import type { Metadata } from "next";
import { CrowdfundProvider } from "@/context/CrowdfundContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orange Belt Crowdfund",
  description: "Soroban crowdfunding campaign on Stellar Testnet",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 antialiased">
        <CrowdfundProvider>{children}</CrowdfundProvider>
      </body>
    </html>
  );
}
