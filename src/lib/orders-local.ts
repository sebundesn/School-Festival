import { ClearSummary, Order, OrderItem, OrderStatus } from "@/app/type/Order";
import { DISCOUNT, MAX_ORDER_NUMBER, MENU_ITEMS, NO_FREE_NUMBER, halfPrice } from "@/lib/menu";

// ローカル実装: ブラウザの localStorage に保存する（バックエンド不要）。

const STORAGE_KEY = "yakitori:state:v1";
const LOCK_NAME = "yakitori-state-lock";

interface StoredOrder extends Omit<Order, "createdAt"> {
  createdAt: string | null;
}

interface State {
  orders: StoredOrder[];
  /** 最後に出した整理券番号 */
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

/** 読み取り→更新→書き込みを排他的に行う */
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

/** 到着順（注文を受けた時刻順）。整理券番号は 30 の次が 1 に戻るので番号順では並ばない。 */
function byArrival(a: Order, b: Order) {
  return (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0) || a.orderNumber - b.orderNumber;
}

function sortedOrders(select: (o: Order) => boolean): Order[] {
  return readState()
    .orders.map(toOrder)
    .filter(select)
    .sort(byArrival);
}

/**
 * 注文を登録して整理券番号を返す。
 * 品名・単価・合計はクライアントの値を信用せず、MENU_ITEMS から再計算する。
 * isHalfPrice の場合は全品を半額の単価で記録する。discount は合計から引く（DISCOUNT の倍数で合計以下）。
 * 番号は前回の次から、調理中の注文が使っていないものを選ぶ（30 の次は 1）。
 */
export async function placeOrder(items: OrderItem[], isHalfPrice = false, discount = 0): Promise<number> {
  const normalized: OrderItem[] = [];
  for (const item of items) {
    const menu = MENU_ITEMS.find((m) => m.id === item.menuId);
    const quantity = Math.floor(item.quantity);
    if (!menu || !Number.isFinite(quantity) || quantity <= 0) continue;
    normalized.push({
      menuId: menu.id,
      name: menu.name,
      quantity,
      pricePerOne: isHalfPrice ? halfPrice(menu.pricePerOne) : menu.pricePerOne,
    });
  }
  if (normalized.length === 0) throw new Error("empty order");

  const subtotal = normalized.reduce((sum, i) => sum + i.pricePerOne * i.quantity, 0);
  if (!Number.isInteger(discount) || discount < 0 || discount % DISCOUNT !== 0 || discount > subtotal) {
    throw new Error("bad discount");
  }
  const totalAmount = subtotal - discount;

  return withLock(() => {
    const state = readState();
    const used = new Set(
      state.orders.filter((o) => o.status === "cooking").map((o) => o.orderNumber)
    );
    let orderNumber = 0;
    for (let i = 1; i <= MAX_ORDER_NUMBER; i++) {
      const candidate = ((state.counter + i - 1) % MAX_ORDER_NUMBER) + 1;
      if (!used.has(candidate)) {
        orderNumber = candidate;
        break;
      }
    }
    if (orderNumber === 0) throw new Error(NO_FREE_NUMBER);
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
          ...(discount ? { discount } : {}),
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

/** 調理中の注文 — モニター画面と厨房画面。 */
export function subscribeActiveOrders(callback: (orders: Order[]) => void) {
  return subscribe((o) => o.status === "cooking", callback);
}

/** 取消を含む全注文 — 管理画面・レジの履歴。 */
export function subscribeAllOrders(callback: (orders: Order[]) => void) {
  return subscribe(() => true, callback);
}

export async function setOrderStatus(orderId: string, status: OrderStatus) {
  await withLock(() => {
    const state = readState();
    // 受け渡し完了・取消から戻すとき、番号がほかの注文に使われていたら戻さない
    const target = state.orders.find((o) => o.id === orderId);
    const isActive = (s: OrderStatus) => s === "cooking";
    if (target && !isActive(target.status) && isActive(status)) {
      const taken = state.orders.some(
        (o) => o.id !== orderId && isActive(o.status) && o.orderNumber === target.orderNumber
      );
      if (taken) {
        window.alert("この注文の整理券番号は、ほかの注文が使用中なので戻せません。");
        return;
      }
    }
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

/** 全注文を削除し、削除前の集計（受け渡し完了分）を返す。整理券番号も 0 に戻す。 */
export async function clearAllOrders(): Promise<ClearSummary | null> {
  return withLock(() => {
    const state = readState();
    const summary: ClearSummary = { deleted: state.orders.length, sales: 0, byItem: {} };
    for (const o of state.orders) {
      if (o.status !== "completed") continue;
      summary.sales += o.totalAmount;
      for (const i of o.items) summary.byItem[i.menuId] = (summary.byItem[i.menuId] ?? 0) + i.quantity;
    }
    writeState({ ...state, orders: [], counter: 0 });
    return summary;
  });
}
