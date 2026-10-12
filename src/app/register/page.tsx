"use client";

import { useEffect, useState } from "react";
import { Order, OrderItem } from "../type/Order";
import { MENU_ITEMS } from "@/lib/menu";
import { placeOrder, cancelOrder, setOrderStatus, subscribeAllOrders } from "@/lib/orders";

function buildInitialCart(): Record<string, number> {
  return Object.fromEntries(MENU_ITEMS.map((item) => [item.id, 0]));
}

export default function RegisterPage() {
  const [quantities, setQuantities] = useState<Record<string, number>>(buildInitialCart);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState<number | null>(null);
  const [noticeKey, setNoticeKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [readyOrders, setReadyOrders] = useState<Order[]>([]);

  useEffect(() => {
    return subscribeAllOrders((orders) => {
      setRecentOrders(orders.slice(-5).reverse());
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
      pricePerOne: item.pricePerOne,
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

  async function handleCheckout() {
    if (isSubmitting || cart.length === 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const orderNumber = await placeOrder(cart);
      setLastOrderNumber(orderNumber);
      setNoticeKey((k) => k + 1);
      setQuantities(buildInitialCart());
    } catch {
      setError("注文の登録に失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-100 p-6 pb-6 grid grid-cols-1 lg:w-[60vw] lg:mx-auto lg:pb-[50vh] gap-6 items-start">
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">レジ・注文入力</h1>

        {lastOrderNumber !== null && (
          <div
            key={noticeKey}
            className="notice-fade rounded-xl bg-emerald-100 border border-emerald-400 px-5 py-4 text-emerald-900 text-xl"
          >
            発行番号：{" "}
            <span className="font-mono font-bold text-3xl">
              {String(lastOrderNumber).padStart(3, "0")}
            </span>{" "}
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-100 border border-red-400 px-5 py-4 text-red-900">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          {MENU_ITEMS.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-xl bg-white border border-neutral-300 px-4 py-3"
            >
              <div>
                <p className="text-lg font-semibold">{item.name}</p>
                <p className="text-neutral-500">¥{item.pricePerOne}</p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => updateQuantity(item.id, -1)}
                  disabled={isSubmitting}
                  className="w-14 h-14 rounded-full bg-neutral-200 text-3xl font-bold active:bg-neutral-300 disabled:opacity-40"
                >
                  −
                </button>
                <span className="text-3xl font-mono tabular-nums">
                  {quantities[item.id]}
                </span>
                <button
                  type="button"
                  onClick={() => updateQuantity(item.id, 1)}
                  disabled={isSubmitting}
                  className="w-14 h-14 rounded-full bg-orange-500 text-white text-3xl font-bold active:bg-orange-600 disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <aside className="lg:fixed lg:bottom-0 lg:left-[20vw] lg:w-[60vw] lg:h-1/2 rounded-2xl lg:rounded-b-none bg-white border border-neutral-300 lg:border-b-0 shadow-lg px-5 py-4 flex flex-col gap-3">
        <h2 className="font-semibold text-neutral-600">注文内容確認</h2>
        {cart.length === 0 ? (
          <p className="text-neutral-400 flex-1">本数を選択してください</p>
        ) : (
          <ul className="flex flex-col gap-1 flex-1 overflow-y-auto min-h-0">
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
        <div className="flex justify-between text-2xl font-bold border-t border-neutral-200 pt-3">
          <span>合計 ({totalCount}本)</span>
          <span>¥{totalAmount}</span>
        </div>

        <button
          type="button"
          onClick={handleCheckout}
          disabled={isSubmitting || cart.length === 0}
          className="w-full rounded-2xl bg-orange-600 text-white text-2xl font-bold py-4 active:bg-orange-700 disabled:opacity-40"
        >
          {isSubmitting ? "登録中..." : "会計確定"}
        </button>
      </aside>

      <div className="lg:contents grid grid-cols-2 gap-4 bg-white border border-neutral-300 rounded-2xl shadow-lg p-4 lg:p-0 lg:bg-transparent lg:border-0 lg:shadow-none">
        <section className="mt-[50px] flex flex-col gap-2 min-h-0 overflow-y-auto lg:fixed lg:top-0 lg:bottom-0 lg:right-0 lg:w-[20vw] lg:bg-white lg:border-l lg:border-neutral-300 lg:shadow-lg lg:p-4">
          <h2 className="font-semibold text-emerald-700">🔔 呼出中（受け渡し完了）</h2>
          {readyOrders.length === 0 && <p className="text-neutral-400">No 注文</p>}
          {readyOrders.map((order) => (
            <div key={order.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <span />
              <span className="font-mono font-bold text-2xl text-center">
                {String(order.orderNumber).padStart(3, "0")}
              </span>
              <button
                type="button"
                onClick={() => handleComplete(order)}
                className="justify-self-end rounded-lg bg-blue-100 text-blue-700 font-bold text-lg px-4 py-2 active:bg-blue-200"
              >
                完了
              </button>
            </div>
          ))}
        </section>

        <section className="mt-[50px] flex flex-col gap-2 min-h-0 overflow-y-auto lg:fixed lg:top-0 lg:bottom-0 lg:left-0 lg:w-[20vw] lg:bg-white lg:border-r lg:border-neutral-300 lg:shadow-lg lg:p-4">
          <h2 className="font-semibold text-neutral-600 ">直近の注文（会計ミスの取消）</h2>
          <div className="hidden lg:grid grid-cols-[4rem_1fr_auto] gap-3 border-b border-neutral-300 pb-1 text-sm font-semibold text-neutral-500">
            <span>番号</span>
            <span>料金</span>
            <span>取消</span>
          </div>
          {recentOrders.length === 0 && <p className="text-left text-neutral-400">No 注文</p>}
          {recentOrders.map((order) => {
            const cancelled = order.status === "cancelled";
            return (
              <div key={order.id} className="grid grid-cols-[1fr_auto_1fr] lg:grid-cols-[4rem_1fr_auto] items-center gap-3 lg:border-b lg:border-neutral-200 lg:pb-2">
                <span className="lg:hidden" />
                <span className={`text-lg font-bold lg:contents`}>
                  <span className={`font-bold text-center mr-5 lg:mr-0 lg:text-left ${cancelled ? "line-through text-neutral-400" : "text-green-800"}`}>
                    {String(order.orderNumber).padStart(3, "0")}
                  </span>{" "}
                  <span className={`lg:text-left ${cancelled ? "line-through text-neutral-400" : ""}`}>¥{order.totalAmount}</span>
                </span>
                {cancelled ? (
                  <span className="justify-self-end text-sm text-neutral-400">取消済み</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCancel(order)}
                    className="justify-self-end rounded-lg bg-red-100 text-red-700 font-bold text-lg px-4 py-2 active:bg-red-200"
                  >
                    取消
                  </button>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
