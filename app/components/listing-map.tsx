"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ListingAccessibility } from "./listing-accessibility";
import type { Listing } from "../data/site-data";
import "leaflet/dist/leaflet.css";

type ListingMapProps = {
  listings: Listing[];
  mode?: "vacation" | "events";
  single?: boolean;
  autoLoad?: boolean;
};

export function ListingMap({ listings, mode = "vacation", single = false, autoLoad = false }: ListingMapProps) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<import("leaflet").Map | null>(null);
  const [enabled, setEnabled] = useState(autoLoad);
  const [mapReady, setMapReady] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState(listings[0]?.slug ?? "");
  const preview = listings[0] ?? null;
  const selected = listings.find((listing) => listing.slug === selectedSlug) ?? preview;

  useEffect(() => {
    if (!enabled || !mapElement.current || listings.length === 0) return;
    let cancelled = false;
    let readyTimer: number | undefined;
    setMapReady(false);

    void import("leaflet").then((L) => {
      if (cancelled || !mapElement.current) return;
      mapInstance.current?.remove();

      const map = L.map(mapElement.current, {
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true,
      });
      const streetTiles = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: 20,
          subdomains: "abcd",
        },
      );
      const aerialTiles = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "Tiles &copy; Esri",
          maxZoom: 19,
        },
      );
      const activeTiles = streetTiles;
      activeTiles.addTo(map);
      if (single) {
        L.control.layers(
          { "מפה בהירה": streetTiles, "תצלום אוויר": aerialTiles },
          undefined,
          { position: "topright" },
        ).addTo(map);
      }

      const showMap = () => {
        if (!cancelled) setMapReady(true);
      };
      activeTiles.once("load", showMap);
      readyTimer = window.setTimeout(showMap, 2200);

      const bounds = L.latLngBounds([]);
      listings.forEach((listing) => {
        const marker = L.marker([listing.lat, listing.lng], {
          icon: L.divIcon({
            className: "vii-map-marker-wrap",
            html: `<span class="vii-map-marker"><b>${single ? "•" : listing.guests}</b></span>`,
            iconSize: [46, 52],
            iconAnchor: [23, 48],
          }),
        }).addTo(map);
        marker.bindTooltip(listing.name, {
          direction: "top",
          offset: [0, -38],
          className: "vii-map-tooltip",
        });
        marker.on("click", () => setSelectedSlug(listing.slug));
        bounds.extend([listing.lat, listing.lng]);
      });

      if (listings.length === 1) map.setView([listings[0].lat, listings[0].lng], 13);
      else map.fitBounds(bounds.pad(0.16), { maxZoom: 11 });

      mapInstance.current = map;
      window.setTimeout(() => map.invalidateSize(), 50);
    });

    return () => {
      cancelled = true;
      if (readyTimer) window.clearTimeout(readyTimer);
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, [enabled, listings, single]);

  if (!preview) return null;

  const previewContent = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="map-preview-image" src={preview.image} alt={`מבט על ${preview.name}`} />
      <span className="map-preview-shade" aria-hidden="true" />
      <div className="map-preview-content">
        <span className="map-preview-label">מפה אינטראקטיבית</span>
        <span className="map-consent-pin" aria-hidden="true">⌖</span>
        <div>
          <h3>{single ? preview.name : `${listings.length} מקומות על המפה`}</h3>
          <p>{single ? `${preview.location}, ${preview.area}` : "רואים את כל המקומות, משווים מיקומים ובוחרים בקלות"}</p>
        </div>
        {!enabled && (
          <button className="button map-load-button" type="button" onClick={() => setEnabled(true)}>
            <span aria-hidden="true">⌖</span>
            פתיחת המפה
          </button>
        )}
        {enabled && !mapReady && <span className="map-loading-pill">המפה נטענת...</span>}
      </div>
    </>
  );

  if (!enabled) {
    return <div className={`map-preview-card ${single ? "single-map-preview" : ""}`}>{previewContent}</div>;
  }

  return (
    <div className={`listing-map-shell ${single ? "single-map" : ""}`}>
      <div ref={mapElement} className={`listing-map ${mapReady || autoLoad ? "is-ready" : ""}`} aria-label="מפה אינטראקטיבית של המקומות" />
      {!mapReady && (autoLoad
        ? <span className="map-live-loading" role="status">טוענים את המפה ואת הסמנים...</span>
        : <div className="map-preview-card map-loading-preview">{previewContent}</div>)}
      {mapReady && !single && selected && (
        <article className="map-selection-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selected.image} alt={selected.name} />
          <div>
            <small>{selected.type}</small>
            <strong>{selected.name}</strong>
            <span>{selected.location} · עד {selected.guests} אורחים</span>
            <ListingAccessibility slug={selected.slug} compact />
            <Link href={mode === "events" ? `/events/place/?id=${selected.slug}` : `/business/?id=${selected.slug}`}>לפרטי המקום</Link>
          </div>
        </article>
      )}
    </div>
  );
}
