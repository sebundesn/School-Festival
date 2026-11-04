import { BatchWriteCommand, DeleteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { db, MENU } from "./common.mjs";

const { ORDERS_TABLE, META_TABLE, STAFF_TOKEN } = process.env;
const STATUSES = ["cooking", "ready", "completed", "cancelled"];
// 調理中・呼出中のあいだは整理券番号を使用中にして、ほかの注文には出さない
const ACTIVE_STATUSES = ["cooking", "ready"];
// 整理券番号は 1〜30 を順に使い、30 の次は 1 に戻る
const MAX_ORDER_NUMBER = 30;
// レジの「-100円」ボタン 1 回分。値引きはこの倍数で、合計を超えない額だけ受け付ける
const DISCOUNT = 100;

const res = (code, body, headers = {}) => ({
  statusCode: code,
  headers: { "content-type": "application/json", ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

export const handler = async (event) => {
  const method = event.requestContext.http.method;
  // $default ルートだと CORS プリフライトもここに届く。ブラウザはトークンを付けずに送るので、認証より先に 2xx を返す
  // （CORS ヘッダーは API Gateway が付ける）
  if (method === "OPTIONS") return { statusCode: 204 };
  if ((event.headers?.["x-staff-token"] ?? "") !== STAFF_TOKEN) return res(401, { error: "unauthorized" });
  const path = event.rawPath;
  const id = path.match(/^\/orders\/([^/]+)$/)?.[1];

  try {
    if (method === "GET" && path === "/menu") {
      return res(200, Object.fromEntries(Object.entries(MENU).map(([k, v]) => [v.name, v.price])));
    }

    if (method === "POST" && path === "/orders") {
      const body = parseBody(event);
      const items = [];
      const half = body.isHalfPrice === true;
      for (const it of body.items ?? []) {
        const m = MENU[it.menuId];
        const qty = Math.floor(Number(it.qty ?? it.quantity));
        if (m && qty > 0) items.push({ menuId: it.menuId, name: m.name, quantity: qty, pricePerOne: half ? Math.floor(m.price / 2) : m.price });
      }
      if (!items.length) return res(400, { error: "empty order" });
      const subtotal = items.reduce((s, i) => s + i.pricePerOne * i.quantity, 0);
      const discount = body.discount ?? 0;
      if (!Number.isInteger(discount) || discount < 0 || discount % DISCOUNT !== 0 || discount > subtotal) {
        return res(400, { error: "bad discount" });
      }
      const totalAmount = subtotal - discount;
      const order = {
        orderId: crypto.randomUUID(), orderNumber: 0, items, totalAmount,
        ...(discount ? { discount } : {}),
        status: "cooking", createdAt: new Date().toISOString(),
      };

      // 前回出した番号の次から空いている番号を探す。番号ごとの slot#<番号> を条件付きで作って押さえるので、
      // 同時会計でも同じ番号は出ない（受け渡し完了・取消で slot を消すまで使用中）。
      // slot ができる前からある調理中・呼出中の注文の番号も避ける。
      const active = (await Promise.all(ACTIVE_STATUSES.map((s) => readAll((k) => new QueryCommand({
        TableName: ORDERS_TABLE, IndexName: "by-status",
        KeyConditionExpression: "#s = :s", ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":s": s }, ExclusiveStartKey: k,
      }))))).flat();
      const used = new Set(active.map((o) => o.orderNumber));
      const last = (await db.send(new GetCommand({ TableName: META_TABLE, Key: { pk: "counter" } }))).Item?.n ?? 0;
      for (let i = 1; i <= MAX_ORDER_NUMBER; i++) {
        const num = ((last + i - 1) % MAX_ORDER_NUMBER) + 1;
        if (used.has(num)) continue;
        order.orderNumber = num;
        try {
          await db.send(new TransactWriteCommand({ TransactItems: [
            { Put: { TableName: META_TABLE, Item: { pk: slotKey(num), orderId: order.orderId }, ConditionExpression: "attribute_not_exists(pk)" } },
            { Put: { TableName: ORDERS_TABLE, Item: order, ConditionExpression: "attribute_not_exists(orderId)" } },
            { Put: { TableName: META_TABLE, Item: { pk: "counter", n: num } } },
          ] }));
          return res(200, order);
        } catch (e) {
          // ほかの会計に先に取られた。次の番号を試す
          if (e.name === "TransactionCanceledException") continue;
          throw e;
        }
      }
      return res(409, { error: "no free number" });
    }

    if (method === "GET" && path === "/orders") {
      const status = event.queryStringParameters?.status;
      const items = status
        ? await readAll((k) => new QueryCommand({
            TableName: ORDERS_TABLE, IndexName: "by-status",
            KeyConditionExpression: "#s = :s", ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: { ":s": status }, ExclusiveStartKey: k,
          }))
        : await readAll((k) => new ScanCommand({ TableName: ORDERS_TABLE, ExclusiveStartKey: k }));
      return res(200, items.sort((a, b) => a.orderNumber - b.orderNumber));
    }

    // 整理券番号を 0 に戻す（注文データ・集計は消さない）
    if (method === "POST" && path === "/counter/reset") {
      await db.send(new PutCommand({ TableName: META_TABLE, Item: { pk: "counter", n: 0 } }));
      return res(200, { ok: true });
    }

    // 全注文の削除（片付け用）。消す前に受け渡し完了分の売上・品目別本数を集計して返す。
    // 集計値と整理券番号も 0 に戻す。他端末には DynamoDB Streams 経由で削除が届く。
    if (method === "POST" && path === "/orders/clear") {
      const all = await readAll((k) => new ScanCommand({ TableName: ORDERS_TABLE, ExclusiveStartKey: k }));
      const summary = { deleted: all.length, sales: 0, byItem: {} };
      for (const o of all) {
        if (o.status !== "completed") continue;
        summary.sales += o.totalAmount;
        for (const i of o.items) summary.byItem[i.menuId] = (summary.byItem[i.menuId] ?? 0) + i.quantity;
      }
      for (let i = 0; i < all.length; i += 25) {
        let requests = all.slice(i, i + 25).map((o) => ({ DeleteRequest: { Key: { orderId: o.orderId } } }));
        while (requests.length) {
          const out = await db.send(new BatchWriteCommand({ RequestItems: { [ORDERS_TABLE]: requests } }));
          requests = out.UnprocessedItems?.[ORDERS_TABLE] ?? [];
        }
      }
      const slots = Array.from({ length: MAX_ORDER_NUMBER }, (_, i) => ({ DeleteRequest: { Key: { pk: slotKey(i + 1) } } }));
      for (let i = 0; i < slots.length; i += 25) {
        let requests = slots.slice(i, i + 25);
        while (requests.length) {
          const out = await db.send(new BatchWriteCommand({ RequestItems: { [META_TABLE]: requests } }));
          requests = out.UnprocessedItems?.[META_TABLE] ?? [];
        }
      }
      await db.send(new DeleteCommand({ TableName: META_TABLE, Key: { pk: "stats" } }));
      await db.send(new PutCommand({ TableName: META_TABLE, Item: { pk: "counter", n: 0 } }));
      return res(200, summary);
    }

    // ステータス変更。会計済み(completed)/取消への遷移は「現在の状態」を条件にして二重処理を防ぎ、
    // 集計値は遷移に成功した1回だけ加算/減算する。
    if (method === "PATCH" && id) {
      const { status } = parseBody(event);
      if (!STATUSES.includes(status)) return res(400, { error: "bad status" });
      const cur = await db.send(new GetCommand({ TableName: ORDERS_TABLE, Key: { orderId: id } }));
      if (!cur.Item) return res(404, { error: "not found" });
      const o = cur.Item;
      const wasCounted = o.status === "completed";
      const willCount = status === "completed";
      const tx = [{
        Update: {
          TableName: ORDERS_TABLE, Key: { orderId: id },
          UpdateExpression: "SET #s = :new", ConditionExpression: "#s = :old",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: { ":new": status, ":old": o.status },
        },
      }];
      if (wasCounted !== willCount) tx.push(statsUpdate(o, willCount ? 1 : -1));
      // 受け渡し完了・取消で番号を空け、そこから調理中・呼出中に戻すときは番号を押さえ直す
      const wasActive = ACTIVE_STATUSES.includes(o.status);
      const willActive = ACTIVE_STATUSES.includes(status);
      const slot = { TableName: META_TABLE, Key: { pk: slotKey(o.orderNumber) } };
      if (wasActive && !willActive) tx.push({ Delete: slot });
      if (!wasActive && willActive) {
        tx.push({
          Put: {
            TableName: META_TABLE, Item: { pk: slotKey(o.orderNumber), orderId: id },
            ConditionExpression: "attribute_not_exists(pk) OR orderId = :id",
            ExpressionAttributeValues: { ":id": id },
          },
        });
      }
      try {
        await db.send(new TransactWriteCommand({ TransactItems: tx }));
      } catch (e) {
        if (e.name === "TransactionCanceledException") {
          // 取り消し理由は TransactItems と同じ順に並ぶ。番号の押さえ直し（最後の項目）で失敗したら番号が使用中
          const reasons = e.CancellationReasons ?? [];
          const numberInUse = !wasActive && willActive && reasons[tx.length - 1]?.Code === "ConditionalCheckFailed";
          return res(409, { error: numberInUse ? "number in use" : "already changed by another terminal" });
        }
        throw e;
      }
      return res(200, { ...o, status });
    }

    if (method === "GET" && path === "/stats") {
      const s = (await db.send(new GetCommand({ TableName: META_TABLE, Key: { pk: "stats" } }))).Item ?? {};
      const byItem = {};
      for (const [k, v] of Object.entries(s)) if (k.startsWith("item_")) byItem[MENU[k.slice(5)]?.name ?? k.slice(5)] = v;
      return res(200, { orders: s.orders ?? 0, sales: s.sales ?? 0, skewers: s.skewers ?? 0, byItem });
    }

    if (method === "GET" && path === "/export.csv") {
      const items = await readAll((k) => new ScanCommand({ TableName: ORDERS_TABLE, ExclusiveStartKey: k }));
      const jst = (iso) => new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false });
      const rows = [["注文ID", "整理券番号", "品物", "本数", "単価", "小計", "ステータス", "注文時刻"]];
      for (const o of items.sort((a, b) => a.orderNumber - b.orderNumber)) {
        for (const i of o.items) rows.push([o.orderId, o.orderNumber, i.name, i.quantity, i.pricePerOne, i.quantity * i.pricePerOne, o.status, jst(o.createdAt)]);
        if (o.discount) rows.push([o.orderId, o.orderNumber, "値引き", 1, -o.discount, -o.discount, o.status, jst(o.createdAt)]);
      }
      const csv = "﻿" + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
      return res(200, csv, { "content-type": "text/csv; charset=utf-8" });
    }

    return res(404, { error: "not found" });
  } catch (e) {
    console.error(e);
    return res(500, { error: "internal" });
  }
};

function slotKey(orderNumber) {
  return `slot#${orderNumber}`;
}

// content-type が JSON 以外だと API Gateway は本文を base64 で渡してくる
function parseBody(event) {
  const raw = event.isBase64Encoded ? Buffer.from(event.body ?? "", "base64").toString("utf8") : event.body;
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

// Scan/Query は 1 回 1MB までなので、続きがあれば最後まで読む。
async function readAll(makeCommand) {
  const items = [];
  let key;
  do {
    const out = await db.send(makeCommand(key));
    items.push(...(out.Items ?? []));
    key = out.LastEvaluatedKey;
  } while (key);
  return items;
}

// 会計済みになる(+1)/会計済みでなくなる(-1)ときの集計加減算。品目別は平坦なキー item_<menuId> で持つ。
function statsUpdate(o, sign) {
  const names = {};
  const vals = {
    ":o": sign,
    ":s": sign * o.totalAmount,
    ":k": sign * o.items.reduce((s, i) => s + i.quantity, 0),
  };
  const parts = o.items.map((i, idx) => {
    names[`#i${idx}`] = `item_${i.menuId}`;
    vals[`:q${idx}`] = sign * i.quantity;
    return `, #i${idx} :q${idx}`;
  });
  return {
    Update: {
      TableName: META_TABLE, Key: { pk: "stats" },
      UpdateExpression: `ADD orders :o, sales :s, skewers :k${parts.join("")}`,
      ExpressionAttributeNames: names, ExpressionAttributeValues: vals,
    },
  };
}
