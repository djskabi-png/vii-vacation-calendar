import type { Metadata } from "next";

export const metadata: Metadata = { title: "מדידת חיפושים", robots: { index: false, follow: false } };
export default function SearchAnalyticsLayout({ children }: { children: React.ReactNode }) { return children; }
