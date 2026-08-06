import type { Metadata } from "next";
import { WorldLanding } from "../components/world-landing";
import { hourlyPlaces } from "../data/world-data";
import { StructuredData } from "../components/structured-data";
import { collectionSchema } from "../lib/seo";

export const metadata: Metadata = {
  title: "חדרים לפי שעה",
  description: "חדרים וסוויטות לשהייה קצרה לפי אזור, מחיר וסוג האירוח.",
  alternates: { canonical: "/hourly" },
};

export default function HourlyPage() {
  return <>
    <StructuredData data={collectionSchema("חדרים לפי שעה", "חדרים וסוויטות לשהייה קצרה לפי אזור וסוג האירוח.", "/hourly", hourlyPlaces.map((place) => ({ name: place.name, path: `/discover/place?id=${place.id}`, image: place.image })))} />
    <WorldLanding world="hourly" eyebrow="לא חייבים להזמין לילה" title="חדר לכמה שעות, בדיוק בזמן שלכם" description="מוצאים חדרים וסוויטות לשהייה קצרה, משווים מחיר לשעה ובוחרים מקום שמתאים ללוח הזמנים." items={hourlyPlaces} searchMode="hourly" sourceNote="פרטי המקום, אפשרויות השהייה והפנייה מרוכזים כאן כדי שאפשר יהיה לבחור בלי לצאת מהאתר." />
  </>;
}
