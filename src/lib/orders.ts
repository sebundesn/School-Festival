import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { Order, OrderItem, OrderStatus } from "@/app/type/Order";

const ORDERS_COLLECTION = "orders";
const COUNTER_PATH = "counters/today";

/**
 * Atomically issues the next order number and creates the order document,
 * so concurrent register submissions can never receive the same number.
 */
export async function placeOrder(items: OrderItem[]): Promise<number> {
  const totalAmount = items.reduce(
    (sum, item) => sum + item.pricePerOne * item.quantity,
    0
  );
  const counterRef = doc(db, COUNTER_PATH);
  const ordersRef = collection(db, ORDERS_COLLECTION);

  return runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const current = counterSnap.exists() ? (counterSnap.data().current as number) : 0;
    const orderNumber = current + 1;

    tx.set(counterRef, { current: orderNumber }, { merge: true });
    tx.set(doc(ordersRef), {
      orderNumber,
      items,
      totalAmount,
      status: "cooking" satisfies OrderStatus,
      createdAt: serverTimestamp(),
    });

    return orderNumber;
  });
}

function toOrders(snapshot: { docs: { id: string; data: () => unknown }[] }): Order[] {
  const orders = snapshot.docs.map(
    (d) => ({ id: d.id, ...(d.data() as object) }) as Order
  );
  orders.sort((a, b) => a.orderNumber - b.orderNumber);
  return orders;
}

/** Orders still in progress (cooking or ready for pickup) — monitor & kitchen screens. */
export function subscribeActiveOrders(callback: (orders: Order[]) => void) {
  const q = query(
    collection(db, ORDERS_COLLECTION),
    where("status", "in", ["cooking", "ready"])
  );
  return onSnapshot(q, (snapshot) => callback(toOrders(snapshot)));
}

/** Every order placed today, regardless of status — admin dashboard. */
export function subscribeAllOrders(callback: (orders: Order[]) => void) {
  return onSnapshot(collection(db, ORDERS_COLLECTION), (snapshot) =>
    callback(toOrders(snapshot))
  );
}

export async function setOrderStatus(orderId: string, status: OrderStatus) {
  await updateDoc(doc(db, ORDERS_COLLECTION, orderId), { status });
}

/** Resets today's order-number counter back to 0 (does not delete any orders). */
export async function resetCounter() {
  await setDoc(doc(db, COUNTER_PATH), { current: 0 }, { merge: true });
}
