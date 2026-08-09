"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DiscoveryCard } from "../components/discovery-card";
import { DiscoveryMap } from "../components/listing-map";
import { ModernSelect } from "../components/modern-select";
import { paidAttractions } from "../data/world-data";
import { MapIcon } from "../site-header";

const areas = ["הכל", "צפון", "כנרת", "מרכז ותל אביב", "ירושלים", "דרום ונגב", "אילת והסביבה"];
const types = ["הכל", "שטח ואדרנלין", "טבע ורכיבה", "ים ושיט", "מים ומשפחה", "נחלים ומים", "אוכל ותרבות", "מדבר ושטח", "יצירה וקבוצות"];

export function AttractionsExplorer() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.toString();
  const requestedArea = searchParams.get("area") || "הכל";
  const requestedType = searchParams.get("type") || "הכל";
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [area, setArea] = useState(areas.includes(requestedArea) ? requestedArea : "הכל");
  const [type, setType] = useState(types.includes(requestedType) ? requestedType : "הכל");
  const [mapOpen, setMapOpen] = useState(false);
  const [mapVisibleIds, setMapVisibleIds] = useState<string[] | null>(null);

  const filtered = useMemo(() => paidAttractions.filter((item) => {
    const searchable = `${item.name} ${item.location} ${item.area} ${item.description} ${item.features.join(" ")}`;
    const areaMatch = area === "הכל" || item.location.includes(area) || (area === "מרכז ותל אביב" && (item.location.includes("מרכז") || item.location.includes("תל אביב")));
    return areaMatch && (type === "הכל" || item.area === type) && (!query.trim() || searchable.includes(query.trim()));
  }), [area, query, type]);

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
    if (!mapVisibleIds) return filtered;
    const visible = new Set(mapVisibleIds);
    return filtered.filter((item) => visible.has(item.id));
  }, [filtered, mapVisibleIds]);

  useEffect(() => {
    const timer = window.setTimeout(() => setMapVisibleIds(null), 0);
    return () => window.clearTimeout(timer);
  }, [area, query, type]);
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
    <div className="trail-results-head attraction-results-head">
      <div><strong>{displayed.length === 1 ? "חוויה אחת מתאימה" : `${displayed.length} חוויות מתאימות`}</strong><span>הספק, הזמינות והמחיר מוצגים רק לאחר אימות.</span></div>
      {filtered.length > 0 && <button className={`button map-button mobile-map-fab ${mapOpen ? "active" : ""}`} type="button" aria-label={mapOpen ? "חזרה לתצוגת רשימה" : "הצגת האטרקציות על המפה"} aria-pressed={mapOpen} onClick={() => setMapOpen((value) => !value)}><MapIcon /><span className="map-button__desktop-label">{mapOpen ? "תצוגת רשימה" : "תצוגה על מפה"}</span><span className="map-button__mobile-label" aria-hidden="true">מפה</span></button>}
    </div>
    {filtered.length
      ? mapOpen
        ? <DiscoveryMap items={filtered} tone="activities" autoLoad onClose={() => setMapOpen(false)} onVisiblePlaceIdsChange={setMapVisibleIds} />
        : <div className="discovery-grid attraction-grid">{displayed.map((item) => <DiscoveryCard key={item.id} item={item} />)}</div>
      : <div className="trail-empty"><h2>לא מצאנו התאמה לסינון הזה</h2><p>אפשר להסיר סינון או לבחור אזור סמוך.</p><button type="button" onClick={resetFilters}>ניקוי סינונים</button></div>}
  </>;
}
