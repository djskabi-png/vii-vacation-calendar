import { WorldLanding } from "../components/world-landing";
import { providerProfiles } from "../data/world-data";

export default function ProvidersPage() {
  return <WorldLanding world="providers" eyebrow="מגיעים עד אליכם" title="האנשים שהופכים אירוח לחוויה" description="שף פרטי, תקליטן, צילום, הפעלות ועיצוב. בוחרים שירות ומחברים אותו למקום ולתאריך." items={providerProfiles} sourceNote="הפרופילים בעמוד זה הם פרופילי הדגמה למבנה המוצר ואינם עסקים אמיתיים." />;
}
