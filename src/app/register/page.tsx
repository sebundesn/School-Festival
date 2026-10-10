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
    <main className="min-h-screen bg-neutral-100 p-6 pb-6 grid grid-cols-1 lg:w-[calc(100vw-22.222vw-26rem)] gap-6 items-start">
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
            でお呼び出し致します。
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

      <aside className="lg:fixed lg:bottom-0 lg:right-[22.222vw] lg:w-[26rem] lg:h-1/2 rounded-2xl lg:rounded-b-none lg:rounded-r-none bg-white border border-neutral-300 lg:border-b-0 shadow-lg px-5 py-4 flex flex-col gap-3">
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

      <div className="lg:fixed lg:bottom-0 lg:right-0 lg:w-[22.222vw] lg:h-1/2 grid lg:grid-cols-1 lg:grid-rows-2 grid-cols-2 gap-4 bg-white border border-neutral-300 lg:border-b-0 lg:border-r-0 rounded-2xl lg:rounded-b-none lg:rounded-r-none shadow-lg p-4">
        <section className="flex flex-col gap-2 min-h-0 overflow-y-auto">
          <h2 className="font-semibold text-emerald-700">🔔 呼出中（受け渡し完了）</h2>
          {readyOrders.length === 0 && <p className="text-neutral-400">呼出中の注文はありません</p>}
          {readyOrders.map((order) => (
            <div key={order.id} className="flex items-center justify-between gap-3">
              <span className="font-mono font-bold text-2xl">
                #{String(order.orderNumber).padStart(3, "0")}
              </span>
              <button
                type="button"
                onClick={() => handleComplete(order)}
                className="rounded-lg bg-blue-100 text-blue-700 font-bold text-lg px-4 py-2 active:bg-blue-200"
              >
                完了
              </button>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-2 min-h-0 overflow-y-auto lg:border-t border-neutral-200 lg:pt-3">
          <h2 className="font-semibold text-neutral-600">直近の注文（会計ミスの取消）</h2>
          {recentOrders.length === 0 && <p className="text-neutral-400">注文はまだありません</p>}
          {recentOrders.map((order) => {
            const cancelled = order.status === "cancelled";
            return (
              <div key={order.id} className="flex items-center justify-between gap-3">
                <span className={`text-lg ${cancelled ? "line-through text-neutral-400" : ""}`}>
                  <span className="font-mono font-bold">
                    #{String(order.orderNumber).padStart(3, "0")}
                  </span>{" "}
                  ¥{order.totalAmount}
                </span>
                {cancelled ? (
                  <span className="text-sm text-neutral-400">取消済み</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCancel(order)}
                    className="rounded-lg bg-red-100 text-red-700 font-bold text-lg px-4 py-2 active:bg-red-200"
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
