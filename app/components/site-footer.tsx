import Link from "next/link";
import { CookiePreferencesButton } from "./cookie-consent";
import { LanguageSwitcher } from "../i18n/locale-provider";
import { AccessibilityWidget } from "./accessibility-widget";
import type { WorldId } from "../data/world-data";

/* eslint-disable @next/next/no-img-element */

const destinations = ["צפון", "כנרת", "גליל מערבי", "מרכז", "ירושלים", "ים המלח", "אילת"];

const contextualLinks: Record<WorldId, { label: string; links: { href: string; label: string }[] }> = {
  vacation: {
    label: "יעדים פופולריים",
    links: destinations.map((item) => ({ href: `/search?location=${encodeURIComponent(item)}`, label: `נופש ב${item}` })),
  },
  events: {
    label: "אזורים מבוקשים",
    links: ["תל אביב", "מישור החוף והשפלה", "חיפה וחוף הכרמל", "מישור החוף הדרומי", "ראשון לציון", "נשר"].map((item) => ({ href: `/events/search?location=${encodeURIComponent(item)}`, label: item })),
  },
  corporate: {
    label: "אירועי חברה ורווחה",
    links: [
      { href: "/corporate#corporate-packages", label: "חבילות מוכנות לאירועי חברה" },
      { href: "/corporate#corporate-contact", label: "בניית חבילה עם מומחה" },
      { href: "/corporate#corporate-packages", label: "ימי גיבוש" },
      { href: "/corporate#corporate-packages", label: "רווחה במשרד" },
      { href: "/gift-card", label: "מתנות וגיפט קארד לעובדים" },
    ],
  },
  spa: {
    label: "בתי ספא לפי אזור",
    links: ["תל אביב", "ירושלים", "מרכז", "צפון", "חיפה"].map((item) => ({
      href: `/spas?location=${encodeURIComponent(item)}`,
      label: `ספא ב${item}`,
    })),
  },
  hourly: {
    label: "חדרים לפי שעה",
    links: ["תל אביב", "ראשון לציון", "חיפה", "ירושלים", "הרצליה"].map((item) => ({ href: `/hourly?location=${encodeURIComponent(item)}`, label: item })),
  },
  providers: {
    label: "ספקים",
    links: [
      { href: "/providers?category=food", label: "שפים ואוכל" },
      { href: "/providers?category=music", label: "מוזיקה" },
      { href: "/providers?category=photo", label: "צילום" },
      { href: "/providers?category=design", label: "עיצוב" },
      { href: "/providers?category=bar", label: "ברים" },
      { href: "/providers?category=wellness", label: "רווחה ותנועה" },
    ],
  },
  activities: {
    label: "מה עושים בסביבה",
    links: [
      { href: "/trails", label: "מסלולי טיולים" },
      { href: "/attractions", label: "אטרקציות בתשלום" },
      { href: "/trails?area=צפון", label: "מסלולים בצפון" },
      { href: "/trails?area=ירושלים", label: "מסלולים בירושלים" },
      { href: "/trails?area=אילת%20והסביבה", label: "מסלולים באילת" },
    ],
  },
};

export function SiteFooter({ variant = "vacation" }: { variant?: WorldId }) {
  const contextual = contextualLinks[variant];
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
