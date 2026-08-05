import Link from "next/link";
import { CookiePreferencesButton } from "./cookie-consent";
import { LanguageSwitcher } from "../i18n/locale-provider";

/* eslint-disable @next/next/no-img-element */

const destinations = ["צפון", "כנרת", "גליל מערבי", "מרכז", "ירושלים", "ים המלח", "אילת"];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <section className="footer-about">
          <img src="/vii-logo.png" alt="וי פור ויקיישן" />
          <p>נופש, אירועים, ספא, ספקים וחוויות, עם חיפוש אחד שמחבר את כל מה שצריך.</p>
        </section>
        <nav aria-label="יעדים פופולריים"><strong>יעדים פופולריים</strong>{destinations.map((item) => <Link key={item} href={`/search/?location=${encodeURIComponent(item)}`}>נופש ב{item}</Link>)}</nav>
        <nav aria-label="שירותים"><strong>העולמות שלנו</strong><Link href="/search/">נופש</Link><Link href="/events/">אירועים</Link><Link href="/spas/">ספא</Link><Link href="/hourly/">חדרים לכמה שעות</Link><Link href="/providers/">ספקים</Link><Link href="/activities/">מה עושים בסביבה</Link><Link href="/trails/">מסלולי טיול עצמאיים</Link></nav>
        <nav aria-label="מידע ושירות"><strong>מידע ושירות</strong><Link className="footer-join-link" href="/join/">הצטרפות לאתר</Link><Link href="/contact/">יצירת קשר</Link><Link href="/guides/">מגזין ומדריכים</Link><Link href="/accessibility/">הצהרת נגישות</Link><Link href="/legal/terms/">תקנון</Link><Link href="/legal/privacy/">מדיניות פרטיות</Link><Link href="/legal/cancellation/">ביטול הזמנה</Link></nav>
      </div>
      <div className="shell footer-bottom"><span>© וי פור ויקיישן</span><div><LanguageSwitcher compact /><CookiePreferencesButton /><span>כל החופשה, במקום אחד</span></div></div>
    </footer>
  );
}
