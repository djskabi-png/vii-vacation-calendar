import Link from "next/link";
import type { SearchMode } from "../data/search-taxonomy";

const quickSearches: Partial<Record<SearchMode, Array<{ label: string; href: string }>>> = {
  events: [
    { label: "ימי הולדת", href: "/events/search?eventType=יום+הולדת" },
    { label: "אירועים משפחתיים", href: "/events/search?eventType=אירוע+משפחתי" },
    { label: "מעל 100 משתתפים", href: "/events/search?guests=100" },
    { label: "ללא הגבלת רעש", href: "/events/search?noise=1" },
  ],
  spa: [
    { label: "ספא זוגי", href: "/spas/couples-spa" },
    { label: "יום כיף", href: "/spas/spa-day" },
    { label: "ספא במלון", href: "/spas/hotel-spa" },
    { label: "עם בריכה", href: "/spas/spa-with-pool" },
  ],
  hourly: [
    { label: "במרכז", href: "/hourly?location=מרכז" },
    { label: "עד 250 ₪ לשעתיים", href: "/hourly?maxPrice=250" },
    { label: "עם ג׳קוזי", href: "/hourly?features=jacuzzi" },
    { label: "כניסה עצמאית", href: "/hourly?features=independent" },
  ],
};

export function WorldQuickSearches({ mode }: { mode: SearchMode }) {
  const links = quickSearches[mode];
  if (!links?.length) return null;

  return <nav className="quick-links world-quick-links" aria-label="חיפושים מהירים">
    <span>חיפושים מהירים:</span>
    {links.map((link) => <Link key={link.href} href={link.href} data-global-feedback="true" data-loading-label={`פותחים ${link.label}...`}>{link.label}</Link>)}
  </nav>;
}
