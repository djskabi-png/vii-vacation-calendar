"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ListingMap } from "../components/listing-map";
import { ModernSelect } from "../components/modern-select";
import { PageShell } from "../components/page-shell";
import { PropertyCard } from "../components/property-card";
import { SearchBox } from "../components/search-box";
import { properties } from "../data/site-data";
import { getPlaceAccessibility } from "../data/accessibility-data";
import { CloseIcon, MapIcon, PinIcon } from "../site-header";

export default function SearchPage() {
  const [sort, setSort] = useState("recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [area, setArea] = useState("הכל");
  const [type, setType] = useState("הכל");
  const [guests, setGuests] = useState(2);
  const [pool, setPool] = useState(false);
  const [spa, setSpa] = useState(false);
  const [whole, setWhole] = useState(false);
  const [accessibleOnly, setAccessibleOnly] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(location.search);
      const requestedArea = params.get("location");
      const requestedGuests = Number(params.get("guests") || 2);
      if (requestedArea && requestedArea !== "כל הארץ") setArea(requestedArea);
      if (Number.isFinite(requestedGuests)) setGuests(Math.max(1, requestedGuests));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const areas = useMemo(() => ["הכל", ...Array.from(new Set(properties.map((p) => p.area)))], []);
  const types = useMemo(() => ["הכל", ...Array.from(new Set(properties.map((p) => p.type)))], []);
  const filtered = useMemo(() => {
    const matches = properties.filter((property) => {
      const matchesArea = area === "הכל" || property.area === area || property.location === area;
      const matchesType = type === "הכל" || property.type === type;
      const matchesGuests = property.guests >= guests;
      const matchesPool = !pool || property.features.some((feature) => feature.includes("בריכ"));
      const matchesSpa = !spa || property.features.some((feature) => feature.includes("ג'קוזי") || feature.includes("ספא") || feature.includes("סאונה"));
      const matchesWhole = !whole || property.scenario === "single";
      const matchesAccessibility = !accessibleOnly || getPlaceAccessibility(property.slug).status === "accessible";
      return matchesArea && matchesType && matchesGuests && matchesPool && matchesSpa && matchesWhole && matchesAccessibility;
    });
    return [...matches].sort((a, b) => {
      if (sort === "capacity") return b.guests - a.guests;
      if (sort === "units") return (b.units || 1) - (a.units || 1);
      if (sort === "name") return a.name.localeCompare(b.name, "he");
      return properties.indexOf(a) - properties.indexOf(b);
    });
  }, [accessibleOnly, area, guests, pool, sort, spa, type, whole]);

  const activeFilters = [
    area !== "הכל" ? { id: "area", label: area, remove: () => setArea("הכל") } : null,
    type !== "הכל" ? { id: "type", label: type, remove: () => setType("הכל") } : null,
    guests > 2 ? { id: "guests", label: `${guests} אורחים ומעלה`, remove: () => setGuests(2) } : null,
    pool ? { id: "pool", label: "בריכה", remove: () => setPool(false) } : null,
    spa ? { id: "spa", label: "ספא וג'קוזי", remove: () => setSpa(false) } : null,
    whole ? { id: "whole", label: "מקום שלם", remove: () => setWhole(false) } : null,
    accessibleOnly ? { id: "accessible", label: "נגישות מלאה ומאומתת", remove: () => setAccessibleOnly(false) } : null,
  ].filter((filter): filter is { id: string; label: string; remove: () => void } => Boolean(filter));

  function resetFilters() {
    setArea("הכל");
    setType("הכל");
    setGuests(2);
    setPool(false);
    setSpa(false);
    setWhole(false);
    setAccessibleOnly(false);
  }

  return (
    <PageShell>
      <main id="main-content" className="results-page">
        <div className="results-search shell"><SearchBox compact /></div>
        <div className="shell breadcrumbs"><Link href="/">ראשי</Link><span>/</span><span>תוצאות חיפוש</span></div>
        <div className={`shell results-layout ${mapOpen ? "with-map" : ""}`}>
          <aside className={`filter-panel ${filtersOpen ? "open" : ""} ${mapOpen ? "map-mode" : ""}`} aria-label="סינון תוצאות">
            <div className="filter-head"><h2>סינון תוצאות</h2><button type="button" onClick={() => setFiltersOpen(false)} aria-label="סגירה"><CloseIcon /></button></div>
            {mapOpen && <div className="map-filter-status" aria-live="polite"><PinIcon /><span>האזור שמוצג במפה</span><strong>{area === "הכל" ? "כל הארץ" : area}</strong></div>}
            <ModernSelect className={`map-area-select ${mapOpen ? "active" : ""}`} label="אזור" value={area} onChange={setArea} options={areas.map((item) => ({ value: item, label: item === "הכל" ? "כל הארץ" : item }))} />
            <ModernSelect label="סוג מקום" value={type} onChange={setType} options={types.map((item) => ({ value: item, label: item }))} />
            <fieldset><legend>כמות אורחים מינימלית</legend><input type="range" min="1" max="30" value={guests} aria-label="כמות אורחים מינימלית" onChange={(event) => setGuests(Number(event.target.value))} /><div className="range-value">לפחות {guests} אורחים</div></fieldset>
            <fieldset><legend>מאפיינים</legend>
              <label><input type="checkbox" checked={pool} onChange={(event) => setPool(event.target.checked)} /> בריכה</label>
              <label><input type="checkbox" checked={spa} onChange={(event) => setSpa(event.target.checked)} /> ספא, ג׳קוזי או סאונה</label>
              <label><input type="checkbox" checked={whole} onChange={(event) => setWhole(event.target.checked)} /> מקום אירוח שלם</label>
              <label><input type="checkbox" checked={accessibleOnly} onChange={(event) => setAccessibleOnly(event.target.checked)} /> נגישות מלאה ומאומתת</label>
            </fieldset>
            <button type="button" className="button primary filter-apply" onClick={() => setFiltersOpen(false)}>{`הצגת ${filtered.length} מקומות`}</button>
            <button type="button" className="button subtle wide" onClick={resetFilters}>ניקוי סינונים</button>
          </aside>

          <section className="results-list" aria-label="תוצאות">
            <section className="results-heading">
              <div><span className="eyebrow">מקומות שמתאימים לחיפוש</span><h1>{area === "הכל" ? "נופש ברחבי הארץ" : `נופש ב${area}`}</h1><p>{`${filtered.length} מתוך ${properties.length} מקומות מאומתים מוצגים`}</p></div>
            </section>
            {activeFilters.length > 0 && <div className="active-filter-row"><span>סינונים פעילים:</span>{activeFilters.map((filter) => <button key={filter.id} type="button" onClick={filter.remove} aria-label={`הסרת הסינון ${filter.label}`}>{filter.label} ×</button>)}<button type="button" className="clear-all" onClick={resetFilters}>ניקוי הכל</button></div>}
            <div className="results-toolbar"><div className="results-toolbar__actions"><button type="button" className="button mobile-filter" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setFiltersOpen(true); }}>סינון</button><button className={`button map-button mobile-map-fab ${mapOpen ? "active" : ""}`} type="button" aria-pressed={mapOpen} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setMapOpen((value) => !value); }}><MapIcon />{mapOpen ? "תצוגת רשימה" : "תצוגה על מפה"}</button></div><ModernSelect compact label="מיון לפי" value={sort} onChange={setSort} options={[{ value: "recommended", label: "מומלצים" }, { value: "capacity", label: "קיבולת גבוהה" }, { value: "units", label: "מספר יחידות" }, { value: "name", label: "שם המקום" }]} /></div>
            {!mapOpen && <div className="result-cards">{filtered.map((property) => <PropertyCard key={property.slug} property={property} />)}</div>}
            {mapOpen && <ListingMap listings={filtered} autoLoad onClose={() => setMapOpen(false)} />}
            {filtered.length === 0 && <div className="empty-state"><h2>לא נמצאה התאמה מדויקת</h2><p>אפשר לשנות אזור, להפחית את כמות האורחים או להסיר מאפיין.</p><button className="button primary" type="button" onClick={resetFilters}>ניקוי סינונים</button></div>}
          </section>
        </div>
        {filtersOpen && <button className="filter-backdrop" aria-label="סגירת סינון" onClick={() => setFiltersOpen(false)} />}
      </main>
    </PageShell>
  );
}
