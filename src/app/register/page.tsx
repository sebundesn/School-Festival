"use client";

import { useState } from "react";
import { OrderItem } from "../type/Order";
import { MENU_ITEMS } from "@/lib/menu";
import { placeOrder } from "@/lib/orders";

function buildInitialCart(): Record<string, number> {
  return Object.fromEntries(MENU_ITEMS.map((item) => [item.id, 0]));
}

export default function RegisterPage() {
  const [quantities, setQuantities] = useState<Record<string, number>>(buildInitialCart);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setQuantities(buildInitialCart());
    } catch {
      setError("注文の登録に失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-100 p-6 flex flex-col gap-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">レジ・注文入力</h1>

      {lastOrderNumber !== null && (
        <div className="rounded-xl bg-emerald-100 border border-emerald-400 px-5 py-4 text-emerald-900">
          発行番号: <span className="font-mono font-bold text-xl">#{String(lastOrderNumber).padStart(3, "0")}</span>
          {" "}のお客様をお呼びします
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-100 border border-red-400 px-5 py-4 text-red-900">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {MENU_ITEMS.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-xl bg-white border border-neutral-300 px-5 py-4"
          >
            <div>
              <p className="text-lg font-semibold">{item.name}</p>
              <p className="text-neutral-500">¥{item.pricePerOne}</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => updateQuantity(item.id, -1)}
                disabled={isSubmitting}
                className="w-12 h-12 rounded-full bg-neutral-200 text-2xl font-bold active:bg-neutral-300 disabled:opacity-40"
              >
                −
              </button>
              <span className="w-8 text-center text-xl font-mono tabular-nums">
                {quantities[item.id]}
              </span>
              <button
                type="button"
                onClick={() => updateQuantity(item.id, 1)}
                disabled={isSubmitting}
                className="w-12 h-12 rounded-full bg-orange-500 text-white text-2xl font-bold active:bg-orange-600 disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto rounded-xl bg-white border border-neutral-300 px-5 py-4 flex flex-col gap-3">
        <h2 className="font-semibold text-neutral-600">注文内容確認</h2>
        {cart.length === 0 ? (
          <p className="text-neutral-400">本数を選択してください</p>
        ) : (
          <ul className="flex flex-col gap-1">
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
        <div className="flex justify-between text-lg font-bold border-t border-neutral-200 pt-3">
          <span>合計 ({totalCount}本)</span>
          <span>¥{totalAmount}</span>
        </div>

        <button
          type="button"
          onClick={handleCheckout}
          disabled={isSubmitting || cart.length === 0}
          className="w-full rounded-xl bg-orange-600 text-white text-xl font-bold py-4 active:bg-orange-700 disabled:opacity-40"
        >
          {isSubmitting ? "登録中..." : "会計確定"}
        </button>
      </div>
    </main>
  );
}
