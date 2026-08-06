"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { eventPlaceHref, type EventPlace, type Listing } from "../data/site-data";
import type { DiscoveryItem } from "../data/world-data";
import { useSiteLanguage } from "../i18n/locale-provider";
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
  onClose?: () => void;
};

function safeMarkerLabel(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

function PlacesMap({ places, tone = "vacation", single = false, autoLoad = false, onClose }: PlacesMapProps) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<import("leaflet").Map | null>(null);
  const markerInstances = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const resultElements = useRef<Map<string, HTMLElement>>(new Map());
  const selectedIdRef = useRef(places[0]?.id ?? "");
  const [enabled, setEnabled] = useState(autoLoad);
  const [mapReady, setMapReady] = useState(false);
  const [selectedId, setSelectedId] = useState(places[0]?.id ?? "");
  const preview = places[0] ?? null;
  const effectiveSelectedId = selectedId === "" ? "" : places.some((place) => place.id === selectedId) ? selectedId : places[0]?.id ?? "";
  const selected = places.find((place) => place.id === effectiveSelectedId) ?? null;

  const selectPlace = useCallback((id: string, source: "map" | "list") => {
    const place = places.find((entry) => entry.id === id);
    if (!place) return;
    setSelectedId(id);
    if (source === "list" && mapInstance.current) {
      const currentZoom = mapInstance.current.getZoom();
      mapInstance.current.flyTo([place.lat, place.lng], Math.max(currentZoom, 10), { duration: 0.65 });
    }
    if (source === "map") {
      window.requestAnimationFrame(() => resultElements.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    }
  }, [places]);

  useEffect(() => {
    selectedIdRef.current = effectiveSelectedId;
    markerInstances.current.forEach((marker, id) => {
      marker.getElement()?.classList.toggle("is-active", id === effectiveSelectedId);
    });
  }, [effectiveSelectedId, mapReady]);

  useEffect(() => {
    if (!enabled || !mapElement.current || places.length === 0) return;
    const container = mapElement.current;
    const markerRegistry = markerInstances.current;
    let cancelled = false;
    let readyTimer: number | undefined;
    const keepWheelInsideMap = (event: WheelEvent) => event.preventDefault();
    setMapReady(false);

    void import("leaflet").then((L) => {
      if (cancelled) return;
      mapInstance.current?.remove();
      markerRegistry.clear();

      const map = L.map(container, {
        scrollWheelZoom: true,
        wheelDebounceTime: 30,
        wheelPxPerZoomLevel: 52,
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
            className: `vii-map-marker-wrap map-tone--${tone}${place.id === selectedIdRef.current ? " is-active" : ""}`,
            html: `<span class="vii-map-marker"><b>${single ? "•" : safeMarkerLabel(place.markerLabel)}</b></span>`,
            iconSize: single ? [50, 54] : [112, 54],
            iconAnchor: single ? [25, 51] : [56, 51],
          }),
        }).addTo(map);
        marker.bindTooltip(place.name, {
          direction: "top",
          offset: [0, -42],
          className: "vii-map-tooltip",
        });
        marker.on("click", () => selectPlace(place.id, "map"));
        const markerElement = marker.getElement();
        markerElement?.addEventListener("click", (event) => {
          event.stopPropagation();
          selectPlace(place.id, "map");
        });
        markerElement?.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectPlace(place.id, "map");
          }
        });
        markerRegistry.set(place.id, marker);
        bounds.extend([place.lat, place.lng]);
      });

      if (places.length === 1) map.setView([places[0].lat, places[0].lng], places[0].precision === "area" ? 12 : 14);
      else map.fitBounds(bounds.pad(0.17), { maxZoom: 11, padding: [44, 44] });

      mapInstance.current = map;
      window.setTimeout(() => map.invalidateSize(), 80);
    });

    return () => {
      cancelled = true;
      if (readyTimer) window.clearTimeout(readyTimer);
      container.removeEventListener("wheel", keepWheelInsideMap);
      markerRegistry.clear();
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, [enabled, places, selectPlace, single, tone]);

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
          <p>{single ? `${preview.location}, ${preview.area}` : "רואים את התוצאות ואת המפה יחד, ובוחרים מקום בלי לאבד את החיפוש"}</p>
        </div>
        {!enabled && <button className="button map-load-button" type="button" onClick={() => setEnabled(true)}><span aria-hidden="true">⌖</span>פתיחת המפה</button>}
        {enabled && !mapReady && <span className="map-loading-pill">המפה נטענת...</span>}
        {single && regional && <small className="map-precision-note">מוצג אזור המקום. נקודת ההגעה המדויקת נמסרת לאחר אישור.</small>}
      </div>
    </>
  );

  if (!enabled) return <div className={`map-preview-card map-tone--${tone} ${single ? "single-map-preview" : ""}`}>{previewContent}</div>;

  const mapCanvas = <div className={`listing-map-shell map-tone--${tone} ${single ? "single-map" : ""}`}>
    <div ref={mapElement} className={`listing-map ${mapReady || autoLoad ? "is-ready" : ""}`} aria-label="מפה אינטראקטיבית של המקומות" />
    {onClose && !single && <button className="map-mobile-close" type="button" onClick={onClose} aria-label="חזרה לתצוגת רשימה"><span aria-hidden="true">×</span>חזרה לרשימה</button>}
    {mapReady && <span className="map-zoom-hint">גלגלת העכבר מגדילה ומקטינה את המפה</span>}
    {!mapReady && (autoLoad ? <span className="map-live-loading" role="status">טוענים את המפה ואת הסמנים...</span> : <div className="map-preview-card map-loading-preview">{previewContent}</div>)}
    {mapReady && !single && selected && <article className="map-selection-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={selected.image} alt={selected.name} />
      <div><small>{selected.category}</small><strong>{selected.name}</strong><span>{selected.location} · {selected.meta}</span><Link href={selected.href}>לפרטי המקום</Link></div>
      <button type="button" onClick={() => setSelectedId("")} aria-label="סגירת פרטי המקום">×</button>
    </article>}
  </div>;

  if (single) return mapCanvas;

  return <div className={`map-results-experience map-tone--${tone}`}>
    <aside className="map-results-rail" aria-label="המקומות שמוצגים על המפה">
      <header>
        <div><span>תוצאות על המפה</span><strong>{places.length} מקומות</strong></div>
        {onClose && <button type="button" onClick={onClose}>חזרה לרשימה</button>}
      </header>
      <div className="map-results-scroll">
        {places.map((place) => <article
          key={place.id}
          ref={(element) => {
            if (element) resultElements.current.set(place.id, element);
            else resultElements.current.delete(place.id);
          }}
          className={`map-result-card ${effectiveSelectedId === place.id ? "is-selected" : ""}`}
        >
          <button type="button" className="map-result-select" onClick={() => selectPlace(place.id, "list")} aria-pressed={effectiveSelectedId === place.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={place.image} alt="" />
            <span><small>{place.category}</small><strong>{place.name}</strong><span>{place.location}, {place.area}</span><b>{place.meta}</b></span>
          </button>
          <Link href={place.href}>לפרטים וזמינות</Link>
        </article>)}
      </div>
    </aside>
    <div className="map-results-canvas">{mapCanvas}</div>
  </div>;
}

export function ListingMap({ listings, mode = "vacation", single = false, autoLoad = false, onClose }: { listings: Listing[]; mode?: "vacation" | "events"; single?: boolean; autoLoad?: boolean; onClose?: () => void }) {
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
    markerLabel: `עד ${listing.guests}`,
    precision: "exact",
  })), [listings, mode]);
  return <PlacesMap places={places} tone={mode} single={single} autoLoad={autoLoad} onClose={onClose} />;
}

export function DiscoveryMap({ items, tone, single = false, autoLoad = false, onClose }: { items: DiscoveryItem[]; tone: "spa" | "hourly"; single?: boolean; autoLoad?: boolean; onClose?: () => void }) {
  const { language } = useSiteLanguage();
  const localized = language === "en"
    ? { spa: "Spa and treatments", hourly: "Hourly stay", packages: "Packages and treatments", short: "Short stay", from: "From" }
    : language === "ru"
      ? { spa: "Спа и процедуры", hourly: "Почасовое размещение", packages: "Пакеты и процедуры", short: "Короткое пребывание", from: "От" }
      : language === "fr"
        ? { spa: "Spa et soins", hourly: "Séjour à l'heure", packages: "Forfaits et soins", short: "Court séjour", from: "À partir de" }
        : null;
  const places = useMemo<MapPlace[]>(() => items.filter((item) => typeof item.lat === "number" && typeof item.lng === "number").map((item) => {
    const price = item.priceLabel?.match(/[\d,.]+/)?.[0];
    return {
      id: item.id,
      name: item.name,
      location: item.location,
      area: item.area,
      category: localized ? (tone === "spa" ? localized.spa : localized.hourly) : tone === "spa" ? "ספא וטיפולים" : "שהייה לפי שעה",
      meta: localized ? (price ? `${localized.from} ₪${price}` : tone === "spa" ? localized.packages : localized.short) : item.priceLabel || (tone === "spa" ? "חבילות וטיפולים" : "שהייה קצרה"),
      image: item.image || "/vii-logo.png",
      lat: item.lat!,
      lng: item.lng!,
      href: `/discover/place?world=${item.world}&id=${item.id}`,
      markerLabel: price ? `${price} ₪` : tone === "spa" ? "ספא" : "לפי שעה",
      precision: item.mapPrecision || "area",
    };
  }), [items, tone, localized]);
  return <PlacesMap places={places} tone={tone} single={single} autoLoad={autoLoad} onClose={onClose} />;
}
