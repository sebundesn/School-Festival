"use client";

import { useEffect, useRef, useState } from "react";
import { Order, OrderStatus } from "../type/Order";
import { subscribeActiveOrders, setOrderStatus } from "@/lib/orders";

const UNDO_WINDOW_MS = 5000;

interface PendingUndo {
  orderId: string;
  orderNumber: number;
  previousStatus: OrderStatus;
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeActiveOrders(setOrders);
    return unsubscribe;
  }, []);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  function armUndo(order: Order) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setPendingUndo({
      orderId: order.id,
      orderNumber: order.orderNumber,
      previousStatus: order.status,
    });
    undoTimer.current = setTimeout(() => setPendingUndo(null), UNDO_WINDOW_MS);
  }

  async function advanceStatus(order: Order) {
    const nextStatus: OrderStatus = order.status === "cooking" ? "ready" : "completed";
    armUndo(order);
    await setOrderStatus(order.id, nextStatus);
  }

  async function handleUndo() {
    if (!pendingUndo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    await setOrderStatus(pendingUndo.orderId, pendingUndo.previousStatus);
    setPendingUndo(null);
  }

  const cookingOrders = orders.filter((order) => order.status === "cooking");
  const readyOrders = orders.filter((order) => order.status === "ready");

  return (
    <main className="h-screen overflow-hidden bg-neutral-100 p-6 flex flex-col gap-6">
      <h1 className="text-5xl font-bold text-center">厨房</h1>

      <div className="grid grid-cols-1 md:grid-cols-[repeat(13,minmax(0,1fr))] gap-6 flex-1 min-h-0">
        <section className="md:col-span-9 flex flex-col gap-3 min-h-0 rounded-2xl bg-orange-50 border-2 border-orange-200 p-4">
          <h2 className="text-4xl font-semibold text-orange-600">🔥 調理中</h2>
          <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-3 content-start">
            {cookingOrders.length === 0 && (
              <div className="col-span-full flex items-center justify-center min-h-[40vh]">
                <p className="font-bold text-5xl text-orange-600 text-center">No 注文</p>
              </div>
            )}
            {cookingOrders.map((order) => (
              <OrderCard key={order.id} order={order} onAdvance={advanceStatus} />
            ))}
          </div>
        </section>

        <section className="md:col-span-4 flex flex-col gap-3 min-h-0 rounded-2xl bg-emerald-50 border-2 border-emerald-200 p-4">
          <h2 className="text-4xl font-semibold text-emerald-600">🔔 呼出中</h2>
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
            {readyOrders.length === 0 && (
              <div className="flex-1 flex items-center justify-center">
                <p className="font-bold text-5xl text-emerald-600 text-center">No 注文</p>
              </div>
            )}
            {readyOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        </section>
      </div>

      {pendingUndo && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-neutral-900 text-white px-5 py-3 flex items-center gap-4 shadow-lg">
          <span>
            {String(pendingUndo.orderNumber).padStart(3, "0")} を更新しました
          </span>
          <button
            type="button"
            onClick={handleUndo}
            className="rounded-lg bg-white text-neutral-900 font-bold px-4 py-2"
          >
            取り消す
          </button>
        </div>
      )}
    </main>
  );
}

function OrderCard({
  order,
  onAdvance,
}: {
  order: Order;
  onAdvance?: (order: Order) => void;
}) {
  return (
    <div className="rounded-xl bg-white border border-neutral-300 px-5 py-4 flex flex-col gap-2">
      <p className="font-mono font-bold text-2xl tabular-nums">
        {String(order.orderNumber).padStart(3, "0")}
      </p>
      <div className="flex items-center justify-between gap-4">
        <ul className="flex-1 text-center text-xl font-bold text-neutral-900">
          {order.items.map((item) => (
            <li key={item.menuId}>
              {item.name} × {item.quantity}
            </li>
          ))}
        </ul>
        {onAdvance && (
          <button
            type="button"
            onClick={() => onAdvance(order)}
            className="rounded-xl bg-emerald-600 text-white font-bold px-5 py-3 active:opacity-80"
          >
            呼出中にする
          </button>
        )}
      </div>
    </div>
  );
}
