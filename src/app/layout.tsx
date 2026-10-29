import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "./components/NavBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "焼き鳥注文・呼び出し管理システム",
  description: "文化祭・イベントの模擬店向けリアルタイム注文管理・呼び出しシステム",
  // 漢字が多いと Chrome が中国語と誤判定して翻訳を勧めてくるので止める
  other: { google: "notranslate" },
};

// 長押しで出るメニュー（コピー・リンクを開く等）を全画面で出さない
const blockContextMenu = `document.addEventListener("contextmenu", (e) => e.preventDefault());`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      translate="no"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: blockContextMenu }} />
      </head>
      <body className="min-h-full flex flex-col">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
