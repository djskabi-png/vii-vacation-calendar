import Link from "next/link";
import { CurrencyText } from "./currency-text";
import type { SearchMode } from "../data/search-taxonomy";
import { spaSearchHref, spaSearchStateFromValues } from "../data/spa-search-landings";

const quickSearches: Partial<Record<SearchMode, Array<{ label: string; href: string }>>> = {
  spa: [
    { label: "ספא זוגי", href: "/spas/couples-spa" },
    { label: "יום כיף", href: "/spas/spa-day" },
    { label: "ספא במלון", href: "/spas/hotel-spa" },
    { label: "עם בריכה", href: "/spas/spa-with-pool" },
  ],
  hourly: [
    { label: "במרכז", href: "/hourly/search/center" },
    { label: "בצפון", href: "/hourly/search/north" },
    { label: "במישור החוף והשפלה", href: "/hourly/search/coastal-plain" },
    { label: "בשרון", href: "/hourly/search/sharon" },
  ],
};

export function WorldQuickSearches({ mode, initialLocation, initialSpaAudience }: { mode: SearchMode; initialLocation?: string; initialSpaAudience?: string }) {
  const links = quickSearches[mode];
  if (!links?.length) return null;
  const spaFeatureIds = ["couples", "day-pass", "hotel", "pool"];
  const contextualLinks = links.map((link, index) => {
    if (mode === "spa") return { ...link, href: spaSearchHref(spaSearchStateFromValues(initialLocation, initialSpaAudience, [spaFeatureIds[index]])) };
    return link;
  });

  return <nav className="quick-links world-quick-links" aria-label="חיפושים מהירים">
    <span>חיפושים מהירים:</span>
    {contextualLinks.map((link) => <Link key={link.href} href={link.href} data-global-feedback="true" data-loading-label={`פותחים ${link.label}...`}><CurrencyText text={link.label} /></Link>)}
  </nav>;
}
