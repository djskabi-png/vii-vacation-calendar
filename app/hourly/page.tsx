import type { Metadata } from "next";
import { WorldLanding } from "../components/world-landing";
import { hourlyPlaces } from "../data/world-data";

export const metadata: Metadata = {
  title: "חדרים לפי שעה",
  description: "חדרים וסוויטות לשהייה קצרה לפי אזור, מחיר וסוג האירוח.",
  alternates: { canonical: "/hourly/" },
};

export default function HourlyPage() {
  return <WorldLanding world="hourly" eyebrow="לא חייבים להזמין לילה" title="חדר לכמה שעות, בדיוק בזמן שלכם" description="מוצאים חדרים וסוויטות לשהייה קצרה, משווים מחיר לשעה ובוחרים מקום שמתאים ללוח הזמנים." items={hourlyPlaces} searchMode="hourly" sourceNote="המידע והתמונות נלקחו מעמודי המקור המאומתים של חדרים וי־איי־פי." />;
}
