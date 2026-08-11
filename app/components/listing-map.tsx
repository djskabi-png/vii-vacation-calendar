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
  onVisiblePlaceIdsChange?: (ids: string[]) => void;
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

function PlacesMap({ places, initialPlaceIds, tone = "vacation", single = false, autoLoad = false, onClose, onVisibleCountChange, onVisiblePlaceIdsChange }: PlacesMapProps) {
  const { language } = useSiteLanguage();
  const cardCopy = language === "en"
    ? { details: "View details", close: "Close place details", results: "Results on the map", visible: "places", list: "Result list", openCluster: "Open grouped places", searchArea: "Search this area" }
    : language === "ru"
      ? { details: "Подробнее", close: "Закрыть карточку места", results: "Результаты на карте", visible: "мест", list: "Список результатов", openCluster: "Открыть сгруппированные места", searchArea: "Искать в этой области" }
      : language === "fr"
        ? { details: "Voir les détails", close: "Fermer la fiche du lieu", results: "Résultats sur la carte", visible: "lieux", list: "Liste des résultats", openCluster: "Ouvrir les lieux regroupés", searchArea: "Rechercher dans cette zone" }
      : { details: "לכל הפרטים", close: "סגירת פרטי המקום", results: "תוצאות על המפה", visible: "מקומות", list: "רשימת תוצאות במפה", openCluster: "פתיחת המקומות המקובצים", searchArea: "חיפוש באזור הזה" };
  const mapCopy = language === "en"
    ? { preview: "Interactive map", label: "Interactive places map", back: "Back to list", hint: "Use the map controls to zoom in and out", loading: "Loading the map and markers" }
    : language === "ru"
      ? { preview: "Интерактивная карта", label: "Интерактивная карта мест", back: "Вернуться к списку", hint: "Используйте кнопки карты для изменения масштаба", loading: "Загрузка карты и маркеров" }
      : language === "fr"
        ? { preview: "Carte interactive", label: "Carte interactive des lieux", back: "Retour à la liste", hint: "Utilisez les boutons de la carte pour zoomer", loading: "Chargement de la carte et des repères" }
        : { preview: "מפה אינטראקטיבית", label: "מפה אינטראקטיבית של המקומות", back: "חזרה לרשימה", hint: "השתמשו בכפתורי המפה כדי להגדיל ולהקטין", loading: "טוענים את המפה ואת הסמנים" };
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<import("leaflet").Map | null>(null);
  const markerInstances = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const visibleCountCallback = useRef(onVisibleCountChange);
  const visiblePlaceIdsCallback = useRef(onVisiblePlaceIdsChange);
  const suppressViewportPrompt = useRef(false);
  const initialSelectedId = single ? initialPlaceIds?.find((id) => places.some((place) => place.id === id)) ?? places[0]?.id ?? "" : "";
  const selectedIdRef = useRef(initialSelectedId);
  const [enabled, setEnabled] = useState(autoLoad);
  const [mapReady, setMapReady] = useState(false);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [pendingVisibleIds, setPendingVisibleIds] = useState<string[]>([]);
  const [viewportDirty, setViewportDirty] = useState(false);
  const preview = places[0] ?? null;
  const effectiveSelectedId = selectedId !== "" && places.some((place) => place.id === selectedId) ? selectedId : "";
  const selected = places.find((place) => place.id === effectiveSelectedId) ?? null;
  const focusKey = initialPlaceIds?.join("|") ?? "";

  useEffect(() => {
    visibleCountCallback.current = onVisibleCountChange;
    visiblePlaceIdsCallback.current = onVisiblePlaceIdsChange;
  }, [onVisibleCountChange, onVisiblePlaceIdsChange]);

  useEffect(() => {
    if (selectedId && !places.some((place) => place.id === selectedId)) setSelectedId("");
  }, [places, selectedId]);

  const selectPlace = useCallback((id: string) => {
    const place = places.find((entry) => entry.id === id);
    if (!place) return;
    setSelectedId(id);

  }, [places]);

  const closeSelectedPlace = useCallback(() => {
    const marker = markerInstances.current.get(selectedIdRef.current);
    setSelectedId("");
    window.setTimeout(() => marker?.getElement()?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!effectiveSelectedId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSelectedPlace();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeSelectedPlace, effectiveSelectedId]);

  const applyVisibleArea = useCallback(() => {
    visibleCountCallback.current?.(pendingVisibleIds.length);
    visiblePlaceIdsCallback.current?.(pendingVisibleIds);
    setViewportDirty(false);
    setSelectedId("");
  }, [pendingVisibleIds]);

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
    setMapReady(false);

    void import("leaflet").then((L) => {
      if (cancelled) return;
      mapInstance.current?.remove();
      markerRegistry.clear();

      const map = L.map(container, {
        scrollWheelZoom: true,
        touchZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        zoomSnap: 0.5,
        wheelDebounceTime: 40,
        wheelPxPerZoomLevel: 80,
        zoomControl: true,
        attributionControl: true,
        minZoom: 6,
        maxBounds: [[28.65, 33.55], [34.15, 36.45]],
        maxBoundsViscosity: 0.72,
      });
      const streetTiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
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
      const spiderfyCluster = (entries: MapPlace[], center: import("leaflet").LatLng, clearExisting = true) => {
        if (clearExisting) {
          markerLayer.clearLayers();
          markerRegistry.clear();
        }
        const selectionReadyAt = performance.now() + 300;
        const centerPoint = map.latLngToLayerPoint(center);
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));

        entries.forEach((entry, index) => {
          const angle = -Math.PI / 2 + index * goldenAngle;
          const radius = entries.length <= 3
            ? 44 + index * 14
            : 34 + Math.sqrt(index + 1) * 24;
          const spiderPoint = centerPoint.add(L.point(Math.cos(angle) * radius, Math.sin(angle) * radius));
          const spiderPosition = map.layerPointToLatLng(spiderPoint);
          const useTextLabel = /\d/.test(entry.markerLabel);
          const markerContent = useTextLabel
            ? `<span class="vii-map-marker__label">${safeMarkerLabel(entry.markerLabel)}</span>`
            : `<span class="vii-map-marker__icon">${markerIcon(tone)}</span>`;

          L.polyline([center, spiderPosition], {
            color: tone === "spa" ? "#a33a82" : "#087e8b",
            weight: 2,
            opacity: 0.72,
            interactive: false,
          }).addTo(markerLayer);

          const spiderMarker = L.marker(spiderPosition, {
            keyboard: true,
            alt: entry.name,
            zIndexOffset: 900 + index,
            icon: L.divIcon({
              className: `vii-map-marker-wrap map-tone--${tone}${useTextLabel ? " is-text" : " is-icon"}${entry.id === selectedIdRef.current ? " is-active" : ""}`,
              html: `<span class="vii-map-marker">${markerContent}</span>`,
              iconSize: useTextLabel ? [112, 54] : [54, 58],
              iconAnchor: useTextLabel ? [56, 51] : [27, 54],
            }),
          }).addTo(markerLayer);
          spiderMarker.getElement()?.setAttribute("aria-label", entry.name);
          spiderMarker.on("click", () => {
            if (performance.now() < selectionReadyAt) return;
            selectPlace(entry.id);
          });
          markerRegistry.set(entry.id, spiderMarker);
        });
      };

      const renderMarkers = () => {
        markerLayer.clearLayers();
        markerRegistry.clear();
        const zoom = map.getZoom();
        const threshold = zoom < 8 ? 92 : zoom < 10 ? 66 : zoom < 12 ? 44 : 32;
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
          const averageCenter = L.latLng(
            cluster.entries.reduce((sum, place) => sum + place.lat, 0) / cluster.entries.length,
            cluster.entries.reduce((sum, place) => sum + place.lng, 0) / cluster.entries.length,
          );
          const clusterAnchor = cluster.entries.reduce((closest, candidate) => (
            averageCenter.distanceTo([candidate.lat, candidate.lng]) < averageCenter.distanceTo([closest.lat, closest.lng]) ? candidate : closest
          ));
          const clusterCenter = L.latLng(clusterAnchor.lat, clusterAnchor.lng);
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
            alt: clustered ? clusterText : place.name,
            icon: L.divIcon({
              className: `vii-map-marker-wrap map-tone--${tone}${clustered ? " is-cluster" : ""}${useTextLabel ? " is-text" : " is-icon"}${!clustered && place.id === selectedIdRef.current ? " is-active" : ""}`,
              html: `<span class="vii-map-marker">${markerContent}</span>`,
              iconSize: clustered ? [72, 58] : useTextLabel ? [112, 54] : [54, 58],
              iconAnchor: clustered ? [36, 54] : useTextLabel ? [56, 51] : [27, 54],
            }),
          }).addTo(markerLayer);

          if (clustered) {
            marker.getElement()?.setAttribute("aria-label", `${clusterText}, ${cardCopy.openCluster}`);
            marker.on("click", () => {
              setSelectedId("");
              const clusterBounds = L.latLngBounds(cluster.entries.map((entry) => [entry.lat, entry.lng] as [number, number]));
              const clusterDistance = clusterBounds.getNorthEast().distanceTo(clusterBounds.getSouthWest());
              const paddedClusterBounds = clusterBounds.pad(0.65);
              const currentZoom = map.getZoom();
              const targetZoom = Math.min(map.getBoundsZoom(paddedClusterBounds, false, L.point(140, 140)), currentZoom + 3, 17);
              if (currentZoom >= 13) {
                spiderfyCluster(cluster.entries, clusterCenter);
              } else if (clusterDistance < 80 || targetZoom <= currentZoom) {
                map.setView(clusterCenter, Math.min(13, currentZoom + 2), { animate: true });
              } else {
                map.fitBounds(paddedClusterBounds, { maxZoom: targetZoom, padding: [70, 70] });
              }
            });
          } else {
            marker.getElement()?.setAttribute("aria-label", place.name);
            marker.on("click", () => selectPlace(place.id));
            markerRegistry.set(place.id, marker);
          }
        });
      };

      const visiblePlaceIds = () => {
        const currentBounds = map.getBounds().pad(0.04);
        return places.filter((place) => currentBounds.contains([place.lat, place.lng])).map((place) => place.id);
      };
      const reportVisiblePlaces = (prompt = false) => {
        const ids = visiblePlaceIds();
        setPendingVisibleIds(ids);
        if (prompt && !suppressViewportPrompt.current) setViewportDirty(true);
        else visibleCountCallback.current?.(ids.length);
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

      map.on("moveend", () => {
        renderMarkers();
      });
      map.on("zoomend", () => { renderMarkers(); reportVisiblePlaces(true); });
      map.on("dragend", () => reportVisiblePlaces(true));
      renderMarkers();
      reportVisiblePlaces();

      mapInstance.current = map;
      window.setTimeout(() => map.invalidateSize(), 80);
    });

    return () => {
      cancelled = true;
      if (readyTimer) window.clearTimeout(readyTimer);
      markerRegistry.clear();
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, [enabled, places, selectPlace, single, tone, language, focusKey, initialPlaceIds, cardCopy.openCluster]);

  if (!preview) return null;

  const regional = preview.precision === "area";
  const previewContent = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="map-preview-image" src={preview.image} alt={`מבט על ${preview.name}`} />
      <span className="map-preview-shade" aria-hidden="true" />
      <div className="map-preview-content">
        <span className="map-preview-label">{mapCopy.preview}</span>
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
    <div ref={mapElement} className={`listing-map ${mapReady ? "is-ready" : ""}`} aria-label={mapCopy.label} />
    {onClose && !single && <button className="map-mobile-close" type="button" onClick={onClose} aria-label={mapCopy.back}><span aria-hidden="true">×</span>{mapCopy.back}</button>}
    {mapReady && <span className="map-zoom-hint">{mapCopy.hint}</span>}
    {mapReady && !single && viewportDirty && <button className="map-search-area" type="button" onClick={applyVisibleArea}><span>{cardCopy.searchArea}</span><small>{pendingVisibleIds.length} {cardCopy.visible}</small></button>}
    {!mapReady && (autoLoad ? <span className="map-live-loading" role="status">{mapCopy.loading}</span> : <div className="map-preview-card map-loading-preview">{previewContent}</div>)}
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
      <button className="map-selection-card__close" type="button" onClick={closeSelectedPlace} aria-label={cardCopy.close}>×</button>
    </article>}
  </div>;

  if (single) return mapCanvas;

  return <div className={`map-results-experience map-tone--${tone}`}>
    <div className="map-results-canvas">{mapCanvas}</div>
  </div>;
}

export function ListingMap({ listings, initialListings, mode = "vacation", single = false, autoLoad = false, detailQuery, onClose, onVisibleCountChange, onVisiblePlaceIdsChange }: { listings: Listing[]; initialListings?: Listing[]; mode?: "vacation" | "events"; single?: boolean; autoLoad?: boolean; detailQuery?: string; onClose?: () => void; onVisibleCountChange?: (count: number) => void; onVisiblePlaceIdsChange?: (ids: string[]) => void }) {
  const { language } = useSiteLanguage();
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
    href: mode === "events" ? eventPlaceHref(listing as EventPlace) : `/business?id=${listing.slug}${detailQuery ? `&${detailQuery}` : ""}`,
    markerLabel: mode === "events"
      ? `${listing.guests} אורחים`
      : typeof listing.price === "number"
        ? language === "he"
          ? `${listing.price.toLocaleString("he-IL")} ₪`
          : `₪${listing.price.toLocaleString(language === "fr" ? "fr-FR" : language === "ru" ? "ru-RU" : "en-US")}`
        : listing.type,
    precision: "exact",
  })), [detailQuery, language, listings, mode]);
  const initialPlaceIds = useMemo(() => initialListings?.map((listing) => listing.slug), [initialListings]);
  return <PlacesMap key={initialPlaceIds?.join("|") || "all"} places={places} initialPlaceIds={initialPlaceIds} tone={mode} single={single} autoLoad={autoLoad} onClose={onClose} onVisibleCountChange={onVisibleCountChange} onVisiblePlaceIdsChange={onVisiblePlaceIdsChange} />;
}

export function DiscoveryMap({ items, initialItems, tone, single = false, autoLoad = false, onClose, onVisibleCountChange, onVisiblePlaceIdsChange }: { items: DiscoveryItem[]; initialItems?: DiscoveryItem[]; tone: "spa" | "hourly" | "activities"; single?: boolean; autoLoad?: boolean; onClose?: () => void; onVisibleCountChange?: (count: number) => void; onVisiblePlaceIdsChange?: (ids: string[]) => void }) {
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
  return <PlacesMap key={initialPlaceIds?.join("|") || "all"} places={places} initialPlaceIds={initialPlaceIds} tone={tone} single={single} autoLoad={autoLoad} onClose={onClose} onVisibleCountChange={onVisibleCountChange} onVisiblePlaceIdsChange={onVisiblePlaceIdsChange} />;
}
