"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DiscoveryCard } from "../components/discovery-card";
import { DeferredDiscoveryMap, preloadListingMap } from "../components/deferred-listing-map";
import { ModernSelect } from "../components/modern-select";
import { paidAttractions, type DiscoveryItem } from "../data/world-data";
import { MapIcon } from "../site-header";
import { useMapViewState } from "../components/map-view-state";
import { nearbyRecommendations, completeNearbyResults, nearbyPoint } from "../lib/nearby-recommendations";
import { NearbySearchNotice } from "../components/nearby-search-notice";
import { activityRegion, activityType } from "../lib/activity-discovery-taxonomy";
import { useSiteLanguage } from "../i18n/locale-provider";
import { useDocumentSeed } from "../components/use-document-seed";
import { discoverySortLabel, discoverySortOptions, numericPriceLabel, orderDiscoveryResults, type DiscoverySortKey } from "../lib/discovery-result-sort";

const areas = ["הכל", "צפון", "כנרת", "מרכז ותל אביב", "ירושלים", "דרום ונגב", "אילת והסביבה"];
const types = ["הכל", "שטח ואדרנלין", "טבע ורכיבה", "ים ושיט", "מים ומשפחה", "נחלים ומים", "אוכל ותרבות", "מדבר ושטח", "יצירה וקבוצות"];

export function AttractionsExplorer({ items = paidAttractions, initialArea, initialType }: { items?: DiscoveryItem[]; initialArea?: string; initialType?: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { language } = useSiteLanguage();
  const documentSeed = useDocumentSeed();
  const searchQuery = searchParams.toString();
  const requestedArea = searchParams.get("area") || initialArea || "הכל";
  const requestedType = searchParams.get("type") || initialType || "הכל";
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [area, setArea] = useState(areas.includes(requestedArea) ? requestedArea : "הכל");
  const [type, setType] = useState(types.includes(requestedType) ? requestedType : "הכל");
  const sortModel = useMemo(() => ({ id: (item: DiscoveryItem) => item.id, name: (item: DiscoveryItem) => item.name, price: (item: DiscoveryItem) => numericPriceLabel(item.priceLabel), rating: (item: DiscoveryItem) => item.rating, priority: (item: DiscoveryItem) => item.image ? 0 : 1 }), []);
  const sortOptions = useMemo(() => discoverySortOptions(items, sortModel, language), [items, language, sortModel]);
  const requestedSort = searchParams.get("sort") || "recommended";
  const [sort, setSort] = useState<DiscoverySortKey>(sortOptions.some((option) => option.value === requestedSort) ? requestedSort as DiscoverySortKey : "recommended");
  const { mapOpen, mapInteractive, openMap, closeMap } = useMapViewState();
  const [mapVisibleIds, setMapVisibleIds] = useState<string[] | null>(null);
  const [activeMapPlaceId, setActiveMapPlaceId] = useState<string | null>(null);

  const filtered = useMemo(() => items.filter((item) => {
    const searchable = `${item.name} ${item.location} ${item.area} ${item.description} ${item.features.join(" ")}`;
    const areaMatch = area === "הכל" || activityRegion(item) === area;
    return areaMatch && (type === "הכל" || activityType(item) === type) && (!query.trim() || searchable.includes(query.trim()));
  }), [area, items, query, type]);

  const nearbyRecovery = useMemo(() => {
    if (filtered.length >= 3 || area === "הכל") return [];
    if (!nearbyPoint({ area })) return [];
    const normalizedQuery = query.trim();
    const eligible = items.filter((item) => {
      const searchable = `${item.name} ${item.location} ${item.area} ${item.description} ${item.features.join(" ")}`;
      return (type === "הכל" || activityType(item) === type) && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
    return nearbyRecommendations(eligible, { area, location: area }, { key: (item) => item.id, limit: 12, minimum: 3 }).items;
  }, [area, filtered.length, items, query, type]);
  const resultItems = useMemo(() => orderDiscoveryResults(completeNearbyResults(filtered, nearbyRecovery, (item) => item.id), sort, `${documentSeed}:attraction-search`, { ...sortModel, priority: (item) => (query.trim() && !item.name.includes(query.trim()) ? 2 : 0) + (item.image ? 0 : 1) }), [documentSeed, filtered, nearbyRecovery, query, sort, sortModel]);

  function updateUrl(updates: Record<string, string>) {
    const params = new URLSearchParams(window.location.search);
    if (initialArea && !params.has("area")) params.set("area", initialArea);
    if (initialType && !params.has("type")) params.set("type", initialType);
    Object.entries(updates).forEach(([key, value]) => value && value !== "הכל" ? params.set(key, value) : params.delete(key));
    const basePath = window.location.pathname.replace(/\/explore\/[^/]+\/?$/, "");
    if (basePath !== window.location.pathname) router.push(`${basePath}${params.size ? `?${params}` : ""}`, { scroll: false });
    else window.history.pushState(null, "", `${basePath}${params.size ? `?${params}` : ""}`);
  }

  function changeQuery(value: string) { setQuery(value); updateUrl({ q: value.trim() }); }
  function changeArea(value: string) { setArea(value); updateUrl({ area: value }); }
  function changeType(value: string) { setType(value); updateUrl({ type: value }); }
  function changeSort(value: string) { const next = sortOptions.some((option) => option.value === value) ? value as DiscoverySortKey : "recommended"; setSort(next); updateUrl({ sort: next === "recommended" ? "" : next }); }

  function resetFilters() {
    setQuery("");
    setArea("הכל");
    setType("הכל");
    setSort("recommended");
    updateUrl({ q: "", area: "", type: "", sort: "" });
  }

  const displayed = useMemo(() => {
    if (!mapOpen || !mapVisibleIds) return resultItems;
    const visible = new Set(mapVisibleIds);
    return resultItems.filter((item) => visible.has(item.id));
  }, [mapOpen, mapVisibleIds, resultItems]);

  useEffect(() => {
    const timer = window.setTimeout(() => { setMapVisibleIds(null); setActiveMapPlaceId(null); }, 0);
    return () => window.clearTimeout(timer);
  }, [area, query, sort, type]);

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
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchQuery);
      const nextArea = params.get("area") || initialArea || "הכל";
      const nextType = params.get("type") || initialType || "הכל";
      setArea(areas.includes(nextArea) ? nextArea : "הכל");
      setType(types.includes(nextType) ? nextType : "הכל");
      setQuery(params.get("q") || "");
      const nextSort = params.get("sort") || "recommended";
      setSort(sortOptions.some((option) => option.value === nextSort) ? nextSort as DiscoverySortKey : "recommended");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchQuery, initialArea, initialType, sortOptions]);

  return <>
    <form className="trail-filters attraction-filters" onSubmit={(event) => event.preventDefault()} aria-label="סינון אטרקציות בתשלום">
      <label><span>מה מתחשק לעשות?</span><input value={query} onChange={(event) => changeQuery(event.target.value)} placeholder="לדוגמה: סוסים, שיט, סדנה" /></label>
      <ModernSelect label="אזור" value={area} onChange={changeArea} options={areas.map((item) => ({ value: item, label: item }))} />
      <ModernSelect label="סוג חוויה" value={type} onChange={changeType} options={types.map((item) => ({ value: item, label: item }))} />
    </form>
    {resultItems.length > filtered.length && <NearbySearchNotice regionalOnly />}
    <div className="trail-results-head attraction-results-head">
      <div><strong>{displayed.length === 1 ? "חוויה אחת מתאימה" : `${displayed.length} חוויות מתאימות`}</strong><span>הספק, הזמינות והמחיר מוצגים רק לאחר אימות.</span></div>
      <div className="trail-results-head__actions"><ModernSelect compact label={discoverySortLabel(language)} value={sort} onChange={changeSort} options={sortOptions} />{resultItems.length > 0 && <button className={`button map-button mobile-map-fab ${mapOpen ? "active" : ""}`} type="button" aria-label={mapOpen ? "חזרה לתצוגת רשימה" : "הצגת האטרקציות על המפה"} aria-pressed={mapOpen} data-map-interactive={mapInteractive} disabled={!mapInteractive} onPointerEnter={preloadListingMap} onFocus={preloadListingMap} onTouchStart={preloadListingMap} onClick={toggleResultsMap}><MapIcon /><span className="map-button__desktop-label">{mapOpen ? "תצוגת רשימה" : "תצוגה על מפה"}</span><span className="map-button__mobile-label" aria-hidden="true">מפה</span></button>}</div>
    </div>
    {resultItems.length
      ? mapOpen
        ? <div className="airbnb-map-split world-map-split"><div className="airbnb-map-split__results discovery-grid attraction-grid">{displayed.map((item) => <DiscoveryCard key={item.id} item={item} mapActive={activeMapPlaceId === item.id} onActiveChange={(active) => setActiveMapPlaceId(active ? item.id : null)} />)}</div><div className="airbnb-map-split__map"><DeferredDiscoveryMap items={resultItems} tone="activities" autoLoad onClose={closeResultsMap} onVisiblePlaceIdsChange={setMapVisibleIds} activePlaceId={activeMapPlaceId} onActivePlaceChange={setActiveMapPlaceId} /></div></div>
        : <div className="discovery-grid attraction-grid">{displayed.map((item) => <DiscoveryCard key={item.id} item={item} />)}</div>
      : <div className="trail-empty"><h2>לא מצאנו התאמה לסינון הזה</h2><p>אפשר להסיר סינון או לבחור אזור סמוך.</p><button type="button" onClick={resetFilters}>ניקוי סינונים</button></div>}
  </>;
}
