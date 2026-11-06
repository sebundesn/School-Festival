export type OrderStatus = "cooking" | "completed" | "cancelled";

export interface OrderItem {
  menuId: string;
  name: string;
  quantity: number;
  pricePerOne: number;
}

export interface Order {
  id: string;
  orderNumber: number;
  items: OrderItem[];
  totalAmount: number;
  /** レジの「-100円」で引いた額（totalAmount は値引き後） */
  discount?: number;
  status: OrderStatus;
  createdAt: Date | null;
}

/** 全注文削除の直前に集計した値（受け渡し完了分のみ）。 */
export interface ClearSummary {
  deleted: number;
  sales: number;
  /** menuId → 本数 */
  byItem: Record<string, number>;
}
