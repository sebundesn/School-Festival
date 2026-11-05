"use client";

import { useEffect, useState } from "react";
import { Order } from "./type/Order";
import { subscribeActiveOrders } from "@/lib/orders";
import { useNewIds, useNotificationSound } from "@/lib/useNotificationSound";
import SoundOffNotice from "./components/SoundOffNotice";

// 調理中・受け取り可能がどちらも空のまま、この時間が過ぎたらスライドショーを流す
const SLIDESHOW_DELAY_MS = 15_000;

function formatOrderNumber(orderNumber: number) {
  return `${String(orderNumber).padStart(3, "0")}`;
}

export default function MainPage() {
  const [cookingOrders, setCookingOrders] = useState<Order[]>([]);
  const [readyOrders, setReadyOrders] = useState<Order[]>([]);
  const [idleTimeUp, setIdleTimeUp] = useState(false);
  const readySound = useNotificationSound("/ani_ge_neko02.mp3");
  const playReadySound = readySound.play;
  const findNewReady = useNewIds();

  useEffect(() => {
    const unsubscribe = subscribeActiveOrders((orders) => {
      const cooking = orders.filter((order) => order.status === "cooking");
      const ready = orders.filter((order) => order.status === "ready");
      setCookingOrders(cooking);
      setReadyOrders(ready);
      // 注文が出てきたらスライドショーを閉じ、次に空になったら 15 秒数え直す
      if (cooking.length > 0 || ready.length > 0) setIdleTimeUp(false);
      if (findNewReady(ready.map((order) => order.id)).length > 0) playReadySound();
    });
    return unsubscribe;
  }, [findNewReady, playReadySound]);

  const isEmpty = cookingOrders.length === 0 && readyOrders.length === 0;

  const showSlideshow = isEmpty && idleTimeUp;

  useEffect(() => {
    if (!isEmpty) return;
    const timer = setTimeout(() => setIdleTimeUp(true), SLIDESHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isEmpty]);

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
              className="min-w-32 rounded-2xl bg-emerald-100 border-2 border-emerald-500 px-6 py-5 text-center"
            >
              <p className="text-4xl md:text-5xl font-mono font-bold tabular-nums text-emerald-800">
                {formatOrderNumber(order.orderNumber)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {showSlideshow && (
        <video
          src="/wangel-slideshow.mp4"
          autoPlay
          muted
          loop
          playsInline
          className="fixed inset-0 z-40 h-full w-full bg-black object-contain"
        />
      )}

      {!readySound.enabled && <SoundOffNotice />}
    </main>
  );
}
