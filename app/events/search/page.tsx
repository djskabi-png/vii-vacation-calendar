"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DeferredListingMap, preloadListingMap } from "../../components/deferred-listing-map";
import { ModernSelect } from "../../components/modern-select";
import { StructuredData } from "../../components/structured-data";
import { collectionSchema } from "../../lib/seo";
import { SupplierCapacityNotice } from "../../components/supplier-capacity-notice";
import { UnavailablePlaceNotice } from "../../components/unavailable-place-notice";
import { PageShell } from "../../components/page-shell";
import { SearchBox } from "../../components/search-box";
import type { EventPlace } from "../../data/site-data";
import { eventOfferHref, eventPlaceHref } from "../../lib/event-place-href";
import { supplierDisplayDescription } from "../../data/supplier-display-text";
import { usePublishedCatalog } from "../../lib/use-published-catalog";
import { hasVerifiedAccessibilityFeature } from "../../data/accessibility-data";
import { CloseIcon, MapIcon, PinIcon } from "../../site-header";
import { BreadcrumbTrail } from "../../components/breadcrumb-trail";
import { useRouter, useSearchParams } from "next/navigation";
import { useMapViewState } from "../../components/map-view-state";
import { eventSearchHref, mergeSearchHref } from "../../data/world-search-landings";
import { localizedPath } from "../../i18n/locale-routing";
import { useSiteLanguage } from "../../i18n/locale-provider";
import { SearchAfterResults, type ContextualSearchSuggestion } from "../../components/search-after-results";
import { EventResultCard } from "../../components/event-result-card";
import { useStartingPrices } from "../../lib/use-starting-prices";
import { hasSearchDate, supplierStartingPrice } from "../../lib/supplier-starting-price";
import { ResultsViewToggle, useResultsViewMode } from "../../components/results-view-toggle";
import { matchesSearchLocation } from "../../data/search-taxonomy";
import { useViiLiveSearch } from "../../components/use-vii-live-search";
import { eventLiveCopy } from "../../i18n/vii-live-search-copy";
import { eventSlotCopy } from "../../i18n/event-slot-copy";
import type { EventSlot } from "../../lib/vii-live-search";
import { trackSearchResults } from "../../lib/analytics";
import { completePlaceSearchResults, nearbySearchRecommendations, PLACE_SEARCH_MINIMUM_RESULTS } from "../../lib/nearby-recommendations";
import { NearbySearchNotice } from "../../components/nearby-search-notice";
import { useManagedGeography } from "../../components/use-managed-geography";
import { RegionalAvailability } from "../../components/regional-availability";
import { eventFacilityOrder, eventOccasionOrder, eventVenueTypeOrder, orderedEventFacetValues } from "../../lib/event-search-taxonomy";
import { hasConfirmedEventAvailability } from "../../lib/dated-availability-eligibility";
import { useDocumentSeed } from "../../components/use-document-seed";
import { discoverySortLabel, discoverySortOptions, orderDiscoveryResults, type DiscoverySortKey } from "../../lib/discovery-result-sort";

type EventSortKey = DiscoverySortKey | "capacity";
const EVENT_SORT_VALUES: EventSortKey[] = ["recommended", "popular", "price-asc", "price-desc", "rating-desc", "capacity", "name"];

function runtimeEventPlace(value: unknown): EventPlace {
  const place = value as EventPlace;
  return { ...place, description: supplierDisplayDescription(place) };
}

export default function EventSearchPage({ initialArea, landingTitle, landingDescription }: { initialArea?: string; landingTitle?: string; landingDescription?: string }) {
  const { items: eventPlaces, error: catalogError, loading: catalogLoading } = usePublishedCatalog("events", runtimeEventPlace);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useSiteLanguage();
  const documentSeed = useDocumentSeed();
  const managedGeography = useManagedGeography();
  const liveCopy = eventLiveCopy[language];
  const slotCopy = eventSlotCopy[language];
  const searchQuery = searchParams.toString();
  const initialParams = typeof window === "undefined" ? searchParams : new URLSearchParams(window.location.search);
  const initialEventFrom = initialParams.get("from");
  const initialGuests = Number(initialParams.get("guests") || 0);
  const [area, setArea] = useState(initialParams.get("location") || initialArea || "הכל");
  const [type, setType] = useState(initialParams.get("type") || "הכל");
  const [eventType, setEventType] = useState(initialParams.get("eventType") || "הכל");
  const [facility, setFacility] = useState(initialParams.get("features") || "הכל");
  const [guests, setGuests] = useState(Number.isFinite(initialGuests) && initialGuests > 0 ? Math.max(10, initialGuests) : initialEventFrom ? 20 : 0);
  const [noNoiseLimit, setNoNoiseLimit] = useState(initialParams.get("noise") === "1");
  const [accessibleOnly, setAccessibleOnly] = useState(initialParams.get("accessible") === "1");
  const { mapOpen, openMap, closeMap } = useMapViewState();
  const { viewMode, setViewMode } = useResultsViewMode("events");
  const [sort, setSort] = useState<EventSortKey>(EVENT_SORT_VALUES.includes((initialParams.get("sort") || "recommended") as EventSortKey) ? (initialParams.get("sort") || "recommended") as EventSortKey : "recommended");
  const [slot, setSlot] = useState<EventSlot | undefined>(initialParams.get("slot") === "morning" ? "morning" : initialParams.get("slot") === "evening" ? "evening" : undefined);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mapVisibleIds, setMapVisibleIds] = useState<string[] | null>(null);
  const [activeMapPlaceId, setActiveMapPlaceId] = useState<string | null>(null);
  const [liveRetry, setLiveRetry] = useState(0);

  function updateUrl(updates: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([key, value]) => value === null ? params.delete(key) : params.set(key, value));
    const requestedArea = updates.location === undefined ? area : updates.location || "הכל";
    params.delete("location");
    const path = eventSearchHref(requestedArea);
    router.push(localizedPath(mergeSearchHref(path, params), language));
  }

  function changeFilter(key: "location" | "type" | "eventType" | "features" | "guests" | "noise" | "accessible" | "sort" | "slot", value: string | boolean | number) {
    if (key === "location") setArea(String(value));
    if (key === "type") setType(String(value));
    if (key === "eventType") setEventType(String(value));
    if (key === "features") setFacility(String(value));
    if (key === "guests") setGuests(Number(value));
    if (key === "noise") setNoNoiseLimit(Boolean(value));
    if (key === "accessible") setAccessibleOnly(Boolean(value));
    if (key === "sort") setSort(EVENT_SORT_VALUES.includes(String(value) as EventSortKey) ? String(value) as EventSortKey : "recommended");
    if (key === "slot") setSlot(value === "morning" || value === "evening" ? value : undefined);
    const isDefault = value === false || value === 0 || value === "" || value === "הכל" || value === "recommended";
    updateUrl({ [key]: isDefault ? null : String(value === true ? 1 : value) });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const requestedArea = params.get("location");
      const requestedGuests = Number(params.get("guests") || 0);
      setArea(requestedArea && requestedArea !== "כל הארץ" ? requestedArea : initialArea || "הכל");
      setGuests(Number.isFinite(requestedGuests) && requestedGuests > 0 ? Math.max(10, requestedGuests) : params.get("from") ? 20 : 0);
      setType(params.get("type") || "הכל");
      setEventType(params.get("eventType") || "הכל");
      setFacility(params.get("features") || "הכל");
      setNoNoiseLimit(params.get("noise") === "1");
      setAccessibleOnly(params.get("accessible") === "1");
      setSort(EVENT_SORT_VALUES.includes((params.get("sort") || "recommended") as EventSortKey) ? (params.get("sort") || "recommended") as EventSortKey : "recommended");
      setSlot(params.get("slot") === "morning" ? "morning" : params.get("slot") === "evening" ? "evening" : undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialArea, searchQuery]);

  const areas = useMemo(() => ["הכל", ...Array.from(new Set([
    ...managedGeography.map((node) => node.title),
    ...eventPlaces.flatMap((place) => [place.area, place.location]),
  ].filter(Boolean)))], [eventPlaces, managedGeography]);
  const eventFrom = searchParams.get("from");
  const undatedSearch = !hasSearchDate(searchParams);
  const startingPrices = useStartingPrices("events", undatedSearch);
  const sortModel = useMemo(() => ({
    id: (place: EventPlace) => place.slug,
    name: (place: EventPlace) => place.name,
    price: (place: EventPlace) => supplierStartingPrice(startingPrices[place.slug] ?? place) || undefined,
    rating: (place: EventPlace) => place.score,
    popularity: (place: EventPlace) => place.reviews,
    priority: (place: EventPlace) => {
      if (undatedSearch) {
        const startingPricePriority = supplierStartingPrice(startingPrices[place.slug] ?? place) ? 0 : 1;
        return startingPricePriority;
      }
      return 0;
    },
  }), [startingPrices, undatedSearch]);
  const sortOptions = useMemo(() => {
    const common = discoverySortOptions(eventPlaces, sortModel, language);
    if (!eventPlaces.some((place) => place.capacityScope !== "unit")) return common;
    return [...common.slice(0, -1), { value: "capacity", label: language === "he" ? "קיבולת גבוהה" : language === "en" ? "Highest capacity" : language === "ru" ? "Наибольшая вместимость" : "Plus grande capacité" }, common[common.length - 1]];
  }, [eventPlaces, language, sortModel]);
  const eventTo = searchParams.get("to") || eventFrom;
  const datedEventSearch = Boolean(eventFrom && eventTo && guests > 0);
  const supplierSearch = useViiLiveSearch("events", guests > 0 ? eventFrom : null, guests > 0 ? eventTo : null, guests, undefined, undefined, slot, liveRetry, false, undefined, datedEventSearch);
  const eventAvailabilityPending = datedEventSearch && supplierSearch.status === "loading";
  const eventAvailabilityError = datedEventSearch && supplierSearch.status === "error";
  const confirmedEventPlace = (place: EventPlace) => {
    if (!datedEventSearch) return true;
    const match = /^event-(\d+)$/.exec(place.slug);
    const result = supplierSearch.results[Number(match?.[1] || -1)];
    return hasConfirmedEventAvailability(result) && result?.from === eventFrom;
  };

  useEffect(() => {
    if (!eventFrom || searchParams.get("guests")) return;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("guests")) return;
      params.set("guests", "20");
      params.delete("location");
      router.replace(localizedPath(mergeSearchHref(eventSearchHref(area), params), language), { scroll: false });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [area, eventFrom, language, router, searchParams]);
  const supplierStatus = (slug: string) => {
    if (!eventFrom || !eventTo || !guests || !/^event-\d+$/.test(slug)) return null;
    if (supplierSearch.status === "loading") return liveCopy.checking;
    if (supplierSearch.status === "error") return liveCopy.error;
    const result = supplierSearch.results[Number(slug.slice(6))];
    if (result?.available === false) return liveCopy.unavailable;
    if (result?.available === true && result.total && result.from && result.slot) return `${liveCopy.available(result.total, 0, result.from, result.start || "")} · ${slotCopy[result.slot]}`;
    if (result?.available === true) return liveCopy.availableNoPrice;
    return liveCopy.unknown;
  };
  const detailHref = (place: (typeof eventPlaces)[number]) => {
    const offer = supplierSearch.results[Number(place.slug.slice(6))];
    return eventFrom && guests > 0
      ? eventOfferHref(place, new URLSearchParams({ from: offer?.from || eventFrom, guests: String(guests), ...(offer?.slot || slot ? { slot: offer?.slot || slot! } : {}) }))
      : eventPlaceHref(place);
  };
  const types = useMemo(() => ["הכל", ...orderedEventFacetValues(eventPlaces.map((place) => place.type), eventVenueTypeOrder)], [eventPlaces]);
  const eventTypes = useMemo(() => ["הכל", ...orderedEventFacetValues(eventPlaces.flatMap((place) => place.eventTypes), eventOccasionOrder)], [eventPlaces]);
  const facilities = useMemo(() => ["הכל", ...orderedEventFacetValues(eventPlaces.flatMap((place) => place.features), eventFacilityOrder)], [eventPlaces]);
  const matchesHardFilters = (place: EventPlace) => (!types.includes(type) || type === "הכל" || place.type === type)
    && (!eventTypes.includes(eventType) || eventType === "הכל" || place.eventTypes.includes(eventType))
    && (!facilities.includes(facility) || facility === "הכל" || place.features.includes(facility))
    && (!guests || place.capacityScope === "unit" || place.guests >= guests)
    && (!noNoiseLimit || place.features.some((feature) => feature.includes("ללא הגבלת רעש")))
    && (!accessibleOnly || hasVerifiedAccessibilityFeature(place.features));
  const filtered = useMemo(() => {
    return eventPlaces.filter((place) => matchesSearchLocation(place, area) && matchesHardFilters(place) && confirmedEventPlace(place));
  }, [accessibleOnly, area, eventFrom, eventPlaces, eventType, eventTypes, facilities, facility, guests, noNoiseLimit, supplierSearch.results, supplierSearch.status, type, types]);

  const nearbyRecovery = useMemo(() => {
    if (filtered.length >= PLACE_SEARCH_MINIMUM_RESULTS || area === "הכל" || area === "כל הארץ") return [];
    // Broaden geography only; a supplier-confirmed unavailable venue remains excluded.
    const eligible = eventPlaces.filter((place) => matchesHardFilters(place) && confirmedEventPlace(place));
    return nearbySearchRecommendations(eligible, area, managedGeography, { key: (place) => place.slug });
  }, [accessibleOnly, area, eventFrom, eventPlaces, eventType, eventTypes, facilities, facility, filtered.length, guests, managedGeography, noNoiseLimit, supplierSearch.results, supplierSearch.status, type, types]);
  const resultSet = useMemo(() => {
    const complete = completePlaceSearchResults(filtered, nearbyRecovery, (place) => place.slug);
    if (sort === "capacity") return [...complete].sort((first, second) => second.guests - first.guests || first.name.localeCompare(second.name, "he"));
    return orderDiscoveryResults(complete, sort, `${documentSeed}:event-search`, sortModel);
  }, [documentSeed, filtered, nearbyRecovery, sort, sortModel]);

  const displayed = useMemo(() => {
    if (!mapOpen || !mapVisibleIds) return resultSet;
    const visible = new Set(mapVisibleIds);
    return resultSet.filter((place) => visible.has(place.slug));
  }, [resultSet, mapOpen, mapVisibleIds]);

  useEffect(() => {
    if (catalogLoading || catalogError || eventAvailabilityPending || eventAvailabilityError) return;
    const timer = window.setTimeout(() => trackSearchResults({
      world: "events",
      location: area,
      hasDate: Boolean(eventFrom),
      resultCount: resultSet.length,
      filters: {
        ...(type !== "הכל" ? { type } : {}),
        ...(eventType !== "הכל" ? { eventType } : {}),
        ...(facility !== "הכל" ? { features: facility } : {}),
        ...(guests ? { guests } : {}),
        ...(noNoiseLimit ? { noise: true } : {}),
        ...(accessibleOnly ? { accessible: true } : {}),
      },
    }), 650);
    return () => window.clearTimeout(timer);
  }, [accessibleOnly, area, catalogError, catalogLoading, eventAvailabilityError, eventAvailabilityPending, eventFrom, eventType, facility, resultSet.length, guests, slot, noNoiseLimit, type]);

  useEffect(() => {
    const timer = window.setTimeout(() => { setMapVisibleIds(null); setActiveMapPlaceId(null); }, 0);
    return () => window.clearTimeout(timer);
  }, [accessibleOnly, area, eventType, facility, guests, noNoiseLimit, sort, type]);

  function toggleResultsMap() {
    setMapVisibleIds(null);
    if (mapOpen) { setActiveMapPlaceId(null); closeMap(); }
    else openMap();
  }

  function closeResultsMap() {
    setMapVisibleIds(null);
    setActiveMapPlaceId(null);
    closeMap();
  }

  function reset() { const datedGuests = eventFrom ? 20 : 0; setArea("הכל"); setType("הכל"); setEventType("הכל"); setFacility("הכל"); setGuests(datedGuests); setNoNoiseLimit(false); setAccessibleOnly(false); setSort("recommended"); setSlot(undefined); updateUrl({ location: null, type: null, eventType: null, features: null, guests: datedGuests ? String(datedGuests) : null, noise: null, accessible: null, sort: null, hours: null, slot: null }); }

  const eventBreadcrumbFilters = [area !== "הכל" ? area : null, types.includes(type) && type !== "הכל" ? type : null, eventTypes.includes(eventType) && eventType !== "הכל" ? eventType : null, facilities.includes(facility) && facility !== "הכל" ? facility : null].filter((item): item is string => Boolean(item));
  const eventHeading = `${types.includes(type) && type !== "הכל" ? type : "מקומות לאירועים"}${eventTypes.includes(eventType) && eventType !== "הכל" ? ` ל${eventType}` : ""}${area !== "הכל" ? ` ב${area}` : " בישראל"}`;
  const contextualSearchSuggestions: ContextualSearchSuggestion[] = [
    ...types.filter((item) => item !== "הכל" && item !== type).map((item) => ({ label: item, params: { type: item } })),
    ...eventTypes.filter((item) => item !== "הכל" && item !== eventType).map((item) => ({ label: item, params: { eventType: item } })),
    ...facilities.filter((item) => item !== "הכל" && item !== facility).slice(0, 8).map((item) => ({ label: item, params: { features: item } })),
    ...(!noNoiseLimit ? [{ label: "ללא הגבלת רעש", params: { noise: "1" } as Record<string, string | null> }] : []),
    ...(!accessibleOnly ? [{ label: "מקומות נגישים", params: { accessible: "1" } as Record<string, string | null> }] : []),
  ];

  return (
    <PageShell variant="events">
      <main id="main-content" className="results-page events-results-page">
        {!initialArea ? <StructuredData data={collectionSchema("מקומות לאירועים בישראל", "מקומות לאירועים עם תמונות ומתקנים. התאמה לכמות המשתתפים נבדקת מול המקום.", "/events/search", filtered.map((place) => ({ name: place.name, path: eventPlaceHref(place), image: place.image })))} /> : null}
        <UnavailablePlaceNotice world="events" />
        {catalogLoading ? <p className="shell" role="status">טוענים מקומות...</p> : null}
        {catalogError ? <p className="shell" role="alert">לא ניתן לטעון את המקומות כרגע.</p> : null}
        <div className="results-search shell"><SearchBox mode="events" compact initialLocation={area === "הכל" ? undefined : area} initialGuests={guests || undefined} /></div>
        <BreadcrumbTrail items={[{ name: "ראשי", path: "/" }, { name: "אירועים", path: "/events" }, { name: "מקומות לאירועים", path: eventBreadcrumbFilters.length ? "/events/search" : undefined }, ...(eventBreadcrumbFilters.length ? [{ name: eventBreadcrumbFilters.join(" · ") }] : [])]} />
        <div className="shell event-results-layout">
          <aside id="event-result-filters" className={`filter-panel ${filtersOpen ? "open" : ""}`} aria-label="סינון תוצאות אירועים">
            <div className="filter-panel__scroll"><div className="filter-head"><h2>סינון</h2><button type="button" onClick={() => setFiltersOpen(false)} aria-label="סגירת סינון"><CloseIcon /></button></div>
              <ModernSelect label="אזור" value={area} onChange={(value) => changeFilter("location", value)} options={areas.map((item) => ({ value: item, label: item }))} />
              <ModernSelect label="סוג מקום" value={type} onChange={(value) => changeFilter("type", value)} options={types.map((item) => ({ value: item, label: item }))} />
              <ModernSelect label="סוג אירוע" value={eventType} onChange={(value) => changeFilter("eventType", value)} options={eventTypes.map((item) => ({ value: item, label: item }))} />
              <ModernSelect label="מתקנים ושירותים" value={facility} onChange={(value) => changeFilter("features", value)} options={facilities.map((item) => ({ value: item, label: item }))} />
              <ModernSelect label={slotCopy.label} value={slot || "both"} onChange={(value) => changeFilter("slot", value === "both" ? "" : value)} options={[{ value: "both", label: slotCopy.both }, { value: "morning", label: slotCopy.morning }, { value: "evening", label: slotCopy.evening }]} />
              {eventPlaces.some((place) => place.capacityScope !== "unit") && <fieldset><legend>כמות משתתפים</legend><input type="range" min="0" max="300" step="10" value={guests} aria-label="כמות משתתפים" onChange={(event) => changeFilter("guests", Number(event.target.value))} /></fieldset>}
              <label><input type="checkbox" checked={noNoiseLimit} onChange={(event) => changeFilter("noise", event.target.checked)} /> ללא הגבלת רעש</label>
              <label><input type="checkbox" checked={accessibleOnly} onChange={(event) => changeFilter("accessible", event.target.checked)} /> נגישות לנכים</label>
              <div className="filter-panel__mobile-sort">
                <ModernSelect label={discoverySortLabel(language)} value={sort} onChange={(value) => changeFilter("sort", value)} options={sortOptions} />
              </div>
            </div>
            <div className="filter-panel__actions"><button className="button primary filter-apply" type="button" onClick={() => setFiltersOpen(false)}>{`הצגת ${filtered.length} מקומות`}</button>
              <button className="button subtle wide filter-reset" type="button" onClick={reset}>ניקוי סינונים</button></div>
          </aside>
          <section className={`event-list results-view results-view--${viewMode}${mapOpen ? " event-list--map-open" : ""}`}>
            <section className="results-heading"><div><h1>{landingTitle && area === initialArea && type === "הכל" && eventType === "הכל" ? landingTitle : eventHeading}</h1><div className="results-heading__meta">{!eventAvailabilityPending && !eventAvailabilityError ? <p>{displayed.length} מקומות מתאימים לחיפוש</p> : null}{landingDescription && area === initialArea && type === "הכל" && eventType === "הכל" ? <p>{landingDescription}</p> : null}</div></div></section>
            {guests > 0 && eventPlaces.some((place) => place.capacityScope === "unit") ? <SupplierCapacityNotice /> : null}
            {datedEventSearch && (eventAvailabilityPending || eventAvailabilityError || supplierSearch.stale || !resultSet.length) ? <div className="online-booking-filter-notice" role={eventAvailabilityError ? "alert" : "status"} aria-busy={eventAvailabilityPending}>
              <p>{eventAvailabilityPending ? "בודקים אילו מקומות פנויים למועד ולכמות המשתתפים שבחרתם..." : eventAvailabilityError ? "לא הצלחנו לבדוק זמינות כרגע. אפשר לנסות שוב או לשנות את החיפוש." : supplierSearch.stale ? "מוצגות תוצאות הבדיקה האחרונה. הזמינות תאושר שוב לפני ההזמנה." : "לא נמצאו מקומות פנויים בבחירה הזו."}</p>
              {eventAvailabilityError ? <button className="button secondary" type="button" onClick={() => setLiveRetry((value) => value + 1)}>לנסות שוב</button> : null}
            </div> : null}
            {resultSet.length > filtered.length ? <NearbySearchNotice dated={Boolean(eventFrom)} /> : null}
            <div className="results-toolbar"><div className="results-toolbar__actions"><button type="button" className={`event-filter-toggle ${filtersOpen ? "active" : ""}`} aria-controls="event-result-filters" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M7 12h10M10 17h4" /></svg><span>סינון</span></button><ResultsViewToggle value={viewMode} onChange={setViewMode} />{resultSet.length > 0 && <button className={`button map-button mobile-map-fab ${mapOpen ? "active" : ""}`} type="button" aria-label={mapOpen ? "חזרה לתוצאות" : "הצגת תוצאות על המפה"} aria-pressed={mapOpen} onPointerEnter={preloadListingMap} onFocus={preloadListingMap} onTouchStart={preloadListingMap} onClick={toggleResultsMap}><MapIcon /><span className="map-button__desktop-label">{mapOpen ? "חזרה לתוצאות" : "תצוגה על מפה"}</span><span className="map-button__mobile-label" aria-hidden="true">מפה</span></button>}</div><ModernSelect className="results-toolbar__sort" compact label={discoverySortLabel(language)} value={sort} onChange={(value) => changeFilter("sort", value)} options={sortOptions} /></div>
            {mapOpen && <div className="event-map-pane"><DeferredListingMap listings={resultSet} mode="events" autoLoad onClose={closeResultsMap} onVisiblePlaceIdsChange={setMapVisibleIds} activePlaceId={activeMapPlaceId} onActivePlaceChange={setActiveMapPlaceId} /></div>}{displayed.map((place) => <EventResultCard key={place.slug} place={place} href={detailHref(place)} supplierStatus={supplierStatus(place.slug)} startingPrice={undatedSearch ? supplierStartingPrice(startingPrices[place.slug] ?? place) : null} mapActive={activeMapPlaceId === place.slug} onActiveChange={(active) => { if (mapOpen) setActiveMapPlaceId(active ? place.slug : null); }} />)}
            {!datedEventSearch && !catalogLoading && !catalogError && displayed.length === 0 && <div className="empty-state"><h2>לא נמצאה התאמה או מקום קרוב</h2><p>אפשר להפחית את כמות המשתתפים או להסיר סינון.</p><button className="button primary" type="button" onClick={reset}>ניקוי סינונים</button></div>}
            {!mapOpen && !eventFrom && type === "הכל" && eventType === "הכל" && facility === "הכל" && !noNoiseLimit && !accessibleOnly ? <RegionalAvailability world="events" region={area} guests={guests || 20} embedded /> : null}
          </section>
        </div>
        {!catalogLoading && !catalogError ? <SearchAfterResults world="events" location={area} inventory={eventPlaces} searchSuggestions={contextualSearchSuggestions} /> : null}
        {filtersOpen && <button className="filter-backdrop" aria-label="סגירת סינון" onClick={() => setFiltersOpen(false)} />}
      </main>
    </PageShell>
  );
}
