import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "חיפוש נופש בישראל",
  description: "מסננים ומשווים מקומות נופש ברחבי הארץ לפי אזור, סוג מקום, הרכב ומאפיינים.",
  alternates: { canonical: "/search/" },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) { return children; }
