import { Order, OrderItem, OrderStatus } from "@/app/type/Order";

// TODO: データベース/インフラ未定のため、仮にメモリ上で保持している。
// ページをリロードすると消え、画面（タブ）間でも共有されない。
let orders: Order[] = [];
let counter = 0;
let nextId = 1;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function sorted(list: Order[]): Order[] {
  return [...list].sort((a, b) => a.orderNumber - b.orderNumber);
}

export async function placeOrder(items: OrderItem[]): Promise<number> {
  const totalAmount = items.reduce(
    (sum, item) => sum + item.pricePerOne * item.quantity,
    0
  );
  counter += 1;
  orders = [
    ...orders,
    {
      id: String(nextId++),
      orderNumber: counter,
      items,
      totalAmount,
      status: "cooking",
      createdAt: new Date(),
    },
  ];
  notify();
  return counter;
}

function subscribe(select: () => Order[], callback: (orders: Order[]) => void) {
  const emit = () => callback(sorted(select()));
  listeners.add(emit);
  emit();
  return () => {
    listeners.delete(emit);
  };
}

/** Orders still in progress (cooking or ready for pickup) — monitor & kitchen screens. */
export function subscribeActiveOrders(callback: (orders: Order[]) => void) {
  return subscribe(
    () => orders.filter((o) => o.status === "cooking" || o.status === "ready"),
    callback
  );
}

/** Every order placed today, regardless of status — admin dashboard. */
export function subscribeAllOrders(callback: (orders: Order[]) => void) {
  return subscribe(() => orders, callback);
}

export async function setOrderStatus(orderId: string, status: OrderStatus) {
  orders = orders.map((o) => (o.id === orderId ? { ...o, status } : o));
  notify();
}

/** Resets the order-number counter back to 0 (does not delete any orders). */
export async function resetCounter() {
  counter = 0;
  notify();
}
