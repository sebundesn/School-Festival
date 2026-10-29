"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/register", label: "レジ" },
  { href: "/kitchen", label: "厨房" },
  { href: "/admin", label: "管理" },
];

// 画面上部に常時表示するナビゲーション。高さは h-12 固定（各ページのレイアウトがこの高さを前提にしている）
// 呼び出し画面（/）はお客さん向けに URL を直接開くので表示しない
export default function NavBar() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <nav className="sticky top-0 z-50 h-12 shrink-0 bg-white border-b border-neutral-300 shadow-sm flex">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`flex-1 flex items-center justify-center text-sm sm:text-lg font-semibold border-b-4 active:bg-neutral-100 ${
              active ? "border-orange-500 text-orange-600" : "border-transparent text-neutral-600"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
