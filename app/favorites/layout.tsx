import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "המקומות ששמרתי",
  description: "רשימת המקומות האישית ששמרתם בדפדפן.",
  robots: { index: false, follow: false },
};

export default function FavoritesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
