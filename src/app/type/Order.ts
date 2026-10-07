export type OrderStatus = "cooking" | "ready" | "completed" | "cancelled";

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
  status: OrderStatus;
  createdAt: Date | null;
}
