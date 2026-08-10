import Link from "next/link";
import type { SearchMode } from "../data/search-taxonomy";
import { eventSearchHref, hourlySearchHref } from "../data/world-search-landings";
import { spaSearchHref, spaSearchStateFromValues } from "../data/spa-search-landings";

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

export function WorldQuickSearches({ mode, initialLocation, initialSpaAudience }: { mode: SearchMode; initialLocation?: string; initialSpaAudience?: string }) {
  const links = quickSearches[mode];
  if (!links?.length) return null;
  const spaFeatureIds = ["couples", "day-pass", "hotel", "pool"];
  const contextualLinks = links.map((link, index) => {
    if (mode === "spa") return { ...link, href: spaSearchHref(spaSearchStateFromValues(initialLocation, initialSpaAudience, [spaFeatureIds[index]])) };
    if (mode === "events" && initialLocation) return { ...link, href: `${eventSearchHref(initialLocation)}${link.href.includes("?") ? link.href.slice(link.href.indexOf("?")) : ""}` };
    if (mode === "hourly" && initialLocation) return { ...link, href: `${hourlySearchHref(initialLocation)}${link.href.includes("?") ? link.href.slice(link.href.indexOf("?")) : ""}` };
    return link;
  });

  return <nav className="quick-links world-quick-links" aria-label="חיפושים מהירים">
    <span>חיפושים מהירים:</span>
    {contextualLinks.map((link) => <Link key={link.href} href={link.href} data-global-feedback="true" data-loading-label={`פותחים ${link.label}...`}>{link.label}</Link>)}
  </nav>;
}
