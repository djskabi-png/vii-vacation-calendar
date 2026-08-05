import { WorldLanding } from "../components/world-landing";
import { activityIdeas } from "../data/world-data";

export default function ActivitiesPage() {
  return <WorldLanding world="activities" eyebrow="מה עושים כשיוצאים מהחדר" title="רעיונות טובים ממש ליד החופשה" description="מסלולים, אוכל, ים וחוויות שמתאימים לאזור, לעונה ולהרכב שלכם." items={activityIdeas} sourceNote="אלה רעיונות מערכתיים. ספקים, שעות פתיחה ובטיחות יאומתו לפני חיבור להזמנה חיה." />;
}
