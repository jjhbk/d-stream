import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TransactionPopupProvider } from "@blockscout/app-sdk";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FreeJam4U",
  description: "A decentralized Streaming platform!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
