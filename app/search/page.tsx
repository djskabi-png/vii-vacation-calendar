"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { PropertyCard } from "../components/property-card";
import { SearchBox } from "../components/search-box";
import { properties } from "../data/site-data";
import { CloseIcon, PinIcon } from "../site-header";

export default function SearchPage() {
  const [sort, setSort] = useState("recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pool, setPool] = useState(false);
  const [family, setFamily] = useState(false);
  const [whole, setWhole] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const filtered = useMemo(() => properties.filter((p) => (!pool || p.features.includes("בריכה")) && (!family || p.features.some((f) => f.includes("משפחות"))) && (!whole || p.scenario === "single")).sort((a,b) => sort === "rating" ? (b.score || 0) - (a.score || 0) : sort === "price" ? (a.price || 99999) - (b.price || 99999) : 0), [pool, family, whole, sort]);
  return (
    <PageShell>
      <main id="main-content" className="results-page">
        <div className="results-search shell"><SearchBox compact /></div>
        <div className="shell breadcrumbs"><Link href="/">ראשי</Link><span>/</span><span>תוצאות חיפוש</span></div>
        <section className="shell results-heading"><div><span className="eyebrow">מקומות שמתאימים לחיפוש</span><h1>נופש ברחבי הארץ</h1><p>{filtered.length} מקומות נבחרים מוצגים כרגע</p></div><button className="button map-button" type="button" onClick={() => setMapOpen((value) => !value)}><PinIcon />{mapOpen ? "סגירת מפה" : "תצוגת מפה"}</button></section>
        <div className={`shell results-layout ${mapOpen ? "with-map" : ""}`}>
          <aside className={`filter-panel ${filtersOpen ? "open" : ""}`} aria-label="סינון תוצאות"><div className="filter-head"><h2>סינון תוצאות</h2><button type="button" onClick={() => setFiltersOpen(false)} aria-label="סגירה"><CloseIcon /></button></div><fieldset><legend>סוג מקום</legend><label><input type="checkbox" checked={whole} onChange={(e) => setWhole(e.target.checked)} /> מקום אירוח שלם</label><label><input type="checkbox" /> וילה</label><label><input type="checkbox" /> סוויטה</label></fieldset><fieldset><legend>מאפיינים</legend><label><input type="checkbox" checked={pool} onChange={(e) => setPool(e.target.checked)} /> בריכה</label><label><input type="checkbox" checked={family} onChange={(e) => setFamily(e.target.checked)} /> מתאים למשפחות</label><label><input type="checkbox" /> ג׳קוזי</label><label><input type="checkbox" /> נוף</label></fieldset><fieldset><legend>טווח מחיר ללילה</legend><input type="range" min="500" max="3000" defaultValue="2200" aria-label="מחיר מרבי" /><div className="range-labels"><span>₪500</span><span>₪3,000</span></div></fieldset><button type="button" className="button primary filter-apply" onClick={() => setFiltersOpen(false)}>הצגת {filtered.length} מקומות</button></aside>
          <section className="results-list" aria-label="תוצאות"><div className="results-toolbar"><button type="button" className="button mobile-filter" onClick={() => setFiltersOpen(true)}>סינון</button><label>מיון לפי <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="recommended">הכי מתאימים</option><option value="rating">דירוג גבוה</option><option value="price">מחיר נמוך</option></select></label></div><div className="result-cards">{filtered.map((property) => <PropertyCard key={property.slug} property={property} />)}</div>{filtered.length === 0 && <div className="empty-state"><h2>לא מצאנו התאמה מדויקת</h2><p>אפשר להסיר מסנן אחד ולראות אפשרויות נוספות.</p><button className="button primary" type="button" onClick={() => { setPool(false); setFamily(false); setWhole(false); }}>ניקוי מסננים</button></div>}</section>
          {mapOpen && <aside className="map-panel"><div className="map-surface">{filtered.slice(0,4).map((property,index) => <button key={property.slug} style={{right:`${15 + (index*19)%68}%`,top:`${18 + (index*17)%60}%`}}><span>₪{property.price || "זמינות"}</span></button>)}</div><p>המפה האינטראקטיבית תחובר לשירות המפות של האתר.</p></aside>}
        </div>
        {filtersOpen && <button className="filter-backdrop" aria-label="סגירת סינון" onClick={() => setFiltersOpen(false)} />}
      </main>
    </PageShell>
  );
}
