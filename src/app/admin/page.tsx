"use client";

import { useEffect, useMemo, useState } from "react";
import { Order } from "../type/Order";
import { subscribeAllOrders, resetCounter, buildCsv } from "@/lib/orders";
import { MENU_ITEMS } from "@/lib/menu";

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeAllOrders(setOrders);
    return unsubscribe;
  }, []);

  const summary = useMemo(() => {
    const cancelledCount = orders.filter((o) => o.status === "cancelled").length;
    const valid = orders.filter((o) => o.status !== "cancelled");
    const totalAmount = valid.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalCount = valid.reduce(
      (sum, order) => sum + order.items.reduce((s, item) => s + item.quantity, 0),
      0
    );

    const countByMenu = new Map<string, number>();
    for (const order of valid) {
      for (const item of order.items) {
        countByMenu.set(item.menuId, (countByMenu.get(item.menuId) ?? 0) + item.quantity);
      }
    }

    return { totalAmount, totalCount, countByMenu, orderCount: valid.length, cancelledCount };
  }, [orders]);

  function handleExportCsv() {
    const blob = new Blob([buildCsv(orders)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "orders.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleResetCounter() {
    if (!window.confirm("整理券番号のカウンターを 0 にリセットします。よろしいですか？")) {
      return;
    }
    await resetCounter();
  }

  return (
    <main className="min-h-screen bg-neutral-100 p-6 flex flex-col gap-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">売上・集計ダッシュボード</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="総売上額" value={`¥${summary.totalAmount.toLocaleString()}`} />
        <StatCard label="累計販売本数" value={`${summary.totalCount}本`} />
        <StatCard
          label="注文件数"
          value={`${summary.orderCount}件`}
          note={summary.cancelledCount > 0 ? `取消 ${summary.cancelledCount}件を除く` : undefined}
        />
      </div>

      <div className="rounded-xl bg-white border border-neutral-300 px-5 py-4">
        <h2 className="font-semibold text-neutral-600 mb-3">商品別内訳</h2>
        <ul className="flex flex-col gap-2">
          {MENU_ITEMS.map((item) => (
            <li key={item.id} className="flex justify-between text-lg">
              <span>{item.name}</span>
              <span className="font-mono tabular-nums">
                {summary.countByMenu.get(item.id) ?? 0}本
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl bg-white border border-neutral-300 px-5 py-4 flex items-center justify-between">
        <p className="font-semibold">注文データのCSV出力</p>
        <button
          type="button"
          onClick={handleExportCsv}
          className="rounded-xl bg-neutral-800 text-white font-bold px-5 py-3 active:bg-neutral-900"
        >
          ダウンロード
        </button>
      </div>

      <div className="rounded-xl bg-white border border-neutral-300 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="font-semibold">整理券番号のリセット</p>
          <p className="text-neutral-500 text-sm">
            過去の注文データは削除されず、次回発行される番号のみ #001 に戻ります。
          </p>
        </div>
        <button
          type="button"
          onClick={handleResetCounter}
          className="rounded-xl bg-red-600 text-white font-bold px-5 py-3 active:bg-red-700"
        >
          リセット
        </button>
      </div>
    </main>
  );
}

function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl bg-white border border-neutral-300 px-5 py-4">
      <p className="text-neutral-500">{label}</p>
      <p className="text-3xl font-bold tabular-nums">{value}</p>
      {note && <p className="text-neutral-400 text-sm">{note}</p>}
    </div>
  );
}
