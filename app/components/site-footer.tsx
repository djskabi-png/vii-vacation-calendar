import Link from "next/link";
import { CookiePreferencesButton } from "./cookie-consent";
import { LanguageSwitcher } from "../i18n/locale-provider";
import { AccessibilityWidget } from "./accessibility-widget";
import type { WorldId } from "../data/world-data";
import { footerContextFor, type FooterTopicId } from "../data/footer-context";

/* eslint-disable @next/next/no-img-element */

export function SiteFooter({ variant = "vacation", topic }: { variant?: WorldId; topic?: FooterTopicId }) {
  const contextual = footerContextFor(variant, topic);
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <section className="footer-about">
          <img src="/vii-logo.png" alt="וי פור ויקיישן" />
          <p>נופש, אירועים, ספא, ספקים וחוויות, עם חיפוש אחד שמחבר את כל מה שצריך.</p>
          <Link className="footer-join-link" href="/join">פרסום והצטרפות לאתר</Link>
        </section>
        <nav aria-label={contextual.label}><strong>{contextual.label}</strong>{contextual.links.map((item) => <Link key={`${item.href}-${item.label}`} href={item.href}>{item.label}</Link>)}</nav>
        <nav aria-label="שירותים"><strong>העולמות שלנו</strong><Link href="/search">נופש</Link><Link href="/events">אירועים</Link><Link href="/corporate">אירועי חברה ורווחה</Link><Link href="/spas">ספא</Link><Link href="/hourly">חדרים לכמה שעות</Link><Link href="/providers">ספקים</Link><Link href="/activities">מה עושים בסביבה</Link><Link href="/trails">מסלולי טיולים</Link><Link href="/attractions">אטרקציות בתשלום</Link></nav>
        <nav aria-label="מידע ושירות"><strong>מידע ושירות</strong><Link href="/account">החשבון האישי שלי</Link><Link href="/favorites">המקומות שאהבתי</Link><Link href="/gift-card">גיפט קארד</Link><Link href="/corporate">אירועי חברה ורווחה</Link><Link href="/booking?action=manage">ניהול הזמנה</Link><Link href="/questions">שאלות ותשובות</Link><Link href="/guides">מגזין ומדריכים</Link><Link href="/accessibility">הצהרת נגישות</Link><Link href="/legal/terms">תקנון</Link><Link href="/legal/privacy">מדיניות פרטיות</Link><Link href="/legal/cancellation">ביטול הזמנה</Link></nav>
      </div>
      <div className="shell footer-bottom"><span>© וי פור ויקיישן</span><div><LanguageSwitcher compact /><AccessibilityWidget placement="footer" /><CookiePreferencesButton /><span>כל החופשה, במקום אחד</span></div></div>
    </footer>
  );
}
