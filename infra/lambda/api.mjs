import { GetCommand, PutCommand, QueryCommand, ScanCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { db, MENU } from "./common.mjs";

const { ORDERS_TABLE, META_TABLE, STAFF_TOKEN } = process.env;
const STATUSES = ["cooking", "ready", "completed", "cancelled"];

const res = (code, body, headers = {}) => ({
  statusCode: code,
  headers: { "content-type": "application/json", ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

export const handler = async (event) => {
  if ((event.headers?.["x-staff-token"] ?? "") !== STAFF_TOKEN) return res(401, { error: "unauthorized" });
  const method = event.requestContext.http.method;
  const path = event.rawPath;
  const id = path.match(/^\/orders\/([^/]+)$/)?.[1];

  try {
    if (method === "GET" && path === "/menu") {
      return res(200, Object.fromEntries(Object.entries(MENU).map(([k, v]) => [v.name, v.price])));
    }

    if (method === "POST" && path === "/orders") {
      const body = JSON.parse(event.body ?? "{}");
      const items = [];
      const half = body.isHalfPrice === true;
      for (const it of body.items ?? []) {
        const m = MENU[it.menuId];
        const qty = Math.floor(Number(it.qty ?? it.quantity));
        if (m && qty > 0) items.push({ menuId: it.menuId, name: m.name, quantity: qty, pricePerOne: half ? Math.floor(m.price / 2) : m.price });
      }
      if (!items.length) return res(400, { error: "empty order" });
      const totalAmount = items.reduce((s, i) => s + i.pricePerOne * i.quantity, 0);

      // 採番はアトミックカウンタ。同時会計でも番号は必ず別々になる。
      const c = await db.send(new UpdateCommand({
        TableName: META_TABLE, Key: { pk: "counter" },
        UpdateExpression: "ADD #n :one", ExpressionAttributeNames: { "#n": "n" },
        ExpressionAttributeValues: { ":one": 1 }, ReturnValues: "UPDATED_NEW",
      }));
      const order = {
        orderId: crypto.randomUUID(), orderNumber: c.Attributes.n, items, totalAmount,
        status: "cooking", createdAt: new Date().toISOString(),
      };
      await db.send(new PutCommand({ TableName: ORDERS_TABLE, Item: order, ConditionExpression: "attribute_not_exists(orderId)" }));
      return res(200, order);
    }

    if (method === "GET" && path === "/orders") {
      const status = event.queryStringParameters?.status;
      const out = status
        ? await db.send(new QueryCommand({
            TableName: ORDERS_TABLE, IndexName: "by-status",
            KeyConditionExpression: "#s = :s", ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: { ":s": status },
          }))
        : await db.send(new ScanCommand({ TableName: ORDERS_TABLE }));
      return res(200, (out.Items ?? []).sort((a, b) => a.orderNumber - b.orderNumber));
    }

    // ステータス変更。会計済み(completed)/取消への遷移は「現在の状態」を条件にして二重処理を防ぎ、
    // 集計値は遷移に成功した1回だけ加算/減算する。
    if (method === "PATCH" && id) {
      const { status } = JSON.parse(event.body ?? "{}");
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
      try {
        await db.send(new TransactWriteCommand({ TransactItems: tx }));
      } catch (e) {
        if (e.name === "TransactionCanceledException") return res(409, { error: "already changed by another terminal" });
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
      const items = (await db.send(new ScanCommand({ TableName: ORDERS_TABLE }))).Items ?? [];
      const jst = (iso) => new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false });
      const rows = [["注文ID", "整理券番号", "品物", "本数", "単価", "小計", "ステータス", "注文時刻"]];
      for (const o of items.sort((a, b) => a.orderNumber - b.orderNumber))
        for (const i of o.items) rows.push([o.orderId, o.orderNumber, i.name, i.quantity, i.pricePerOne, i.quantity * i.pricePerOne, o.status, jst(o.createdAt)]);
      const csv = "﻿" + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
      return res(200, csv, { "content-type": "text/csv; charset=utf-8" });
    }

    return res(404, { error: "not found" });
  } catch (e) {
    console.error(e);
    return res(500, { error: "internal" });
  }
};

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
