import { Order, OrderItem, OrderStatus } from "@/app/type/Order";
import { MENU_ITEMS } from "@/lib/menu";

// ローカル実装: ブラウザの localStorage に保存する（バックエンド不要）。
// 同一ブラウザ内なら /register /kitchen / /admin のタブ間で `storage` イベント経由で同期される。
// 別端末間の共有が必要になったら、このファイルの中身だけを API 呼び出しに差し替える（infra/ 参照）。

const STORAGE_KEY = "yakitori:state:v1";
const LOCK_NAME = "yakitori-state-lock";

interface StoredOrder extends Omit<Order, "createdAt"> {
  createdAt: string | null;
}

interface State {
  orders: StoredOrder[];
  counter: number;
  nextId: number;
}

const EMPTY_STATE: State = { orders: [], counter: 0, nextId: 1 };

const listeners = new Set<() => void>();
// ストレージが使えない環境（プライベートモード等）用のメモリ上フォールバック
let memoryState: State = { ...EMPTY_STATE };

function readState(): State {
  if (typeof window === "undefined") return memoryState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_STATE };
    return { ...EMPTY_STATE, ...(JSON.parse(raw) as Partial<State>) };
  } catch {
    return memoryState;
  }
}

function writeState(state: State) {
  memoryState = state;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 容量超過などはメモリ保持のみで継続
    }
  }
  notify();
}

/** 読み取り→更新→書き込みを排他的に行う（複数タブからの同時操作で番号が被らないように）。 */
async function withLock<T>(fn: () => T): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(LOCK_NAME, async () => fn());
  }
  return fn();
}

function notify() {
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY || e.key === null) notify();
  });
}

function toOrder(o: StoredOrder): Order {
  return { ...o, createdAt: o.createdAt ? new Date(o.createdAt) : null };
}

function sortedOrders(select: (o: Order) => boolean): Order[] {
  return readState()
    .orders.map(toOrder)
    .filter(select)
    .sort((a, b) => a.orderNumber - b.orderNumber);
}

/**
 * 注文を登録して整理券番号を返す。
 * 品名・単価・合計はクライアントの値を信用せず、MENU_ITEMS から再計算する。
 */
export async function placeOrder(items: OrderItem[]): Promise<number> {
  const normalized: OrderItem[] = [];
  for (const item of items) {
    const menu = MENU_ITEMS.find((m) => m.id === item.menuId);
    const quantity = Math.floor(item.quantity);
    if (!menu || !Number.isFinite(quantity) || quantity <= 0) continue;
    normalized.push({
      menuId: menu.id,
      name: menu.name,
      quantity,
      pricePerOne: menu.pricePerOne,
    });
  }
  if (normalized.length === 0) throw new Error("empty order");

  const totalAmount = normalized.reduce((sum, i) => sum + i.pricePerOne * i.quantity, 0);

  return withLock(() => {
    const state = readState();
    const orderNumber = state.counter + 1;
    writeState({
      counter: orderNumber,
      nextId: state.nextId + 1,
      orders: [
        ...state.orders,
        {
          id: String(state.nextId),
          orderNumber,
          items: normalized,
          totalAmount,
          status: "cooking",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    return orderNumber;
  });
}

function subscribe(select: (o: Order) => boolean, callback: (orders: Order[]) => void) {
  const emit = () => callback(sortedOrders(select));
  listeners.add(emit);
  emit();
  return () => {
    listeners.delete(emit);
  };
}

/** 調理中・お渡し可能の注文 — モニター画面と厨房画面。 */
export function subscribeActiveOrders(callback: (orders: Order[]) => void) {
  return subscribe((o) => o.status === "cooking" || o.status === "ready", callback);
}

/** 取消を含む全注文 — 管理画面・レジの履歴。 */
export function subscribeAllOrders(callback: (orders: Order[]) => void) {
  return subscribe(() => true, callback);
}

export async function setOrderStatus(orderId: string, status: OrderStatus) {
  await withLock(() => {
    const state = readState();
    writeState({
      ...state,
      orders: state.orders.map((o) => (o.id === orderId ? { ...o, status } : o)),
    });
  });
}

/** 会計ミスなどの取消。集計からは除外される（番号は欠番になる）。 */
export async function cancelOrder(orderId: string) {
  await setOrderStatus(orderId, "cancelled");
}

/** 整理券番号を 0 に戻す（注文データは消さない）。 */
export async function resetCounter() {
  await withLock(() => writeState({ ...readState(), counter: 0 }));
}

/** 全注文を 1 品目 1 行の CSV にする（取消済みも含む）。 */
export function buildCsv(orders: Order[]): string {
  const header = ["注文ID", "整理券番号", "品物", "本数", "単価", "小計", "ステータス", "注文時刻"];
  const fmt = (d: Date | null) =>
    d ? d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false }) : "";
  const rows = orders.flatMap((o) =>
    o.items.map((i) => [
      o.id,
      o.orderNumber,
      i.name,
      i.quantity,
      i.pricePerOne,
      i.pricePerOne * i.quantity,
      o.status,
      fmt(o.createdAt),
    ])
  );
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return "﻿" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
}
