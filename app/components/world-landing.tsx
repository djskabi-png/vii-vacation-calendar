import Link from "next/link";
import { PageShell } from "./page-shell";
import { DiscoveryCard } from "./discovery-card";
import { SearchBox, type SearchMode } from "./search-box";
import type { DiscoveryItem, WorldId } from "../data/world-data";

export function WorldLanding({
  world,
  eyebrow,
  title,
  description,
  items,
  searchMode,
  sourceNote,
}: {
  world: WorldId;
  eyebrow: string;
  title: string;
  description: string;
  items: DiscoveryItem[];
  searchMode?: SearchMode;
  sourceNote?: string;
}) {
  return <PageShell variant={world}>
    <main id="main-content" className={`world-page world-page--${world}`}>
      <section className="world-hero"><div className="shell"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p>{searchMode && <SearchBox mode={searchMode} showWorlds />}</div></section>
      <section className="section shell">
        <div className="section-head"><div><span className="eyebrow">מקומות ורעיונות שכדאי להכיר</span><h2>{items.length} אפשרויות להתחיל מהן</h2></div>{sourceNote && <p className="source-note">{sourceNote}</p>}</div>
        <div className="discovery-grid">{items.map((item) => <DiscoveryCard key={item.id} item={item} />)}</div>
      </section>
      <section className="section section-tint world-cross-sell"><div className="shell"><span className="eyebrow">החיבור שעושה את ההבדל</span><h2>לא רק מקום. כל מה שצריך מסביב.</h2><p>בכל דף מקום יוצגו בהמשך הספא, הספקים, האוכל והפעילויות שבאמת קרובים אליו.</p><div><Link className="button primary" href="/">חזרה לעולם הנופש</Link><Link className="button secondary" href="/events/">לעולם האירועים</Link></div></div></section>
    </main>
  </PageShell>;
}
