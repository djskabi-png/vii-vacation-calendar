"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MapPinned } from "lucide-react";
import type { EventPlace, Listing } from "../data/site-data";
import { eventPlaceHref } from "../lib/event-place-href";
import type { DiscoveryItem } from "../data/world-data";
import type { Trail } from "../data/trail-data";
import { useSiteLanguage } from "../i18n/locale-provider";
import { localizedPath } from "../i18n/locale-routing";
import { latinBusinessAlias, localizedBusinessText } from "../i18n/localized-business-content";
import { PreviewCardGallery } from "./preview-card-gallery";
import { mapSnapshotPublicUrl } from "../lib/map-snapshot-url";
import { formatMapPrice, priceModeFromLabel, validMapPrice, verifiedPriceFromLabel, type MapPriceQuote } from "../lib/map-price";
import { trackMapInteraction } from "../lib/analytics";
import "leaflet/dist/leaflet.css";

let leafletModulePromise: Promise<typeof import("leaflet")> | null = null;

export function preloadLeaflet() {
  if (typeof window === "undefined") return null;
  leafletModulePromise ??= import("leaflet");
  return leafletModulePromise;
}

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
  markerKind: "price" | "capacity" | "count" | "category";
  valueLabel?: string;
  rating?: number;
  reviews?: number;
  precision?: "exact" | "area";
  illustrativeImage?: boolean;
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
  activePlaceId?: string | null;
  onActivePlaceChange?: (id: string | null) => void;
  regional?: boolean;
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

function enableMarkerKeyboardActivation(marker: import("leaflet").Marker) {
  // Leaflet's div icons have role=button but do not synthesize a click on Enter.
  marker.getElement()?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) marker.fire("click");
  });
}

function markerIcon(tone: MapTone) {
  const common = 'viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
  if (tone === "events") return `<svg ${common}><path d="M12 5.2c.7 3.6 2.8 5.7 6.4 6.4-3.6.7-5.7 2.8-6.4 6.4-.7-3.6-2.8-5.7-6.4-6.4 3.6-.7 5.7-2.8 6.4-6.4Z"/><path d="M5.2 4.2v2.4M4 5.4h2.4M19 17.7v2.1M18 18.7h2"/></svg>`;
  if (tone === "spa") return `<svg ${common}><path d="M12 20.5c4.3-2.3 6.8-5.3 6.8-8.6A3.6 3.6 0 0 0 12 10.3a3.6 3.6 0 0 0-6.8 1.6c0 3.3 2.5 6.3 6.8 8.6Z"/><path d="M12 6.5c-.1-1.7.6-3 2.1-4M8.4 8C7 6.8 6.5 5.4 6.8 3.7M15.6 8c1.4-1.2 1.9-2.6 1.6-4.3"/></svg>`;
  if (tone === "hourly") return `<svg ${common}><circle cx="12" cy="12" r="8.5"/><path d="M12 7.3v5l3.3 2M8.2 3.8l-1.6 2.1M15.8 3.8l1.6 2.1"/></svg>`;
  if (tone === "activities") return `<svg ${common}><path d="M4.5 7.4h15v9.2h-15V7.4Z"/><path d="M8.8 7.4v9.2M15.2 7.4v9.2M12 4.2v3.2M10.3 5.5 12 4l1.7 1.5"/></svg>`;
  return `<svg ${common}><path d="m3.5 10.6 8.5-6.8 8.5 6.8"/><path d="M5.6 9.4v10.8h12.8V9.4M9.5 20.2v-6.1h5v6.1M8 11.1h1.8M14.2 11.1H16"/></svg>`;
}

function PlacesMap({ places: incomingPlaces, initialPlaceIds, tone = "vacation", single = false, autoLoad = false, onClose, onVisibleCountChange, onVisiblePlaceIdsChange, activePlaceId = null, onActivePlaceChange, regional = false }: PlacesMapProps) {
  // Keep equivalent parent renders from rebuilding Leaflet without serializing
  // entire image arrays and records on every hover or selection render.
  const placesSignature = incomingPlaces.map((place) => [
    place.id,
    place.name,
    place.location,
    place.area,
    place.category,
    place.meta,
    place.image,
    place.lat,
    place.lng,
    place.href,
    place.markerLabel,
    place.markerKind,
    place.valueLabel ?? "",
    place.rating ?? "",
    place.reviews ?? "",
    place.precision ?? "",
    place.illustrativeImage ? "1" : "0",
  ].join(":")).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const places = useMemo(() => incomingPlaces, [placesSignature]);
  const { language } = useSiteLanguage();
  const cardCopy = language === "en"
    ? { details: "View details", close: "Close place details", results: "Results on the map", visible: "places", list: "Result list", openCluster: "Open grouped places", searchArea: "Search this area", priced: "with verified price", review: "reviews" }
    : language === "ru"
      ? { details: "Подробнее", close: "Закрыть карточку места", results: "Результаты на карте", visible: "мест", list: "Список результатов", openCluster: "Открыть сгруппированные места", searchArea: "Искать в этой области", priced: "с подтверждённой ценой", review: "отзывов" }
      : language === "fr"
        ? { details: "Voir les détails", close: "Fermer la fiche du lieu", results: "Résultats sur la carte", visible: "lieux", list: "Liste des résultats", openCluster: "Ouvrir les lieux regroupés", searchArea: "Rechercher dans cette zone", priced: "avec prix vérifié", review: "avis" }
      : { details: "לכל הפרטים", close: "סגירת פרטי המקום", results: "תוצאות על המפה", visible: "מקומות", list: "רשימת תוצאות במפה", openCluster: "פתיחת המקומות המקובצים", searchArea: "חיפוש באזור הזה", priced: "עם מחיר מאומת", review: "חוות דעת" };
  const mapCopy = language === "en"
    ? { preview: "Interactive map", label: "Interactive places map", back: "Back to list", hint: "Map zoom controls", loading: "Loading the map and markers", view: "View of", open: "Open map", onMap: "places on the map", together: "See the results and map together, then choose a place without losing your search", loadingShort: "Loading the map…", regional: "The approximate area is shown. The exact arrival point is provided after confirmation." }
    : language === "ru"
      ? { preview: "Интерактивная карта", label: "Интерактивная карта мест", back: "Вернуться к списку", hint: "Масштаб карты", loading: "Загрузка карты и маркеров", view: "Вид на", open: "Открыть карту", onMap: "мест на карте", together: "Смотрите результаты вместе с картой и выбирайте место, не теряя параметры поиска", loadingShort: "Карта загружается…", regional: "Показан приблизительный район. Точная точка прибытия предоставляется после подтверждения." }
      : language === "fr"
        ? { preview: "Carte interactive", label: "Carte interactive des lieux", back: "Retour à la liste", hint: "Zoom de la carte", loading: "Chargement de la carte et des repères", view: "Vue de", open: "Ouvrir la carte", onMap: "lieux sur la carte", together: "Consultez les résultats et la carte ensemble, puis choisissez sans perdre votre recherche", loadingShort: "Chargement de la carte…", regional: "La zone approximative est affichée. Le point d’arrivée exact est fourni après confirmation." }
        : { preview: "מפה אינטראקטיבית", label: "מפה אינטראקטיבית של המקומות", back: "חזרה לרשימה", hint: "הגדלה והקטנה", loading: "טוענים את המפה ואת הסמנים", view: "מבט על", open: "פתיחת המפה", onMap: "מקומות על המפה", together: "רואים את התוצאות ואת המפה יחד, ובוחרים מקום בלי לאבד את החיפוש", loadingShort: "המפה נטענת…", regional: "מוצג אזור המקום. נקודת ההגעה המדויקת נמסרת לאחר אישור." };
  const mapControlCopy = language === "en"
    ? { zoomIn: "Zoom in", zoomOut: "Zoom out", cluster: "Zoom in to grouped places" }
    : language === "ru"
      ? { zoomIn: "\u0423\u0432\u0435\u043b\u0438\u0447\u0438\u0442\u044c \u043a\u0430\u0440\u0442\u0443", zoomOut: "\u0423\u043c\u0435\u043d\u044c\u0448\u0438\u0442\u044c \u043a\u0430\u0440\u0442\u0443", cluster: "\u041f\u0440\u0438\u0431\u043b\u0438\u0437\u0438\u0442\u044c \u0441\u0433\u0440\u0443\u043f\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0435 \u043c\u0435\u0441\u0442\u0430" }
      : language === "fr"
        ? { zoomIn: "Agrandir la carte", zoomOut: "R\u00e9duire la carte", cluster: "Agrandir les lieux regroup\u00e9s" }
        : { zoomIn: "\u05d4\u05d2\u05d3\u05dc\u05ea \u05d4\u05de\u05e4\u05d4", zoomOut: "\u05d4\u05e7\u05d8\u05e0\u05ea \u05d4\u05de\u05e4\u05d4", cluster: "\u05d4\u05ea\u05e7\u05e8\u05d1\u05d5\u05ea \u05dc\u05de\u05e7\u05d5\u05de\u05d5\u05ea \u05d4\u05de\u05e7\u05d5\u05d1\u05e6\u05d9\u05dd" };
  const precisionCopy = { he: "מיקום אזורי משוער", en: "Approximate area", ru: "Приблизительный район", fr: "Zone approximative" }[language];
  const regionsCopy = { he: "אזורים", en: "regions", ru: "регионов", fr: "régions" }[language];
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<import("leaflet").Map | null>(null);
  const markerInstances = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const activePreviewMarker = useRef<import("leaflet").Marker | null>(null);
  const visibleCountCallback = useRef(onVisibleCountChange);
  const visiblePlaceIdsCallback = useRef(onVisiblePlaceIdsChange);
  const activePlaceCallback = useRef(onActivePlaceChange);
  const hoveredPlaceId = useRef(activePlaceId);
  const suppressViewportPrompt = useRef(false);
  const mapOpenTracked = useRef(false);
  const initialSelectedId = single ? initialPlaceIds?.find((id) => places.some((place) => place.id === id)) ?? places[0]?.id ?? "" : "";
  const selectedIdRef = useRef(initialSelectedId);
  // A place page must display a real map, not a venue photo pretending to be
  // one. Search maps remain opt-in; a single-place map loads passively and
  // becomes fully interactive only after the visitor activates it.
  const [enabled, setEnabled] = useState(autoLoad || single);
  const [interactive, setInteractive] = useState(autoLoad);
  const [mapReady, setMapReady] = useState(false);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [pendingVisibleIds, setPendingVisibleIds] = useState<string[]>([]);
  const [viewportDirty, setViewportDirty] = useState(false);
  const [snapshotUnavailable, setSnapshotUnavailable] = useState(true);
  const previewImageRef = useRef<HTMLImageElement>(null);
  const preview = places[0] ?? null;
  const snapshotUrl = preview ? mapSnapshotPublicUrl(tone, preview.id) : "";
  const effectiveSelectedId = selectedId !== "" && places.some((place) => place.id === selectedId) ? selectedId : "";
  const selected = places.find((place) => place.id === effectiveSelectedId) ?? null;
  const pricedPlaceCount = places.filter((place) => place.markerKind === "price").length;
  const focusKey = initialPlaceIds?.join("|") ?? "";

  const activateMap = useCallback(() => {
    setInteractive(true);
    setEnabled(true);
  }, []);

  useEffect(() => {
    if (!enabled || single || mapOpenTracked.current) return;
    mapOpenTracked.current = true;
    trackMapInteraction({ action: "open", world: tone, resultCount: places.length });
  }, [enabled, places.length, single, tone]);

  useEffect(() => {
    // A changed place must never keep a snapshot accepted for the prior place.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSnapshotUnavailable(true);
    if (!snapshotUrl) return;
    const controller = new AbortController();
    void fetch(snapshotUrl, { cache: "force-cache", signal: controller.signal })
      .then((response) => {
        if (response.ok) setSnapshotUnavailable(false);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [single, snapshotUrl]);

  useEffect(() => {
    if (snapshotUnavailable) return;
    const image = previewImageRef.current;
    if (!image) return;
    const handlePlaceFallback = () => setSnapshotUnavailable(true);
    image.addEventListener("error", handlePlaceFallback);
    // A cached 404 can finish before React hydrates and attaches onError.
    // Inspect the element as well so the preview can never remain broken.
    if (image.complete && image.naturalWidth === 0) handlePlaceFallback();
    return () => image.removeEventListener("error", handlePlaceFallback);
  }, [snapshotUnavailable, preview?.id, tone]);

  useEffect(() => {
    visibleCountCallback.current = onVisibleCountChange;
    visiblePlaceIdsCallback.current = onVisiblePlaceIdsChange;
    activePlaceCallback.current = onActivePlaceChange;
  }, [onActivePlaceChange, onVisibleCountChange, onVisiblePlaceIdsChange]);

  useEffect(() => { hoveredPlaceId.current = activePlaceId; }, [activePlaceId]);

  useEffect(() => {
    if (!selectedId || places.some((place) => place.id === selectedId)) return;
    const clearSelectionFrame = window.requestAnimationFrame(() => setSelectedId(""));
    return () => window.cancelAnimationFrame(clearSelectionFrame);
  }, [places, selectedId]);

  const selectPlace = useCallback((id: string) => {
    const place = places.find((entry) => entry.id === id);
    if (!place) return;
    selectedIdRef.current = id;
    setSelectedId(id);
    activePlaceCallback.current?.(id);
    trackMapInteraction({ action: "marker_select", world: tone, resultCount: places.length, placeId: id });
  }, [places, tone]);

  const closeSelectedPlace = useCallback(() => {
    const marker = markerInstances.current.get(selectedIdRef.current);
    selectedIdRef.current = "";
    setSelectedId("");
    activePlaceCallback.current?.(null);
    window.setTimeout(() => marker?.getElement()?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!effectiveSelectedId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSelectedPlace();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeSelectedPlace, effectiveSelectedId]);

  const applyVisibleArea = useCallback(() => {
    visibleCountCallback.current?.(pendingVisibleIds.length);
    visiblePlaceIdsCallback.current?.(pendingVisibleIds);
    setViewportDirty(false);
    setSelectedId("");
    activePlaceCallback.current?.(null);
    trackMapInteraction({ action: "search_area", world: tone, resultCount: pendingVisibleIds.length });
  }, [pendingVisibleIds, tone]);

  useEffect(() => {
    selectedIdRef.current = effectiveSelectedId;
    markerInstances.current.forEach((marker, id) => {
      const element = marker.getElement();
      const active = id === effectiveSelectedId;
      element?.classList.toggle("is-active", active);
      element?.setAttribute("aria-pressed", String(active));
    });
  }, [effectiveSelectedId, mapReady]);

  useEffect(() => {
    activePreviewMarker.current?.remove();
    activePreviewMarker.current = null;
    const activeMarker = activePlaceId ? markerInstances.current.get(activePlaceId) : undefined;
    const sharedMarkerCount = activeMarker ? [...markerInstances.current.values()].filter((marker) => marker === activeMarker).length : 0;
    new Set(markerInstances.current.values()).forEach((marker) => {
      // A cluster is not the hovered place's exact location. Its temporary
      // exact-coordinate preview is the only highlighted marker in that case.
      const active = marker === activeMarker && sharedMarkerCount === 1;
      marker.getElement()?.classList.toggle("is-card-active", active);
      marker.setZIndexOffset(active ? 1000 : 0);
    });

    if (!activePlaceId || !activeMarker || !mapInstance.current) return;
    const activePlace = places.find((place) => place.id === activePlaceId);
    if (activePlace && !mapInstance.current.getBounds().pad(-0.08).contains([activePlace.lat, activePlace.lng])) {
      mapInstance.current.panInside([activePlace.lat, activePlace.lng], {
        padding: [48, 48], animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      });
    }
    if (sharedMarkerCount <= 1) return;

    const place = places.find((entry) => entry.id === activePlaceId);
    const leaflet = preloadLeaflet();
    if (!place || !leaflet) return;
    let cancelled = false;
    void leaflet.then((L) => {
      if (cancelled || !mapInstance.current) return;
      const useTextLabel = place.markerKind !== "category";
      const markerContent = useTextLabel
        ? `${place.markerKind === "price" ? "" : `<span class="vii-map-marker__icon">${markerIcon(tone)}</span>`}<span class="vii-map-marker__label">${safeMarkerLabel(place.markerLabel)}</span>`
        : `<span class="vii-map-marker__icon">${markerIcon(tone)}</span>`;
      const previewMarker = L.marker([place.lat, place.lng], {
        keyboard: true,
        alt: place.name,
        zIndexOffset: 1400,
        icon: L.divIcon({
          className: `vii-map-marker-wrap map-tone--${tone} marker-kind--${place.markerKind}${useTextLabel ? " is-text" : " is-icon"} is-card-active is-hover-preview`,
          html: `<span class="vii-map-marker">${markerContent}</span>`,
          iconSize: useTextLabel ? [140, 54] : [54, 58],
          iconAnchor: useTextLabel ? [70, 51] : [27, 54],
        }),
      }).addTo(mapInstance.current);
      previewMarker.getElement()?.setAttribute("data-map-place-id", place.id);
      previewMarker.getElement()?.setAttribute("aria-label", place.name);
      previewMarker.on("click", (event) => {
        if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
        selectPlace(place.id);
      });
      enableMarkerKeyboardActivation(previewMarker);
      previewMarker.on("mouseover", () => activePlaceCallback.current?.(place.id));
      previewMarker.on("mouseout", () => activePlaceCallback.current?.(null));
      activePreviewMarker.current = previewMarker;
    });

    return () => {
      cancelled = true;
      activePreviewMarker.current?.remove();
      activePreviewMarker.current = null;
    };
  }, [activePlaceId, mapReady, places, selectPlace, tone]);

  useEffect(() => {
    if (!enabled || !mapElement.current || places.length === 0) return;
    const container = mapElement.current;
    const markerRegistry = markerInstances.current;
    let cancelled = false;
    let readyTimer: number | undefined;
    let layoutTimer: number | undefined;
    let settleFrame: number | undefined;
    let createdMap: import("leaflet").Map | null = null;
    let resizeObserver: ResizeObserver | undefined;
    let resizeFrame: number | undefined;
    let layoutReady = false;
    let tilesReady = false;
    suppressViewportPrompt.current = true;
    setViewportDirty(false);
    setPendingVisibleIds([]);
    setMapReady(false);

    const leaflet = preloadLeaflet();
    if (!leaflet) return;
    void leaflet.then((L) => {
      if (cancelled) return;
      mapInstance.current?.remove();
      mapInstance.current = null;
      markerRegistry.clear();

      const map = L.map(container, {
        scrollWheelZoom: interactive,
        touchZoom: interactive,
        doubleClickZoom: interactive,
        boxZoom: interactive,
        keyboard: interactive,
        zoomSnap: 0.5,
        wheelDebounceTime: 40,
        wheelPxPerZoomLevel: 80,
        zoomControl: false,
        attributionControl: true,
        minZoom: 7,
        maxBounds: [[28.65, 33.55], [34.15, 36.45]],
        maxBoundsViscosity: 0.72,
      });
      createdMap = map;
      mapInstance.current = map;
      const streetTileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
      const streetTiles = L.tileLayer(streetTileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 20,
        maxNativeZoom: 19,
      });
      const aerialTiles = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Tiles &copy; Esri", maxZoom: 19 },
      );
      let streetFallbackUsed = false;
      streetTiles.on("tileerror", () => {
        if (streetFallbackUsed || !map.hasLayer(streetTiles)) return;
        streetFallbackUsed = true;
        map.removeLayer(streetTiles);
        aerialTiles.addTo(map);
      });
      streetTiles.addTo(map);
      const layerNames = language === "he"
        ? { street: "מפה בעברית", aerial: "תצלום אוויר", layers: "בחירת סוג מפה" }
        : language === "ru"
          ? { street: "Карта", aerial: "Спутник", layers: "Выбрать вид карты" }
          : language === "fr"
            ? { street: "Plan", aerial: "Satellite", layers: "Choisir le type de carte" }
            : { street: "Map", aerial: "Satellite", layers: "Choose map style" };
      if (interactive) {
        L.control.zoom({
          position: language === "he" ? "topleft" : "topright",
          zoomInTitle: mapControlCopy.zoomIn,
          zoomOutTitle: mapControlCopy.zoomOut,
          zoomInText: "+",
          zoomOutText: "\u2212",
        }).addTo(map);
        const layersControl = L.control.layers(
          { [layerNames.street]: streetTiles, [layerNames.aerial]: aerialTiles },
          undefined,
          // Keep the style selector opposite the zoom controls. In LTR
          // locales both controls previously occupied the top-right corner;
          // the expanding layers panel could cover a real place marker and
          // make that marker impossible to select on narrow viewports.
          { position: language === "he" ? "topright" : "topleft" },
        ).addTo(map);
        const layersToggle = layersControl.getContainer()?.querySelector<HTMLAnchorElement>(".leaflet-control-layers-toggle");
        layersToggle?.setAttribute("title", layerNames.layers);
        layersToggle?.setAttribute("aria-label", layerNames.layers);
      }

      const showMap = () => {
        tilesReady = true;
        if (!cancelled && layoutReady) setMapReady(true);
      };
      streetTiles.once("load", showMap);
      readyTimer = window.setTimeout(showMap, 2200);

      const markerLayer = L.layerGroup().addTo(map);
      let expandedPlaceIds = new Set<string>();
      let clusterActivationEvent: Event | undefined;
      const bindPlaceMarkerInteraction = (marker: import("leaflet").Marker, id: string) => {
        marker.on("mouseover", () => activePlaceCallback.current?.(id));
        marker.on("mouseout", () => activePlaceCallback.current?.(selectedIdRef.current || null));
        const element = marker.getElement();
        element?.setAttribute("data-map-place-id", id);
        element?.addEventListener("focus", () => activePlaceCallback.current?.(id));
        element?.addEventListener("blur", () => activePlaceCallback.current?.(selectedIdRef.current || null));
      };
      const spiderfyCluster = (entries: MapPlace[], center: import("leaflet").LatLng, clearExisting = true) => {
        if (clearExisting) {
          markerLayer.clearLayers();
          markerRegistry.clear();
        }
        const centerPoint = map.latLngToLayerPoint(center);
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));

        entries.forEach((entry, index) => {
          const angle = -Math.PI / 2 + index * goldenAngle;
          const radius = entries.length <= 3
            ? 44 + index * 14
            : 34 + Math.sqrt(index + 1) * 24;
          const spiderPoint = centerPoint.add(L.point(Math.cos(angle) * radius, Math.sin(angle) * radius));
          const spiderPosition = map.layerPointToLatLng(spiderPoint);
          const useTextLabel = entry.markerKind !== "category";
          const markerContent = useTextLabel
            ? `${entry.markerKind === "price" ? "" : `<span class="vii-map-marker__icon">${markerIcon(tone)}</span>`}<span class="vii-map-marker__label">${safeMarkerLabel(entry.markerLabel)}</span>`
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
              className: `vii-map-marker-wrap map-tone--${tone} marker-kind--${entry.markerKind}${useTextLabel ? " is-text" : " is-icon"}${entry.id === selectedIdRef.current ? " is-active" : ""}`,
              html: `<span class="vii-map-marker">${markerContent}</span>`,
              iconSize: useTextLabel ? [140, 54] : [54, 58],
              iconAnchor: useTextLabel ? [70, 51] : [27, 54],
            }),
          }).addTo(markerLayer);
          spiderMarker.getElement()?.setAttribute("aria-label", entry.name);
          spiderMarker.on("click", (event) => {
            if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
            // Ignore only the event which expanded the cluster, not a new tap
            // or immediate keyboard action on the newly revealed place.
            if (event.originalEvent && event.originalEvent === clusterActivationEvent) return;
            selectPlace(entry.id);
          });
          bindPlaceMarkerInteraction(spiderMarker, entry.id);
          enableMarkerKeyboardActivation(spiderMarker);
          markerRegistry.set(entry.id, spiderMarker);
        });
      };

      const renderMarkers = () => {
        markerLayer.clearLayers();
        markerRegistry.clear();
        const zoom = map.getZoom();
        const threshold = zoom < 8 ? 76 : zoom < 10 ? 52 : zoom < 12 ? 32 : 18;
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
          const explicitlyExpanded = clustered && cluster.entries.every((entry) => expandedPlaceIds.has(entry.id));
          if (clustered && (zoom >= 12 || explicitlyExpanded)) {
            spiderfyCluster(cluster.entries, clusterCenter, false);
            return;
          }
          const clusterText = language === "he" ? `${cluster.entries.length} מקומות` : `${cluster.entries.length}`;
          const visibleLabel = clustered ? String(cluster.entries.length) : place.markerLabel;
          // Clusters communicate result count. Numeric labels keep useful values,
          // such as price or capacity, visible without opening a result card.
          const useTextLabel = clustered || place.markerKind !== "category";
          const markerContent = clustered
            ? `<span class="vii-map-marker__label">${safeMarkerLabel(visibleLabel)}</span>`
            : useTextLabel
              ? `${place.markerKind === "price" ? "" : `<span class="vii-map-marker__icon">${markerIcon(tone)}</span>`}<span class="vii-map-marker__label">${safeMarkerLabel(visibleLabel)}</span>`
              : `<span class="vii-map-marker__icon">${markerIcon(tone)}</span>`;
          const marker = L.marker(clusterCenter, {
            keyboard: true,
            alt: clustered ? clusterText : place.name,
            icon: L.divIcon({
              className: `vii-map-marker-wrap map-tone--${tone} marker-kind--${clustered ? "count" : place.markerKind}${clustered ? " is-cluster" : ""}${useTextLabel ? " is-text" : " is-icon"}${cluster.entries.some((entry) => entry.id === selectedIdRef.current) ? " is-active" : ""}`,
              html: `<span class="vii-map-marker">${markerContent}</span>`,
              iconSize: clustered ? [72, 58] : useTextLabel ? [140, 54] : [54, 58],
              iconAnchor: clustered ? [36, 54] : useTextLabel ? [70, 51] : [27, 54],
            }),
          }).addTo(markerLayer);

          if (clustered) {
            cluster.entries.forEach((entry) => markerRegistry.set(entry.id, marker));
            marker.getElement()?.setAttribute("aria-label", `${clusterText}, ${mapControlCopy.cluster}`);
            marker.getElement()?.setAttribute("aria-pressed", String(cluster.entries.some((entry) => entry.id === selectedIdRef.current)));
            marker.on("click", (event) => {
              if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
              clusterActivationEvent = event.originalEvent;
              selectedIdRef.current = "";
              setSelectedId("");
              expandedPlaceIds = new Set(cluster.entries.map((entry) => entry.id));
              const clusterBounds = L.latLngBounds(cluster.entries.map((entry) => [entry.lat, entry.lng] as [number, number]));
              const clusterDistance = clusterBounds.getNorthEast().distanceTo(clusterBounds.getSouthWest());
              const paddedClusterBounds = clusterBounds.pad(0.65);
              const currentZoom = map.getZoom();
              const targetZoom = Math.min(map.getBoundsZoom(paddedClusterBounds, false, L.point(140, 140)), currentZoom + 3, 12);
              if (clusterDistance < 120 || targetZoom <= currentZoom) {
                map.setView(clusterCenter, Math.min(12, Math.max(10, currentZoom + 3)), { animate: true });
              } else {
                map.fitBounds(paddedClusterBounds, { maxZoom: targetZoom, padding: [70, 70] });
              }
            });
          } else {
            marker.getElement()?.setAttribute("aria-label", place.name);
            marker.on("click", (event) => {
              if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
              selectPlace(place.id);
            });
            bindPlaceMarkerInteraction(marker, place.id);
            markerRegistry.set(place.id, marker);
          }
          enableMarkerKeyboardActivation(marker);
        });
        const activeMarker = hoveredPlaceId.current ? markerRegistry.get(hoveredPlaceId.current) : undefined;
        if (activeMarker && [...markerRegistry.values()].filter((marker) => marker === activeMarker).length === 1) {
          activeMarker.getElement()?.classList.add("is-card-active");
          activeMarker.setZIndexOffset(1000);
        }
      };

      const visiblePlaceIds = () => {
        const currentBounds = map.getBounds().pad(0.04);
        return places.filter((place) => currentBounds.contains([place.lat, place.lng])).map((place) => place.id);
      };
      const reportVisiblePlaces = (prompt = false) => {
        const ids = visiblePlaceIds();
        setPendingVisibleIds(ids);
        if (prompt && !suppressViewportPrompt.current) setViewportDirty(true);
        else {
          visibleCountCallback.current?.(ids.length);
          if (!prompt) visiblePlaceIdsCallback.current?.(ids);
        }
      };

      const focusPlaces = initialPlaceIds?.length
        ? places.filter((place) => initialPlaceIds.includes(place.id))
        : places;
      const targetPlaces = focusPlaces.length ? focusPlaces : places;
      const bounds = L.latLngBounds(targetPlaces.map((place) => [place.lat, place.lng] as [number, number]));
      const focusInitialPlaces = () => {
        const compactViewport = container.clientWidth <= 640;
        const boundsPadding: [number, number] = compactViewport ? [22, 22] : [56, 56];
        const boundsExpansion = compactViewport ? 0.04 : 0.12;
        if (targetPlaces.length === 1) {
          map.setView([targetPlaces[0].lat, targetPlaces[0].lng], targetPlaces[0].precision === "area" ? 13 : 15, { animate: false });
          return;
        }
        map.fitBounds(bounds.pad(boundsExpansion), { animate: false, maxZoom: 13, padding: boundsPadding });
        // A tall mobile viewport can otherwise zoom out far beyond Israel just
        // to preserve generous horizontal padding. Keep the national overview
        // useful while retaining every relevant result inside the viewport.
        if (compactViewport && map.getZoom() < 7) map.setZoom(7, { animate: false });
      };
      focusInitialPlaces();

      // Panning and resizing do not change proximity at a fixed zoom. Leaflet
      // repositions existing markers itself. Replacing their DOM here loses
      // focus and can discard the first click/Enter after the layout changes.
      map.on("zoomend", () => {
        if (cancelled || mapInstance.current !== map) return;
        renderMarkers();
        reportVisiblePlaces(true);
      });
      map.on("dragend", () => {
        if (cancelled || mapInstance.current !== map) return;
        reportVisiblePlaces(true);
      });
      renderMarkers();
      reportVisiblePlaces();

      // CSS changes the same canvas between a sticky split and a full-screen
      // map. Leaflet's window resize handler does not observe every flex/grid
      // size change. Preserve the camera; never refit the original search here.
      resizeObserver = new ResizeObserver(() => {
        if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
        resizeFrame = window.requestAnimationFrame(() => {
          if (cancelled || mapInstance.current !== map || !container.isConnected) return;
          map.invalidateSize({ animate: false, pan: false });
          reportVisiblePlaces(true);
        });
      });
      resizeObserver.observe(container);
      map.on("click", () => {
        selectedIdRef.current = "";
        setSelectedId("");
        activePlaceCallback.current?.(null);
      });

      layoutTimer = window.setTimeout(() => {
        if (cancelled || mapInstance.current !== map || !container.isConnected) return;
        map.invalidateSize({ animate: false });
        focusInitialPlaces();
        renderMarkers();
        reportVisiblePlaces();
        layoutReady = true;
        if (tilesReady) setMapReady(true);
        settleFrame = window.requestAnimationFrame(() => {
          suppressViewportPrompt.current = false;
          setViewportDirty(false);
        });
      }, 80);
    });

    return () => {
      cancelled = true;
      if (readyTimer) window.clearTimeout(readyTimer);
      if (layoutTimer) window.clearTimeout(layoutTimer);
      if (settleFrame) window.cancelAnimationFrame(settleFrame);
      resizeObserver?.disconnect();
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      suppressViewportPrompt.current = false;
      activePreviewMarker.current?.remove();
      activePreviewMarker.current = null;
      markerRegistry.clear();
      createdMap?.off();
      createdMap?.remove();
      if (mapInstance.current === createdMap) mapInstance.current = null;
    };
  // focusKey already represents every initial ID. Array identity alone is not
  // an instruction to rebuild the map during a marker hover or keyboard focus.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, interactive, places, selectPlace, single, tone, language, focusKey, cardCopy.openCluster, mapControlCopy.cluster, mapControlCopy.zoomIn, mapControlCopy.zoomOut]);

  if (!preview) return null;

  const previewRegional = preview.precision === "area";
  const placeFallback = snapshotUnavailable;
  const previewImage = placeFallback ? preview.image : snapshotUrl;
  const fallbackLabel = { he: "תצוגת המקום", en: "Place preview", ru: "Вид места", fr: "Aperçu du lieu" }[language];
  const previewContent = (
    <>
      {(!snapshotUnavailable || placeFallback) && <>{/* eslint-disable-next-line @next/next/no-img-element */}<img ref={previewImageRef} className={`map-preview-image ${placeFallback ? "is-place-fallback" : "is-map-snapshot"}`} src={previewImage}
        alt={placeFallback ? preview.name : `${mapCopy.view} ${preview.name}`}
        title={placeFallback ? preview.name : `${mapCopy.view} ${preview.name}`}
        onError={() => { if (!placeFallback) setSnapshotUnavailable(true); }} /></>}
      <span className="map-preview-shade" aria-hidden="true" />
      <div className="map-preview-content">
        <span className="map-preview-label">{placeFallback ? fallbackLabel : mapCopy.preview}</span>
        <span className="map-consent-pin" aria-hidden="true"><MapPinned /></span>
        <div>
          <h3>{single ? preview.name : `${places.length} ${mapCopy.onMap}`}</h3>
          <p>{single ? `${preview.location}, ${preview.area}` : mapCopy.together}</p>
        </div>
        {!enabled && <button className="button map-load-button" type="button" onClick={activateMap}><MapPinned aria-hidden="true" />{mapCopy.open}</button>}
        {enabled && !mapReady && <span className="map-loading-pill">{mapCopy.loadingShort}</span>}
        {single && previewRegional && <small className="map-precision-note">{mapCopy.regional}</small>}
      </div>
      {!snapshotUnavailable && <a className="map-preview-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>© OpenStreetMap</a>}
    </>
  );

  if (!enabled) return <div className={`map-preview-card map-tone--${tone} ${single ? "single-map-preview" : ""}`}>{previewContent}</div>;

  const mapCanvas = <div className={`listing-map-shell map-tone--${tone} ${single ? "single-map" : ""}`}>
    <div ref={mapElement} className={`listing-map ${mapReady ? "is-ready" : ""}`} aria-label={mapCopy.label} />
    {single && mapReady && !interactive && <button className="map-passive-activate" type="button" onClick={activateMap} onWheel={activateMap} aria-label={mapCopy.open}>
      <span className="map-consent-pin" aria-hidden="true"><MapPinned /></span>
      <span>{mapCopy.open}</span>
    </button>}
    {!single && <div className="map-results-summary" aria-live="polite" data-place-count={places.length} data-priced-count={pricedPlaceCount}><strong>{places.length} {cardCopy.visible}</strong>{pricedPlaceCount > 0 && <span>{pricedPlaceCount} {cardCopy.priced}</span>}</div>}
    {onClose && !single && <button className="map-mobile-close" type="button" onClick={() => { trackMapInteraction({ action: "close", world: tone, resultCount: places.length }); onClose(); }} aria-label={mapCopy.back}><span aria-hidden="true">×</span>{mapCopy.back}</button>}
    {mapReady && !viewportDirty && <span className="map-zoom-hint">{mapCopy.hint}</span>}
    {mapReady && !single && viewportDirty && <button className="map-search-area" type="button" onClick={applyVisibleArea}><span>{cardCopy.searchArea}</span><small>{pendingVisibleIds.length} {regional ? regionsCopy : cardCopy.visible}</small></button>}
    {!mapReady && (autoLoad ? <span className="map-live-loading" role="status">{mapCopy.loading}</span> : <div className="map-preview-card map-loading-preview">{previewContent}</div>)}
    {mapReady && !single && selected && <article className="map-selection-card" aria-live="polite">
      <PreviewCardGallery key={selected.id} className="map-selection-card__media" name={selected.name} images={[selected.image]} href={localizedPath(selected.href, language)}>
        <small>{selected.category}</small>
      </PreviewCardGallery>
      <div className="map-selection-card__body">
        <span className="map-selection-card__location">{selected.location}{selected.area && selected.area !== selected.location ? ` · ${selected.area}` : ""}</span>
        <strong>{selected.name}</strong>
        {(selected.valueLabel || selected.rating) && <div className="map-selection-card__decision">
          {selected.valueLabel && <b>{selected.valueLabel}</b>}
          {selected.rating && <span>★ {selected.rating.toFixed(1)}{selected.reviews ? ` · ${selected.reviews.toLocaleString()} ${cardCopy.review}` : ""}</span>}
        </div>}
        <span className="map-selection-card__meta">{selected.meta}</span>
        {selected.precision === "area" && <span className="map-selection-card__precision">{precisionCopy}</span>}
        <Link href={localizedPath(selected.href, language)}>{cardCopy.details}</Link>
      </div>
      <button className="map-selection-card__close" type="button" onClick={closeSelectedPlace} aria-label={cardCopy.close}>×</button>
    </article>}
  </div>;

  if (single) return mapCanvas;

  return <div className={`map-results-experience map-tone--${tone}`}>
    <div className="map-results-canvas">{mapCanvas}</div>
  </div>;
}

export function ListingMap({ listings, initialListings, mode = "vacation", single = false, autoLoad = false, detailQuery, priceById, onClose, onVisibleCountChange, onVisiblePlaceIdsChange, activePlaceId, onActivePlaceChange }: { listings: Listing[]; initialListings?: Listing[]; mode?: "vacation" | "events"; single?: boolean; autoLoad?: boolean; detailQuery?: string; priceById?: Record<string, MapPriceQuote>; onClose?: () => void; onVisibleCountChange?: (count: number) => void; onVisiblePlaceIdsChange?: (ids: string[]) => void; activePlaceId?: string | null; onActivePlaceChange?: (id: string | null) => void }) {
  const { language, translate } = useSiteLanguage();
  const units = useMemo(() => ({
    he: { bedrooms: "חדרי שינה", units: "יחידות", guests: "אורחים", upTo: "עד" },
    en: { bedrooms: "bedrooms", units: "units", guests: "guests", upTo: "Up to" },
    ru: { bedrooms: "спален", units: "номеров", guests: "гостей", upTo: "До" },
    fr: { bedrooms: "chambres", units: "logements", guests: "personnes", upTo: "Jusqu’à" },
  })[language], [language]);
  const fallback = useMemo(() => ({
    he: { place: "מקום", location: "ישראל", area: "ישראל" },
    en: { place: "Place", location: "Israel", area: "Israel" },
    ru: { place: "Место", location: "Израиль", area: "Израиль" },
    fr: { place: "Lieu", location: "Israël", area: "Israël" },
  })[language], [language]);
  const places = useMemo<MapPlace[]>(() => listings.filter((listing) => typeof listing.lat === "number" && typeof listing.lng === "number").map((listing) => {
    const verifiedPrice = priceById?.[listing.slug] ?? (validMapPrice(listing.price) ? { amount: listing.price, mode: "from" as const } : undefined);
    const compactPrice = verifiedPrice ? formatMapPrice(verifiedPrice, language) : "";
    const fullPrice = verifiedPrice ? formatMapPrice(verifiedPrice, language, false) : "";
    return ({
    id: listing.slug,
    name: localizedBusinessText(listing.name, language, translate, latinBusinessAlias(listing.name) || fallback.place),
    location: localizedBusinessText(listing.location, language, translate, latinBusinessAlias(listing.location) || fallback.location),
    area: localizedBusinessText(listing.area, language, translate, latinBusinessAlias(listing.area) || fallback.area),
    category: translate(listing.type),
    meta: [
      listing.bedrooms ? `${listing.bedrooms} ${units.bedrooms}` : null,
      listing.units && listing.units > 1 ? `${listing.units} ${units.units}` : null,
      listing.guests > 0 ? `${units.upTo} ${listing.guests} ${units.guests}` : null,
    ].filter(Boolean).join(" · "),
    image: listing.image,
    lat: listing.lat!,
    lng: listing.lng!,
    href: mode === "events" ? eventPlaceHref(listing as EventPlace) : `/business?id=${listing.slug}${detailQuery ? `&${detailQuery}` : ""}`,
    markerLabel: compactPrice || (mode === "events" && listing.guests > 0 ? `${listing.guests} ${units.guests}` : translate(listing.type)),
    markerKind: compactPrice ? "price" : mode === "events" && listing.guests > 0 ? "capacity" : "category",
    valueLabel: fullPrice || undefined,
    rating: listing.score,
    reviews: listing.reviews,
    precision: "exact",
  }); }), [detailQuery, fallback, language, listings, mode, priceById, translate, units]);
  const initialPlaceIds = useMemo(() => initialListings?.map((listing) => listing.slug), [initialListings]);
  return <PlacesMap key={initialPlaceIds?.join("|") || "all"} places={places} initialPlaceIds={initialPlaceIds} tone={mode} single={single} autoLoad={autoLoad} onClose={onClose} onVisibleCountChange={onVisibleCountChange} onVisiblePlaceIdsChange={onVisiblePlaceIdsChange} activePlaceId={activePlaceId} onActivePlaceChange={onActivePlaceChange} />;
}

export function DiscoveryMap({ items, initialItems, tone, single = false, autoLoad = false, onClose, onVisibleCountChange, onVisiblePlaceIdsChange, activePlaceId, onActivePlaceChange }: { items: DiscoveryItem[]; initialItems?: DiscoveryItem[]; tone: "spa" | "hourly" | "activities"; single?: boolean; autoLoad?: boolean; onClose?: () => void; onVisibleCountChange?: (count: number) => void; onVisiblePlaceIdsChange?: (ids: string[]) => void; activePlaceId?: string | null; onActivePlaceChange?: (id: string | null) => void }) {
  const { language, translate } = useSiteLanguage();
  const localized = useMemo(() => language === "en"
    ? { spa: "Spa and treatments", hourly: "Hourly stay", packages: "Packages and treatments", short: "Short stay", from: "From" }
    : language === "ru"
      ? { spa: "Спа и процедуры", hourly: "Почасовое размещение", packages: "Пакеты и процедуры", short: "Короткое пребывание", from: "От" }
      : language === "fr"
        ? { spa: "Spa et soins", hourly: "Séjour à l'heure", packages: "Forfaits et soins", short: "Court séjour", from: "À partir de" }
        : null, [language]);
  const fallback = useMemo(() => ({
    he: { place: "מקום", location: "ישראל", area: "ישראל" },
    en: { place: "Place", location: "Israel", area: "Israel" },
    ru: { place: "Место", location: "Израиль", area: "Израиль" },
    fr: { place: "Lieu", location: "Israël", area: "Israël" },
  })[language], [language]);
  const places = useMemo<MapPlace[]>(() => items.filter((item) => typeof item.lat === "number" && typeof item.lng === "number").map((item) => {
    const price = verifiedPriceFromLabel(item.priceLabel);
    const priceQuote = price ? { amount: price, mode: priceModeFromLabel(item.priceLabel) } satisfies MapPriceQuote : null;
    const compactPrice = priceQuote ? formatMapPrice(priceQuote, language) : "";
    const fullPrice = priceQuote ? formatMapPrice(priceQuote, language, false) : "";
    return {
      id: item.id,
      name: localizedBusinessText(item.name, language, translate, latinBusinessAlias(item.name) || fallback.place),
      location: localizedBusinessText(item.location, language, translate, latinBusinessAlias(item.location) || fallback.location),
      area: localizedBusinessText(item.area, language, translate, latinBusinessAlias(item.area) || fallback.area),
      category: tone === "activities" ? localizedBusinessText(item.area, language, translate, latinBusinessAlias(item.area) || fallback.area) : localized ? (tone === "spa" ? localized.spa : localized.hourly) : tone === "spa" ? "ספא וטיפולים" : "שהייה לפי שעה",
      meta: localized ? (price ? fullPrice : tone === "spa" ? localized.packages : tone === "activities" ? localizedBusinessText(item.priceLabel || item.location, language, translate, fallback.location) : localized.short) : item.priceLabel || (tone === "spa" ? "חבילות וטיפולים" : tone === "activities" ? "חוויה בתשלום" : "שהייה קצרה"),
      image: item.image || "/vii-logo.png",
      lat: item.lat!,
      lng: item.lng!,
      href: `/discover/place/${item.id}`,
      markerLabel: compactPrice || (tone === "spa" ? "ספא" : tone === "activities" ? "אטרקציה" : "לפי שעה"),
      markerKind: compactPrice ? "price" : "category",
      valueLabel: fullPrice || undefined,
      rating: item.rating,
      precision: item.mapPrecision || "area",
    };
  }), [fallback, items, language, localized, tone, translate]);
  const initialPlaceIds = useMemo(() => initialItems?.map((item) => item.id), [initialItems]);
  return <PlacesMap key={initialPlaceIds?.join("|") || "all"} places={places} initialPlaceIds={initialPlaceIds} tone={tone} single={single} autoLoad={autoLoad} onClose={onClose} onVisibleCountChange={onVisibleCountChange} onVisiblePlaceIdsChange={onVisiblePlaceIdsChange} activePlaceId={activePlaceId} onActivePlaceChange={onActivePlaceChange} />;
}

const trailAreaCenters: Record<Trail["mainArea"], { lat: number; lng: number }> = {
  "צפון": { lat: 33.02, lng: 35.38 },
  "כנרת": { lat: 32.79, lng: 35.54 },
  "חיפה": { lat: 32.79, lng: 35.02 },
  "מרכז": { lat: 32.12, lng: 34.93 },
  "תל אביב": { lat: 32.08, lng: 34.78 },
  "דרום ונגב": { lat: 30.82, lng: 34.79 },
  "ירושלים": { lat: 31.78, lng: 35.17 },
  "אילת והסביבה": { lat: 29.56, lng: 34.95 },
};

export function TrailMap({ trails, autoLoad = false, onClose, onVisibleCountChange, onVisiblePlaceIdsChange, activePlaceId, onActivePlaceChange, filterQuery = "" }: { trails: Trail[]; autoLoad?: boolean; onClose?: () => void; onVisibleCountChange?: (count: number) => void; onVisiblePlaceIdsChange?: (ids: string[]) => void; activePlaceId?: string | null; onActivePlaceChange?: (id: string | null) => void; filterQuery?: string }) {
  const { language } = useSiteLanguage();
  const areaNames: Record<string, Record<string, string>> = {
    en: { "צפון": "Northern Israel", "כנרת": "the Sea of Galilee", "חיפה": "Haifa", "מרכז": "Central Israel", "תל אביב": "Tel Aviv", "דרום ונגב": "the South and Negev", "ירושלים": "Jerusalem", "אילת והסביבה": "Eilat and its surroundings" },
    ru: { "צפון": "Север Израиля", "כנרת": "Кинерет", "חיפה": "Хайфа", "מרכז": "Центр Израиля", "תל אביב": "Тель-Авив", "דרום ונגב": "Юг и Негев", "ירושלים": "Иерусалим", "אילת והסביבה": "Эйлат и окрестности" },
    fr: { "צפון": "le nord d’Israël", "כנרת": "le lac de Tibériade", "חיפה": "Haïfa", "מרכז": "le centre d’Israël", "תל אביב": "Tel-Aviv", "דרום ונגב": "le sud et le Néguev", "ירושלים": "Jérusalem", "אילת והסביבה": "Eilat et ses environs" },
  };
  const places = useMemo<MapPlace[]>(() => Object.entries(
    trails.reduce<Record<string, Trail[]>>((groups, trail) => {
      (groups[trail.mainArea] ||= []).push(trail);
      return groups;
    }, {}),
  ).map(([area, areaTrails]) => {
    const center = trailAreaCenters[area as Trail["mainArea"]];
    const areaName = language === "he" ? area : areaNames[language]?.[area] || area;
    const groupCount = areaTrails.length;
    const query = new URLSearchParams();
    const sourceQuery = new URLSearchParams(filterQuery);
    for (const key of ["nature", "difficulty", "q"]) {
      const value = sourceQuery.get(key);
      if (value) query.set(key, value);
    }
    query.set("area", area);
    return {
      id: `trails-${area}`,
      name: language === "he" ? `מסלולי טיול ב${area}` : language === "en" ? `Trails: ${areaName}` : language === "ru" ? `Маршруты: ${areaName}` : `Itinéraires : ${areaName}`,
      location: areaName,
      area: areaName,
      category: { he: "טיולים", en: "Trails", ru: "Маршруты", fr: "Itinéraires" }[language],
      meta: language === "he" ? `${groupCount} מסלולים באזור` : language === "en" ? `Trails in this area: ${groupCount}` : language === "ru" ? `Маршрутов в этом районе: ${groupCount}` : `Itinéraires dans cette zone : ${groupCount}`,
      image: `/images/trails/${areaTrails[0].slug}.jpg`,
      illustrativeImage: true,
      lat: center.lat,
      lng: center.lng,
      href: `/trails?area=${encodeURIComponent(area)}${query.size > 1 ? `&${[...query].filter(([key]) => key !== "area").map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&")}` : ""}`,
      markerLabel: language === "he" ? `${groupCount} מסלולים` : language === "en" ? `${groupCount} ${groupCount === 1 ? "trail" : "trails"}` : language === "ru" ? `Маршруты: ${groupCount}` : `${groupCount} ${groupCount === 1 ? "itinéraire" : "itinéraires"}`,
      markerKind: "count" as const,
      precision: "area" as const,
    };
  // areaNames is a fixed vocabulary; only the selected locale changes it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [trails, language, filterQuery]);

  const activeTrail = trails.find((trail) => trail.slug === activePlaceId);
  const activeGroupId = activeTrail ? `trails-${activeTrail.mainArea}` : activePlaceId;
  const reportVisibleTrails = (groupIds: string[]) => {
    const groups = new Set(groupIds);
    const ids = trails.filter((trail) => groups.has(`trails-${trail.mainArea}`)).map((trail) => trail.slug);
    onVisibleCountChange?.(ids.length);
    onVisiblePlaceIdsChange?.(ids);
  };
  return <PlacesMap places={places} tone="activities" regional autoLoad={autoLoad} onClose={onClose} onVisiblePlaceIdsChange={reportVisibleTrails} activePlaceId={activeGroupId} onActivePlaceChange={onActivePlaceChange} />;
}
