"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ListingMap } from "../../components/listing-map";
import { ModernSelect } from "../../components/modern-select";
import { PageShell } from "../../components/page-shell";
import { SearchBox } from "../../components/search-box";
import { eventPlaceHref, eventPlaces } from "../../data/site-data";
import { getPlaceAccessibility } from "../../data/accessibility-data";
import { CloseIcon, MapIcon, PinIcon } from "../../site-header";
import { FavoriteButton } from "../../components/favorite-button";
import { BreadcrumbTrail } from "../../components/breadcrumb-trail";
import { useSearchParams } from "next/navigation";
import { useMapViewState } from "../../components/map-view-state";

export default function EventSearchPage() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.toString();
  const [area, setArea] = useState("הכל");
  const [type, setType] = useState("הכל");
  const [eventType, setEventType] = useState("הכל");
  const [guests, setGuests] = useState(0);
  const [noNoiseLimit, setNoNoiseLimit] = useState(false);
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const { mapOpen, closeMap, toggleMap } = useMapViewState();
  const [sort, setSort] = useState("recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mapVisibleIds, setMapVisibleIds] = useState<string[] | null>(null);

  function updateUrl(updates: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([key, value]) => value === null ? params.delete(key) : params.set(key, value));
    const query = params.toString();
    window.history.pushState({}, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
  }

  function changeFilter(key: "location" | "type" | "eventType" | "guests" | "noise" | "accessible" | "sort", value: string | boolean | number) {
    if (key === "location") setArea(String(value));
    if (key === "type") setType(String(value));
    if (key === "eventType") setEventType(String(value));
    if (key === "guests") setGuests(Number(value));
    if (key === "noise") setNoNoiseLimit(Boolean(value));
    if (key === "accessible") setAccessibleOnly(Boolean(value));
    if (key === "sort") setSort(String(value));
    const isDefault = value === false || value === 0 || value === "הכל" || value === "recommended";
    updateUrl({ [key]: isDefault ? null : String(value === true ? 1 : value) });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchQuery);
      const requestedArea = params.get("location");
      const requestedGuests = Number(params.get("guests") || 0);
      if (requestedArea && requestedArea !== "כל הארץ") setArea(requestedArea);
      if (Number.isFinite(requestedGuests) && requestedGuests > 0) setGuests(Math.max(10, requestedGuests));
      if (params.get("type")) setType(params.get("type") || "הכל");
      if (params.get("eventType")) setEventType(params.get("eventType") || "הכל");
      setNoNoiseLimit(params.get("noise") === "1");
      setAccessibleOnly(params.get("accessible") === "1");
      if (["capacity", "name"].includes(params.get("sort") || "")) setSort(params.get("sort") || "recommended");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const areas = useMemo(() => ["הכל", ...Array.from(new Set(eventPlaces.map((place) => place.area)))], []);
  const types = useMemo(() => ["הכל", ...Array.from(new Set(eventPlaces.map((place) => place.type)))], []);
  const eventTypes = useMemo(() => ["הכל", ...Array.from(new Set(eventPlaces.flatMap((place) => place.eventTypes)))], []);
  const filtered = useMemo(() => {
    const result = eventPlaces.filter((place) => (area === "הכל" || place.area === area || place.location === area) && (type === "הכל" || place.type === type) && (eventType === "הכל" || place.eventTypes.includes(eventType)) && (!guests || place.guests >= guests) && (!noNoiseLimit || place.features.some((feature) => feature.includes("ללא הגבלת רעש"))) && (!accessibleOnly || getPlaceAccessibility(place.slug).status === "accessible"));
    return [...result].sort((a, b) => sort === "capacity" ? b.guests - a.guests : sort === "name" ? a.name.localeCompare(b.name, "he") : eventPlaces.indexOf(a) - eventPlaces.indexOf(b));
  }, [accessibleOnly, area, eventType, guests, noNoiseLimit, sort, type]);

  const displayed = useMemo(() => {
    if (!mapVisibleIds) return filtered;
    const visible = new Set(mapVisibleIds);
    return filtered.filter((place) => visible.has(place.slug));
  }, [filtered, mapVisibleIds]);

  useEffect(() => {
    const timer = window.setTimeout(() => setMapVisibleIds(null), 0);
    return () => window.clearTimeout(timer);
  }, [accessibleOnly, area, eventType, guests, noNoiseLimit, sort, type]);

  function reset() { setArea("הכל"); setType("הכל"); setEventType("הכל"); setGuests(0); setNoNoiseLimit(false); setAccessibleOnly(false); setSort("recommended"); updateUrl({ location: null, type: null, eventType: null, guests: null, noise: null, accessible: null, sort: null }); }

  const activeFilterCount = [area !== "הכל", type !== "הכל", eventType !== "הכל", guests > 0, noNoiseLimit, accessibleOnly].filter(Boolean).length;
  const sortOptions = [{ value: "recommended", label: "מומלצים" }, { value: "capacity", label: "קיבולת גבוהה" }, { value: "name", label: "שם המקום" }];

  const eventBreadcrumbFilters = [area !== "הכל" ? area : null, type !== "הכל" ? type : null, eventType !== "הכל" ? eventType : null, guests ? `${guests} משתתפים ומעלה` : null].filter((item): item is string => Boolean(item));

  return (
    <PageShell variant="events">
      <main id="main-content" className="results-page events-results-page">
        <div className="results-search shell"><SearchBox mode="events" compact /></div>
        <BreadcrumbTrail items={[{ name: "ראשי", path: "/" }, { name: "אירועים", path: "/events" }, { name: "מקומות לאירועים", path: eventBreadcrumbFilters.length ? "/events/search" : undefined }, ...(eventBreadcrumbFilters.length ? [{ name: eventBreadcrumbFilters.join(" · ") }] : [])]} />
        <div className="shell event-results-layout">
          <aside className={`filter-panel ${filtersOpen ? "open" : ""}`}><div className="filter-head"><h2>סינון</h2><button type="button" onClick={() => setFiltersOpen(false)} aria-label="סגירה"><CloseIcon /></button></div>
            <ModernSelect label="אזור" value={area} onChange={(value) => changeFilter("location", value)} options={areas.map((item) => ({ value: item, label: item }))} />
            <ModernSelect label="סוג מקום" value={type} onChange={(value) => changeFilter("type", value)} options={types.map((item) => ({ value: item, label: item }))} />
            <ModernSelect label="סוג אירוע" value={eventType} onChange={(value) => changeFilter("eventType", value)} options={eventTypes.map((item) => ({ value: item, label: item }))} />
            <fieldset><legend>כמות משתתפים</legend><input type="range" min="0" max="300" step="10" value={guests} aria-label="כמות משתתפים מינימלית" onChange={(event) => changeFilter("guests", Number(event.target.value))} /><div className="range-value">{guests ? `לפחות ${guests} משתתפים` : "ללא סינון לפי כמות"}</div></fieldset>
            <label><input type="checkbox" checked={noNoiseLimit} onChange={(event) => changeFilter("noise", event.target.checked)} /> ללא הגבלת רעש</label>
            <label><input type="checkbox" checked={accessibleOnly} onChange={(event) => changeFilter("accessible", event.target.checked)} /> נגישות מלאה ומאומתת</label>
            <div className="filter-panel__mobile-sort">
              <ModernSelect label="מיון לפי" value={sort} onChange={(value) => changeFilter("sort", value)} options={sortOptions} />
            </div>
            <button className="button primary filter-apply" type="button" onClick={() => setFiltersOpen(false)}>{`הצגת ${filtered.length} מקומות`}</button>
            <button className="button subtle wide" type="button" onClick={reset}>ניקוי סינונים</button>
          </aside>
          <section className="event-list">
            <section className="results-heading"><div><h1>{area === "הכל" ? "מקומות לאירועים בישראל" : `מקומות לאירועים ב${area}`}</h1><p>{displayed.length} מקומות מתאימים לחיפוש</p></div></section>
            <div className="results-toolbar"><div className="results-toolbar__actions"><button type="button" className={`button mobile-filter ${activeFilterCount ? "has-filters" : ""}`} aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}><span className="mobile-filter__icon" aria-hidden="true"><i /><i /><i /></span><span>סינון</span>{activeFilterCount ? <b aria-label={`${activeFilterCount} סינונים פעילים`}>{activeFilterCount}</b> : null}</button>{filtered.length > 0 && <button className={`button map-button mobile-map-fab ${mapOpen ? "active" : ""}`} type="button" aria-label={mapOpen ? "חזרה לתצוגת רשימה" : "הצגת תוצאות על המפה"} aria-pressed={mapOpen} onClick={toggleMap}><MapIcon /><span className="map-button__desktop-label">{mapOpen ? "תצוגת רשימה" : "תצוגה על מפה"}</span><span className="map-button__mobile-label" aria-hidden="true">מפה</span></button>}</div><ModernSelect className="results-toolbar__sort" compact label="מיון לפי" value={sort} onChange={(value) => changeFilter("sort", value)} options={sortOptions} /></div>
            {mapOpen ? <ListingMap listings={filtered} mode="events" autoLoad onClose={closeMap} onVisiblePlaceIdsChange={setMapVisibleIds} /> : displayed.map((place) => <article key={place.slug}><div className="event-card-gallery"><img src={place.image} alt={place.name} /><span>{place.images.length} תמונות</span><FavoriteButton id={place.slug} world="events" name={place.name} location={`${place.location}, ${place.area}`} image={place.image} href={eventPlaceHref(place)} meta={`${place.type} · עד ${place.guests} אורחים`} /></div><div><small>{place.type}</small><h2>{place.name}</h2><p><PinIcon />{place.location}, {place.area}</p><p>{place.description}</p><div className="feature-chips">{place.features.slice(0, 3).map((feature) => <span key={feature}>{feature}</span>)}</div><div className="event-capacity">עד {place.guests} אורחים</div><Link className="button primary" href={eventPlaceHref(place)}>לפרטים על המקום</Link></div></article>)}
            {displayed.length === 0 && <div className="empty-state"><h2>לא נמצאה התאמה</h2><p>אפשר להפחית את כמות המשתתפים או להסיר סינון.</p><button className="button primary" type="button" onClick={reset}>ניקוי סינונים</button></div>}
          </section>
        </div>
        {filtersOpen && <button className="filter-backdrop" aria-label="סגירת סינון" onClick={() => setFiltersOpen(false)} />}
      </main>
    </PageShell>
  );
}
