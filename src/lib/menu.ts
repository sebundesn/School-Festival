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

/** 半額会計時の単価（端数切り捨て）。 */
export function halfPrice(price: number): number {
  return Math.floor(price / 2);
}
