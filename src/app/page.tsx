"use client";

import { useEffect, useState } from "react";
import { Order } from "./type/Order";
import { subscribeActiveOrders } from "@/lib/orders";

function formatOrderNumber(orderNumber: number) {
  return `#${String(orderNumber).padStart(3, "0")}`;
}

export default function MainPage() {
  const [cookingOrders, setCookingOrders] = useState<Order[]>([]);
  const [readyOrders, setReadyOrders] = useState<Order[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeActiveOrders((orders) => {
      setCookingOrders(orders.filter((order) => order.status === "cooking"));
      setReadyOrders(orders.filter((order) => order.status === "ready"));
    });
    return unsubscribe;
  }, []);

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-8 flex flex-col gap-10">
      <section className="flex-1 flex flex-col gap-6">
        <h2 className="text-3xl md:text-4xl font-bold flex items-center gap-3 text-orange-300">
          <span>🔥</span> 調理中 (COOKING)
        </h2>

        <div className="flex flex-wrap gap-4">
          {cookingOrders.length === 0 && (
            <p className="text-neutral-500 text-xl">現在調理中の注文はありません</p>
          )}
          {cookingOrders.map((order) => (
            <div
              key={order.id}
              className="min-w-32 rounded-2xl bg-neutral-800 border border-neutral-700 px-6 py-5 text-center"
            >
              <p className="text-4xl md:text-5xl font-mono font-bold tabular-nums">
                {formatOrderNumber(order.orderNumber)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex-1 flex flex-col gap-6">
        <h2 className="text-3xl md:text-4xl font-bold flex items-center gap-3 text-emerald-300">
          <span>🔔</span> お渡し可能 (READY)
        </h2>

        <div className="flex flex-wrap gap-4">
          {readyOrders.length === 0 && (
            <p className="text-neutral-500 text-xl">呼び出し中の注文はありません</p>
          )}
          {readyOrders.map((order) => (
            <div
              key={order.id}
              className="min-w-32 rounded-2xl bg-emerald-900/60 border-2 border-emerald-400 px-6 py-5 text-center animate-pulse"
            >
              <p className="text-4xl md:text-5xl font-mono font-bold tabular-nums text-emerald-200">
                {formatOrderNumber(order.orderNumber)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
