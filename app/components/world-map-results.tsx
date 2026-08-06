"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { DiscoveryItem } from "../data/world-data";
import { MapIcon } from "../site-header";
import { DiscoveryCard } from "./discovery-card";
import { DiscoveryMap } from "./listing-map";
import { ModernSelect } from "./modern-select";

const spaFilters = [
  { id: "hotel", label: "ספא בבית מלון", terms: ["מלון"] },
  { id: "boutique", label: "ספא בוטיק או פרטי", terms: ["בוטיק", "פרטי", "סוויטה פרטית"] },
  { id: "pool", label: "בריכה", terms: ["בריכה", "בריכות"] },
  { id: "jacuzzi", label: "ג׳קוזי", terms: ["ג׳קוזי"] },
  { id: "sauna", label: "סאונה", terms: ["סאונה", "סאונות"] },
  { id: "gym", label: "חדר כושר", terms: ["חדר כושר"] },
  { id: "couples", label: "חבילה זוגית", terms: ["זוג", "זוגי", "זוגיות"] },
  { id: "day-pass", label: "יום כיף", terms: ["יום כיף"] },
  { id: "meal", label: "חבילה עם ארוחה", terms: ["ארוחה", "ארוחת בוקר"] },
];

function searchableText(item: DiscoveryItem) {
  return `${item.name} ${item.description} ${item.features.join(" ")}`;
}

function SpaResults({ items }: { items: DiscoveryItem[] }) {
  const searchParams = useSearchParams();
  const requestedLocation = searchParams.get("location") || "כל הארץ";
  const [location, setLocation] = useState(requestedLocation);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [mapOpen, setMapOpen] = useState(false);

  const locations = useMemo(
    () => ["כל הארץ", ...Array.from(new Set(items.flatMap((item) => [item.area, item.location])))],
    [items],
  );

  const filtered = useMemo(() => items.filter((item) => {
    const locationMatches = location === "כל הארץ" || item.area === location || item.location === location;
    const text = searchableText(item);
    const featuresMatch = selectedFilters.every((filterId) => {
      const filter = spaFilters.find((entry) => entry.id === filterId);
      return filter ? filter.terms.some((term) => text.includes(term)) : true;
    });
    return locationMatches && featuresMatch;
  }), [items, location, selectedFilters]);

  function toggleFilter(id: string) {
    setSelectedFilters((current) => current.includes(id) ? current.filter((filter) => filter !== id) : [...current, id]);
  }

  function resetFilters() {
    setLocation("כל הארץ");
    setSelectedFilters([]);
  }

  const hasFilters = location !== "כל הארץ" || selectedFilters.length > 0;

  return <div className="world-map-results world-map-results--spa spa-results">
    <div className="spa-results__toolbar" aria-label="סינון תוצאות ספא">
      <div className="spa-results__heading">
        <div><span className="eyebrow">מסננים לפי מה שחשוב לכם</span><strong aria-live="polite"><span>{filtered.length}</span> <span>מתחמי ספא נמצאו</span></strong></div>
        {filtered.length > 0 && <button className={`button map-button mobile-map-fab ${mapOpen ? "active" : ""}`} type="button" aria-label={mapOpen ? "חזרה לתצוגת רשימה" : "הצגת תוצאות על המפה"} aria-pressed={mapOpen} onClick={() => setMapOpen((value) => !value)}><MapIcon /><span className="map-button__desktop-label">{mapOpen ? "תצוגת רשימה" : "תצוגה על מפה"}</span><span className="map-button__mobile-label" aria-hidden="true">מפה</span></button>}
      </div>
      <div className="spa-results__filters">
        <ModernSelect className="spa-results__location" label="אזור" value={location} onChange={setLocation} options={locations.map((option) => ({ value: option, label: option }))} />
        <fieldset><legend>סוג המקום, מתקנים וחבילות</legend><div>{spaFilters.map((filter) => <label key={filter.id} className={selectedFilters.includes(filter.id) ? "selected" : ""}><input type="checkbox" checked={selectedFilters.includes(filter.id)} onChange={() => toggleFilter(filter.id)} /><span>{filter.label}</span></label>)}</div><small className="spa-results__swipe-hint">החליקו לעוד סינונים</small></fieldset>
        <button type="button" className="spa-results__reset" onClick={resetFilters} disabled={!hasFilters}>ניקוי סינונים</button>
      </div>
      {hasFilters && <div className="spa-results__active" aria-label="סינונים פעילים"><span>סינונים פעילים:</span>{location !== "כל הארץ" && <button type="button" onClick={() => setLocation("כל הארץ")}>{location} ×</button>}{selectedFilters.map((id) => { const filter = spaFilters.find((entry) => entry.id === id); return filter ? <button type="button" key={id} onClick={() => toggleFilter(id)}>{filter.label} ×</button> : null; })}</div>}
    </div>
    {filtered.length > 0 ? mapOpen ? <DiscoveryMap items={filtered} tone="spa" autoLoad onClose={() => setMapOpen(false)} /> : <div className="discovery-grid">{filtered.map((item) => <DiscoveryCard key={item.id} item={item} />)}</div> : <div className="spa-results__empty"><strong>לא נמצאו מתחמים שמתאימים לכל הסינונים</strong><p>אפשר להסיר מאפיין אחד או לבחור אזור רחב יותר.</p><button type="button" className="button secondary" onClick={resetFilters}>הצגת כל מתחמי הספא</button></div>}
  </div>;
}

export function WorldMapResults({ items, world }: { items: DiscoveryItem[]; world: "spa" | "hourly" }) {
  const [mapOpen, setMapOpen] = useState(false);

  if (world === "spa") return <SpaResults items={items} />;

  return <div className={`world-map-results world-map-results--${world}`}>
    <div className="world-map-results__toolbar">
      <div><span className="eyebrow">בוחרים בדרך שנוחה לכם</span><strong>{mapOpen ? "המקומות מסומנים על מפה אינטראקטיבית" : `${items.length} מקומות ברשימה`}</strong></div>
      {items.length > 0 && <button className={`button map-button mobile-map-fab ${mapOpen ? "active" : ""}`} type="button" aria-label={mapOpen ? "חזרה לתצוגת רשימה" : "הצגת תוצאות על המפה"} aria-pressed={mapOpen} onClick={() => setMapOpen((value) => !value)}><MapIcon /><span className="map-button__desktop-label">{mapOpen ? "תצוגת רשימה" : "תצוגה על מפה"}</span><span className="map-button__mobile-label" aria-hidden="true">מפה</span></button>}
    </div>
    {mapOpen ? <DiscoveryMap items={items} tone={world} autoLoad onClose={() => setMapOpen(false)} /> : <div className="discovery-grid">{items.map((item) => <DiscoveryCard key={item.id} item={item} />)}</div>}
  </div>;
}
