import * as api from "@/lib/orders-api";
import * as local from "@/lib/orders-local";

// NEXT_PUBLIC_API_URL / NEXT_PUBLIC_WS_URL が設定されていれば AWS バックエンドを使い、
// なければ localStorage だけで動くローカル版（1 台の端末内でのみ共有）を使う。
const impl = process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_WS_URL ? api : local;

export const placeOrder = impl.placeOrder;
export const subscribeActiveOrders = impl.subscribeActiveOrders;
export const subscribeAllOrders = impl.subscribeAllOrders;
export const setOrderStatus = impl.setOrderStatus;
export const cancelOrder = impl.cancelOrder;
export const resetCounter = impl.resetCounter;
export const clearAllOrders = impl.clearAllOrders;
