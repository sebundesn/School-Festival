"use client";

import { useEffect, useMemo, useState } from "react";
import { Order } from "../type/Order";
import { subscribeAllOrders, resetCounter, setOrderStatus, clearAllOrders } from "@/lib/orders";
import { MENU_ITEMS } from "@/lib/menu";

function formatNumber(orderNumber: number) {
  return String(orderNumber).padStart(3, "0");
}

/** 売上と品目別セット数を、メモしやすい文面にする。 */
function formatSummary(sales: number, countOf: (menuId: string) => number) {
  return [
    `売上: ¥${sales.toLocaleString()}`,
    ...MENU_ITEMS.map((item) => `${item.name}: ${countOf(item.id)}セット`),
  ].join("\n");
}

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeAllOrders(setOrders);
    return unsubscribe;
  }, []);

  // 受け渡し完了した注文だけを履歴・売上の対象にする（レジでの会計ミス取消や調理中・呼出中は含めない）
  const completed = useMemo(
    () =>
      orders
        .filter((o) => o.status === "completed")
        .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)),
    [orders]
  );

  const summary = useMemo(() => {
    const totalAmount = completed.reduce((sum, order) => sum + order.totalAmount, 0);

    const countByMenu = new Map<string, number>();
    for (const order of completed) {
      for (const item of order.items) {
        countByMenu.set(item.menuId, (countByMenu.get(item.menuId) ?? 0) + item.quantity);
      }
    }

    return { totalAmount, countByMenu };
  }, [completed]);

  // 受け渡しを押し間違えたときに呼出中へ戻す（履歴・売上からも外れる）
  async function handleBackToReady(order: Order) {
    await setOrderStatus(order.id, "ready");
  }

  async function handleResetCounter() {
    if (!window.confirm("整理券番号のカウンターを 0 にリセットします。よろしいですか？")) {
      return;
    }
    await resetCounter();
  }

  // 片付け用。消す前と消した後の両方で売上・セット数を出し、記録してもらう
  async function handleClearAll() {
    const active = orders.filter((o) => o.status === "cooking" || o.status === "ready").length;
    const message = [
      "全注文を削除します（元に戻せません）。整理券番号も #001 に戻ります。",
      active > 0 ? `\n⚠ 調理中・呼出中の注文が ${active} 件あります。これも消えます。` : "",
      "\n削除前に以下を記録してください:",
      formatSummary(summary.totalAmount, (id) => summary.countByMenu.get(id) ?? 0),
      "\n削除してよろしいですか？",
    ].join("\n");
    if (!window.confirm(message)) return;

    const result = await clearAllOrders();
    if (!result) return;
    window.alert(
      `${result.deleted} 件の注文を削除しました。\n\n` +
        formatSummary(result.sales, (id) => result.byItem[id] ?? 0)
    );
  }

  return (
    <main className="min-h-[calc(100dvh-3rem)] bg-neutral-100 p-3 sm:p-6 flex flex-col gap-3 sm:gap-6 w-full max-w-3xl mx-auto">
      {/* スマホでも左右に並べる */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="rounded-xl bg-white border border-neutral-300 px-3 py-2 sm:px-5 sm:py-4">
          <p className="text-sm sm:text-base text-neutral-500">総売上額</p>
          <p className="text-xl sm:text-3xl font-bold tabular-nums">¥{summary.totalAmount.toLocaleString()}</p>
        </div>

        <div className="rounded-xl bg-white border border-neutral-300 px-3 py-2 sm:px-5 sm:py-4">
          <h2 className="text-sm sm:text-base text-neutral-500 mb-1 sm:mb-2">商品別内訳</h2>
          <ul className="flex flex-col gap-1">
            {MENU_ITEMS.map((item) => (
              <li key={item.id} className="flex justify-between text-base sm:text-lg">
                <span>{item.name}</span>
                <span className="font-mono tabular-nums">
                  {summary.countByMenu.get(item.id) ?? 0}s
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl bg-white border border-neutral-300 px-3 py-2 sm:px-5 sm:py-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm sm:text-base font-semibold">整理券番号のリセット</p>
          <p className="text-neutral-500 text-xs sm:text-sm">
            過去の注文データは削除されず、次回発行される番号のみ #001 に戻ります。
          </p>
        </div>
        <button
          type="button"
          onClick={handleResetCounter}
          className="shrink-0 rounded-xl bg-red-600 text-white font-bold text-sm sm:text-base px-3 py-2 sm:px-5 sm:py-3 active:bg-red-700"
        >
          リセット
        </button>
      </div>

      <div className="rounded-xl bg-white border border-neutral-300 px-3 py-2 sm:px-5 sm:py-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm sm:text-base font-semibold">全注文の削除</p>
          <p className="text-neutral-500 text-xs sm:text-sm">
            売上・セット数を表示してから、全端末の注文と集計を消します。片付け用です。
          </p>
        </div>
        <button
          type="button"
          onClick={handleClearAll}
          className="shrink-0 rounded-xl bg-red-600 text-white font-bold text-sm sm:text-base px-3 py-2 sm:px-5 sm:py-3 active:bg-red-700"
        >
          全削除
        </button>
      </div>

      <div className="rounded-xl bg-white border border-neutral-300 px-3 py-2 sm:px-5 sm:py-4">
        <h2 className="text-sm sm:text-base font-semibold text-neutral-600 mb-1 sm:mb-3">注文履歴（受け渡し完了）</h2>
        {completed.length === 0 ? (
          <p className="text-sm sm:text-base text-neutral-400">No 注文</p>
        ) : (
          <ul className="flex flex-col max-h-[60vh] overflow-y-auto">
            {completed.map((order) => (
              <li
                key={order.id}
                className="flex items-center gap-2 sm:gap-4 border-b last:border-b-0 border-neutral-200 py-1.5 sm:py-2"
              >
                <span className="w-10 sm:w-12 shrink-0 font-mono font-bold text-base sm:text-lg tabular-nums">
                  {formatNumber(order.orderNumber)}
                </span>
                <span className="flex-1 min-w-0 text-sm sm:text-base">
                  {order.items.map((item) => `${item.name}×${item.quantity}`).join("　")}
                </span>
                <button
                  type="button"
                  onClick={() => handleBackToReady(order)}
                  className="shrink-0 whitespace-nowrap rounded-lg bg-emerald-100 text-emerald-700 font-bold text-sm sm:text-base px-2.5 py-1 sm:px-4 sm:py-2 active:bg-emerald-200"
                >
                  呼出中に戻す
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
