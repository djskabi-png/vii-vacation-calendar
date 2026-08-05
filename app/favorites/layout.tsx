import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "המקומות שאהבתי",
  description: "כל מקומות הנופש והאירועים ששמרתם באתר וי פור ויקיישן.",
  robots: { index: false, follow: true },
};

export default function FavoritesLayout({ children }: { children: React.ReactNode }) { return children; }
