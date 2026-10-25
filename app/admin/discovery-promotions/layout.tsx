import type { Metadata } from "next";

export const metadata: Metadata = { title: "ניהול חשיפה | V", robots: { index: false, follow: false } };

export default function DiscoveryPromotionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
