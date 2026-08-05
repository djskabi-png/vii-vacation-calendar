import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { PartnerOnboarding } from "./partner-onboarding";

export const metadata: Metadata = {
  title: "הצטרפות ופרסום עסק באתר",
  description: "פותחים עמוד עסק מלא באתר וי פור ויקיישן, מנהלים תוכן וזמינות ומתחילים לקבל חשיפה ופניות.",
  alternates: { canonical: "/join" },
};

const benefits = [
  ["עמוד עסק מלא", "גלריה, סרטונים, חבילות, שירותים, שאלות נפוצות ועמוד עומק שמוכן לחיפוש."],
  ["ניהול עצמי", "כניסה אישית לעדכון תמונות, מחירים, חבילות, פרטים ותוכן בלי להמתין לנציג."],
  ["יומן דיגיטלי", "גישה למערכת ביז אונליין לניהול העסק, היומן והזמינות מול האתר."],
  ["פניות במקום אחד", "לידים, בקשות מחיר, שיחות ופעולות של גולשים נשמרים בצורה מסודרת."],
  ["חשיפה בתוך המערכת", "הופעה בחיפוש, במפה, בעמודי קטגוריה ובהמלצות שמתאימות לגולש."],
  ["כלים לצמיחה", "נתוני צפייה ופניות, איסוף חוות דעת וקישור שקל לשתף עם לקוחות."],
];

export default function JoinPage() {
  return (
    <PageShell showWorldSwitcher={false}>
      <main id="main-content">
        <section className="join-hero join-hero--conversion">
          <div className="shell">
            <span className="eyebrow">מצטרפים לעולמות של וי פור ויקיישן</span>
            <h1>העמוד של העסק שלכם יכול להתחיל לעלות כבר עכשיו</h1>
            <p>בוחרים מסלול, פותחים חשבון, מעלים את העסק ומתחילים לנהל תוכן, חבילות וזמינות ממקום אחד.</p>
            <div className="join-hero__actions">
              <Link className="button primary" href="#join-pricing">לבחירת מסלול</Link>
              <Link className="button subtle" href="#join-benefits">מה מקבלים?</Link>
            </div>
            <ul className="join-hero__trust" aria-label="יתרונות מרכזיים">
              <li>ללא דמי הקמה במחיר ההיכרות</li>
              <li>תשלום חודשי או שנתי</li>
              <li>שליטה עצמית בעמוד העסק</li>
            </ul>
          </div>
        </section>

        <section id="join-benefits" className="section shell join-benefits" aria-labelledby="join-benefits-title">
          <div className="section-head">
            <div>
              <span className="eyebrow">יותר מעמוד באינדקס</span>
              <h2 id="join-benefits-title">מערכת אחת שמחברת פרסום, תוכן וזמינות</h2>
              <p>העסק מקבל נוכחות מלאה באתר וכלים שעוזרים לנהל אותה לאורך זמן.</p>
            </div>
          </div>
          <div className="join-benefits__grid">
            {benefits.map(([title, description], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <PartnerOnboarding />

        <section className="section shell join-final-cta">
          <span className="eyebrow">החשיפה מתחילה בעמוד שבנוי נכון</span>
          <h2>מוכנים לפתוח את העסק באתר?</h2>
          <p>בוחרים מסלול, משאירים את פרטי העסק ומקבלים מעבר מסודר לאימות, תשלום והעלאת התוכן.</p>
          <Link className="button primary" href="#join-form">מתחילים עכשיו</Link>
        </section>
      </main>
    </PageShell>
  );
}
