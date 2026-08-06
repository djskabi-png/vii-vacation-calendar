"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { eventPlaceHref, type EventPlace, type Listing } from "../data/site-data";
import type { DiscoveryItem } from "../data/world-data";
import "leaflet/dist/leaflet.css";

type MapTone = "vacation" | "events" | "spa" | "hourly";

type MapPlace = {
  id: string;
  name: string;
  location: string;
  area: string;
  category: string;
  meta: string;
  image: string;
  lat: number;
  lng: number;
  href: string;
  markerLabel: string;
  precision?: "exact" | "area";
};

type PlacesMapProps = {
  places: MapPlace[];
  tone?: MapTone;
  single?: boolean;
  autoLoad?: boolean;
};

function PlacesMap({ places, tone = "vacation", single = false, autoLoad = false }: PlacesMapProps) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<import("leaflet").Map | null>(null);
  const [enabled, setEnabled] = useState(autoLoad);
  const [mapReady, setMapReady] = useState(false);
  const [selectedId, setSelectedId] = useState(places[0]?.id ?? "");
  const preview = places[0] ?? null;
  const selected = places.find((place) => place.id === selectedId) ?? preview;

  useEffect(() => {
    if (!enabled || !mapElement.current || places.length === 0) return;
    const container = mapElement.current;
    let cancelled = false;
    let readyTimer: number | undefined;
    const keepWheelInsideMap = (event: WheelEvent) => event.preventDefault();
    setMapReady(false);

    void import("leaflet").then((L) => {
      if (cancelled) return;
      mapInstance.current?.remove();

      const map = L.map(container, {
        scrollWheelZoom: true,
        wheelDebounceTime: 35,
        wheelPxPerZoomLevel: 55,
        touchZoom: true,
        doubleClickZoom: true,
        zoomControl: true,
        attributionControl: true,
      });
      container.addEventListener("wheel", keepWheelInsideMap, { passive: false });
      const streetTiles = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: 20,
          subdomains: "abcd",
        },
      );
      const aerialTiles = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Tiles &copy; Esri", maxZoom: 19 },
      );
      streetTiles.addTo(map);
      L.control.layers(
        { "מפה בהירה": streetTiles, "תצלום אוויר": aerialTiles },
        undefined,
        { position: "topright" },
      ).addTo(map);

      const showMap = () => {
        if (!cancelled) setMapReady(true);
      };
      streetTiles.once("load", showMap);
      readyTimer = window.setTimeout(showMap, 2200);

      const bounds = L.latLngBounds([]);
      places.forEach((place) => {
        const marker = L.marker([place.lat, place.lng], {
          keyboard: true,
          title: place.name,
          alt: place.name,
          icon: L.divIcon({
            className: `vii-map-marker-wrap map-tone--${tone}`,
            html: `<span class="vii-map-marker"><b>${single ? "•" : place.markerLabel}</b></span>`,
            iconSize: [48, 54],
            iconAnchor: [24, 49],
          }),
        }).addTo(map);
        marker.bindTooltip(place.name, {
          direction: "top",
          offset: [0, -40],
          className: "vii-map-tooltip",
        });
        marker.on("click", () => setSelectedId(place.id));
        bounds.extend([place.lat, place.lng]);
      });

      if (places.length === 1) map.setView([places[0].lat, places[0].lng], places[0].precision === "area" ? 12 : 14);
      else map.fitBounds(bounds.pad(0.19), { maxZoom: 11 });

      mapInstance.current = map;
      window.setTimeout(() => map.invalidateSize(), 60);
    });

    return () => {
      cancelled = true;
      if (readyTimer) window.clearTimeout(readyTimer);
      container.removeEventListener("wheel", keepWheelInsideMap);
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, [enabled, places, single, tone]);

  if (!preview) return null;

  const regional = preview.precision === "area";
  const previewContent = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="map-preview-image" src={preview.image} alt={`מבט על ${preview.name}`} />
      <span className="map-preview-shade" aria-hidden="true" />
      <div className="map-preview-content">
        <span className="map-preview-label">מפה אינטראקטיבית</span>
        <span className="map-consent-pin" aria-hidden="true">⌖</span>
        <div>
          <h3>{single ? preview.name : `${places.length} מקומות על המפה`}</h3>
          <p>{single ? `${preview.location}, ${preview.area}` : "רואים את כל המקומות, משווים אזורים ובוחרים בקלות"}</p>
        </div>
        {!enabled && <button className="button map-load-button" type="button" onClick={() => setEnabled(true)}><span aria-hidden="true">⌖</span>פתיחת המפה</button>}
        {enabled && !mapReady && <span className="map-loading-pill">המפה נטענת...</span>}
        {single && regional && <small className="map-precision-note">מוצג אזור המקום. נקודת ההגעה המדויקת נמסרת לאחר אישור.</small>}
      </div>
    </>
  );

  if (!enabled) return <div className={`map-preview-card map-tone--${tone} ${single ? "single-map-preview" : ""}`}>{previewContent}</div>;

  return <div className={`listing-map-shell map-tone--${tone} ${single ? "single-map" : ""}`}>
    <div ref={mapElement} className={`listing-map ${mapReady || autoLoad ? "is-ready" : ""}`} aria-label="מפה אינטראקטיבית של המקומות" />
    {mapReady && <span className="map-zoom-hint">גלגלת להגדלה ולהקטנה</span>}
    {!mapReady && (autoLoad ? <span className="map-live-loading" role="status">טוענים את המפה ואת הסמנים...</span> : <div className="map-preview-card map-loading-preview">{previewContent}</div>)}
    {mapReady && !single && selected && <article className="map-selection-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={selected.image} alt={selected.name} />
      <div><small>{selected.category}</small><strong>{selected.name}</strong><span>{selected.location} · {selected.meta}</span><Link href={selected.href}>לפרטי המקום</Link></div>
    </article>}
  </div>;
}

export function ListingMap({ listings, mode = "vacation", single = false, autoLoad = false }: { listings: Listing[]; mode?: "vacation" | "events"; single?: boolean; autoLoad?: boolean }) {
  const places = useMemo<MapPlace[]>(() => listings.map((listing) => ({
    id: listing.slug,
    name: listing.name,
    location: listing.location,
    area: listing.area,
    category: listing.type,
    meta: `עד ${listing.guests} אורחים`,
    image: listing.image,
    lat: listing.lat,
    lng: listing.lng,
    href: mode === "events" ? eventPlaceHref(listing as EventPlace) : `/business?id=${listing.slug}`,
    markerLabel: String(listing.guests),
    precision: "exact",
  })), [listings, mode]);
  return <PlacesMap places={places} tone={mode} single={single} autoLoad={autoLoad} />;
}

export function DiscoveryMap({ items, tone, single = false, autoLoad = false }: { items: DiscoveryItem[]; tone: "spa" | "hourly"; single?: boolean; autoLoad?: boolean }) {
  const places = useMemo<MapPlace[]>(() => items.filter((item) => typeof item.lat === "number" && typeof item.lng === "number").map((item) => ({
    id: item.id,
    name: item.name,
    location: item.location,
    area: item.area,
    category: tone === "spa" ? "ספא וטיפולים" : "שהייה לפי שעה",
    meta: item.priceLabel || (tone === "spa" ? "חבילות וטיפולים" : "שהייה קצרה"),
    image: item.image || "/vii-logo.png",
    lat: item.lat!,
    lng: item.lng!,
    href: `/discover/place?world=${item.world}&id=${item.id}`,
    markerLabel: tone === "spa" ? "S" : "H",
    precision: item.mapPrecision || "area",
  })), [items, tone]);
  return <PlacesMap places={places} tone={tone} single={single} autoLoad={autoLoad} />;
}
