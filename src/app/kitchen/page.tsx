"use client";

import { useEffect, useState } from "react";
import { Order } from "../type/Order";
import { subscribeActiveOrders, setOrderStatus } from "@/lib/orders";

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeActiveOrders(setOrders);
    return unsubscribe;
  }, []);

  async function toReady(order: Order) {
    await setOrderStatus(order.id, "ready");
  }

  async function backToCooking(order: Order) {
    await setOrderStatus(order.id, "cooking");
  }

  const cookingOrders = orders.filter((order) => order.status === "cooking");
  const readyOrders = orders.filter((order) => order.status === "ready");

  return (
    <main className="h-[calc(100dvh-3rem)] overflow-hidden bg-neutral-100 p-2 sm:p-4 lg:p-6 flex flex-col gap-2 sm:gap-3 lg:gap-6">
      {/* スマホ・タブレットは上下分割、PC は左右分割。カードの大きさは画面幅ごとに固定（件数で動かない） */}
      <div className="flex-1 min-h-0 grid grid-rows-[minmax(0,3fr)_minmax(0,2fr)] lg:grid-rows-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-2 sm:gap-3 lg:gap-6">
        <section className="flex flex-col gap-2 lg:gap-3 min-h-0 rounded-2xl bg-orange-50 border-2 border-orange-200 p-2 sm:p-3 lg:p-4">
          <SectionHeading className="text-orange-600" label="🔥 調理中" count={cookingOrders.length} />
          {cookingOrders.length === 0 ? (
            <EmptyState className="text-orange-600" />
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 content-start">
              {cookingOrders.map((order) => (
                <OrderCard key={order.id} order={order} onAdvance={toReady} />
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-2 lg:gap-3 min-h-0 rounded-2xl bg-emerald-50 border-2 border-emerald-200 p-2 sm:p-3 lg:p-4">
          <SectionHeading className="text-emerald-600" label="🔔 呼出中" count={readyOrders.length} />
          {readyOrders.length === 0 ? (
            <EmptyState className="text-emerald-600" />
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3 content-start">
              {readyOrders.map((order) => (
                <ReadyTile key={order.id} order={order} onBack={backToCooking} />
              ))}
            </div>
          )}
        </section>
      </div>

    </main>
  );
}

function formatNumber(orderNumber: number) {
  return String(orderNumber).padStart(3, "0");
}

function SectionHeading({ label, count, className }: { label: string; count: number; className: string }) {
  return (
    <h2 className={`flex items-baseline justify-between text-base sm:text-2xl lg:text-4xl font-semibold ${className}`}>
      <span>{label}</span>
      <span className="text-sm sm:text-lg lg:text-2xl tabular-nums">{count}件</span>
    </h2>
  );
}

function EmptyState({ className }: { className: string }) {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center">
      <p className={`font-bold text-xl sm:text-4xl lg:text-5xl text-center ${className}`}>No 注文</p>
    </div>
  );
}

// カードの隅に添える小さい注文番号（厨房カード・呼出中タイルで同じサイズ）
function OrderNumberBadge({ orderNumber }: { orderNumber: number }) {
  return (
    <span className="shrink-0 font-mono font-semibold tabular-nums leading-none text-neutral-500 text-xs sm:text-sm lg:text-base">
      {formatNumber(orderNumber)}
    </span>
  );
}

// ボタンはカードの右下に固定（下余白 pb でボタンの高さ分を空けておく）
// 文字サイズは スマホ / タブレット(sm) / PC(lg) の 3 段階で固定
function OrderCard({ order, onAdvance }: { order: Order; onAdvance: (order: Order) => void }) {
  return (
    <div className="relative rounded-xl bg-white border border-neutral-300 p-2 sm:p-3 pb-9 sm:pb-11 lg:pb-12">
      <div className="flex items-start gap-2">
        <ul className="flex-1 text-center font-bold leading-tight text-neutral-900 text-sm sm:text-lg lg:text-xl">
          {order.items.map((item) => (
            <li key={item.menuId} className="whitespace-nowrap">
              {item.name}×{item.quantity}
            </li>
          ))}
        </ul>
        <OrderNumberBadge orderNumber={order.orderNumber} />
      </div>
      <button
        type="button"
        onClick={() => onAdvance(order)}
        className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 rounded-lg bg-emerald-600 text-white font-bold whitespace-nowrap text-xs sm:text-sm lg:text-base px-2.5 py-1 sm:px-3 active:opacity-80"
      >
        呼出中に
      </button>
    </div>
  );
}

function ReadyTile({ order, onBack }: { order: Order; onBack: (order: Order) => void }) {
  return (
    <div className="relative rounded-xl bg-white border-2 border-emerald-300 p-1.5 sm:p-2 pb-9 sm:pb-10 lg:pb-11">
      <div className="flex items-start gap-1.5">
        <ul className="flex-1 text-center font-semibold leading-tight text-neutral-600 text-xs sm:text-sm lg:text-base">
          {order.items.map((item) => (
            <li key={item.menuId} className="whitespace-nowrap">
              {item.name}×{item.quantity}
            </li>
          ))}
        </ul>
        <OrderNumberBadge orderNumber={order.orderNumber} />
      </div>
      <button
        type="button"
        onClick={() => onBack(order)}
        className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 rounded-lg bg-orange-100 text-orange-700 font-bold whitespace-nowrap text-xs sm:text-sm lg:text-base px-2.5 py-1 sm:px-3 active:bg-orange-200"
      >
        戻す
      </button>
    </div>
  );
}
