"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DiscoveryCard } from "../components/discovery-card";
import { DeferredDiscoveryMap, preloadListingMap } from "../components/deferred-listing-map";
import { ModernSelect } from "../components/modern-select";
import { paidAttractions, type DiscoveryItem } from "../data/world-data";
import { MapIcon } from "../site-header";
import { useMapViewState } from "../components/map-view-state";
import { rotateWithinTiers } from "../lib/daily-rotation";
import { nearbyRecommendations, completeNearbyResults, nearbyPoint } from "../lib/nearby-recommendations";
import { NearbySearchNotice } from "../components/nearby-search-notice";

const areas = ["הכל", "צפון", "כנרת", "מרכז ותל אביב", "ירושלים", "דרום ונגב", "אילת והסביבה"];
const types = ["הכל", "שטח ואדרנלין", "טבע ורכיבה", "ים ושיט", "מים ומשפחה", "נחלים ומים", "אוכל ותרבות", "מדבר ושטח", "יצירה וקבוצות"];

export function AttractionsExplorer({ items = paidAttractions }: { items?: DiscoveryItem[] }) {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.toString();
  const requestedArea = searchParams.get("area") || "הכל";
  const requestedType = searchParams.get("type") || "הכל";
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [area, setArea] = useState(areas.includes(requestedArea) ? requestedArea : "הכל");
  const [type, setType] = useState(types.includes(requestedType) ? requestedType : "הכל");
  const { mapOpen, openMap, closeMap } = useMapViewState();
  const [mapVisibleIds, setMapVisibleIds] = useState<string[] | null>(null);
  const [activeMapPlaceId, setActiveMapPlaceId] = useState<string | null>(null);

  const filtered = useMemo(() => rotateWithinTiers(items.filter((item) => {
    const searchable = `${item.name} ${item.location} ${item.area} ${item.description} ${item.features.join(" ")}`;
    const areaMatch = area === "הכל" || item.location.includes(area) || (area === "מרכז ותל אביב" && (item.location.includes("מרכז") || item.location.includes("תל אביב")));
    return areaMatch && (type === "הכל" || item.area === type) && (!query.trim() || searchable.includes(query.trim()));
  }), (item) => query.trim() && !item.name.includes(query.trim()) ? 1 : 0,
  (item) => item.id, "attraction-search"), [area, items, query, type]);

  const nearbyRecovery = useMemo(() => {
    if (filtered.length >= 3 || area === "הכל") return [];
    if (!nearbyPoint({ area })) return [];
    const normalizedQuery = query.trim();
    const eligible = items.filter((item) => {
      const searchable = `${item.name} ${item.location} ${item.area} ${item.description} ${item.features.join(" ")}`;
      return (type === "הכל" || item.area === type) && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
    return nearbyRecommendations(eligible, { area, location: area }, { key: (item) => item.id, limit: 12, minimum: 3 }).items;
  }, [area, filtered.length, items, query, type]);
  const resultItems = useMemo(() => completeNearbyResults(filtered, nearbyRecovery, (item) => item.id), [filtered, nearbyRecovery]);

  function updateUrl(updates: Record<string, string>) {
    const params = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([key, value]) => value && value !== "הכל" ? params.set(key, value) : params.delete(key));
    window.history.pushState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
  }

  function changeQuery(value: string) { setQuery(value); updateUrl({ q: value.trim() }); }
  function changeArea(value: string) { setArea(value); updateUrl({ area: value }); }
  function changeType(value: string) { setType(value); updateUrl({ type: value }); }

  function resetFilters() {
    setQuery("");
    setArea("הכל");
    setType("הכל");
    updateUrl({ q: "", area: "", type: "" });
  }

  const displayed = useMemo(() => {
    if (!mapOpen || !mapVisibleIds) return resultItems;
    const visible = new Set(mapVisibleIds);
    return resultItems.filter((item) => visible.has(item.id));
  }, [mapOpen, mapVisibleIds, resultItems]);

  useEffect(() => {
    const timer = window.setTimeout(() => { setMapVisibleIds(null); setActiveMapPlaceId(null); }, 0);
    return () => window.clearTimeout(timer);
  }, [area, query, type]);

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
      const nextArea = params.get("area") || "הכל";
      const nextType = params.get("type") || "הכל";
      setArea(areas.includes(nextArea) ? nextArea : "הכל");
      setType(types.includes(nextType) ? nextType : "הכל");
      setQuery(params.get("q") || "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  return <>
    <form className="trail-filters attraction-filters" onSubmit={(event) => event.preventDefault()} aria-label="סינון אטרקציות בתשלום">
      <label><span>מה מתחשק לעשות?</span><input value={query} onChange={(event) => changeQuery(event.target.value)} placeholder="לדוגמה: סוסים, שיט, סדנה" /></label>
      <ModernSelect label="אזור" value={area} onChange={changeArea} options={areas.map((item) => ({ value: item, label: item }))} />
      <ModernSelect label="סוג חוויה" value={type} onChange={changeType} options={types.map((item) => ({ value: item, label: item }))} />
    </form>
    {resultItems.length > filtered.length && <NearbySearchNotice regionalOnly />}
    <div className="trail-results-head attraction-results-head">
      <div><strong>{displayed.length === 1 ? "חוויה אחת מתאימה" : `${displayed.length} חוויות מתאימות`}</strong><span>הספק, הזמינות והמחיר מוצגים רק לאחר אימות.</span></div>
      {resultItems.length > 0 && <button className={`button map-button mobile-map-fab ${mapOpen ? "active" : ""}`} type="button" aria-label={mapOpen ? "חזרה לתצוגת רשימה" : "הצגת האטרקציות על המפה"} aria-pressed={mapOpen} onPointerEnter={preloadListingMap} onFocus={preloadListingMap} onTouchStart={preloadListingMap} onClick={toggleResultsMap}><MapIcon /><span className="map-button__desktop-label">{mapOpen ? "תצוגת רשימה" : "תצוגה על מפה"}</span><span className="map-button__mobile-label" aria-hidden="true">מפה</span></button>}
    </div>
    {resultItems.length
      ? mapOpen
        ? <div className="airbnb-map-split world-map-split"><div className="airbnb-map-split__results discovery-grid attraction-grid">{displayed.map((item) => <DiscoveryCard key={item.id} item={item} mapActive={activeMapPlaceId === item.id} onActiveChange={(active) => setActiveMapPlaceId(active ? item.id : null)} />)}</div><div className="airbnb-map-split__map"><DeferredDiscoveryMap items={resultItems} tone="activities" autoLoad onClose={closeResultsMap} onVisiblePlaceIdsChange={setMapVisibleIds} activePlaceId={activeMapPlaceId} onActivePlaceChange={setActiveMapPlaceId} /></div></div>
        : <div className="discovery-grid attraction-grid">{displayed.map((item) => <DiscoveryCard key={item.id} item={item} />)}</div>
      : <div className="trail-empty"><h2>לא מצאנו התאמה לסינון הזה</h2><p>אפשר להסיר סינון או לבחור אזור סמוך.</p><button type="button" onClick={resetFilters}>ניקוי סינונים</button></div>}
  </>;
}
