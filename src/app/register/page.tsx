"use client";

import { useEffect, useState } from "react";
import { Order, OrderItem } from "../type/Order";
import { DISCOUNT, MAX_ORDER_NUMBER, MENU_ITEMS, NO_FREE_NUMBER, halfPrice } from "@/lib/menu";
import { placeOrder, cancelOrder, setOrderStatus, subscribeAllOrders } from "@/lib/orders";

function buildInitialCart(): Record<string, number> {
  return Object.fromEntries(MENU_ITEMS.map((item) => [item.id, 0]));
}

export default function RegisterPage() {
  const [quantities, setQuantities] = useState<Record<string, number>>(buildInitialCart);
  const [isHalfPrice, setIsHalfPrice] = useState(false);
  // 「-100円」を押した回数
  const [discountCount, setDiscountCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState<number | null>(null);
  const [noticeKey, setNoticeKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [cookingOrders, setCookingOrders] = useState<Order[]>([]);

  useEffect(() => {
    return subscribeAllOrders((orders) => {
      // 受け渡し完了・会計ミスの取消の対象は調理中の注文だけ
      setCookingOrders(orders.filter((order) => order.status === "cooking"));
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

  const subtotal = cart.reduce((sum, item) => sum + item.pricePerOne * item.quantity, 0);
  // 本数を減らして値引きが合計を超えたら、合計までに抑える
  const discount = Math.min(discountCount * DISCOUNT, Math.floor(subtotal / DISCOUNT) * DISCOUNT);
  const totalAmount = subtotal - discount;
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
    setDiscountCount(0);
  }

  async function handleCheckout() {
    if (isSubmitting || cart.length === 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const orderNumber = await placeOrder(cart, isHalfPrice, discount);
      setLastOrderNumber(orderNumber);
      setNoticeKey((k) => k + 1);
      setQuantities(buildInitialCart());
      setIsHalfPrice(false);
      setDiscountCount(0);
    } catch (e) {
      setError(
        e instanceof Error && e.message === NO_FREE_NUMBER
          ? `整理券番号 1〜${MAX_ORDER_NUMBER} がすべて使用中です。受け渡しが完了してから会計してください。`
          : "注文の登録に失敗しました。もう一度お試しください。"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-[calc(100dvh-3rem)] bg-neutral-100 p-3 sm:p-6 grid grid-cols-1 gap-3 sm:gap-6 items-start lg:w-[60vw] lg:mx-auto">
      {/* 発行番号はナビの下に重ねて出すので、表示されても下のレイアウトは動かない */}
      {lastOrderNumber !== null && (
        <div
          key={noticeKey}
          role="status"
          className="notice-fade pointer-events-none fixed top-14 left-1/2 -translate-x-1/2 z-[60] flex items-baseline gap-2 whitespace-nowrap rounded-xl bg-emerald-100 border-2 border-emerald-400 shadow-lg px-5 py-2 text-emerald-900 text-lg"
        >
          発行番号
          <span className="font-mono font-bold text-4xl">
            {String(lastOrderNumber).padStart(3, "0")}
          </span>
        </div>
      )}

      {/* セット数の入力と注文内容の確認を 1 つのパネルにまとめる。
          スマホ・タブレットは調理中の注文の下に置き、画面下に貼り付けて上に重ねる */}
      <section className="order-last sticky bottom-3 z-20 lg:order-none lg:static rounded-2xl bg-white border border-neutral-300 shadow-lg px-4 sm:px-5 py-3 sm:py-4 flex flex-col gap-3 sm:gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-semibold text-neutral-600">注文内容確認</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClear}
              disabled={isSubmitting || (cart.length === 0 && !isHalfPrice && discountCount === 0)}
              className="rounded-lg font-bold text-base sm:text-lg px-3 py-1 sm:px-4 sm:py-2 border bg-white border-neutral-300 text-neutral-600 active:bg-neutral-100 disabled:opacity-40"
            >
              クリア
            </button>
            <button
              type="button"
              onClick={() => setDiscountCount(discount / DISCOUNT + 1)}
              disabled={isSubmitting || totalAmount < DISCOUNT}
              className={`rounded-lg font-bold text-base sm:text-lg px-3 py-1 sm:px-4 sm:py-2 border disabled:opacity-40 ${
                discount > 0
                  ? "bg-sky-400 border-sky-500 text-sky-950 active:bg-sky-500"
                  : "bg-white border-neutral-300 text-neutral-600 active:bg-neutral-100"
              }`}
            >
              -{DISCOUNT}円
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

        {error && (
          <div className="rounded-xl bg-red-100 border border-red-400 px-4 py-2 text-sm sm:text-base text-red-900">
            {error}
          </div>
        )}

        {/* タレ・塩を 1 行に並べる */}
        <ul className="grid grid-cols-2 gap-x-3 sm:gap-x-6 border-b border-neutral-200 pb-1.5 sm:pb-2">
          {MENU_ITEMS.map((item) => {
            const quantity = quantities[item.id];
            return (
              <li key={item.id} className="flex items-center justify-between gap-1.5 sm:gap-3">
                <p className="min-w-0 text-base sm:text-lg font-semibold whitespace-nowrap">{item.name}</p>
                <div className="flex items-center gap-1 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, -1)}
                    disabled={isSubmitting || quantity === 0}
                    className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-full bg-neutral-200 text-xl sm:text-2xl font-bold active:bg-neutral-300 disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-7 sm:w-8 text-center text-xl sm:text-2xl font-mono tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, 1)}
                    disabled={isSubmitting}
                    className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-full bg-orange-500 text-white text-xl sm:text-2xl font-bold active:bg-orange-600 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        {/* スマホは合計と会計確定を 1 行に並べて、画面下のパネルを低くする */}
        <div className="flex items-center gap-3 sm:flex-col sm:items-stretch sm:gap-4">
          <div className="flex-1 min-w-0 flex items-center justify-between gap-2 text-lg sm:text-2xl font-bold">
            <span>
              合計 ({totalCount}セット)
              {isHalfPrice && <span className="ml-2 text-sm sm:text-base text-yellow-700">半額</span>}
              {discount > 0 && (
                <button
                  type="button"
                  onClick={() => setDiscountCount(0)}
                  disabled={isSubmitting}
                  className="ml-2 rounded-md bg-sky-100 px-1.5 text-sm sm:text-base text-sky-800 active:bg-sky-200"
                >
                  値引き -{discount}円 ✕
                </button>
              )}
            </span>
            <span className="shrink-0">¥{totalAmount}</span>
          </div>

          <button
            type="button"
            onClick={handleCheckout}
            disabled={isSubmitting || cart.length === 0}
            className="shrink-0 sm:w-full rounded-2xl bg-orange-600 text-white text-lg sm:text-2xl font-bold px-5 py-2.5 sm:py-4 active:bg-orange-700 disabled:opacity-40"
          >
            {isSubmitting ? "登録中..." : "会計確定"}
          </button>
        </div>
      </section>

      {/* 調理中の注文を 1 行ずつ「取消・番号・完了」で並べる。PC は右端に縦長で固定する */}
      <section className="flex flex-col gap-2 min-h-0 bg-white border border-neutral-300 rounded-2xl shadow-lg p-3 sm:p-4 lg:fixed lg:top-12 lg:bottom-0 lg:right-0 lg:w-[20vw] lg:rounded-none lg:border-0 lg:border-l lg:p-4">
        <h2 className="text-sm sm:text-base font-semibold text-orange-600">🔥 調理中（取消・受け渡し完了）</h2>
        {cookingOrders.length === 0 && <p className="text-sm sm:text-base text-neutral-400">No 注文</p>}
        {/* スマホは 4 行分の高さまでで、それ以上はスクロール */}
        <ul className="flex flex-col max-h-[10.5rem] sm:max-h-none overflow-y-auto lg:flex-1 lg:min-h-0">
          {cookingOrders.map((order) => (
            <li
              key={order.id}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b last:border-b-0 border-neutral-200 py-1.5 sm:py-2"
            >
              <button
                type="button"
                onClick={() => handleCancel(order)}
                className="justify-self-start shrink-0 rounded-lg bg-red-100 text-red-700 font-bold text-sm sm:text-lg px-2.5 py-1 sm:px-4 sm:py-2 active:bg-red-200"
              >
                取消
              </button>
              <span className="flex flex-col items-center leading-tight">
                <span className="font-mono font-bold text-lg sm:text-2xl">
                  {String(order.orderNumber).padStart(3, "0")}
                </span>
                <span className="text-xs sm:text-sm text-neutral-500">¥{order.totalAmount}</span>
              </span>
              <button
                type="button"
                onClick={() => handleComplete(order)}
                className="justify-self-end shrink-0 rounded-lg bg-blue-100 text-blue-700 font-bold text-sm sm:text-lg px-2.5 py-1 sm:px-4 sm:py-2 active:bg-blue-200"
              >
                完了
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
