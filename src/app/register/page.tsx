"use client";

import { useEffect, useState } from "react";
import { Order, OrderItem } from "../type/Order";
import { MENU_ITEMS, halfPrice } from "@/lib/menu";
import { placeOrder, cancelOrder, setOrderStatus, subscribeAllOrders } from "@/lib/orders";

function buildInitialCart(): Record<string, number> {
  return Object.fromEntries(MENU_ITEMS.map((item) => [item.id, 0]));
}

export default function RegisterPage() {
  const [quantities, setQuantities] = useState<Record<string, number>>(buildInitialCart);
  const [isHalfPrice, setIsHalfPrice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState<number | null>(null);
  const [noticeKey, setNoticeKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [readyOrders, setReadyOrders] = useState<Order[]>([]);

  useEffect(() => {
    return subscribeAllOrders((orders) => {
      // 受け取り完了した注文は取消対象から外す
      setRecentOrders(orders.filter((order) => order.status !== "completed").slice(-5).reverse());
      setReadyOrders(orders.filter((order) => order.status === "ready"));
    });
  }, []);

  useEffect(() => {
    if (lastOrderNumber === null) return;
    const timer = setTimeout(() => setLastOrderNumber(null), 4000);
    return () => clearTimeout(timer);
  }, [lastOrderNumber, noticeKey]);

  async function handleComplete(order: Order) {
    await setOrderStatus(order.id, "completed");
  }

  async function handleCancel(order: Order) {
    const label = `#${String(order.orderNumber).padStart(3, "0")}`;
    if (!window.confirm(`${label} の注文を取り消します。よろしいですか？`)) return;
    await cancelOrder(order.id);
  }

  const cart: OrderItem[] = MENU_ITEMS.filter((item) => quantities[item.id] > 0).map(
    (item) => ({
      menuId: item.id,
      name: item.name,
      quantity: quantities[item.id],
      pricePerOne: isHalfPrice ? halfPrice(item.pricePerOne) : item.pricePerOne,
    })
  );

  const totalAmount = cart.reduce((sum, item) => sum + item.pricePerOne * item.quantity, 0);
  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function updateQuantity(menuId: string, delta: number) {
    setQuantities((prev) => ({
      ...prev,
      [menuId]: Math.max(0, prev[menuId] + delta),
    }));
  }

  function handleClear() {
    setQuantities(buildInitialCart());
    setIsHalfPrice(false);
  }

  async function handleCheckout() {
    if (isSubmitting || cart.length === 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const orderNumber = await placeOrder(cart, isHalfPrice);
      setLastOrderNumber(orderNumber);
      setNoticeKey((k) => k + 1);
      setQuantities(buildInitialCart());
      setIsHalfPrice(false);
    } catch {
      setError("注文の登録に失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-[calc(100dvh-3rem)] bg-neutral-100 p-3 sm:p-6 grid grid-cols-1 gap-3 sm:gap-6 items-start lg:w-[60vw] lg:mx-auto lg:pb-[50vh]">
      <section className="flex flex-col gap-3 sm:gap-4">
        {/* 発行番号はナビの下に重ねて出すので、表示されても下のレイアウトは動かない */}
        {lastOrderNumber !== null && (
          <div
            key={noticeKey}
            role="status"
            className="notice-fade pointer-events-none fixed top-14 left-1/2 -translate-x-1/2 z-[60] flex items-baseline gap-1 whitespace-nowrap rounded-lg bg-emerald-100 border border-emerald-400 shadow-lg px-3 py-1.5 text-emerald-900 text-sm"
          >
            発行番号
            <span className="font-mono font-bold text-xl">
              {String(lastOrderNumber).padStart(3, "0")}
            </span>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-100 border border-red-400 px-4 sm:px-5 py-2 sm:py-4 text-sm sm:text-base text-red-900">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3">
          {MENU_ITEMS.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-2 sm:gap-3 rounded-xl bg-white border border-neutral-300 px-3 py-2 sm:px-4 sm:py-3"
            >
              <div className="flex items-baseline justify-between gap-2 sm:block">
                <p className="text-base sm:text-lg font-semibold">{item.name}</p>
                <p className="text-sm sm:text-base text-neutral-500">¥{item.pricePerOne}</p>
              </div>
              <div className="flex items-center justify-between gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => updateQuantity(item.id, -1)}
                  disabled={isSubmitting}
                  className="w-10 h-10 sm:w-14 sm:h-14 shrink-0 rounded-full bg-neutral-200 text-2xl sm:text-3xl font-bold active:bg-neutral-300 disabled:opacity-40"
                >
                  −
                </button>
                <span className="w-8 sm:w-10 text-center text-2xl sm:text-3xl font-mono tabular-nums">
                  {quantities[item.id]}
                </span>
                <button
                  type="button"
                  onClick={() => updateQuantity(item.id, 1)}
                  disabled={isSubmitting}
                  className="w-10 h-10 sm:w-14 sm:h-14 shrink-0 rounded-full bg-orange-500 text-white text-2xl sm:text-3xl font-bold active:bg-orange-600 disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <aside className="order-last sticky bottom-3 z-10 lg:order-none lg:z-auto lg:fixed lg:bottom-0 lg:left-[20vw] lg:w-[60vw] lg:h-1/2 rounded-2xl lg:rounded-b-none bg-white border border-neutral-300 lg:border-b-0 shadow-lg px-4 sm:px-5 py-3 sm:py-4 flex flex-col gap-2 sm:gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-semibold text-neutral-600">注文内容確認</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClear}
              disabled={isSubmitting || (cart.length === 0 && !isHalfPrice)}
              className="rounded-lg font-bold text-base sm:text-lg px-3 py-1 sm:px-4 sm:py-2 border bg-white border-neutral-300 text-neutral-600 active:bg-neutral-100 disabled:opacity-40"
            >
              クリア
            </button>
            <button
              type="button"
              onClick={() => setIsHalfPrice((v) => !v)}
              disabled={isSubmitting}
              aria-pressed={isHalfPrice}
              className={`rounded-lg font-bold text-base sm:text-lg px-3 py-1 sm:px-4 sm:py-2 border disabled:opacity-40 ${
                isHalfPrice
                  ? "bg-yellow-400 border-yellow-500 text-yellow-950 active:bg-yellow-500"
                  : "bg-white border-neutral-300 text-neutral-600 active:bg-neutral-100"
              }`}
            >
              {isHalfPrice ? "半額 ON" : "半額"}
            </button>
          </div>
        </div>
        {cart.length === 0 ? (
          <p className="text-sm sm:text-base text-neutral-400 flex-1">セット数を選択してください</p>
        ) : (
          <ul className="flex flex-col gap-1 flex-1 overflow-y-auto min-h-0 max-h-20 sm:max-h-24 lg:max-h-none text-sm sm:text-base">
            {cart.map((item) => (
              <li key={item.menuId} className="flex justify-between">
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>¥{item.pricePerOne * item.quantity}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-between text-lg sm:text-2xl font-bold border-t border-neutral-200 pt-2 sm:pt-3">
          <span>
            合計 ({totalCount}セット)
            {isHalfPrice && <span className="ml-2 text-sm sm:text-base text-yellow-700">半額</span>}
          </span>
          <span>¥{totalAmount}</span>
        </div>

        <button
          type="button"
          onClick={handleCheckout}
          disabled={isSubmitting || cart.length === 0}
          className="w-full rounded-2xl bg-orange-600 text-white text-lg sm:text-2xl font-bold py-2.5 sm:py-4 active:bg-orange-700 disabled:opacity-40"
        >
          {isSubmitting ? "登録中..." : "会計確定"}
        </button>
      </aside>

      <div className="lg:contents grid grid-cols-1 gap-4 bg-white border border-neutral-300 rounded-2xl shadow-lg p-3 sm:p-4 lg:p-0 lg:bg-transparent lg:border-0 lg:shadow-none">
        <section className="flex flex-col gap-2 min-h-0 overflow-y-auto lg:fixed lg:top-12 lg:bottom-0 lg:right-0 lg:w-[20vw] lg:bg-white lg:border-l lg:border-neutral-300 lg:shadow-lg lg:p-4">
          <h2 className="text-sm sm:text-base font-semibold text-emerald-700">
            🔔 呼出中（受け渡し完了）
          </h2>
          {readyOrders.length === 0 && <p className="text-sm sm:text-base text-neutral-400">No 注文</p>}
          {/* スマホ・タブレットは番号を 2 列で並べる */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 lg:flex lg:flex-col">
            {readyOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-lg sm:text-2xl">
                  {String(order.orderNumber).padStart(3, "0")}
                </span>
                <button
                  type="button"
                  onClick={() => handleComplete(order)}
                  className="shrink-0 rounded-lg bg-blue-100 text-blue-700 font-bold text-sm sm:text-lg px-2.5 py-1 sm:px-4 sm:py-2 active:bg-blue-200"
                >
                  完了
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2 min-h-0 overflow-y-auto lg:fixed lg:top-12 lg:bottom-0 lg:left-0 lg:w-[20vw] lg:bg-white lg:border-r lg:border-neutral-300 lg:shadow-lg lg:p-4">
          <h2 className="text-sm sm:text-base font-semibold text-neutral-600">
            直近の注文（会計ミスの取消）
          </h2>
          <div className="hidden lg:grid grid-cols-[4rem_1fr_auto] gap-3 border-b border-neutral-300 pb-1 text-sm font-semibold text-neutral-500">
            <span>番号</span>
            <span>料金</span>
            <span>取消</span>
          </div>
          {recentOrders.length === 0 && <p className="text-left text-sm sm:text-base text-neutral-400">No 注文</p>}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 lg:flex lg:flex-col">
            {recentOrders.map((order) => {
              const cancelled = order.status === "cancelled";
              return (
                <div key={order.id} className="flex items-center justify-between gap-2 lg:grid lg:grid-cols-[4rem_1fr_auto] lg:gap-3 lg:border-b lg:border-neutral-200 lg:pb-2">
                  <span className="flex flex-col leading-tight font-bold lg:contents">
                    <span className={`text-lg ${cancelled ? "line-through text-neutral-400" : "text-green-800"}`}>
                      {String(order.orderNumber).padStart(3, "0")}
                    </span>
                    <span className={`text-xs sm:text-sm lg:text-lg ${cancelled ? "line-through text-neutral-400" : "text-neutral-600 lg:text-neutral-900"}`}>
                      ¥{order.totalAmount}
                    </span>
                  </span>
                  {cancelled ? (
                    <span className="shrink-0 justify-self-end text-xs sm:text-sm text-neutral-400">取消済み</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleCancel(order)}
                      className="shrink-0 justify-self-end rounded-lg bg-red-100 text-red-700 font-bold text-sm sm:text-lg px-2.5 py-1 sm:px-4 sm:py-2 active:bg-red-200"
                    >
                      取消
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
