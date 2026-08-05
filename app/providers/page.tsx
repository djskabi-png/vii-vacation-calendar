import type { Metadata } from "next";
import { WorldLanding } from "../components/world-landing";
import { providerProfiles } from "../data/world-data";

export const metadata: Metadata = {
  title: "ספקים ונותני שירות לחופשה ולאירוע",
  description: "שפים פרטיים, תקליטנים, צילום, הפעלות ועיצוב שמגיעים עד מקום האירוח.",
  alternates: { canonical: "/providers" },
  robots: { index: false, follow: true },
};

export default function ProvidersPage() {
  return <WorldLanding world="providers" eyebrow="מגיעים עד אליכם" title="האנשים שהופכים אירוח לחוויה" description="שף פרטי, תקליטן, צילום, הפעלות ועיצוב. בוחרים שירות ומחברים אותו למקום ולתאריך." items={providerProfiles} sourceNote="הפרופילים בעמוד זה הם פרופילי הדגמה למבנה המוצר ואינם עסקים אמיתיים." />;
}
