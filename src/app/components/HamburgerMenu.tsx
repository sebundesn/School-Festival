"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "呼び出し画面" },
  { href: "/register", label: "レジ・注文入力" },
  { href: "/kitchen", label: "厨房" },
  { href: "/admin", label: "管理" },
];

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="fixed top-3 right-3 z-50">
      <button
        type="button"
        aria-label="メニュー"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-12 h-12 rounded-xl bg-white border border-neutral-300 shadow flex flex-col items-center justify-center gap-1.5 active:bg-neutral-100"
      >
        <span className="block w-6 h-0.5 bg-neutral-800" />
        <span className="block w-6 h-0.5 bg-neutral-800" />
        <span className="block w-6 h-0.5 bg-neutral-800" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 -z-10" onClick={() => setOpen(false)} />
          <nav className="absolute right-0 mt-2 w-48 rounded-xl bg-white border border-neutral-300 shadow-lg overflow-hidden text-neutral-900">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`block px-4 py-3 text-lg border-b last:border-b-0 border-neutral-200 active:bg-neutral-100 ${
                  pathname === link.href ? "bg-orange-50 font-bold text-orange-600" : ""
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </>
      )}
    </div>
  );
}
