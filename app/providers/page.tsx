import type { Metadata } from "next";
import { WorldLanding } from "../components/world-landing";
import { providerProfiles } from "../data/world-data";

export const metadata: Metadata = {
  title: "ספקים לחופשה ולאירוע במקום אחד",
  description: "שפים פרטיים, תקליטנים, צילום, ברים, עיצוב ופעילויות שמגיעים עד מקום האירוח.",
  alternates: { canonical: "/providers" },
  robots: { index: false, follow: true },
};

export default function ProvidersPage() {
  return <WorldLanding world="providers" title="ספקים לאירוח ולאירועים" description="שפים, מוזיקה, צילום, עיצוב ופעילויות במקום אחד." items={providerProfiles} sourceNote="הפרטים נאספו ממקורות רשמיים ונבדקו באוגוסט 2026." />;
}
