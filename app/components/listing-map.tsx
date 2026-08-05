"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Listing } from "../data/site-data";
import "leaflet/dist/leaflet.css";

type ListingMapProps = {
  listings: Listing[];
  mode?: "vacation" | "events";
  single?: boolean;
};

export function ListingMap({ listings, mode = "vacation", single = false }: ListingMapProps) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<import("leaflet").Map | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [selected, setSelected] = useState(listings[0] ?? null);

  useEffect(() => {
    if (!enabled || !mapElement.current || listings.length === 0) return;
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !mapElement.current) return;
      mapInstance.current?.remove();
      const map = L.map(mapElement.current, { scrollWheelZoom: false, zoomControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      const bounds = L.latLngBounds([]);
      listings.forEach((listing) => {
        const marker = L.marker([listing.lat, listing.lng], {
          icon: L.divIcon({
            className: "vii-map-marker-wrap",
            html: `<span class="vii-map-marker">${single ? "⌖" : listing.guests}</span>`,
            iconSize: [42, 42],
            iconAnchor: [21, 42],
          }),
        }).addTo(map);
        marker.bindTooltip(listing.name, { direction: "top", offset: [0, -36] });
        marker.on("click", () => setSelected(listing));
        bounds.extend([listing.lat, listing.lng]);
      });
      if (listings.length === 1) map.setView([listings[0].lat, listings[0].lng], 14);
      else map.fitBounds(bounds.pad(0.16), { maxZoom: 11 });
      mapInstance.current = map;
      window.setTimeout(() => map.invalidateSize(), 50);
    });
    return () => {
      cancelled = true;
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, [enabled, listings, single]);

  if (!enabled) {
    return (
      <div className="map-consent-card">
        <span className="map-consent-pin">⌖</span>
        <h3>{single ? "מיקום המקום" : `מפה עם ${listings.length} מקומות`}</h3>
        <p>המפה החינמית נטענת רק לאחר לחיצה ומציגה נתונים של OpenStreetMap.</p>
        <button className="button primary" type="button" onClick={() => setEnabled(true)}>טעינת המפה</button>
      </div>
    );
  }

  return (
    <div className={`listing-map-shell ${single ? "single-map" : ""}`}>
      <div ref={mapElement} className="listing-map" aria-label="מפה אינטראקטיבית של המקומות" />
      {!single && selected && (
        <article className="map-selection-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selected.image} alt={selected.name} />
          <div>
            <small>{selected.type}</small>
            <strong>{selected.name}</strong>
            <span>{selected.location} · עד {selected.guests} אורחים</span>
            <Link href={mode === "events" ? `/events/place/?id=${selected.slug}` : `/business/?id=${selected.slug}`}>לפרטי המקום</Link>
          </div>
        </article>
      )}
    </div>
  );
}
