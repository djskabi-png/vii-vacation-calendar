import type { Metadata } from "next";

export const metadata: Metadata = { title: "ניהול חשיפה | VII", robots: { index: false, follow: false } };

export default function DiscoveryPromotionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
