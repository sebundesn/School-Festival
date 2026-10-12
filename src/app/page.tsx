"use client";

import { useEffect, useState } from "react";
import { Order } from "./type/Order";
import { subscribeActiveOrders } from "@/lib/orders";

function formatOrderNumber(orderNumber: number) {
  return `${String(orderNumber).padStart(3, "0")}`;
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
    <main className="min-h-screen bg-white text-neutral-900 p-8 grid grid-cols-2 gap-8">
      <section className="flex-1 flex flex-col gap-6">
        <h2 className="mt-5 text-3xl md:text-4xl font-bold flex items-center gap-3 text-orange-600">
          <span>🔥</span> 調理中 (COOKING)
        </h2>

        <div className="flex flex-wrap gap-4">
          {cookingOrders.length === 0 && (
            <p className="text-neutral-400 text-xl">現在調理中の注文はありません</p>
          )}
          {cookingOrders.map((order) => (
            <div
              key={order.id}
              className="min-w-32 rounded-2xl bg-neutral-100 border border-neutral-300 px-6 py-5 text-center"
            >
              <p className="text-4xl md:text-5xl font-mono font-bold tabular-nums">
                {formatOrderNumber(order.orderNumber)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex-1 flex flex-col gap-6 border-l-4 border-dashed border-neutral-300 pl-8">
        <h2 className="mt-5 text-3xl md:text-4xl font-bold flex items-center gap-3 text-emerald-700">
          <span>🔔</span> お渡し可能 (READY)
        </h2>

        <div className="flex flex-wrap gap-4">
          {readyOrders.length === 0 && (
            <p className="text-neutral-400 text-xl">呼び出し中の注文はありません</p>
          )}
          {readyOrders.map((order) => (
            <div
              key={order.id}
              className="min-w-32 rounded-2xl bg-emerald-100 border-2 border-emerald-500 px-6 py-5 text-center animate-pulse"
            >
              <p className="text-4xl md:text-5xl font-mono font-bold tabular-nums text-emerald-800">
                {formatOrderNumber(order.orderNumber)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
