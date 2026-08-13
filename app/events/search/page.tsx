"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DeferredListingMap } from "../../components/deferred-listing-map";
import { ModernSelect } from "../../components/modern-select";
import { PageShell } from "../../components/page-shell";
import { SearchBox } from "../../components/search-box";
import { eventPlaceHref, eventPlaces } from "../../data/site-data";
import { getPlaceAccessibility } from "../../data/accessibility-data";
import { CloseIcon, MapIcon, PinIcon } from "../../site-header";
import { FavoriteButton } from "../../components/favorite-button";
import { BreadcrumbTrail } from "../../components/breadcrumb-trail";
import { useRouter, useSearchParams } from "next/navigation";
import { useMapViewState } from "../../components/map-view-state";
import { eventSearchHref } from "../../data/world-search-landings";
import { localizedPath } from "../../i18n/locale-routing";
import { useSiteLanguage } from "../../i18n/locale-provider";
import { SearchAfterResults, type ContextualSearchSuggestion } from "../../components/search-after-results";
import { EventCardContactActions } from "../../components/event-card-contact-actions";
import { ResultsViewToggle, useResultsViewMode } from "../../components/results-view-toggle";

export default function EventSearchPage({ initialArea }: { initialArea?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useSiteLanguage();
  const searchQuery = searchParams.toString();
  const initialParams = typeof window === "undefined" ? searchParams : new URLSearchParams(window.location.search);
  const initialGuests = Number(initialParams.get("guests") || 0);
  const [area, setArea] = useState(initialParams.get("location") || initialArea || "הכל");
  const [type, setType] = useState(initialParams.get("type") || "הכל");
  const [eventType, setEventType] = useState(initialParams.get("eventType") || "הכל");
  const [guests, setGuests] = useState(Number.isFinite(initialGuests) && initialGuests > 0 ? Math.max(10, initialGuests) : 0);
  const [noNoiseLimit, setNoNoiseLimit] = useState(initialParams.get("noise") === "1");
  const [accessibleOnly, setAccessibleOnly] = useState(initialParams.get("accessible") === "1");
  const { mapOpen, openMap, closeMap } = useMapViewState();
  const { viewMode, setViewMode } = useResultsViewMode("events");
  const [sort, setSort] = useState(["capacity", "name"].includes(initialParams.get("sort") || "") ? initialParams.get("sort") || "recommended" : "recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mapVisibleIds, setMapVisibleIds] = useState<string[] | null>(null);

  function updateUrl(updates: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([key, value]) => value === null ? params.delete(key) : params.set(key, value));
    const requestedArea = updates.location === undefined ? area : updates.location || "הכל";
    params.delete("location");
    const query = params.toString();
    const path = eventSearchHref(requestedArea);
    router.push(localizedPath(`${path}${query ? `?${query}` : ""}`, language));
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
      const params = new URLSearchParams(window.location.search);
      const requestedArea = params.get("location");
      const requestedGuests = Number(params.get("guests") || 0);
      setArea(requestedArea && requestedArea !== "כל הארץ" ? requestedArea : initialArea || "הכל");
      setGuests(Number.isFinite(requestedGuests) && requestedGuests > 0 ? Math.max(10, requestedGuests) : 0);
      setType(params.get("type") || "הכל");
      setEventType(params.get("eventType") || "הכל");
      setNoNoiseLimit(params.get("noise") === "1");
      setAccessibleOnly(params.get("accessible") === "1");
      setSort(["capacity", "name"].includes(params.get("sort") || "") ? params.get("sort") || "recommended" : "recommended");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialArea, searchQuery]);

  const areas = useMemo(() => ["הכל", ...Array.from(new Set(eventPlaces.map((place) => place.area)))], []);
  const types = useMemo(() => ["הכל", ...Array.from(new Set(eventPlaces.map((place) => place.type)))], []);
  const eventTypes = useMemo(() => ["הכל", ...Array.from(new Set(eventPlaces.flatMap((place) => place.eventTypes)))], []);
  const filtered = useMemo(() => {
    const result = eventPlaces.filter((place) => (area === "הכל" || place.area === area || place.location === area) && (type === "הכל" || place.type === type) && (eventType === "הכל" || place.eventTypes.includes(eventType)) && (!guests || place.guests >= guests) && (!noNoiseLimit || place.features.some((feature) => feature.includes("ללא הגבלת רעש"))) && (!accessibleOnly || getPlaceAccessibility(place.slug).status === "accessible"));
    return [...result].sort((a, b) => sort === "capacity" ? b.guests - a.guests : sort === "name" ? a.name.localeCompare(b.name, "he") : eventPlaces.indexOf(a) - eventPlaces.indexOf(b));
  }, [accessibleOnly, area, eventType, guests, noNoiseLimit, sort, type]);

  const displayed = useMemo(() => {
    if (!mapOpen || !mapVisibleIds) return filtered;
    const visible = new Set(mapVisibleIds);
    return filtered.filter((place) => visible.has(place.slug));
  }, [filtered, mapOpen, mapVisibleIds]);

  useEffect(() => {
    const timer = window.setTimeout(() => setMapVisibleIds(null), 0);
    return () => window.clearTimeout(timer);
  }, [accessibleOnly, area, eventType, guests, noNoiseLimit, sort, type]);

  function toggleResultsMap() {
    setMapVisibleIds(null);
    if (mapOpen) closeMap();
    else openMap();
  }

  function closeResultsMap() {
    setMapVisibleIds(null);
    closeMap();
  }

  function reset() { setArea("הכל"); setType("הכל"); setEventType("הכל"); setGuests(0); setNoNoiseLimit(false); setAccessibleOnly(false); setSort("recommended"); updateUrl({ location: null, type: null, eventType: null, guests: null, noise: null, accessible: null, sort: null }); }

  const sortOptions = [{ value: "recommended", label: "מומלצים" }, { value: "capacity", label: "קיבולת גבוהה" }, { value: "name", label: "שם המקום" }];

  const eventBreadcrumbFilters = [area !== "הכל" ? area : null, type !== "הכל" ? type : null, eventType !== "הכל" ? eventType : null, guests ? `${guests} משתתפים ומעלה` : null].filter((item): item is string => Boolean(item));
  const eventHeading = `${type !== "הכל" ? type : "מקומות לאירועים"}${eventType !== "הכל" ? ` ל${eventType}` : ""}${area !== "הכל" ? ` ב${area}` : " בישראל"}`;
  const contextualSearchSuggestions: ContextualSearchSuggestion[] = [
    ...types.filter((item) => item !== "הכל" && item !== type).map((item) => ({ label: item, params: { type: item } })),
    ...eventTypes.filter((item) => item !== "הכל" && item !== eventType).map((item) => ({ label: item, params: { eventType: item } })),
    ...(!noNoiseLimit ? [{ label: "ללא הגבלת רעש", params: { noise: "1" } as Record<string, string | null> }] : []),
    ...(!accessibleOnly ? [{ label: "מקומות נגישים", params: { accessible: "1" } as Record<string, string | null> }] : []),
  ];

  return (
    <PageShell variant="events">
      <main id="main-content" className="results-page events-results-page">
        <div className="results-search shell"><SearchBox mode="events" compact initialLocation={area === "הכל" ? undefined : area} initialGuests={guests || undefined} /></div>
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
          <section className={`event-list results-view results-view--${viewMode}${mapOpen ? " event-list--map-open" : ""}`}>
            <section className="results-heading"><div><h1>{eventHeading}</h1><div className="results-heading__meta"><p>{displayed.length} מקומות מתאימים לחיפוש</p></div></div></section>
            <div className="results-toolbar"><div className="results-toolbar__actions"><ResultsViewToggle value={viewMode} onChange={setViewMode} />{filtered.length > 0 && <button className={`button map-button mobile-map-fab ${mapOpen ? "active" : ""}`} type="button" aria-label={mapOpen ? "חזרה לתוצאות" : "הצגת תוצאות על המפה"} aria-pressed={mapOpen} onClick={toggleResultsMap}><MapIcon /><span className="map-button__desktop-label">{mapOpen ? "חזרה לתוצאות" : "תצוגה על מפה"}</span><span className="map-button__mobile-label" aria-hidden="true">מפה</span></button>}</div><ModernSelect className="results-toolbar__sort" compact label="מיון לפי" value={sort} onChange={(value) => changeFilter("sort", value)} options={sortOptions} /></div>
            {mapOpen && <div className="event-map-pane"><DeferredListingMap listings={filtered} mode="events" autoLoad onClose={closeResultsMap} onVisiblePlaceIdsChange={setMapVisibleIds} /></div>}{displayed.map((place) => <article key={place.slug}><div className="event-card-gallery"><img src={place.image} alt={place.name} loading="lazy" decoding="async" /><span>{place.images.length} תמונות</span><FavoriteButton id={place.slug} world="events" name={place.name} location={`${place.location}, ${place.area}`} image={place.image} href={eventPlaceHref(place)} meta={`${place.type} · עד ${place.guests} אורחים`} /></div><div><small>{place.type}</small><h2>{place.name}</h2><p><PinIcon />{place.location}, {place.area}</p><p>{place.description}</p><div className="feature-chips">{place.features.slice(0, 3).map((feature) => <span key={feature}>{feature}</span>)}</div><div className="event-capacity">עד {place.guests} אורחים</div><div className="stay-card__actions event-card__actions"><Link className="stay-card__details-link" href={eventPlaceHref(place)} target="_blank" rel="noopener noreferrer">לפרטים על המקום<span className="sr-only"></span></Link><EventCardContactActions placeId={place.slug} placeName={place.name} phone={place.contact?.phone} whatsapp={place.contact?.whatsapp} serviceName={place.type} /></div></div></article>)}
            {displayed.length === 0 && <div className="empty-state"><h2>לא נמצאה התאמה</h2><p>אפשר להפחית את כמות המשתתפים או להסיר סינון.</p><button className="button primary" type="button" onClick={reset}>ניקוי סינונים</button></div>}
          </section>
        </div>
        <SearchAfterResults world="events" location={area} searchSuggestions={contextualSearchSuggestions} />
        {filtersOpen && <button className="filter-backdrop" aria-label="סגירת סינון" onClick={() => setFiltersOpen(false)} />}
      </main>
    </PageShell>
  );
}
