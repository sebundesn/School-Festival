import { Order, OrderItem, OrderStatus } from "@/app/type/Order";

// AWS 実装: 書き込み・取得は HTTP API、他端末の変更は WebSocket で受け取る（infra/ を参照）。

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "";
const TOKEN_KEY = "yakitori:staff-token";
const NETWORK_ERROR = "通信に失敗しました。電波状況を確認して、もう一度操作してください。";

interface ApiOrder extends Omit<Order, "id" | "createdAt"> {
  orderId: string;
  createdAt: string | null;
}

const orders = new Map<string, Order>();
const listeners = new Set<() => void>();
let socket: WebSocket | null = null;
let retryCount = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

// ---------- スタッフ用トークン ----------
// ビルドに埋め込むと配信ページから誰でも読めてしまうので、端末ごとに一度だけ入力して保存する。
// `?token=xxx` 付きの URL で開いても保存できる（QR コード配布用）。

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getToken(): string {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("token");
  if (fromUrl) {
    storage()?.setItem(TOKEN_KEY, fromUrl);
    params.delete("token");
    const query = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : ""));
    return fromUrl;
  }
  let token = storage()?.getItem(TOKEN_KEY) ?? "";
  if (!token) {
    token = window.prompt("スタッフ用トークンを入力してください")?.trim() ?? "";
    if (token) storage()?.setItem(TOKEN_KEY, token);
  }
  return token;
}

function clearToken() {
  storage()?.removeItem(TOKEN_KEY);
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(API_URL + path, {
    ...init,
    headers: { "content-type": "application/json", "x-staff-token": getToken(), ...init.headers },
  });
  // トークン違い。次の通信で入力し直してもらう
  if (res.status === 401) clearToken();
  return res;
}

// ---------- 端末内のキャッシュ ----------

function toOrder({ orderId, createdAt, ...rest }: ApiOrder): Order {
  return { ...rest, id: orderId, createdAt: createdAt ? new Date(createdAt) : null };
}

function upsert(order: ApiOrder) {
  orders.set(order.orderId, toOrder(order));
  notify();
}

function notify() {
  listeners.forEach((listener) => listener());
}

/** 全件を取り直す。接続直後と再接続時に呼び、切断中に取りこぼした変更を埋める。 */
async function refresh() {
  try {
    const res = await request("/orders");
    if (!res.ok) return;
    const list = (await res.json()) as ApiOrder[];
    orders.clear();
    list.forEach((o) => orders.set(o.orderId, toOrder(o)));
    notify();
  } catch {
    // 次の再接続で取り直す
  }
}

// ---------- WebSocket（自動再接続） ----------
// API Gateway は 10 分無通信・最長 2 時間で切断するので、切れたら取り直しつつ繋ぎ直す。

function connect() {
  if (socket || typeof window === "undefined") return;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  const token = getToken();
  if (!token) {
    scheduleReconnect();
    return;
  }
  const role = window.location.pathname.replace(/^\/|\.html$|\/$/g, "") || "monitor";
  const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}&role=${encodeURIComponent(role)}`);
  socket = ws;
  ws.onopen = () => {
    retryCount = 0;
    refresh();
  };
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === "order" && msg.order?.orderId) upsert(msg.order);
    } catch {
      // 不正なメッセージは無視
    }
  };
  ws.onclose = () => {
    if (socket === ws) socket = null;
    scheduleReconnect();
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = Math.min(30_000, 1000 * 2 ** retryCount);
  retryCount += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

if (typeof window !== "undefined") {
  // スリープ復帰・回線復帰時はすぐに繋ぎ直す
  const wake = () => {
    if (document.visibilityState !== "visible") return;
    retryCount = 0;
    if (socket?.readyState === WebSocket.OPEN) refresh();
    else connect();
  };
  document.addEventListener("visibilitychange", wake);
  window.addEventListener("online", wake);
}

function sortedOrders(select: (o: Order) => boolean): Order[] {
  return [...orders.values()].filter(select).sort((a, b) => a.orderNumber - b.orderNumber);
}

function subscribe(select: (o: Order) => boolean, callback: (orders: Order[]) => void) {
  const emit = () => callback(sortedOrders(select));
  listeners.add(emit);
  emit();
  connect();
  return () => {
    listeners.delete(emit);
  };
}

// ---------- 公開 API（orders-local.ts と同じ形） ----------

/** 注文を登録して整理券番号を返す。単価・合計はサーバー側で計算される。 */
export async function placeOrder(items: OrderItem[], isHalfPrice = false): Promise<number> {
  const res = await request("/orders", {
    method: "POST",
    body: JSON.stringify({
      items: items.map((i) => ({ menuId: i.menuId, quantity: i.quantity })),
      isHalfPrice,
    }),
  });
  if (!res.ok) throw new Error(`placeOrder failed: ${res.status}`);
  const order = (await res.json()) as ApiOrder;
  upsert(order);
  return order.orderNumber;
}

export function subscribeActiveOrders(callback: (orders: Order[]) => void) {
  return subscribe((o) => o.status === "cooking" || o.status === "ready", callback);
}

export function subscribeAllOrders(callback: (orders: Order[]) => void) {
  return subscribe(() => true, callback);
}

/**
 * ステータス変更。他の端末が先に変えていた場合(409)は最新の状態を取り直すだけにする。
 * 通信失敗は画面側で扱っていないので、ここで知らせる。
 */
export async function setOrderStatus(orderId: string, status: OrderStatus) {
  try {
    const res = await request(`/orders/${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    if (res.status === 409) {
      await refresh();
      return;
    }
    if (!res.ok) throw new Error(`setOrderStatus failed: ${res.status}`);
    upsert((await res.json()) as ApiOrder);
  } catch {
    window.alert(NETWORK_ERROR);
  }
}

export async function cancelOrder(orderId: string) {
  await setOrderStatus(orderId, "cancelled");
}

export async function resetCounter() {
  try {
    const res = await request("/counter/reset", { method: "POST" });
    if (!res.ok) throw new Error(`resetCounter failed: ${res.status}`);
  } catch {
    window.alert(NETWORK_ERROR);
  }
}
