"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DiscoveryCard } from "./discovery-card";
import type { DiscoveryItem } from "../data/world-data";
import { DiscoveryMap } from "./listing-map";
import { MapIcon } from "../site-header";
import { ModernSelect } from "./modern-select";

const featureFilters = [
  { id: "parking", label: "חניה", terms: ["חניה"] },
  { id: "independent", label: "כניסה עצמאית", terms: ["כניסה עצמאית", "ללא מפגש"] },
  { id: "jacuzzi", label: "ג׳קוזי", terms: ["ג׳קוזי"] },
  { id: "pool", label: "בריכה", terms: ["בריכה"] },
];

function startingPrice(item: DiscoveryItem) {
  const value = item.priceLabel?.match(/\d+/)?.[0];
  return value ? Number(value) : Number.POSITIVE_INFINITY;
}

export function HourlyResults({ items }: { items: DiscoveryItem[] }) {
  const searchParams = useSearchParams();
  const requestedLocation = searchParams.get("location") || "כל הארץ";
  return <HourlyResultsPanel key={requestedLocation} items={items} requestedLocation={requestedLocation} />;
}

function HourlyResultsPanel({ items, requestedLocation }: { items: DiscoveryItem[]; requestedLocation: string }) {
  const [location, setLocation] = useState(requestedLocation);
  const [maximumPrice, setMaximumPrice] = useState(0);
  const [features, setFeatures] = useState<string[]>([]);
  const [mapOpen, setMapOpen] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  const locations = useMemo(
    () => ["כל הארץ", ...Array.from(new Set(items.flatMap((item) => [item.area, item.location])))],
    [items],
  );

  const filtered = useMemo(() => items.filter((item) => {
    const locationMatches = location === "כל הארץ" || item.area === location || item.location === location;
    const priceMatches = maximumPrice === 0 || startingPrice(item) <= maximumPrice;
    const searchable = `${item.description} ${item.features.join(" ")}`;
    const featuresMatch = features.every((featureId) => {
      const filter = featureFilters.find((entry) => entry.id === featureId);
      return filter ? filter.terms.some((term) => searchable.includes(term)) : true;
    });
    return locationMatches && priceMatches && featuresMatch;
  }), [features, items, location, maximumPrice]);

  function toggleFeature(id: string) {
    setFeatures((current) => current.includes(id) ? current.filter((feature) => feature !== id) : [...current, id]);
  }

  function resetFilters() {
    setLocation("כל הארץ");
    setMaximumPrice(0);
    setFeatures([]);
  }

  return <div className="hourly-results">
    <div className="hourly-results__toolbar" aria-label="סינון תוצאות של חדרים לפי שעה">
      <div className="hourly-results__heading">
        <div><strong aria-live="polite">{filtered.length} מקומות נמצאו</strong><span>אפשר לדייק את הרשימה לפי אזור, מחיר ומאפייני המקום.</span></div>
        {filtered.length > 0 && <button className={`button map-button mobile-map-fab ${mapOpen ? "active" : ""}`} type="button" aria-label={mapOpen ? "חזרה לתצוגת רשימה" : "הצגת תוצאות על המפה"} aria-pressed={mapOpen} onClick={() => setMapOpen((value) => !value)}><MapIcon /><span className="map-button__desktop-label">{mapOpen ? "תצוגת רשימה" : "תצוגה על מפה"}</span><span className="map-button__mobile-label" aria-hidden="true">מפה</span></button>}
      </div>
      <div className="hourly-results__filters">
        <ModernSelect label="עיר או אזור" value={location} onChange={setLocation} options={locations.map((option) => ({ value: option, label: option }))} />
        <ModernSelect label="מחיר התחלתי עד" value={String(maximumPrice)} onChange={(nextValue) => setMaximumPrice(Number(nextValue))} options={[{ value: "0", label: "ללא הגבלה" }, { value: "200", label: "200 ₪" }, { value: "250", label: "250 ₪" }, { value: "300", label: "300 ₪" }, { value: "400", label: "400 ₪" }]} />
        <button type="button" className="hourly-more-filters" aria-expanded={moreFiltersOpen} onClick={() => setMoreFiltersOpen((value) => !value)}>סינון נוסף{features.length ? ` (${features.length})` : ""}</button>
        <fieldset className={moreFiltersOpen ? "open" : ""}><legend>מאפייני המקום</legend><div>{featureFilters.map((filter) => <label key={filter.id} className={features.includes(filter.id) ? "selected" : ""}><input type="checkbox" checked={features.includes(filter.id)} onChange={() => toggleFeature(filter.id)} /><span>{filter.label}</span></label>)}</div></fieldset>
        <button type="button" className="hourly-results__reset" onClick={resetFilters} disabled={location === "כל הארץ" && maximumPrice === 0 && features.length === 0}>ניקוי סינונים</button>
      </div>
    </div>
    {filtered.length > 0 ? mapOpen ? <DiscoveryMap items={filtered} tone="hourly" autoLoad onClose={() => setMapOpen(false)} /> : <div className="discovery-grid">{filtered.map((item) => <DiscoveryCard key={item.id} item={item} />)}</div> : <div className="hourly-results__empty"><strong>לא נמצאו מקומות שמתאימים לכל הסינונים</strong><p>אפשר להרחיב את האזור או להסיר אחד מהמאפיינים.</p><button type="button" className="button secondary" onClick={resetFilters}>הצגת כל המקומות</button></div>}
  </div>;
}
