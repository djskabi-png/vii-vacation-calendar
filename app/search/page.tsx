"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ListingMap } from "../components/listing-map";
import { PageShell } from "../components/page-shell";
import { PropertyCard } from "../components/property-card";
import { SearchBox } from "../components/search-box";
import { properties } from "../data/site-data";
import { getPlaceAccessibility } from "../data/accessibility-data";
import { CalendarIcon, CloseIcon, PinIcon } from "../site-header";

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
  const [requestedPeriod, setRequestedPeriod] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(location.search);
      const requestedArea = params.get("location");
      const requestedGuests = Number(params.get("guests") || 2);
      const requestedDates = params.get("dates");
      if (requestedArea && requestedArea !== "כל הארץ") setArea(requestedArea);
      if (Number.isFinite(requestedGuests)) setGuests(Math.max(1, requestedGuests));
      if (requestedDates) setRequestedPeriod(requestedDates);
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

  const activeFilters = [area !== "הכל" ? area : "", type !== "הכל" ? type : "", guests > 2 ? `${guests} אורחים ומעלה` : "", pool ? "בריכה" : "", spa ? "ספא וג'קוזי" : "", whole ? "מקום שלם" : "", accessibleOnly ? "נגישות מלאה ומאומתת" : ""].filter(Boolean);

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
        <section className="shell results-heading">
          <div><span className="eyebrow">מקומות שמתאימים לחיפוש</span><h1>{area === "הכל" ? "נופש ברחבי הארץ" : `נופש ב${area}`}</h1>{requestedPeriod && <div className="results-period"><CalendarIcon /><span>התקופה שבחרתם</span><strong>{requestedPeriod}</strong></div>}<p>{filtered.length} מתוך {properties.length} מקומות מאומתים מוצגים</p></div>
          <button className={`button map-button ${mapOpen ? "active" : ""}`} type="button" aria-pressed={mapOpen} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setMapOpen((value) => !value); }}><PinIcon />{mapOpen ? "תצוגת רשימה" : "תצוגה על מפה"}</button>
        </section>

        {activeFilters.length > 0 && <div className="shell active-filter-row"><span>סינונים פעילים:</span>{activeFilters.map((filter) => <button key={filter} type="button" onClick={resetFilters}>{filter} ×</button>)}<button type="button" className="clear-all" onClick={resetFilters}>ניקוי הכל</button></div>}

        <div className={`shell results-layout ${mapOpen ? "with-map" : ""}`}>
          <aside className={`filter-panel ${filtersOpen ? "open" : ""} ${mapOpen ? "map-mode" : ""}`} aria-label="סינון תוצאות">
            <div className="filter-head"><h2>סינון תוצאות</h2><button type="button" onClick={() => setFiltersOpen(false)} aria-label="סגירה"><CloseIcon /></button></div>
            {mapOpen && <div className="map-filter-status" aria-live="polite"><PinIcon /><span>האזור שמוצג במפה</span><strong>{area === "הכל" ? "כל הארץ" : area}</strong></div>}
            <label className={`filter-select map-area-select ${mapOpen ? "active" : ""}`}>אזור<select value={area} onChange={(event) => setArea(event.target.value)}>{areas.map((item) => <option value={item} key={item}>{item === "הכל" ? "כל הארץ" : item}</option>)}</select></label>
            <label className="filter-select">סוג מקום<select value={type} onChange={(event) => setType(event.target.value)}>{types.map((item) => <option key={item}>{item}</option>)}</select></label>
            <fieldset><legend>כמות אורחים מינימלית</legend><input type="range" min="1" max="30" value={guests} onChange={(event) => setGuests(Number(event.target.value))} /><div className="range-value">לפחות {guests} אורחים</div></fieldset>
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
            <div className="results-toolbar"><button type="button" className="button mobile-filter" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setFiltersOpen(true); }}>סינון</button><label>מיון לפי <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="recommended">מומלצים</option><option value="capacity">קיבולת גבוהה</option><option value="units">מספר יחידות</option><option value="name">שם המקום</option></select></label></div>
            {!mapOpen && <div className="result-cards">{filtered.map((property) => <PropertyCard key={property.slug} property={property} />)}</div>}
            {mapOpen && <ListingMap listings={filtered} autoLoad />}
            {filtered.length === 0 && <div className="empty-state"><h2>לא נמצאה התאמה מדויקת</h2><p>אפשר לשנות אזור, להפחית את כמות האורחים או להסיר מאפיין.</p><button className="button primary" type="button" onClick={resetFilters}>ניקוי סינונים</button></div>}
          </section>
        </div>
        {filtersOpen && <button className="filter-backdrop" aria-label="סגירת סינון" onClick={() => setFiltersOpen(false)} />}
      </main>
    </PageShell>
  );
}
