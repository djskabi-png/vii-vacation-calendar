"use client";

import { useMemo } from "react";
import type { Listing } from "../data/site-data";
import type { DiscoveryItem } from "../data/world-data";
import type { Trail } from "../data/trail-data";
import { useSiteLanguage } from "../i18n/locale-provider";
import { localizedPath } from "../i18n/locale-routing";
import type { MapPriceQuote } from "../lib/map-price";
import { listingMapPlaces, discoveryMapPlaces, trailAreaCenters, type MapPlace } from "../lib/map/map-place";
import { MapProviderHost as PlacesMap, preloadDefaultMapProvider as preloadProvider } from "./map/map-provider-host";

// Compatibility entry used by deferred-listing-map; no world data enters the provider.
export function preloadLeaflet() { return preloadProvider(); }

export function ListingMap({ listings, initialListings, focusKey, mode = "vacation", single = false, autoLoad = false, detailQuery, priceById, onClose, onVisibleCountChange, onVisiblePlaceIdsChange, activePlaceId, onActivePlaceChange }: { listings: Listing[]; initialListings?: Listing[]; focusKey?: string; mode?: "vacation" | "events"; single?: boolean; autoLoad?: boolean; detailQuery?: string; priceById?: Record<string, MapPriceQuote>; onClose?: () => void; onVisibleCountChange?: (count: number) => void; onVisiblePlaceIdsChange?: (ids: string[]) => void; activePlaceId?: string | null; onActivePlaceChange?: (id: string | null) => void }) {
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
  const places = useMemo(() => listingMapPlaces(listings, language, translate, fallback, mode, detailQuery, priceById, units), [detailQuery, fallback, language, listings, mode, priceById, translate, units]);
  const initialPlaceIds = useMemo(() => initialListings?.map((listing) => listing.slug), [initialListings]);
  return <PlacesMap key={focusKey || (single ? places[0]?.id : "all")} places={places} initialPlaceIds={initialPlaceIds} tone={mode} single={single} autoLoad={autoLoad} onClose={onClose} onVisibleCountChange={onVisibleCountChange} onVisiblePlaceIdsChange={onVisiblePlaceIdsChange} activePlaceId={activePlaceId} onActivePlaceChange={onActivePlaceChange} />;
}

export function DiscoveryMap({ items, initialItems, focusKey, tone, single = false, autoLoad = false, onClose, onVisibleCountChange, onVisiblePlaceIdsChange, activePlaceId, onActivePlaceChange }: { items: DiscoveryItem[]; initialItems?: DiscoveryItem[]; focusKey?: string; tone: "spa" | "hourly" | "activities"; single?: boolean; autoLoad?: boolean; onClose?: () => void; onVisibleCountChange?: (count: number) => void; onVisiblePlaceIdsChange?: (ids: string[]) => void; activePlaceId?: string | null; onActivePlaceChange?: (id: string | null) => void }) {
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
  const places = useMemo(() => discoveryMapPlaces(items, language, translate, fallback, tone, localized), [fallback, items, language, localized, tone, translate]);
  const initialPlaceIds = useMemo(() => initialItems?.map((item) => item.id), [initialItems]);
  return <PlacesMap key={focusKey || (single ? places[0]?.id : "all")} places={places} initialPlaceIds={initialPlaceIds} tone={tone} single={single} autoLoad={autoLoad} onClose={onClose} onVisibleCountChange={onVisibleCountChange} onVisiblePlaceIdsChange={onVisiblePlaceIdsChange} activePlaceId={activePlaceId} onActivePlaceChange={onActivePlaceChange} />;
}

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
      representedCount: groupCount,
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
  return <PlacesMap places={places} tone="activities" regional resultKind="trails" autoLoad={autoLoad} onClose={onClose} onVisiblePlaceIdsChange={reportVisibleTrails} activePlaceId={activeGroupId} onActivePlaceChange={onActivePlaceChange} />;
}
