import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "חיפוש מקומות לאירועים",
  description: "מסננים ומשווים מתחמים לאירועים לפי אזור, כמות משתתפים וסוג האירוע.",
  alternates: { canonical: "/events/search/" },
};

export default function EventSearchLayout({ children }: { children: React.ReactNode }) { return children; }
