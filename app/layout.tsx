import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "全链资产查看器 - DeBank + EVM RPC",
  description: "查看多链钱包资产，支持 DeBank API 和 EVM RPC 实时查询",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

