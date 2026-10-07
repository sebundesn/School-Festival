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
    <main className="min-h-screen bg-neutral-100 p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">厨房・ステータス管理</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold text-orange-600">🔥 調理中</h2>
          {cookingOrders.length === 0 && (
            <p className="text-neutral-400">調理中の注文はありません</p>
          )}
          {cookingOrders.map((order) => (
            <OrderCard key={order.id} order={order} onAdvance={advanceStatus} />
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold text-emerald-600">🔔 呼出中</h2>
          {readyOrders.length === 0 && (
            <p className="text-neutral-400">呼出中の注文はありません</p>
          )}
          {readyOrders.map((order) => (
            <OrderCard key={order.id} order={order} onAdvance={advanceStatus} />
          ))}
        </section>
      </div>

      {pendingUndo && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-neutral-900 text-white px-5 py-3 flex items-center gap-4 shadow-lg">
          <span>
            #{String(pendingUndo.orderNumber).padStart(3, "0")} を更新しました
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
  onAdvance: (order: Order) => void;
}) {
  const isCooking = order.status === "cooking";

  return (
    <div className="rounded-xl bg-white border border-neutral-300 px-5 py-4 flex items-center justify-between gap-4">
      <div>
        <p className="font-mono font-bold text-2xl tabular-nums">
          #{String(order.orderNumber).padStart(3, "0")}
        </p>
        <ul className="text-neutral-600">
          {order.items.map((item) => (
            <li key={item.menuId}>
              {item.name} × {item.quantity}
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={() => onAdvance(order)}
        className={`rounded-xl text-white font-bold px-5 py-3 active:opacity-80 ${
          isCooking ? "bg-emerald-600" : "bg-blue-600"
        }`}
      >
        {isCooking ? "呼出中にする" : "受け渡し完了"}
      </button>
    </div>
  );
}
