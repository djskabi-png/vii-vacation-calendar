"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { DiscoveryItem } from "../data/world-data";
import { MapIcon } from "../site-header";
import { DiscoveryCard } from "./discovery-card";
import { DeferredDiscoveryMap } from "./deferred-listing-map";
import { ModernSelect } from "./modern-select";
import Link from "next/link";
import { spaLandings } from "../data/spa-landings";
import { useMapViewState } from "./map-view-state";
import { spaSearchHref, spaSearchStateFromValues, type SpaSearchAudienceId } from "../data/spa-search-landings";
import { localizedPath } from "../i18n/locale-routing";
import { useSiteLanguage } from "../i18n/locale-provider";

const spaFilters = spaLandings;

const spaAudiences = {
  single: { label: "יחיד", terms: ["יחיד", "אישי"] },
  couple: { label: "זוגי", terms: ["זוג", "זוגי", "זוגיות"] },
  group: { label: "קבוצה", terms: ["קבוצה", "קבוצות"] },
  "day-pass": { label: "יום כיף", terms: ["יום כיף"] },
} as const;

type SpaAudienceId = SpaSearchAudienceId;

function SpaFilterIcon({ id }: { id: string }) {
  const shared = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  if (id === "hotel") return <svg viewBox="0 0 24 24" aria-hidden="true" {...shared}><path d="M4 21V7h10v14M8 11h2m-2 4h2m-2 4h2M14 12h6v9m-3-6v2" /></svg>;
  if (id === "boutique") return <svg viewBox="0 0 24 24" aria-hidden="true" {...shared}><path d="M12 3c.8 4.3 3.2 6.7 7 7.5-3.8.8-6.2 3.2-7 7.5-.8-4.3-3.2-6.7-7-7.5C8.8 9.7 11.2 7.3 12 3Z" /><path d="M19 3v4m-2-2h4" /></svg>;
  if (id === "pool") return <svg viewBox="0 0 24 24" aria-hidden="true" {...shared}><path d="M3 11h18M5 7h4v4m4-6h4v6M3 16c2 0 2 1.5 4 1.5S9 16 11 16s2 1.5 4 1.5S17 16 19 16s2 1.5 2 1.5" /></svg>;
  if (id === "jacuzzi") return <svg viewBox="0 0 24 24" aria-hidden="true" {...shared}><circle cx="7" cy="6" r="2" /><circle cx="14" cy="4" r="1.5" /><circle cx="18" cy="8" r="2" /><path d="M3 13h18v2a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6v-2Z" /></svg>;
  if (id === "sauna") return <svg viewBox="0 0 24 24" aria-hidden="true" {...shared}><path d="M7 4c-2 2 2 3 0 5s2 3 0 5m5-10c-2 2 2 3 0 5s2 3 0 5m5-10c-2 2 2 3 0 5s2 3 0 5M4 19h16" /></svg>;
  if (id === "gym") return <svg viewBox="0 0 24 24" aria-hidden="true" {...shared}><path d="M3 9v6m3-8v10m12-10v10m3-8v6M6 12h12" /></svg>;
  if (id === "couples") return <svg viewBox="0 0 24 24" aria-hidden="true" {...shared}><path d="M20.5 5.8c-2.1-2.2-5.5-1.7-7.1.7L12 8.4l-1.4-1.9C9 4.1 5.6 3.6 3.5 5.8 1.1 8.3 1.7 12.2 4 14.4L12 22l8-7.6c2.3-2.2 2.9-6.1.5-8.6Z" /></svg>;
  if (id === "day-pass") return <svg viewBox="0 0 24 24" aria-hidden="true" {...shared}><circle cx="12" cy="12" r="4" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...shared}><path d="M5 4h12v7a6 6 0 0 1-12 0V4Zm12 2h1a3 3 0 0 1 0 6h-1M4 21h15" /><path d="M8 1v3m4-3v3" /></svg>;
}

function searchableText(item: DiscoveryItem) {
  return `${item.name} ${item.description} ${item.features.join(" ")}`;
}

function SpaResults({ items, activeSpaFilter, initialLocation, initialSpaAudience, initialSpaFilters }: { items: DiscoveryItem[]; activeSpaFilter?: string; initialLocation?: string; initialSpaAudience?: string; initialSpaFilters?: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useSiteLanguage();
  const searchQuery = searchParams.toString();
  const requestedLocation = searchParams.get("location") || initialLocation || "כל הארץ";
  const requestedAudience = searchParams.get("spaFor") || initialSpaAudience;
  const [location, setLocation] = useState(requestedLocation);
  const [spaAudience, setSpaAudience] = useState<SpaAudienceId | "">(
    requestedAudience && requestedAudience in spaAudiences ? requestedAudience as SpaAudienceId : "",
  );
  const [selectedFilters, setSelectedFilters] = useState<string[]>(() => {
    const requested = (searchParams.get("features") || "").split(",").filter(Boolean);
    return (requested.length ? requested : initialSpaFilters || []).filter((id) => spaFilters.some((filter) => filter.id === id));
  });
  const { mapOpen, openMap, closeMap } = useMapViewState();
  const [visibleMapCount, setVisibleMapCount] = useState(0);
  const [mapVisibleIds, setMapVisibleIds] = useState<string[] | null>(null);
  const spaLandingContext = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("location");
    params.delete("spaFor");
    params.delete("features");
    const query = params.toString();
    return (filterId: string) => {
      const nextFilters = selectedFilters.includes(filterId) ? selectedFilters.filter((id) => id !== filterId) : [...selectedFilters, filterId];
      const href = spaSearchHref(spaSearchStateFromValues(location, spaAudience, nextFilters));
      return `${href}${query ? `?${query}` : ""}`;
    };
  }, [location, searchParams, selectedFilters, spaAudience]);

  const locations = useMemo(
    () => ["כל הארץ", ...Array.from(new Set(items.flatMap((item) => [item.area, item.location])))],
    [items],
  );

  const amenityFiltered = useMemo(() => items.filter((item) => {
    const text = searchableText(item);
    const featuresMatch = selectedFilters.every((filterId) => {
      const filter = spaFilters.find((entry) => entry.id === filterId);
      return filter ? filter.terms.some((term) => text.includes(term)) : true;
    });
    const audience = spaAudience ? spaAudiences[spaAudience] : null;
    const audienceMatch = audience ? audience.terms.some((term) => text.includes(term)) : true;
    return featuresMatch && audienceMatch;
  }), [items, selectedFilters, spaAudience]);

  const filtered = useMemo(() => amenityFiltered.filter((item) => (
    location === "כל הארץ" || item.area === location || item.location === location
  )), [amenityFiltered, location]);

  function updateUrl(nextLocation: string, nextAudience: SpaAudienceId | "", nextFilters: string[]) {
    const params = new URLSearchParams(window.location.search);
    params.delete("location");
    params.delete("spaFor");
    params.delete("features");
    const path = spaSearchHref(spaSearchStateFromValues(nextLocation, nextAudience, nextFilters));
    const query = params.toString();
    router.push(localizedPath(`${path}${query ? `?${query}` : ""}`, language));
  }

  function changeLocation(value: string) { setLocation(value); updateUrl(value, spaAudience, selectedFilters); }
  function changeAudience(value: SpaAudienceId | "") { setSpaAudience(value); updateUrl(location, value, selectedFilters); }

  function toggleFilter(id: string) {
    setSelectedFilters((current) => {
      const next = current.includes(id) ? current.filter((filter) => filter !== id) : [...current, id];
      updateUrl(location, spaAudience, next);
      return next;
    });
  }

  function resetFilters() {
    setLocation("כל הארץ");
    setSpaAudience("");
    setSelectedFilters([]);
    updateUrl("כל הארץ", "", []);
  }

  const hasFilters = location !== "כל הארץ" || spaAudience !== "" || selectedFilters.length > 0;
  const displayed = useMemo(() => {
    if (!mapVisibleIds) return filtered;
    const visible = new Set(mapVisibleIds);
    return amenityFiltered.filter((item) => visible.has(item.id));
  }, [amenityFiltered, filtered, mapVisibleIds]);

  useEffect(() => {
    const timer = window.setTimeout(() => setMapVisibleIds(null), 0);
    return () => window.clearTimeout(timer);
  }, [location, selectedFilters, spaAudience]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchQuery);
      setLocation(params.get("location") || initialLocation || "כל הארץ");
      const nextAudience = params.get("spaFor") || initialSpaAudience;
      setSpaAudience(nextAudience && nextAudience in spaAudiences ? nextAudience as SpaAudienceId : "");
      const requestedFilters = (params.get("features") || "").split(",").filter(Boolean);
      setSelectedFilters((requestedFilters.length ? requestedFilters : initialSpaFilters || []).filter((id) => spaFilters.some((filter) => filter.id === id)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialLocation, initialSpaAudience, initialSpaFilters, searchQuery]);
  const resultLabel = mapOpen
    ? `${visibleMapCount} בתי ספא באזור המוצג במפה`
    : `${displayed.length} בתי ספא${mapVisibleIds ? " באזור שבחרתם במפה" : location === "כל הארץ" ? " בישראל" : ` ב${location}`}`;

  return <div className="world-map-results world-map-results--spa spa-results">
    <div className="spa-results__toolbar" aria-label="סינון תוצאות ספא">
      <div className="spa-results__heading">
        <div><h2 aria-live="polite">{resultLabel}</h2></div>
        {filtered.length > 0 && <button className={`button map-button mobile-map-fab ${mapOpen ? "active" : ""}`} type="button" aria-label={mapOpen ? "חזרה לתצוגת רשימה" : "הצגת תוצאות על המפה"} aria-pressed={mapOpen} onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()} onClick={(event) => { event.preventDefault(); event.stopPropagation(); if (mapOpen) closeMap(); else openMap(); }}><MapIcon /><span className="map-button__desktop-label">{mapOpen ? "תצוגת רשימה" : "תצוגה על מפה"}</span><span className="map-button__mobile-label" aria-hidden="true">מפה</span></button>}
      </div>
      <div className="spa-results__filters">
        <div className="spa-results__location-card"><span className="spa-results__location-icon"><MapIcon /></span><ModernSelect className="spa-results__location" label="איפה תרצו להתפנק?" value={location} onChange={changeLocation} options={locations.map((option) => ({ value: option, label: option }))} /></div>
        <nav className="spa-results__landing-links" aria-label="עמודי ספא לפי מאפיין"><strong>מה תרצו שיהיה במקום?</strong><div>{spaFilters.map((filter) => { const selected = selectedFilters.includes(filter.id) || activeSpaFilter === filter.id; return <Link key={filter.id} href={spaLandingContext(filter.id)} scroll={false} aria-current={selected ? "page" : undefined} className={selected ? "selected" : ""}><span className="spa-results__filter-icon"><SpaFilterIcon id={filter.id} /></span><span className="spa-results__filter-label">{filter.label}</span></Link>; })}</div><small className="spa-results__swipe-hint">החליקו לעוד אפשרויות</small></nav>
        <button type="button" className="spa-results__reset" onClick={resetFilters} disabled={!hasFilters}>ניקוי סינונים</button>
      </div>
      {hasFilters && <div className="spa-results__active" aria-label="סינונים פעילים"><span>סינונים פעילים:</span>{location !== "כל הארץ" && <button type="button" onClick={() => changeLocation("כל הארץ")}>{location} ×</button>}{spaAudience && <button type="button" onClick={() => changeAudience("")}>{spaAudiences[spaAudience].label} ×</button>}{selectedFilters.map((id) => { const filter = spaFilters.find((entry) => entry.id === id); return filter ? <button type="button" key={id} onClick={() => toggleFilter(id)}>{filter.label} ×</button> : null; })}</div>}
    </div>
    {filtered.length > 0 ? mapOpen ? <DeferredDiscoveryMap items={amenityFiltered} initialItems={filtered} tone="spa" autoLoad onClose={closeMap} onVisibleCountChange={setVisibleMapCount} onVisiblePlaceIdsChange={setMapVisibleIds} /> : <div className="discovery-grid">{displayed.map((item) => <DiscoveryCard key={item.id} item={item} />)}</div> : <div className="spa-results__empty"><strong>לא נמצאו מתחמים שמתאימים לכל הסינונים</strong><p>אפשר להסיר מאפיין אחד או לבחור אזור רחב יותר.</p><button type="button" className="button secondary" onClick={resetFilters}>הצגת כל מתחמי הספא</button></div>}
  </div>;
}

export function WorldMapResults({ items, world, activeSpaFilter, initialLocation, initialSpaAudience, initialSpaFilters }: { items: DiscoveryItem[]; world: "spa" | "hourly"; activeSpaFilter?: string; initialLocation?: string; initialSpaAudience?: string; initialSpaFilters?: string[] }) {
  const { mapOpen, openMap, closeMap } = useMapViewState();

  if (world === "spa") return <SpaResults items={items} activeSpaFilter={activeSpaFilter} initialLocation={initialLocation} initialSpaAudience={initialSpaAudience} initialSpaFilters={initialSpaFilters} />;

  return <div className={`world-map-results world-map-results--${world}`}>
    <div className="world-map-results__toolbar">
      <div><span className="eyebrow">בוחרים בדרך שנוחה לכם</span><strong>{mapOpen ? "המקומות מסומנים על מפה אינטראקטיבית" : `${items.length} מקומות ברשימה`}</strong></div>
      {items.length > 0 && <button className={`button map-button mobile-map-fab ${mapOpen ? "active" : ""}`} type="button" aria-label={mapOpen ? "חזרה לתצוגת רשימה" : "הצגת תוצאות על המפה"} aria-pressed={mapOpen} onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()} onClick={(event) => { event.preventDefault(); event.stopPropagation(); if (mapOpen) closeMap(); else openMap(); }}><MapIcon /><span className="map-button__desktop-label">{mapOpen ? "תצוגת רשימה" : "תצוגה על מפה"}</span><span className="map-button__mobile-label" aria-hidden="true">מפה</span></button>}
    </div>
    {mapOpen ? <DeferredDiscoveryMap items={items} tone={world} autoLoad onClose={closeMap} /> : <div className="discovery-grid">{items.map((item) => <DiscoveryCard key={item.id} item={item} />)}</div>}
  </div>;
}
