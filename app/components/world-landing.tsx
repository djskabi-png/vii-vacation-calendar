import Link from "next/link";
import { BreadcrumbTrail } from "./breadcrumb-trail";
import { PageShell } from "./page-shell";
import { DiscoveryCard } from "./discovery-card";
import { SearchBox } from "./search-box";
import type { SearchMode } from "../data/search-taxonomy";
import type { DiscoveryItem, WorldId } from "../data/world-data";
import { HourlyResults } from "./hourly-results";
import { ProviderResults } from "./provider-results";
import { WorldMapResults } from "./world-map-results";
import type { BreadcrumbTrailItem } from "./breadcrumb-trail";
import { WorldQuickSearches } from "./world-quick-searches";
import { SemanticWorldHeading } from "./semantic-world-heading";
import { SearchAfterResults } from "./search-after-results";

const crossSellByWorld = {
  hourly: {
    eyebrow: "רוצים להמשיך מכאן?",
    title: "משהייה קצרה לחופשה או ליום של פינוק",
    description: "אם אתם מחפשים יותר מכמה שעות, אפשר לעבור למקומות לינה ללילה שלם או לבחור חבילת ספא שמתאימה לזוג וליחיד.",
    links: [
      { href: "/", label: "למקומות נופש" },
      { href: "/spas", label: "לחבילות ספא" },
    ],
  },
  spa: {
    eyebrow: "משלימים את החוויה",
    title: "הופכים את הטיפול ליום שלם",
    description: "אפשר לשלב את הספא עם מקום לינה, מסעדה, מסלול או פעילות קרובה ולבנות יום שמתאים בדיוק לכם.",
    links: [
      { href: "/", label: "למקומות נופש" },
      { href: "/trails", label: "למסלולי טיול" },
      { href: "/attractions", label: "לאטרקציות" },
    ],
  },
  providers: {
    eyebrow: "מתכננים את האירוע השלם",
    title: "מוצאים מקום שמתאים לספק שבחרתם",
    description: "עברו למתחמי האירועים, התאימו מקום לכמות המשתתפים והשלימו את כל השירותים בלי לצאת מהאתר.",
    links: [
      { href: "/events", label: "למקומות לאירועים" },
      { href: "/corporate", label: "לאירועי חברה" },
    ],
  },
} as const;

export function WorldLanding({
  world,
  title,
  description,
  items,
  searchMode,
  sourceNote,
  activeSpaFilter,
  initialSearchLocation,
  initialSpaAudience,
  initialSpaFilters,
  breadcrumbItems,
  collectionTitle: customCollectionTitle,
}: {
  world: WorldId;
  title: string;
  description: string;
  items: DiscoveryItem[];
  searchMode?: SearchMode;
  sourceNote?: string;
  activeSpaFilter?: string;
  initialSearchLocation?: string;
  initialSpaAudience?: string;
  initialSpaFilters?: string[];
  breadcrumbItems?: BreadcrumbTrailItem[];
  collectionTitle?: string;
}) {
  const crossSell = world === "hourly" || world === "spa" || world === "providers"
    ? crossSellByWorld[world]
    : null;
  const worldLabel = world === "spa" ? "בתי ספא" : world === "hourly" ? "חדרים לפי שעה" : world === "providers" ? "ספקים" : world === "activities" ? "אטרקציות" : "מקומות";
  const collectionTitle = customCollectionTitle || (world === "spa"
    ? "בתי ספא לפי אזור וסוג חוויה"
    : world === "hourly"
      ? "חדרים לפי שעה בישראל"
      : world === "providers"
        ? `${items.length} ספקים ושירותים`
        : `${items.length} ${worldLabel}`);

  return <PageShell variant={world}>
    <main id="main-content" className={`world-page world-page--${world}`}>
      {searchMode && <section className="world-hero"><div className="shell world-hero__inner"><SearchBox mode={searchMode} compact showWorlds initialLocation={initialSearchLocation} initialSpaAudience={initialSpaAudience} initialSpaFeatures={initialSpaFilters} /></div></section>}
      <BreadcrumbTrail className="world-breadcrumbs" items={breadcrumbItems || [{ name: "ראשי", path: "/" }, { name: worldLabel }]} />
      <section className="world-page-heading shell">
        <SemanticWorldHeading mode={searchMode} title={title} description={description} />
        {searchMode && world !== "spa" && world !== "hourly" && <WorldQuickSearches mode={searchMode} initialLocation={initialSearchLocation} initialSpaAudience={initialSpaAudience} />}
      </section>
      <section className="section shell">
        {world !== "spa" && world !== "hourly" && <div className="section-head world-results-title"><div><h2>{collectionTitle}</h2></div>{sourceNote && <p className="source-note">{sourceNote}</p>}</div>}
        {world === "hourly" ? <HourlyResults items={items} initialLocation={initialSearchLocation} /> : world === "providers" ? <ProviderResults items={items} /> : world === "spa" ? <WorldMapResults items={items} world="spa" activeSpaFilter={activeSpaFilter} initialLocation={initialSearchLocation} initialSpaAudience={initialSpaAudience} initialSpaFilters={initialSpaFilters} /> : <div className="discovery-grid">{items.map((item) => <DiscoveryCard key={item.id} item={item} />)}</div>}
      </section>
      {(world === "hourly" || world === "spa" || world === "providers" || world === "activities") ? <SearchAfterResults world={world} location={initialSearchLocation} reviewHighlights={items.filter((item) => typeof item.rating === "number").sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 3).map((item) => ({ name: item.name, href: `/discover/place/${item.id}`, rating: item.rating || 0, context: item.sourceName ? `דירוג מתוך ${item.sourceName}` : undefined }))} /> : null}
      {crossSell && <section className="section section-tint world-cross-sell"><div className="shell"><span className="eyebrow">{crossSell.eyebrow}</span><h2>{crossSell.title}</h2><p>{crossSell.description}</p><div>{crossSell.links.map((link, index) => <Link key={link.href} className={`button ${index === 0 ? "primary" : "secondary"}`} href={link.href}>{link.label}</Link>)}</div></div></section>}
    </main>
  </PageShell>;
}
