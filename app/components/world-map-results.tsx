"use client";

import { useState } from "react";
import type { DiscoveryItem } from "../data/world-data";
import { PinIcon } from "../site-header";
import { DiscoveryCard } from "./discovery-card";
import { DiscoveryMap } from "./listing-map";

export function WorldMapResults({ items, world }: { items: DiscoveryItem[]; world: "spa" | "hourly" }) {
  const [mapOpen, setMapOpen] = useState(false);
  return <div className={`world-map-results world-map-results--${world}`}>
    <div className="world-map-results__toolbar">
      <div><span className="eyebrow">בוחרים בדרך שנוחה לכם</span><strong>{mapOpen ? "המקומות מסומנים על מפה אינטראקטיבית" : `${items.length} מקומות ברשימה`}</strong></div>
      <button className={`button map-button ${mapOpen ? "active" : ""}`} type="button" aria-pressed={mapOpen} onClick={() => setMapOpen((value) => !value)}><PinIcon />{mapOpen ? "תצוגת רשימה" : "תצוגה על מפה"}</button>
    </div>
    {mapOpen ? <DiscoveryMap items={items} tone={world} autoLoad /> : <div className="discovery-grid">{items.map((item) => <DiscoveryCard key={item.id} item={item} />)}</div>}
  </div>;
}
