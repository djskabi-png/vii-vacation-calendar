"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { eventPlaceHref, type EventPlace, type Listing } from "../data/site-data";
import type { DiscoveryItem } from "../data/world-data";
import { useSiteLanguage } from "../i18n/locale-provider";
import "leaflet/dist/leaflet.css";

type MapTone = "vacation" | "events" | "spa" | "hourly" | "activities";

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
  initialPlaceIds?: string[];
  tone?: MapTone;
  single?: boolean;
  autoLoad?: boolean;
  onClose?: () => void;
  onVisibleCountChange?: (count: number) => void;
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

function markerIcon(tone: MapTone) {
  const common = 'viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
  if (tone === "events") return `<svg ${common}><path d="M6 3v3M18 3v3M4 8h16M5 5h14a2 2 0 0 1 2 2v12H3V7a2 2 0 0 1 2-2Z"/></svg>`;
  if (tone === "spa") return `<svg ${common}><path d="M12 3c.7 3.2 2.5 5 5.7 5.7-3.2.7-5 2.5-5.7 5.7-.7-3.2-2.5-5-5.7-5.7C9.5 8 11.3 6.2 12 3ZM18.5 14.5c.4 1.8 1.4 2.8 3.2 3.2-1.8.4-2.8 1.4-3.2 3.2-.4-1.8-1.4-2.8-3.2-3.2 1.8-.4 2.8-1.4 3.2-3.2Z"/></svg>`;
  if (tone === "hourly") return `<svg ${common}><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3.3 2"/></svg>`;
  if (tone === "activities") return `<svg ${common}><path d="M4 7.5A2.5 2.5 0 0 0 6.5 10 2.5 2.5 0 0 0 4 12.5V17h16v-4.5A2.5 2.5 0 0 0 17.5 10 2.5 2.5 0 0 0 20 7.5V7H4v.5Z"/><path d="M9 7v10M15 7v10"/></svg>`;
  return `<svg ${common}><path d="m4 11 8-7 8 7v9h-6v-6h-4v6H4v-9Z"/></svg>`;
}

function PlacesMap({ places, initialPlaceIds, tone = "vacation", single = false, autoLoad = false, onClose, onVisibleCountChange }: PlacesMapProps) {
  const { language } = useSiteLanguage();
  const cardCopy = language === "en"
    ? { details: "View details", close: "Close place details", results: "Results on the map", visible: "places", list: "Result list" }
    : language === "ru"
      ? { details: "Подробнее", close: "Закрыть карточку места", results: "Результаты на карте", visible: "мест", list: "Список результатов" }
      : language === "fr"
        ? { details: "Voir les détails", close: "Fermer la fiche du lieu", results: "Résultats sur la carte", visible: "lieux", list: "Liste des résultats" }
      : { details: "לכל הפרטים", close: "סגירת פרטי המקום", results: "תוצאות על המפה", visible: "מקומות", list: "רשימת תוצאות במפה" };
  const mapElement = useRef<HTMLDivElement>(null);
  const resultRail = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<import("leaflet").Map | null>(null);
  const markerInstances = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const visibleCountCallback = useRef(onVisibleCountChange);
  const initialSelectedId = initialPlaceIds?.find((id) => places.some((place) => place.id === id)) ?? places[0]?.id ?? "";
  const selectedIdRef = useRef(initialSelectedId);
  const [enabled, setEnabled] = useState(autoLoad);
  const [mapReady, setMapReady] = useState(false);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const preview = places[0] ?? null;
  const effectiveSelectedId = selectedId === "" ? "" : places.some((place) => place.id === selectedId) ? selectedId : places[0]?.id ?? "";
  const selected = places.find((place) => place.id === effectiveSelectedId) ?? null;
  const focusKey = initialPlaceIds?.join("|") ?? "";

  useEffect(() => {
    visibleCountCallback.current = onVisibleCountChange;
  }, [onVisibleCountChange]);

  const selectPlace = useCallback((id: string) => {
    const place = places.find((entry) => entry.id === id);
    if (!place) return;
    setSelectedId(id);
    const map = mapInstance.current;
    if (map) map.flyTo([place.lat, place.lng], Math.max(map.getZoom(), place.precision === "area" ? 11 : 13), { duration: 0.45 });
  }, [places]);

  useEffect(() => {
    selectedIdRef.current = effectiveSelectedId;
    markerInstances.current.forEach((marker, id) => {
      marker.getElement()?.classList.toggle("is-active", id === effectiveSelectedId);
    });
  }, [effectiveSelectedId, mapReady]);

  useEffect(() => {
    if (single || !effectiveSelectedId) return;
    resultRail.current?.querySelector<HTMLElement>(`[data-map-result-id="${CSS.escape(effectiveSelectedId)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [effectiveSelectedId, single]);

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
      const streetTiles = language === "he"
        ? L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
          })
        : L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 20,
            subdomains: "abcd",
          });
      const aerialTiles = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Tiles &copy; Esri", maxZoom: 19 },
      );
      streetTiles.addTo(map);
      const layerNames = language === "he"
        ? { street: "מפה בעברית", aerial: "תצלום אוויר" }
        : language === "ru"
          ? { street: "Карта", aerial: "Спутник" }
          : language === "fr"
            ? { street: "Plan", aerial: "Satellite" }
            : { street: "Map", aerial: "Satellite" };
      L.control.layers(
        { [layerNames.street]: streetTiles, [layerNames.aerial]: aerialTiles },
        undefined,
        { position: "topright" },
      ).addTo(map);

      const showMap = () => {
        if (!cancelled) setMapReady(true);
      };
      streetTiles.once("load", showMap);
      readyTimer = window.setTimeout(showMap, 2200);

      const markerLayer = L.layerGroup().addTo(map);
      const renderMarkers = () => {
        markerLayer.clearLayers();
        markerRegistry.clear();
        const threshold = map.getZoom() < 8 ? 92 : map.getZoom() < 11 ? 70 : 52;
        const clusters: Array<{ entries: MapPlace[]; point: import("leaflet").Point }> = [];

        places.forEach((place) => {
          const point = map.latLngToContainerPoint([place.lat, place.lng]);
          const cluster = single ? undefined : clusters.find((entry) => entry.point.distanceTo(point) < threshold);
          if (cluster) {
            cluster.entries.push(place);
            const count = cluster.entries.length;
            cluster.point = L.point(
              (cluster.point.x * (count - 1) + point.x) / count,
              (cluster.point.y * (count - 1) + point.y) / count,
            );
          } else {
            clusters.push({ entries: [place], point });
          }
        });

        clusters.forEach((cluster) => {
          const clusterCenter = L.latLng(
            cluster.entries.reduce((sum, place) => sum + place.lat, 0) / cluster.entries.length,
            cluster.entries.reduce((sum, place) => sum + place.lng, 0) / cluster.entries.length,
          );
          const place = cluster.entries[0];
          const clustered = cluster.entries.length > 1;
          const clusterText = language === "he" ? `${cluster.entries.length} מקומות` : `${cluster.entries.length}`;
          const visibleLabel = clustered ? String(cluster.entries.length) : place.markerLabel;
          // Clusters communicate result count. Numeric labels keep useful values,
          // such as price or capacity, visible without opening a result card.
          const useTextLabel = clustered || /\d/.test(place.markerLabel);
          const markerContent = useTextLabel
            ? `<span class="vii-map-marker__label">${safeMarkerLabel(visibleLabel)}</span>`
            : `<span class="vii-map-marker__icon">${markerIcon(tone)}</span>`;
          const marker = L.marker(clusterCenter, {
            keyboard: true,
            title: clustered ? clusterText : place.name,
            alt: clustered ? clusterText : place.name,
            icon: L.divIcon({
              className: `vii-map-marker-wrap map-tone--${tone}${clustered ? " is-cluster" : ""}${useTextLabel ? " is-text" : " is-icon"}${!clustered && place.id === selectedIdRef.current ? " is-active" : ""}`,
              html: `<span class="vii-map-marker">${markerContent}</span>`,
              iconSize: clustered ? [72, 58] : useTextLabel ? [112, 54] : [54, 58],
              iconAnchor: clustered ? [36, 54] : useTextLabel ? [56, 51] : [27, 54],
            }),
          }).addTo(markerLayer);

          if (clustered) {
            marker.on("click", () => {
              const clusterBounds = L.latLngBounds(cluster.entries.map((entry) => [entry.lat, entry.lng] as [number, number]));
              if (clusterBounds.getNorthEast().distanceTo(clusterBounds.getSouthWest()) < 80) map.flyTo(clusterCenter, Math.min(map.getZoom() + 2, 16), { duration: 0.4 });
              else map.fitBounds(clusterBounds.pad(0.65), { maxZoom: Math.min(map.getZoom() + 3, 15), padding: [70, 70] });
            });
          } else {
            marker.on("click", () => selectPlace(place.id));
            marker.on("mouseover", () => setSelectedId(place.id));
            marker.on("focus", () => setSelectedId(place.id));
            markerRegistry.set(place.id, marker);
          }
        });
      };

      const reportVisiblePlaces = () => {
        const currentBounds = map.getBounds().pad(0.04);
        visibleCountCallback.current?.(places.filter((place) => currentBounds.contains([place.lat, place.lng])).length);
      };

      const focusPlaces = initialPlaceIds?.length
        ? places.filter((place) => initialPlaceIds.includes(place.id))
        : places;
      const targetPlaces = focusPlaces.length ? focusPlaces : places;
      const bounds = L.latLngBounds(targetPlaces.map((place) => [place.lat, place.lng] as [number, number]));
      const compactViewport = container.clientWidth <= 640;
      const boundsPadding: [number, number] = compactViewport ? [22, 22] : [56, 56];
      const boundsExpansion = compactViewport ? 0.04 : 0.12;
      if (targetPlaces.length === 1) map.setView([targetPlaces[0].lat, targetPlaces[0].lng], targetPlaces[0].precision === "area" ? 13 : 15);
      else {
        map.fitBounds(bounds.pad(boundsExpansion), { maxZoom: 13, padding: boundsPadding });
        // A tall mobile viewport can otherwise zoom out far beyond Israel just
        // to preserve generous horizontal padding. Keep the national overview
        // useful while retaining every relevant result inside the viewport.
        if (compactViewport && map.getZoom() < 7) map.setZoom(7, { animate: false });
      }

      map.on("zoomend moveend", () => {
        renderMarkers();
        reportVisiblePlaces();
      });
      renderMarkers();
      reportVisiblePlaces();

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
  }, [enabled, places, selectPlace, single, tone, language, focusKey, initialPlaceIds]);

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
    <div ref={mapElement} className={`listing-map ${mapReady ? "is-ready" : ""}`} aria-label="מפה אינטראקטיבית של המקומות" />
    {onClose && !single && <button className="map-mobile-close" type="button" onClick={onClose} aria-label="חזרה לתצוגת רשימה"><span aria-hidden="true">×</span>חזרה לרשימה</button>}
    {mapReady && <span className="map-zoom-hint">גלגלת העכבר מגדילה ומקטינה את המפה</span>}
    {!mapReady && (autoLoad ? <span className="map-live-loading" role="status">טוענים את המפה ואת הסמנים...</span> : <div className="map-preview-card map-loading-preview">{previewContent}</div>)}
    {mapReady && !single && selected && <article className="map-selection-card" aria-live="polite">
      <div className="map-selection-card__media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={selected.image} alt={selected.name} />
        <small>{selected.category}</small>
      </div>
      <div className="map-selection-card__body">
        <span className="map-selection-card__location">{selected.location}</span>
        <strong>{selected.name}</strong>
        <span className="map-selection-card__meta">{selected.meta}</span>
        <Link href={selected.href}>{cardCopy.details}</Link>
      </div>
      <button className="map-selection-card__close" type="button" onClick={() => setSelectedId("")} aria-label={cardCopy.close}>×</button>
    </article>}
  </div>;

  if (single) return mapCanvas;

  return <div className={`map-results-experience map-tone--${tone}`}>
    <aside className="map-results-rail" aria-label={cardCopy.list}>
      <header><div><span>{cardCopy.results}</span><strong>{places.length} {cardCopy.visible}</strong></div></header>
      <div ref={resultRail} className="map-results-scroll">
        {places.map((place) => <article key={place.id} data-map-result-id={place.id} className={`map-result-card ${place.id === effectiveSelectedId ? "is-selected" : ""}`}>
          <button type="button" className="map-result-select" aria-pressed={place.id === effectiveSelectedId} onClick={() => selectPlace(place.id)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={place.image} alt="" />
            <span><small>{place.category}</small><strong>{place.name}</strong><span>{place.location}</span><b>{place.meta}</b></span>
          </button>
          <Link href={place.href}>{cardCopy.details}</Link>
        </article>)}
      </div>
    </aside>
    <div className="map-results-canvas">{mapCanvas}</div>
  </div>;
}

export function ListingMap({ listings, initialListings, mode = "vacation", single = false, autoLoad = false, onClose, onVisibleCountChange }: { listings: Listing[]; initialListings?: Listing[]; mode?: "vacation" | "events"; single?: boolean; autoLoad?: boolean; onClose?: () => void; onVisibleCountChange?: (count: number) => void }) {
  const places = useMemo<MapPlace[]>(() => listings.map((listing) => ({
    id: listing.slug,
    name: listing.name,
    location: listing.location,
    area: listing.area,
    category: listing.type,
    meta: [
      listing.bedrooms ? `${listing.bedrooms} חדרי שינה` : null,
      listing.units && listing.units > 1 ? `${listing.units} יחידות` : null,
      `עד ${listing.guests} אורחים`,
    ].filter(Boolean).join(" · "),
    image: listing.image,
    lat: listing.lat,
    lng: listing.lng,
    href: mode === "events" ? eventPlaceHref(listing as EventPlace) : `/business?id=${listing.slug}`,
    markerLabel: mode === "events"
      ? `${listing.guests} אורחים`
      : listing.bedrooms
        ? `${listing.bedrooms} חדרים`
        : listing.units && listing.units > 1
          ? `${listing.units} יחידות`
          : listing.type,
    precision: "exact",
  })), [listings, mode]);
  const initialPlaceIds = useMemo(() => initialListings?.map((listing) => listing.slug), [initialListings]);
  return <PlacesMap key={initialPlaceIds?.join("|") || "all"} places={places} initialPlaceIds={initialPlaceIds} tone={mode} single={single} autoLoad={autoLoad} onClose={onClose} onVisibleCountChange={onVisibleCountChange} />;
}

export function DiscoveryMap({ items, initialItems, tone, single = false, autoLoad = false, onClose, onVisibleCountChange }: { items: DiscoveryItem[]; initialItems?: DiscoveryItem[]; tone: "spa" | "hourly" | "activities"; single?: boolean; autoLoad?: boolean; onClose?: () => void; onVisibleCountChange?: (count: number) => void }) {
  const { language } = useSiteLanguage();
  const localized = useMemo(() => language === "en"
    ? { spa: "Spa and treatments", hourly: "Hourly stay", packages: "Packages and treatments", short: "Short stay", from: "From" }
    : language === "ru"
      ? { spa: "Спа и процедуры", hourly: "Почасовое размещение", packages: "Пакеты и процедуры", short: "Короткое пребывание", from: "От" }
      : language === "fr"
        ? { spa: "Spa et soins", hourly: "Séjour à l'heure", packages: "Forfaits et soins", short: "Court séjour", from: "À partir de" }
        : null, [language]);
  const places = useMemo<MapPlace[]>(() => items.filter((item) => typeof item.lat === "number" && typeof item.lng === "number").map((item) => {
    const price = item.priceLabel?.match(/[\d,.]+/)?.[0];
    return {
      id: item.id,
      name: item.name,
      location: item.location,
      area: item.area,
      category: tone === "activities" ? item.area : localized ? (tone === "spa" ? localized.spa : localized.hourly) : tone === "spa" ? "ספא וטיפולים" : "שהייה לפי שעה",
      meta: localized ? (price ? `${localized.from} ₪${price}` : tone === "spa" ? localized.packages : tone === "activities" ? item.priceLabel || item.location : localized.short) : item.priceLabel || (tone === "spa" ? "חבילות וטיפולים" : tone === "activities" ? "חוויה בתשלום" : "שהייה קצרה"),
      image: item.image || "/vii-logo.png",
      lat: item.lat!,
      lng: item.lng!,
      href: `/discover/place/${item.id}`,
      markerLabel: price ? `${price} ₪` : tone === "spa" ? "ספא" : tone === "activities" ? "אטרקציה" : "לפי שעה",
      precision: item.mapPrecision || "area",
    };
  }), [items, tone, localized]);
  const initialPlaceIds = useMemo(() => initialItems?.map((item) => item.id), [initialItems]);
  return <PlacesMap key={initialPlaceIds?.join("|") || "all"} places={places} initialPlaceIds={initialPlaceIds} tone={tone} single={single} autoLoad={autoLoad} onClose={onClose} onVisibleCountChange={onVisibleCountChange} />;
}
