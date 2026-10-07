export interface MenuItem {
  id: string;
  name: string;
  pricePerOne: number;
}

//後で変更
export const MENU_ITEMS: MenuItem[] = [
  { id: "tare", name: "タレ", pricePerOne: 150 },
  { id: "shio", name: "塩", pricePerOne: 150 },
];
