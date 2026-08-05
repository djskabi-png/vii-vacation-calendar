import Link from "next/link";
import { PageShell } from "../../components/page-shell";

export default function PrivacyPage() {
  return <PageShell><main id="main-content"><article className="legal-page shell">
    <span className="eyebrow">מידע משפטי</span>
    <h1>מדיניות פרטיות</h1>
    <p className="lead">הפרטיות שלכם חשובה לנו. השימוש במידע נעשה בהתאם לבחירות שלכם ולצורך מתן השירות.</p>
    <h2>העדפות בדפדפן</h2>
    <p>אפשר לבחור בין קבצים חיוניים לבין שירותים נוספים דרך חלון העדפות הפרטיות.</p>
    <h2>פנייה בנושא פרטיות</h2>
    <p>לבירור, עדכון או בקשה הנוגעת למידע שמסרתם, אפשר לפנות אלינו דרך טופס יצירת הקשר.</p>
    <Link className="button primary" href="/contact/">יצירת קשר</Link>
  </article></main></PageShell>;
}
