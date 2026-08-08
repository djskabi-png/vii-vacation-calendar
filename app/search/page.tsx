"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListingMap } from "../components/listing-map";
import { ModernSelect } from "../components/modern-select";
import { PageShell } from "../components/page-shell";
import { PropertyCard } from "../components/property-card";
import { SearchBox } from "../components/search-box";
import { properties } from "../data/site-data";
import { getPlaceAccessibility } from "../data/accessibility-data";
import { CloseIcon, MapIcon, PinIcon } from "../site-header";
import { useSiteLanguage } from "../i18n/locale-provider";
import { localizedPath } from "../i18n/locale-routing";
import { footerTopicForPropertyType } from "../data/footer-context";
import { cleanAccommodationPath } from "../data/accommodation-landings";

export type SearchLandingContext = {
  path: string;
  title: string;
  description: string;
  breadcrumb: string;
  type: string;
  types?: string[];
  area?: string;
  listingSlugs?: string[];
};

export function SearchExperience({ landing }: { landing?: SearchLandingContext }) {
  const router = useRouter();
  const { language } = useSiteLanguage();
  const [sort, setSort] = useState("recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [area, setArea] = useState(landing?.area || "הכל");
  const [type, setType] = useState(landing?.type || "הכל");
  const [guests, setGuests] = useState(2);
  const [pool, setPool] = useState(false);
  const [spa, setSpa] = useState(false);
  const [whole, setWhole] = useState(false);
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [visibleMapCount, setVisibleMapCount] = useState(0);

  function updateSearchContext(updates: Record<string, string | null>, nextType = type, nextArea = area) {
    const params = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) params.delete(key);
      else params.set(key, value);
    });
    const defaultGuests = (params.get("guests") || "2") === "2";
    const hasTemporaryFilters = Array.from(params.keys()).some((key) => !["location", "type", "guests"].includes(key)) || !defaultGuests;
    const cleanPath = nextType !== "הכל" ? cleanAccommodationPath(nextType, nextArea) : null;
    if (cleanPath) {
      params.delete("location");
      params.delete("type");
      if (defaultGuests) params.delete("guests");
    }
    const query = params.toString();
    const path = cleanPath || "/search";
    router.replace(localizedPath(query && (cleanPath || hasTemporaryFilters) ? `${path}?${query}` : path, language), { scroll: false });
  }

  function changeArea(nextArea: string) {
    setArea(nextArea);
    updateSearchContext({ location: nextArea === "הכל" ? "כל הארץ" : nextArea }, type, nextArea);
  }

  function changeGuests(nextGuests: number) {
    setGuests(nextGuests);
    updateSearchContext({ guests: nextGuests === 2 ? null : String(nextGuests) });
  }

  function changeType(nextType: string) {
    setType(nextType);
    updateSearchContext({ type: nextType === "הכל" ? null : nextType }, nextType, area);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const requestedArea = params.get("location");
      const requestedGuests = Number(params.get("guests") || 2);
      const requestedType = params.get("type");
      const requestedPath = requestedType ? cleanAccommodationPath(requestedType, requestedArea || "כל הארץ") : null;
      if (!landing && requestedPath) {
        params.delete("location");
        params.delete("type");
        if (requestedGuests === 2) params.delete("guests");
        const query = params.toString();
        router.replace(localizedPath(query ? `${requestedPath}?${query}` : requestedPath, language), { scroll: false });
        return;
      }
      if (requestedArea && requestedArea !== "כל הארץ") setArea(requestedArea);
      else if (landing?.area) setArea(landing.area);
      if (Number.isFinite(requestedGuests)) setGuests(Math.max(1, requestedGuests));
      if (requestedType) setType(requestedType);
      else if (landing?.type) setType(landing.type);
      setPool(params.get("pool") === "1");
      setSpa(params.get("spa") === "1");
      setWhole(params.get("whole") === "1");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [landing, language, router]);

  const areas = useMemo(() => ["הכל", ...Array.from(new Set(properties.flatMap((property) => [property.area, property.location])))], []);
  const types = useMemo(() => ["הכל", ...Array.from(new Set(properties.map((p) => p.type)))], []);
  const mapCandidates = useMemo(() => properties.filter((property) => {
      const matchesType = type === "הכל" || (landing?.types?.length && type === landing.type ? landing.types.includes(property.type) : property.type === type);
      const matchesGuests = property.guests >= guests;
      const matchesPool = !pool || property.features.some((feature) => feature.includes("בריכ"));
      const matchesSpa = !spa || property.features.some((feature) => feature.includes("ג'קוזי") || feature.includes("ספא") || feature.includes("סאונה"));
      const matchesWhole = !whole || property.scenario === "single";
      const matchesAccessibility = !accessibleOnly || getPlaceAccessibility(property.slug).status === "accessible";
      return matchesType && matchesGuests && matchesPool && matchesSpa && matchesWhole && matchesAccessibility;
    }), [accessibleOnly, guests, landing, pool, spa, type, whole]);

  const filtered = useMemo(() => {
    const useLandingSet = Boolean(landing?.listingSlugs?.length && (!landing.area || area === landing.area));
    const matches = mapCandidates.filter((property) => useLandingSet ? landing?.listingSlugs?.includes(property.slug) : area === "הכל" || property.area === area || property.location === area);
    return [...matches].sort((a, b) => {
      if (sort === "capacity") return b.guests - a.guests;
      if (sort === "units") return (b.units || 1) - (a.units || 1);
      if (sort === "name") return a.name.localeCompare(b.name, "he");
      return properties.indexOf(a) - properties.indexOf(b);
    });
  }, [area, landing, mapCandidates, sort]);

  const activeFilters = [
    area !== "הכל" ? { id: "area", label: area, remove: () => changeArea("הכל") } : null,
    type !== "הכל" ? { id: "type", label: type, remove: () => changeType("הכל") } : null,
    guests > 2 ? { id: "guests", label: `${guests} אורחים ומעלה`, remove: () => changeGuests(2) } : null,
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
    updateSearchContext({ location: "כל הארץ", guests: null, type: null }, "הכל", "הכל");
  }

  return (
    <PageShell footerTopic={footerTopicForPropertyType(type)}>
      <main id="main-content" className="results-page">
        <div className="results-search shell"><SearchBox compact initialLocation={area === "הכל" ? "כל הארץ" : area} initialGuests={guests} basePath={landing?.path} /></div>
        <div className="shell breadcrumbs"><Link href="/">ראשי</Link><span>/</span>{landing ? <><Link href="/search">מקומות נופש</Link><span>/</span><span>{landing.breadcrumb}</span></> : <span>תוצאות חיפוש</span>}</div>
        <div className={`shell results-layout ${mapOpen ? "with-map" : ""}`}>
          <aside className={`filter-panel ${filtersOpen ? "open" : ""} ${mapOpen ? "map-mode" : ""}`} aria-label="סינון תוצאות">
            <div className="filter-head"><h2>סינון תוצאות</h2><button type="button" onClick={() => setFiltersOpen(false)} aria-label="סגירה"><CloseIcon /></button></div>
            {mapOpen && <div className="map-filter-status" aria-live="polite"><PinIcon /><span>האזור שמוצג במפה</span><strong>{area === "הכל" ? "כל הארץ" : area}</strong></div>}
            <ModernSelect className={`map-area-select ${mapOpen ? "active" : ""}`} label="אזור" value={area} onChange={changeArea} options={areas.map((item) => ({ value: item, label: item === "הכל" ? "כל הארץ" : item }))} />
            <ModernSelect label="סוג מקום" value={type} onChange={changeType} options={types.map((item) => ({ value: item, label: item }))} />
            <fieldset><legend>כמות אורחים מינימלית</legend><input type="range" min="1" max="30" value={guests} aria-label="כמות אורחים מינימלית" onChange={(event) => changeGuests(Number(event.target.value))} /><div className="range-value">לפחות {guests} אורחים</div></fieldset>
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
              <div><span className="eyebrow">מקומות פעילים שנבדקו</span><h1>{landing?.title || (area === "הכל" ? "נופש ברחבי הארץ" : `נופש ב${area}`)}</h1><p>{landing?.description || (mapOpen ? `${visibleMapCount} מקומות באזור המוצג במפה` : area === "הכל" ? `נמצאו ${filtered.length} מקומות` : `נמצאו ${filtered.length} מקומות ב${area}`)}</p></div>
            </section>
            {activeFilters.length > 0 && <div className="active-filter-row"><span>סינונים פעילים:</span>{activeFilters.map((filter) => <button key={filter.id} type="button" onClick={filter.remove} aria-label={`הסרת הסינון ${filter.label}`}>{filter.label} ×</button>)}<button type="button" className="clear-all" onClick={resetFilters}>ניקוי הכל</button></div>}
            <div className="results-toolbar"><div className="results-toolbar__actions"><button type="button" className="button mobile-filter" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setFiltersOpen(true); }}>סינון</button>{filtered.length > 0 && <button className={`button map-button mobile-map-fab ${mapOpen ? "active" : ""}`} type="button" aria-label={mapOpen ? "חזרה לתצוגת רשימה" : "הצגת תוצאות על המפה"} aria-pressed={mapOpen} onClick={(event) => { event.preventDefault(); event.stopPropagation(); if (!mapOpen) setVisibleMapCount(filtered.length); setMapOpen(!mapOpen); }}><MapIcon /><span className="map-button__desktop-label">{mapOpen ? "תצוגת רשימה" : "תצוגה על מפה"}</span><span className="map-button__mobile-label" aria-hidden="true">מפה</span></button>}</div><ModernSelect compact label="מיון לפי" value={sort} onChange={setSort} options={[{ value: "recommended", label: "מומלצים" }, { value: "capacity", label: "קיבולת גבוהה" }, { value: "units", label: "מספר יחידות" }, { value: "name", label: "שם המקום" }]} /></div>
            {!mapOpen && <div className="result-cards">{filtered.map((property) => <PropertyCard key={property.slug} property={property} />)}</div>}
            {mapOpen && <ListingMap listings={mapCandidates} initialListings={filtered} autoLoad onClose={() => setMapOpen(false)} onVisibleCountChange={setVisibleMapCount} />}
            {filtered.length === 0 && <div className="empty-state"><h2>לא נמצאה התאמה מדויקת</h2><p>אפשר לשנות אזור, להפחית את כמות האורחים או להסיר מאפיין.</p><button className="button primary" type="button" onClick={resetFilters}>ניקוי סינונים</button></div>}
            {landing && filtered.length > 0 && <section className="accommodation-landing-copy" aria-labelledby="accommodation-guide-title"><div><span className="eyebrow">מידע שימושי לפני שמזמינים</span><h2 id="accommodation-guide-title">איך בוחרים {landing.breadcrumb}</h2><p>בדקו את מספר חדרי השינה והיחידות, התאמה להרכב האורחים, מתקנים פעילים ומדיניות ההזמנה. בכל כרטיס אפשר להמשיך לעמוד המקום ולראות את התמונות, החדרים והפרטים המלאים.</p></div><div className="accommodation-landing-copy__links"><Link href="/guides">מדריכי נופש</Link><Link href="/questions">שאלות ותשובות</Link><Link href="/gift-card">גיפט קארד לחופשה</Link></div></section>}
          </section>
        </div>
        {filtersOpen && <button className="filter-backdrop" aria-label="סגירת סינון" onClick={() => setFiltersOpen(false)} />}
      </main>
    </PageShell>
  );
}

export default function SearchPage() {
  return <SearchExperience />;
}
