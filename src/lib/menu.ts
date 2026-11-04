export interface MenuItem {
  id: string;
  name: string;
  pricePerOne: number;
}

//後で変更
export const MENU_ITEMS: MenuItem[] = [
  { id: "tare", name: "タレ", pricePerOne: 300 },
  { id: "shio", name: "塩", pricePerOne: 300 },
];

/** レジの「-100円」ボタンで合計から引く額。 */
export const DISCOUNT = 100;

/** 整理券番号は 1〜MAX_ORDER_NUMBER を順に使い、最後まで行ったら 1 に戻る。 */
export const MAX_ORDER_NUMBER = 30;

/** 整理券番号 1〜30 がすべて調理中・呼出中で使用中のときに placeOrder が投げる。 */
export const NO_FREE_NUMBER = "no free number";

/** 半額会計時の単価（端数切り捨て）。 */
export function halfPrice(price: number): number {
  return Math.floor(price / 2);
}
