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
  return <WorldLanding world="providers" eyebrow="כל השירותים סביב האירוח" title="מוצאים ספק שמתאים בדיוק לאירוע" description="שפים פרטיים, מוזיקה, צילום, ברים, עיצוב ופעילויות. מסננים לפי תחום, נכנסים לפרופיל מלא ומבקשים הצעה בלי לצאת מהאתר." items={providerProfiles} sourceNote="הפרטים נאספו מאתרים רשמיים ונבדקו באוגוסט 2026. ספק שלא אומת כשותף פעיל מסומן כך בעמוד שלו, והזמינות מאושרת לפני הזמנה." />;
}
