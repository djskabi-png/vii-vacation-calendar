import { WorldLanding } from "../components/world-landing";
import { hourlyPlaces } from "../data/world-data";

export default function HourlyPage() {
  return <WorldLanding world="hourly" eyebrow="לא חייבים להזמין לילה" title="חדר לכמה שעות, בדיוק בזמן שלכם" description="מוצאים חדרים וסוויטות לשהייה קצרה, משווים מחיר לשעה ובוחרים מקום שמתאים ללוח הזמנים." items={hourlyPlaces} searchMode="hourly" sourceNote="המידע והתמונות נלקחו מעמודי המקור המאומתים של חדרים וי־איי־פי." />;
}
