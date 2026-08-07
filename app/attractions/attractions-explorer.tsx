"use client";

import { useMemo, useState } from "react";
import { DiscoveryCard } from "../components/discovery-card";
import { DiscoveryMap } from "../components/listing-map";
import { ModernSelect } from "../components/modern-select";
import { paidAttractions } from "../data/world-data";
import { MapIcon } from "../site-header";

const areas = ["הכל", "צפון", "כנרת", "מרכז ותל אביב", "ירושלים", "דרום ונגב", "אילת והסביבה"];
const types = ["הכל", "שטח ואדרנלין", "טבע ורכיבה", "ים ושיט", "מים ומשפחה", "נחלים ומים", "אוכל ותרבות", "מדבר ושטח", "יצירה וקבוצות"];

export function AttractionsExplorer() {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("הכל");
  const [type, setType] = useState("הכל");
  const [mapOpen, setMapOpen] = useState(false);

  const filtered = useMemo(() => paidAttractions.filter((item) => {
    const searchable = `${item.name} ${item.location} ${item.area} ${item.description} ${item.features.join(" ")}`;
    const areaMatch = area === "הכל" || item.location.includes(area) || (area === "מרכז ותל אביב" && (item.location.includes("מרכז") || item.location.includes("תל אביב")));
    return areaMatch && (type === "הכל" || item.area === type) && (!query.trim() || searchable.includes(query.trim()));
  }), [area, query, type]);

  function resetFilters() {
    setQuery("");
    setArea("הכל");
    setType("הכל");
  }

  return <>
    <form className="trail-filters attraction-filters" onSubmit={(event) => event.preventDefault()} aria-label="סינון אטרקציות בתשלום">
      <label><span>מה מתחשק לעשות?</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="לדוגמה: סוסים, שיט, סדנה" /></label>
      <ModernSelect label="אזור" value={area} onChange={setArea} options={areas.map((item) => ({ value: item, label: item }))} />
      <ModernSelect label="סוג חוויה" value={type} onChange={setType} options={types.map((item) => ({ value: item, label: item }))} />
    </form>
    <div className="trail-results-head attraction-results-head">
      <div><strong>{filtered.length === 1 ? "חוויה אחת מתאימה" : `${filtered.length} חוויות מתאימות`}</strong><span>הספק, הזמינות והמחיר מוצגים רק לאחר אימות.</span></div>
      {filtered.length > 0 && <button className={`button map-button mobile-map-fab ${mapOpen ? "active" : ""}`} type="button" aria-label={mapOpen ? "חזרה לתצוגת רשימה" : "הצגת האטרקציות על המפה"} aria-pressed={mapOpen} onClick={() => setMapOpen((value) => !value)}><MapIcon /><span className="map-button__desktop-label">{mapOpen ? "תצוגת רשימה" : "תצוגה על מפה"}</span><span className="map-button__mobile-label" aria-hidden="true">מפה</span></button>}
    </div>
    {filtered.length
      ? mapOpen
        ? <DiscoveryMap items={filtered} tone="activities" autoLoad onClose={() => setMapOpen(false)} />
        : <div className="discovery-grid attraction-grid">{filtered.map((item) => <DiscoveryCard key={item.id} item={item} />)}</div>
      : <div className="trail-empty"><h2>לא מצאנו התאמה לסינון הזה</h2><p>אפשר להסיר סינון או לבחור אזור סמוך.</p><button type="button" onClick={resetFilters}>ניקוי סינונים</button></div>}
  </>;
}
