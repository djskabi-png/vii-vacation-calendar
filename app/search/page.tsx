"use client";

import "./search-tablet.css";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DeferredListingMap } from "../components/deferred-listing-map";
import { ModernSelect } from "../components/modern-select";
import { PageShell } from "../components/page-shell";
import { availabilityDemoSlugs, hasAvailablePriceForSearch, isAvailabilityDemoSearch, PropertyCard } from "../components/property-card";
import { SearchBox } from "../components/search-box";
import { BreadcrumbTrail } from "../components/breadcrumb-trail";
import { properties } from "../data/site-data";
import { getPlaceAccessibility } from "../data/accessibility-data";
import { CloseIcon, MapIcon, PinIcon } from "../site-header";
import { useSiteLanguage } from "../i18n/locale-provider";
import { localizedPath } from "../i18n/locale-routing";
import { footerTopicForPropertyType } from "../data/footer-context";
import { cleanAccommodationPath } from "../data/accommodation-landings";
import { isWholeCountrySelection, matchesSearchLocation } from "../data/search-taxonomy";
import { cleanVacationPath } from "../data/vacation-landings";
import { buildVacationSearchUrl } from "../lib/vacation-search-url";
import { vacationInventorySummary } from "../lib/vacation-inventory";
import { vacationStayFromSearch } from "../lib/vacation-date-range";
import { useMapViewState } from "../components/map-view-state";
import { FilterControlIcon } from "../components/filter-control-icon";
import { SearchAfterResults, type ContextualSearchSuggestion } from "../components/search-after-results";
import { ResultsViewToggle, useResultsViewMode } from "../components/results-view-toggle";

export type SearchLandingContext = {
  path: string;
  title: string;
  description: string;
  breadcrumb: string;
  type: string;
  types?: string[];
  resultNoun?: string;
  resultNounOne?: string;
  area?: string;
  listingSlugs?: string[];
  guideTitle?: string;
  guideParagraphs?: string[];
  faqs?: Array<{ question: string; answer: string }>;
};

type VacationFilterState = {
  area: string;
  selectedTypes: string[];
  guests: number;
  minPrice: number;
  maxPrice: number;
  pool: boolean;
  spa: boolean;
  whole: boolean;
  accessibleOnly: boolean;
  selectedExtras: string[];
  sort: string;
};

const legacyAccommodationTypes = [
  { label: "בקתות עץ", matches: ["בקתת עץ", "בקתות עץ"] },
  { label: "וילות", matches: ["וילה", "וילות"] },
  { label: "דירות נופש", matches: ["דירת נופש", "דירות נופש"] },
  { label: "סוויטות", matches: ["סוויטות", "סוויטות יוקרה", "מתחם סוויטות"] },
  { label: "מערות", matches: ["מערה", "מערות"] },
  { label: "צימרים מאבן", matches: ["צימר מאבן", "צימרים מאבן"] },
  { label: "צימרים", matches: ["צימר", "צימרים"] },
  { label: "מתחמי אירוח", matches: ["מתחם אירוח", "מתחמי אירוח", "מתחם נופש", "מתחם סוויטות"] },
  { label: "אוהלים אינדיאנים", matches: ["אוהל אינדיאני", "אוהלים אינדיאנים"] },
] as const;

function normalizeAccommodationType(value: string) {
  const option = legacyAccommodationTypes.find((item) => item.label === value || item.matches.some((match) => match === value));
  return option?.label || value;
}

function normalizedLandingType(landing?: SearchLandingContext) {
  if (!landing?.type) return null;
  const normalized = normalizeAccommodationType(landing.type);
  return normalized === "הכל" ? null : normalized;
}

function matchesAnyAccommodationType(propertyType: string, selectedTypes: string[], landing?: SearchLandingContext) {
  if (selectedTypes.length === 0) return true;
  return selectedTypes.some((selectedType) => {
    const legacyType = legacyAccommodationTypes.find((item) => item.label === selectedType);
    const matchingTypes = landing?.types?.length && selectedType === landing.type ? landing.types : legacyType?.matches;
    return matchingTypes ? matchingTypes.includes(propertyType) : propertyType === selectedType;
  });
}

const legacyExtraFilterGroups = [
  { title: "כללי", options: [
    { id: "accessible", label: "נגישות לנכים", matches: ["נגיש"] },
    { id: "pets", label: "מקבלים בעלי חיים", matches: ["בעלי חיים", "חיות מחמד"] },
    { id: "business-license", label: "רישיון עסק", matches: ["רישיון עסק"] },
    { id: "free-parking", label: "חניה חינם", matches: ["חניה חינם"] },
    { id: "private-units", label: "יחידות", matches: ["יחידות"] },
    { id: "isolated", label: "מבודדת", matches: ["מבודד", "מבודדת"] },
    { id: "religious-complex", label: "מתחמים שומרי שבת", matches: ["שומרי שבת"] },
  ] },
  { title: "מתחם חיצוני", options: [
    { id: "pool", label: "בריכה", matches: ["בריכה"] },
    { id: "covered-heated-pool", label: "בריכת שחייה מחוממת ומקורה", matches: ["בריכה מחוממת ומקורה"] },
    { id: "children-pool", label: "בריכת ילדים", matches: ["בריכת ילדים"] },
    { id: "sauna", label: "סאונה", matches: ["סאונה"] },
    { id: "spa", label: "ספא", matches: ["ספא"] },
    { id: "private-pool", label: "בריכת שחייה פרטית", matches: ["בריכה פרטית"] },
    { id: "current-pool", label: "בריכת זרמים", matches: ["בריכת זרמים"] },
    { id: "jacuzzi", label: "ג׳קוזי", matches: ["ג׳קוזי", "ג'קוזי"] },
    { id: "outdoor-sound", label: "מערכת הגברה", matches: ["מערכת הגברה"] },
    { id: "heated-pool", label: "בריכת שחייה מחוממת", matches: ["בריכה מחוממת"] },
    { id: "fenced-pool", label: "בריכת שחייה מגודרת", matches: ["בריכה מגודרת"] },
    { id: "covered-hot-tub", label: "ג׳קוזי ספא מחומם ומקורה", matches: ["ג׳קוזי ספא מחומם ומקורה", "ג'קוזי ספא מחומם ומקורה"] },
    { id: "barbecue", label: "פינת מנגל", matches: ["מנגל", "ברביקיו"] },
    { id: "steam-sauna", label: "סאונה רטובה", matches: ["סאונה רטובה"] },
  ] },
  { title: "מתחם פנימי", options: [
    { id: "equipped-kitchen", label: "מטבח מאובזר", matches: ["מטבח מאובזר"] },
    { id: "wifi", label: "אינטרנט אלחוטי", matches: ["אינטרנט אלחוטי", "WiFi", "WIFI"] },
    { id: "fireplace", label: "קמין עצים", matches: ["קמין עצים", "קמין"] },
    { id: "projector", label: "מקרן", matches: ["מקרן"] },
    { id: "indoor-jacuzzi", label: "ג׳קוזי", matches: ["ג׳קוזי", "ג'קוזי"] },
    { id: "karaoke", label: "עמדת קריוקי", matches: ["קריוקי"] },
    { id: "indoor-sound", label: "מערכת הגברה", matches: ["מערכת הגברה"] },
    { id: "indoor-spa", label: "ג׳קוזי ספא", matches: ["ג׳קוזי ספא", "ג'קוזי ספא"] },
    { id: "games-room", label: "חדר משחקים", matches: ["חדר משחקים"] },
  ] },
  { title: "קהלי יעד", options: [
    { id: "events", label: "מתאים לאירועים", matches: ["אירועים"] },
    { id: "fun-days", label: "ימי כיף", matches: ["ימי כיף"] },
    { id: "parties", label: "מסיבות", matches: ["מסיבות"] },
    { id: "bachelorette", label: "מסיבות רווקות", matches: ["מסיבת רווקות", "מסיבות רווקות"] },
    { id: "youth", label: "בני נוער", matches: ["בני נוער"] },
    { id: "groom-shabbat", label: "שבתות חתן", matches: ["שבת חתן", "שבתות חתן"] },
    { id: "families", label: "משפחות", matches: ["משפחות", "משפחה"] },
    { id: "team-building", label: "ערבי גיבוש", matches: ["ערבי גיבוש", "יום גיבוש"] },
    { id: "couples-only", label: "סוויטה לזוגות בלבד", matches: ["זוגות בלבד"] },
    { id: "proposals", label: "הצעות נישואין", matches: ["הצעת נישואין", "הצעות נישואין"] },
    { id: "mitzvah", label: "בר או בת מצווה", matches: ["בר מצווה", "בת מצווה"] },
    { id: "groups", label: "קבוצות", matches: ["קבוצות", "קבוצה"] },
    { id: "couples", label: "זוגות", matches: ["זוגות", "זוג"] },
    { id: "birthdays", label: "ימי הולדת", matches: ["יום הולדת", "ימי הולדת"] },
    { id: "bachelor", label: "מסיבת רווקים", matches: ["מסיבת רווקים"] },
    { id: "religious", label: "ציבור דתי", matches: ["ציבור דתי", "שומרי שבת"] },
    { id: "weddings", label: "חתונות", matches: ["חתונה", "חתונות"] },
  ] },
] as const;

type LegacyExtraFilter = { id: string; label: string; matches: readonly string[] };
const legacyExtraFilters = legacyExtraFilterGroups.reduce<LegacyExtraFilter[]>((items, group) => [...items, ...group.options], []);

const VACATION_PRICE_MIN = 0;
const VACATION_PRICE_MAX = Math.max(5000, ...properties.map((property) => property.price || 0));
const VACATION_SORT_VALUES = ["recommended", "price-asc", "price-desc", "rating-desc", "rating-asc", "capacity", "units", "name"] as const;
const vacationSortOptions = [
  { value: "recommended", label: "מומלצים" },
  { value: "price-asc", label: "מחיר מהנמוך לגבוה" },
  { value: "price-desc", label: "מחיר מהגבוה לנמוך" },
  { value: "rating-desc", label: "דירוג מהגבוה לנמוך" },
  { value: "rating-asc", label: "דירוג מהנמוך לגבוה" },
  { value: "capacity", label: "קיבולת גבוהה" },
  { value: "units", label: "מספר יחידות" },
  { value: "name", label: "שם המקום" },
];

function compareOptionalNumber(first: number | undefined, second: number | undefined, direction: "asc" | "desc") {
  const firstKnown = typeof first === "number" && Number.isFinite(first);
  const secondKnown = typeof second === "number" && Number.isFinite(second);
  if (!firstKnown && !secondKnown) return 0;
  if (!firstKnown) return 1;
  if (!secondKnown) return -1;
  return direction === "asc" ? first - second : second - first;
}

function compareVacationProperties(a: (typeof properties)[number], b: (typeof properties)[number], sort: string) {
  if (sort === "price-asc") return compareOptionalNumber(a.price, b.price, "asc") || properties.indexOf(a) - properties.indexOf(b);
  if (sort === "price-desc") return compareOptionalNumber(a.price, b.price, "desc") || properties.indexOf(a) - properties.indexOf(b);
  if (sort === "rating-desc") return compareOptionalNumber(a.score, b.score, "desc") || properties.indexOf(a) - properties.indexOf(b);
  if (sort === "rating-asc") return compareOptionalNumber(a.score, b.score, "asc") || properties.indexOf(a) - properties.indexOf(b);
  if (sort === "capacity") return b.guests - a.guests;
  if (sort === "units") return (b.units || 1) - (a.units || 1);
  if (sort === "name") return a.name.localeCompare(b.name, "he");
  return properties.indexOf(a) - properties.indexOf(b);
}
const VACATION_PRICE_STEP = 50;

const availabilityDemoCopy = {
  he: { title: "\u05d3\u05d5\u05d2\u05de\u05d0\u05d5\u05ea \u05dc\u05d6\u05de\u05d9\u05e0\u05d5\u05ea \u05d5\u05dc\u05de\u05d7\u05d9\u05e8 \u05d1\u05ea\u05d0\u05e8\u05d9\u05db\u05d9\u05dd \u05e9\u05d1\u05d7\u05e8\u05ea\u05dd", text: "\u05d4\u05ea\u05d5\u05e6\u05d0\u05d5\u05ea \u05de\u05d3\u05d2\u05d9\u05de\u05d5\u05ea \u05d0\u05ea \u05db\u05dc \u05de\u05e6\u05d1\u05d9 \u05d4\u05d6\u05de\u05d9\u05e0\u05d5\u05ea \u05d5\u05d4\u05de\u05d7\u05d9\u05e8 \u05dc\u05e4\u05d9 \u05de\u05d1\u05e0\u05d9 \u05d4\u05ea\u05e6\u05d5\u05d2\u05d4 \u05e9\u05dc VII \u05d4\u05d9\u05e9\u05df. \u05d6\u05d4\u05d5 \u05de\u05d9\u05d3\u05e2 \u05dc\u05d4\u05de\u05d7\u05e9\u05d4 \u05d5\u05dc\u05d0 \u05d6\u05de\u05d9\u05e0\u05d5\u05ea \u05d7\u05d9\u05d4." },
  en: { title: "Availability and price examples for your dates", text: "The results demonstrate every availability and price state based on the old VII display patterns. This is illustrative information, not live availability." },
  ru: { title: "\u041f\u0440\u0438\u043c\u0435\u0440\u044b \u043d\u0430\u043b\u0438\u0447\u0438\u044f \u0438 \u0446\u0435\u043d \u043d\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0435 \u0434\u0430\u0442\u044b", text: "\u0420\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u044b \u0434\u0435\u043c\u043e\u043d\u0441\u0442\u0440\u0438\u0440\u0443\u044e\u0442 \u0432\u0441\u0435 \u0441\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u044f \u043d\u0430\u043b\u0438\u0447\u0438\u044f \u0438 \u0446\u0435\u043d \u043f\u043e \u043e\u0431\u0440\u0430\u0437\u0446\u0443 \u0441\u0442\u0430\u0440\u043e\u0433\u043e VII. \u042d\u0442\u043e \u0438\u043b\u043b\u044e\u0441\u0442\u0440\u0430\u0446\u0438\u044f, \u0430 \u043d\u0435 \u043d\u0430\u043b\u0438\u0447\u0438\u0435 \u0432 \u0440\u0435\u0430\u043b\u044c\u043d\u043e\u043c \u0432\u0440\u0435\u043c\u0435\u043d\u0438." },
  fr: { title: "Exemples de disponibilit\u00e9 et de prix pour vos dates", text: "Les r\u00e9sultats pr\u00e9sentent tous les \u00e9tats de disponibilit\u00e9 et de prix inspir\u00e9s de l'ancien VII. Il s'agit d'une illustration, pas de disponibilit\u00e9s en direct." },
};


function normalizeVacationPrice(value: string | null, fallback: number) {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(VACATION_PRICE_MAX, Math.max(VACATION_PRICE_MIN, Math.round(parsed / VACATION_PRICE_STEP) * VACATION_PRICE_STEP));
}

function formatVacationPrice(value: number) {
  return `${value.toLocaleString("he-IL")} ₪`;
}

export function SearchExperience({ landing }: { landing?: SearchLandingContext }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.toString();
  const { language, translate } = useSiteLanguage();
  const landingType = normalizedLandingType(landing);
  const [sort, setSort] = useState("recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterSection, setFilterSection] = useState<"types" | "more">("types");
  const { mapOpen, openMap, closeMap } = useMapViewState();
  const { viewMode, setViewMode } = useResultsViewMode("vacation");
  const [area, setArea] = useState(landing?.area || "הכל");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(landingType ? [landingType] : []);
  const [guests, setGuests] = useState(2);
  const [minPrice, setMinPrice] = useState(VACATION_PRICE_MIN);
  const [maxPrice, setMaxPrice] = useState(VACATION_PRICE_MAX);
  const [pool, setPool] = useState(false);
  const [spa, setSpa] = useState(false);
  const [whole, setWhole] = useState(false);
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [draftFilters, setDraftFilters] = useState<VacationFilterState | null>(null);
  const [, setVisibleMapCount] = useState(0);
  const [mapVisibleIds, setMapVisibleIds] = useState<string[] | null>(null);

  const selectedStay = useMemo(() => vacationStayFromSearch(searchParams, language), [language, searchParams]);
  const requestedLocation = searchParams.get("location");
  const availabilityDemoActive = isAvailabilityDemoSearch(selectedStay, requestedLocation);

  useEffect(() => {
    if (!selectedStay || (!searchParams.get("dates") && searchParams.get("from") && searchParams.get("till"))) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("dates");
    if (!params.get("from")) params.set("from", selectedStay.from);
    if (!params.get("till")) params.set("till", selectedStay.till);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams, selectedStay]);

  function updateSearchContext(updates: Record<string, string | null>, nextTypes = selectedTypes, nextArea = area) {
    const nextUrl = buildVacationSearchUrl(window.location.search, updates, nextTypes, nextArea);
    router.push(localizedPath(nextUrl, language), { scroll: false });
  }

  function currentFilterState(): VacationFilterState {
    return { area, selectedTypes, guests, minPrice, maxPrice, pool, spa, whole, accessibleOnly, selectedExtras, sort };
  }

  function openFiltersPanel(section: "types" | "more" = filterSection) {
    setFilterSection(section);
    setDraftFilters(currentFilterState());
    setFiltersOpen(true);
  }

  function closeFiltersPanel() {
    setDraftFilters(null);
    setFiltersOpen(false);
  }

  function changeArea(nextArea: string) {
    if (filtersOpen && draftFilters) {
      setDraftFilters({ ...draftFilters, area: nextArea });
      return;
    }
    setArea(nextArea);
    updateSearchContext({ location: nextArea === "הכל" ? "כל הארץ" : nextArea }, selectedTypes, nextArea);
  }

  function changeGuests(nextGuests: number) {
    if (filtersOpen && draftFilters) {
      setDraftFilters({ ...draftFilters, guests: nextGuests });
      return;
    }
    setGuests(nextGuests);
    updateSearchContext({ guests: nextGuests === 2 ? null : String(nextGuests) });
  }

  function changePriceRange(nextMinimum: number, nextMaximum: number) {
    const normalizedMinimum = Math.min(normalizeVacationPrice(String(nextMinimum), VACATION_PRICE_MIN), nextMaximum);
    const normalizedMaximum = Math.max(normalizeVacationPrice(String(nextMaximum), VACATION_PRICE_MAX), normalizedMinimum);
    if (filtersOpen && draftFilters) {
      setDraftFilters({ ...draftFilters, minPrice: normalizedMinimum, maxPrice: normalizedMaximum });
      return;
    }
    setMinPrice(normalizedMinimum);
    setMaxPrice(normalizedMaximum);
    updateSearchContext({
      minPrice: normalizedMinimum === VACATION_PRICE_MIN ? null : String(normalizedMinimum),
      maxPrice: normalizedMaximum === VACATION_PRICE_MAX ? null : String(normalizedMaximum),
    });
  }

  function toggleType(nextType: string) {
    if (filtersOpen && draftFilters) {
      const nextTypes = draftFilters.selectedTypes.includes(nextType)
        ? draftFilters.selectedTypes.filter((item) => item !== nextType)
        : [...draftFilters.selectedTypes, nextType];
      setDraftFilters({ ...draftFilters, selectedTypes: nextTypes });
      return;
    }
    const currentTypes = selectedTypes.length
      ? selectedTypes
      : landingType ? [landingType] : [];
    const nextTypes = currentTypes.includes(nextType)
      ? currentTypes.filter((item) => item !== nextType)
      : [...currentTypes, nextType];
    setSelectedTypes(nextTypes);
    updateSearchContext({ type: null, types: nextTypes.length > 1 ? nextTypes.join(",") : null }, nextTypes, area);
  }

  function changeBinaryFilter(key: "pool" | "spa" | "whole" | "accessible", nextValue: boolean) {
    if (filtersOpen && draftFilters) {
      const field = key === "accessible" ? "accessibleOnly" : key;
      setDraftFilters({ ...draftFilters, [field]: nextValue });
      return;
    }
    if (key === "pool") setPool(nextValue);
    if (key === "spa") setSpa(nextValue);
    if (key === "whole") setWhole(nextValue);
    if (key === "accessible") setAccessibleOnly(nextValue);
    updateSearchContext({ [key]: nextValue ? "1" : null });
  }

  function toggleExtraFilter(id: string) {
    if (filtersOpen && draftFilters) {
      const nextExtras = draftFilters.selectedExtras.includes(id) ? draftFilters.selectedExtras.filter((item) => item !== id) : [...draftFilters.selectedExtras, id];
      setDraftFilters({ ...draftFilters, selectedExtras: nextExtras });
      return;
    }
    const nextExtras = selectedExtras.includes(id) ? selectedExtras.filter((item) => item !== id) : [...selectedExtras, id];
    setSelectedExtras(nextExtras);
    updateSearchContext({ features: nextExtras.length ? nextExtras.join(",") : null });
  }

  function changeSort(nextSort: string) {
    if (filtersOpen && draftFilters) {
      setDraftFilters({ ...draftFilters, sort: nextSort });
      return;
    }
    setSort(nextSort);
    updateSearchContext({ sort: nextSort === "recommended" ? null : nextSort });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchQuery);
      const requestedArea = params.get("location");
      const requestedGuests = Number(params.get("guests") || (Number(params.get("adults") || 2) + Number(params.get("children") || 0)));
      const requestedMinPrice = normalizeVacationPrice(params.get("minPrice"), VACATION_PRICE_MIN);
      const requestedMaxPrice = normalizeVacationPrice(params.get("maxPrice"), VACATION_PRICE_MAX);
      const requestedType = params.get("type");
      const requestedTypes = (params.get("types") || requestedType || "")
        .split(",")
        .map(normalizeAccommodationType)
        .filter((label) => legacyAccommodationTypes.some((item) => item.label === label));
      const requestedPath = requestedTypes.length === 1
        ? cleanAccommodationPath(requestedTypes[0], requestedArea || "כל הארץ")
        : cleanVacationPath(requestedArea || "כל הארץ");
      if (!landing && requestedPath) {
        params.delete("location");
        params.delete("type");
        if (requestedTypes.length <= 1) params.delete("types");
        if (requestedGuests === 2) params.delete("guests");
        const query = params.toString();
        router.replace(localizedPath(query ? `${requestedPath}?${query}` : requestedPath, language), { scroll: false });
        return;
      }
      if (requestedArea && !isWholeCountrySelection(requestedArea)) setArea(requestedArea);
      else if (landing?.area) setArea(landing.area);
      else setArea("הכל");
      if (Number.isFinite(requestedGuests)) setGuests(Math.max(1, requestedGuests));
      setMinPrice(Math.min(requestedMinPrice, requestedMaxPrice));
      setMaxPrice(Math.max(requestedMinPrice, requestedMaxPrice));
      if (requestedTypes.length) setSelectedTypes(requestedTypes);
      else if (landingType) setSelectedTypes([landingType]);
      else setSelectedTypes([]);
      setPool(params.get("pool") === "1");
      setSpa(params.get("spa") === "1");
      setWhole(params.get("whole") === "1");
      setAccessibleOnly(params.get("accessible") === "1");
      setSelectedExtras((params.get("features") || "").split(",").filter((id) => legacyExtraFilters.some((item) => item.id === id)));
      setSort(VACATION_SORT_VALUES.includes((params.get("sort") || "recommended") as (typeof VACATION_SORT_VALUES)[number]) ? params.get("sort") || "recommended" : "recommended");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [landing, landingType, language, router, searchQuery]);

  useEffect(() => {
    if (!filtersOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeFiltersPanel();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [filtersOpen]);

  const shownFilters = filtersOpen && draftFilters ? draftFilters : currentFilterState();

  const mapCandidates = useMemo(() => properties.filter((property) => {
      const matchesType = matchesAnyAccommodationType(property.type, selectedTypes, landing);
      const matchesGuests = property.guests >= guests;
      const priceFilterActive = minPrice > VACATION_PRICE_MIN || maxPrice < VACATION_PRICE_MAX;
      const matchesPrice = !priceFilterActive || (typeof property.price === "number" && property.price >= minPrice && property.price <= maxPrice);
      const matchesPool = !pool || property.features.some((feature) => feature.includes("בריכ"));
      const matchesSpa = !spa || property.features.some((feature) => feature.includes("ג'קוזי") || feature.includes("ספא") || feature.includes("סאונה"));
      const matchesWhole = !whole || property.scenario === "single";
      const matchesAccessibility = !accessibleOnly || getPlaceAccessibility(property.slug).status === "accessible";
      const searchableFacts = [property.description, property.type, property.location, property.area, ...property.features].join(" ").toLocaleLowerCase("he");
      const matchesExtras = selectedExtras.every((id) => {
        if (id === "accessible") return getPlaceAccessibility(property.slug).status === "accessible";
        const option = legacyExtraFilters.find((item) => item.id === id);
        return option ? option.matches.some((term) => searchableFacts.includes(term.toLocaleLowerCase("he"))) : false;
      });
      return matchesType && matchesGuests && matchesPrice && matchesPool && matchesSpa && matchesWhole && matchesAccessibility && matchesExtras;
    }), [accessibleOnly, guests, landing, maxPrice, minPrice, pool, selectedExtras, selectedTypes, spa, whole]);

  const filtered = useMemo(() => {
    const useLandingSet = Boolean(landing?.listingSlugs?.length
      && (!landingType || (selectedTypes.length === 1 && selectedTypes[0] === landingType))
      && (landing.area ? area === landing.area : area === "הכל"));
    const matches = mapCandidates.filter((property) => useLandingSet ? landing?.listingSlugs?.includes(property.slug) : matchesSearchLocation(property, area));
    return [...matches].sort((a, b) => {
      const availabilityPriority = Number(hasAvailablePriceForSearch(b, selectedStay, pathname, requestedLocation))
        - Number(hasAvailablePriceForSearch(a, selectedStay, pathname, requestedLocation));
      if (availabilityPriority) return availabilityPriority;
      if (sort === "recommended" && availabilityDemoActive) {
        const aDemoIndex = availabilityDemoSlugs.indexOf(a.slug);
        const bDemoIndex = availabilityDemoSlugs.indexOf(b.slug);
        if (aDemoIndex >= 0 || bDemoIndex >= 0) {
          if (aDemoIndex < 0) return 1;
          if (bDemoIndex < 0) return -1;
          return aDemoIndex - bDemoIndex;
        }
      }
      return compareVacationProperties(a, b, sort);
    });
  // landingType is derived from the immutable landing prop. Keeping the prop in
  // the dependency list lets the compiler preserve this memo across renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, availabilityDemoActive, landing, mapCandidates, pathname, requestedLocation, selectedStay, selectedTypes, sort]);

  const draftCandidates = properties.filter((property) => {
    const matchesType = matchesAnyAccommodationType(property.type, shownFilters.selectedTypes, landing);
    const searchableFacts = [property.description, property.type, property.location, property.area, ...property.features].join(" ").toLocaleLowerCase("he");
    const matchesExtras = shownFilters.selectedExtras.every((id) => {
      if (id === "accessible") return getPlaceAccessibility(property.slug).status === "accessible";
      const option = legacyExtraFilters.find((item) => item.id === id);
      return option ? option.matches.some((term) => searchableFacts.includes(term.toLocaleLowerCase("he"))) : false;
    });
    const priceFilterActive = shownFilters.minPrice > VACATION_PRICE_MIN || shownFilters.maxPrice < VACATION_PRICE_MAX;
    const matchesPrice = !priceFilterActive || (typeof property.price === "number" && property.price >= shownFilters.minPrice && property.price <= shownFilters.maxPrice);
    return matchesType
      && property.guests >= shownFilters.guests
      && matchesPrice
      && (!shownFilters.pool || property.features.some((feature) => feature.includes("בריכ")))
      && (!shownFilters.spa || property.features.some((feature) => feature.includes("ג'קוזי") || feature.includes("ספא") || feature.includes("סאונה")))
      && (!shownFilters.whole || property.scenario === "single")
      && (!shownFilters.accessibleOnly || getPlaceAccessibility(property.slug).status === "accessible")
      && matchesExtras;
  });
  const draftUsesLandingSet = Boolean(landing?.listingSlugs?.length
      && (!landingType || (shownFilters.selectedTypes.length === 1 && shownFilters.selectedTypes[0] === landingType))
    && (landing.area ? shownFilters.area === landing.area : shownFilters.area === "הכל"));
  const draftResultCount = draftCandidates.filter((property) => draftUsesLandingSet ? landing?.listingSlugs?.includes(property.slug) : matchesSearchLocation(property, shownFilters.area)).length;
  const draftResultLabel = draftResultCount === 1 ? "הצגת מקום אחד" : `הצגת ${draftResultCount} מקומות`;

  const displayedResults = useMemo(() => {
    if (!mapOpen || !mapVisibleIds) return filtered;
    const visible = new Set(mapVisibleIds);
    return mapCandidates.filter((property) => visible.has(property.slug)).sort((a, b) => {
      const availabilityPriority = Number(hasAvailablePriceForSearch(b, selectedStay, pathname, requestedLocation))
        - Number(hasAvailablePriceForSearch(a, selectedStay, pathname, requestedLocation));
      if (availabilityPriority) return availabilityPriority;
      return compareVacationProperties(a, b, sort);
    });
  }, [filtered, mapCandidates, mapOpen, mapVisibleIds, pathname, requestedLocation, selectedStay, sort]);
  const inventorySummary = useMemo(() => vacationInventorySummary(displayedResults, language), [displayedResults, language]);
  const detailQuery = useMemo(() => {
    const params = new URLSearchParams();
    const from = searchParams.get("from");
    const till = searchParams.get("till");
    const rooms = searchParams.get("rooms");
    if (!(from && till)) return "";
    params.set("source", "search");
    if (from) params.set("from", from);
    if (till) params.set("till", till);
    params.set("guests", String(guests));
    if (rooms) params.set("rooms", rooms);
    return params.toString();
  }, [guests, searchParams]);
  const detailHref = (slug: string) => `/business?id=${slug}${detailQuery ? `&${detailQuery}` : ""}`;

  useEffect(() => {
    const timer = window.setTimeout(() => setMapVisibleIds(null), 0);
    return () => window.clearTimeout(timer);
  }, [area, selectedTypes, guests, minPrice, maxPrice, pool, spa, whole, accessibleOnly, selectedExtras, sort, searchQuery]);

  function openResultsMap() {
    setMapVisibleIds(null);
    setVisibleMapCount(filtered.length);
    openMap();
  }

  function closeResultsMap() {
    setMapVisibleIds(null);
    closeMap();
  }

  const activeFilters = [
    area !== "הכל" ? { id: "area", label: area, remove: () => changeArea("הכל") } : null,
    ...selectedTypes.map((selectedType) => ({ id: `type-${selectedType}`, label: selectedType, remove: () => toggleType(selectedType) })),
    guests > 2 ? { id: "guests", label: `${guests} אורחים ומעלה`, remove: () => changeGuests(2) } : null,
    minPrice > VACATION_PRICE_MIN || maxPrice < VACATION_PRICE_MAX ? { id: "price", label: `${formatVacationPrice(minPrice)} עד ${formatVacationPrice(maxPrice)}`, remove: () => changePriceRange(VACATION_PRICE_MIN, VACATION_PRICE_MAX) } : null,
    pool ? { id: "pool", label: "בריכה", remove: () => changeBinaryFilter("pool", false) } : null,
    spa ? { id: "spa", label: "ספא וג'קוזי", remove: () => changeBinaryFilter("spa", false) } : null,
    whole ? { id: "whole", label: "מקום שלם", remove: () => changeBinaryFilter("whole", false) } : null,
    accessibleOnly ? { id: "accessible", label: "נגישות מלאה ומאומתת", remove: () => changeBinaryFilter("accessible", false) } : null,
    ...selectedExtras.map((id) => {
      const option = legacyExtraFilters.find((item) => item.id === id);
      return option ? { id: `extra-${id}`, label: option.label, remove: () => toggleExtraFilter(id) } : null;
    }),
  ].filter((filter): filter is { id: string; label: string; remove: () => void } => Boolean(filter));

  const contextualSearchSuggestions: ContextualSearchSuggestion[] = [
    ...legacyAccommodationTypes
      .filter((item) => !selectedTypes.includes(item.label))
      .map((item) => ({ label: item.label, params: { type: null, types: item.label } })),
    ...[
      { label: "נופש עם בריכה", active: pool, params: { pool: "1" } as Record<string, string | null> },
      { label: "נופש עם ספא וג'קוזי", active: spa, params: { spa: "1" } as Record<string, string | null> },
      { label: "מקומות שלמים", active: whole, params: { whole: "1" } as Record<string, string | null> },
      { label: "נופש נגיש", active: accessibleOnly, params: { accessible: "1" } as Record<string, string | null> },
    ].filter((item) => !item.active).map(({ label, params }) => ({ label, params })),
  ];

  const breadcrumbFilterLabels = [
    area !== "הכל" ? area : null,
    ...selectedTypes,
    guests > 2 ? `${guests} אורחים ומעלה` : null,
    minPrice > VACATION_PRICE_MIN || maxPrice < VACATION_PRICE_MAX ? `${formatVacationPrice(minPrice)} עד ${formatVacationPrice(maxPrice)}` : null,
    ...selectedExtras.map((id) => legacyExtraFilters.find((item) => item.id === id)?.label || null),
  ].filter((item): item is string => Boolean(item));
  const breadcrumbItems = [
    { name: "ראשי", path: "/" },
    { name: "נופש", path: breadcrumbFilterLabels.length || landing ? "/search" : undefined },
    ...(breadcrumbFilterLabels.length || landing ? [{ name: landing?.breadcrumb || breadcrumbFilterLabels.join(" · ") || "תוצאות חיפוש" }] : []),
  ];

  function resetFilters() {
    if (filtersOpen) {
      setDraftFilters({ area, selectedTypes: [], guests, minPrice: VACATION_PRICE_MIN, maxPrice: VACATION_PRICE_MAX, pool: false, spa: false, whole: false, accessibleOnly: false, selectedExtras: [], sort: "recommended" });
      return;
    }
    setArea("הכל");
    setSelectedTypes([]);
    setGuests(2);
    setMinPrice(VACATION_PRICE_MIN);
    setMaxPrice(VACATION_PRICE_MAX);
    setPool(false);
    setSpa(false);
    setWhole(false);
    setAccessibleOnly(false);
    setSelectedExtras([]);
    updateSearchContext({ location: "כל הארץ", guests: null, type: null, types: null, minPrice: null, maxPrice: null, pool: null, spa: null, whole: null, accessible: null, features: null, sort: null }, [], "הכל");
  }

  function applyFilters() {
    if (!draftFilters) {
      closeFiltersPanel();
      return;
    }
    setArea(draftFilters.area);
    setSelectedTypes(draftFilters.selectedTypes);
    setGuests(draftFilters.guests);
    setMinPrice(draftFilters.minPrice);
    setMaxPrice(draftFilters.maxPrice);
    setPool(draftFilters.pool);
    setSpa(draftFilters.spa);
    setWhole(draftFilters.whole);
    setAccessibleOnly(draftFilters.accessibleOnly);
    setSelectedExtras(draftFilters.selectedExtras);
    setSort(draftFilters.sort);
    updateSearchContext({
      location: draftFilters.area === "הכל" ? "כל הארץ" : draftFilters.area,
      type: null,
      types: draftFilters.selectedTypes.length > 1 ? draftFilters.selectedTypes.join(",") : null,
      guests: draftFilters.guests === 2 ? null : String(draftFilters.guests),
      minPrice: draftFilters.minPrice === VACATION_PRICE_MIN ? null : String(draftFilters.minPrice),
      maxPrice: draftFilters.maxPrice === VACATION_PRICE_MAX ? null : String(draftFilters.maxPrice),
      pool: draftFilters.pool ? "1" : null,
      spa: draftFilters.spa ? "1" : null,
      whole: draftFilters.whole ? "1" : null,
      accessible: draftFilters.accessibleOnly ? "1" : null,
      features: draftFilters.selectedExtras.length ? draftFilters.selectedExtras.join(",") : null,
      sort: draftFilters.sort === "recommended" ? null : draftFilters.sort,
    }, draftFilters.selectedTypes, draftFilters.area);
    closeFiltersPanel();
  }

  return (
    <PageShell footerTopic={footerTopicForPropertyType(selectedTypes[0] || "הכל")}>
      <main id="main-content" className="results-page">
        <div className="results-search shell"><SearchBox compact initialLocation={area === "הכל" ? "כל הארץ" : area} initialGuests={guests} basePath={selectedTypes.length <= 1 ? landing?.path : undefined} vacationType={selectedTypes.length === 1 ? selectedTypes[0] : undefined} /></div>
        <BreadcrumbTrail items={breadcrumbItems} />
        <div className={`shell results-layout airbnb-results-layout ${mapOpen ? "with-map" : ""}`}>
          <aside className={`filter-panel ${filtersOpen ? "open" : ""} ${mapOpen ? "map-mode" : ""}`} aria-label="סינון תוצאות" role={filtersOpen ? "dialog" : undefined} aria-modal={filtersOpen || undefined}>
            <div className="filter-panel__scroll">
              <div className="filter-head"><h2>סינון תוצאות</h2><button type="button" onClick={closeFiltersPanel} aria-label="סגירה"><CloseIcon /></button></div>
              <div className="vacation-filter-sections" aria-label="קטגוריות סינון">
                <button type="button" className={filterSection === "types" ? "active" : ""} aria-pressed={filterSection === "types"} onClick={() => setFilterSection("types")}>סוגי אירוח</button>
                <button type="button" className={filterSection === "more" ? "active" : ""} aria-pressed={filterSection === "more"} onClick={() => setFilterSection("more")}>סינונים נוספים</button>
              </div>
              <div className="filter-panel__mobile-sort">
                <ModernSelect label="מיון לפי" value={shownFilters.sort} onChange={changeSort} options={vacationSortOptions} />
              </div>
              {mapOpen && <div className="map-filter-status" aria-live="polite"><PinIcon /><span>האזור שמוצג במפה</span><strong>{area === "הכל" ? "כל הארץ" : area}</strong></div>}
              {filterSection === "types" ? <fieldset className="vacation-type-options"><legend>סוגי אירוח, אפשר לבחור כמה אפשרויות</legend>{legacyAccommodationTypes.map((item) => <label key={item.label}><input type="checkbox" checked={shownFilters.selectedTypes.includes(item.label)} onChange={() => toggleType(item.label)} /> {item.label}</label>)}</fieldset> : <div className="vacation-more-filters">
                <fieldset className="vacation-price-filter">
                  <legend>מחיר ללילה</legend>
                  <p>בחרו את המחיר הנמוך והגבוה שמתאים לכם.</p>
                  <output className="vacation-price-filter__summary" aria-live="polite"><span>מ־<bdi>{shownFilters.minPrice.toLocaleString("he-IL")}</bdi> ₪</span><i aria-hidden="true">עד</i><span><bdi>{shownFilters.maxPrice.toLocaleString("he-IL")}</bdi> ₪</span></output>
                  <div className="vacation-price-filter__inputs">
                    <label><span>מחיר מינימלי</span><span className="vacation-price-input"><input type="number" inputMode="numeric" min={VACATION_PRICE_MIN} max={shownFilters.maxPrice} step={VACATION_PRICE_STEP} value={shownFilters.minPrice} aria-label="מחיר מינימום בשקלים" onChange={(event) => changePriceRange(Number(event.target.value), shownFilters.maxPrice)} /><b aria-hidden="true">₪</b></span></label>
                    <span aria-hidden="true">עד</span>
                    <label><span>מחיר מקסימלי</span><span className="vacation-price-input"><input type="number" inputMode="numeric" min={shownFilters.minPrice} max={VACATION_PRICE_MAX} step={VACATION_PRICE_STEP} value={shownFilters.maxPrice} aria-label="מחיר מקסימום בשקלים" onChange={(event) => changePriceRange(shownFilters.minPrice, Number(event.target.value))} /><b aria-hidden="true">₪</b></span></label>
                  </div>
                </fieldset>
                <div className="vacation-extra-groups">{legacyExtraFilterGroups.map((group) => <fieldset key={group.title}><legend>{group.title}</legend>{group.options.map((item) => <label key={item.id}><input type="checkbox" checked={shownFilters.selectedExtras.includes(item.id)} onChange={() => toggleExtraFilter(item.id)} /> {item.label}</label>)}</fieldset>)}</div>
              </div>}
            </div>
            <div className="filter-panel__actions">
              <button type="button" className="button primary filter-apply" onClick={applyFilters}>{draftResultLabel}</button>
              <button type="button" className="button subtle wide filter-reset" onClick={resetFilters}>ניקוי סינונים</button>
            </div>
          </aside>

          <section className="results-list" aria-label="תוצאות">
            <section className="results-heading">
              <div><h1>{translate(landing?.title || (area === "הכל" ? "נופש ברחבי הארץ" : `נופש ב${area}`))}</h1><div className="results-heading__meta"><p className="results-heading__inventory" aria-live="polite">{inventorySummary}</p></div></div>
            </section>
            <nav className="search-quick-filters" aria-label="סינון מהיר">
              <button type="button" className={activeFilters.length ? "primary-filter active" : "primary-filter"} onClick={() => openFiltersPanel()}><FilterControlIcon /><span>מסננים</span>{activeFilters.length ? <b>{activeFilters.length}</b> : null}</button>
              <button type="button" className={selectedTypes.length ? "active" : ""} onClick={() => openFiltersPanel("types")}>סוג מקום</button>
              <button type="button" className={minPrice > VACATION_PRICE_MIN || maxPrice < VACATION_PRICE_MAX ? "active" : ""} onClick={() => openFiltersPanel("more")}>טווח מחיר</button>
              <button type="button" className={pool ? "active" : ""} aria-pressed={pool} onClick={() => changeBinaryFilter("pool", !pool)}>בריכה</button>
              <button type="button" className={spa ? "active" : ""} aria-pressed={spa} onClick={() => changeBinaryFilter("spa", !spa)}>ספא וג׳קוזי</button>
              <button type="button" className={whole ? "active" : ""} aria-pressed={whole} onClick={() => changeBinaryFilter("whole", !whole)}>מקום שלם</button>
              <button type="button" className={accessibleOnly ? "active" : ""} aria-pressed={accessibleOnly} onClick={() => changeBinaryFilter("accessible", !accessibleOnly)}>נגישות</button>
            </nav>
            {activeFilters.length > 0 && <div className="active-filter-row"><span>סינונים פעילים:</span>{activeFilters.map((filter) => <button key={filter.id} type="button" onClick={filter.remove} aria-label={`הסרת הסינון ${filter.label}`}>{filter.label} ×</button>)}<button type="button" className="clear-all" onClick={resetFilters}>ניקוי הכל</button></div>}
            {availabilityDemoActive ? <div className="availability-demo-summary" role="status"><strong>{availabilityDemoCopy[language].title}</strong><span>{availabilityDemoCopy[language].text}</span><small>{selectedStay?.from}{" "}{String.fromCharCode(183)}{" "}{selectedStay?.till}</small></div> : null}
            <div className="results-toolbar"><div className="results-toolbar__actions"><ResultsViewToggle value={viewMode} onChange={setViewMode} />{filtered.length > 0 && <button className={`button map-button mobile-map-fab ${mapOpen ? "active" : ""}`} type="button" aria-label={mapOpen ? "חזרה לתוצאות" : "הצגת תוצאות על המפה"} aria-pressed={mapOpen} onClick={(event) => { event.preventDefault(); event.stopPropagation(); if (mapOpen) closeResultsMap(); else openResultsMap(); }}><MapIcon /><span className="map-button__desktop-label">{mapOpen ? "חזרה לתוצאות" : "תצוגה על מפה"}</span><span className="map-button__mobile-label" aria-hidden="true">מפה</span></button>}</div><ModernSelect className="results-toolbar__sort" compact label="מיון לפי" value={sort} onChange={changeSort} options={vacationSortOptions} /></div>
            {!mapOpen && <div className={`result-cards results-view results-view--${viewMode}`}>{displayedResults.map((property) => <PropertyCard key={property.slug} property={property} selectedStay={selectedStay} detailHref={detailHref(property.slug)} />)}</div>}
            {mapOpen && <div className="airbnb-map-split">
              <div className={`airbnb-map-split__results result-cards results-view results-view--${viewMode}`}>{displayedResults.map((property) => <PropertyCard key={property.slug} property={property} selectedStay={selectedStay} detailHref={detailHref(property.slug)} />)}</div>
              <div className="airbnb-map-split__map"><DeferredListingMap listings={mapCandidates} initialListings={filtered} autoLoad detailQuery={detailQuery} onClose={closeResultsMap} onVisibleCountChange={setVisibleMapCount} onVisiblePlaceIdsChange={setMapVisibleIds} /></div>
            </div>}
            {(mapOpen && mapVisibleIds ? displayedResults.length === 0 : filtered.length === 0) && <div className="empty-state"><h2>לא נמצאה התאמה מדויקת</h2><p>אפשר לשנות אזור, להפחית את כמות האורחים או להסיר מאפיין.</p><button className="button primary" type="button" onClick={resetFilters}>ניקוי סינונים</button></div>}
            {landing && filtered.length > 0 && <>
              <section className="accommodation-landing-copy" aria-labelledby="accommodation-guide-title"><div><span className="eyebrow">מידע שימושי לפני שמזמינים</span><h2 id="accommodation-guide-title">{landing.guideTitle || `איך בוחרים ${landing.breadcrumb}`}</h2><p>{landing.description}</p></div><nav className="accommodation-landing-copy__links" aria-label={`מידע על ${landing.breadcrumb}`}><a href="#accommodation-guide">המדריך של העמוד</a><a href="#accommodation-faq">שאלות ותשובות של העמוד</a><Link href="/gift-card">גיפט קארד לחופשה</Link></nav></section>
              <section id="accommodation-guide" className="accommodation-page-guide" aria-labelledby="accommodation-page-guide-title"><span className="eyebrow">המדריך של העמוד</span><h2 id="accommodation-page-guide-title">{landing.guideTitle || `איך בוחרים ${landing.breadcrumb}`}</h2><div>{(landing.guideParagraphs || [landing.description]).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></section>
              {landing.faqs?.length ? <section id="accommodation-faq" className="accommodation-page-faq" aria-labelledby="accommodation-page-faq-title"><span className="eyebrow">תשובות ממוקדות לעמוד הזה</span><h2 id="accommodation-page-faq-title">שאלות ותשובות על {landing.breadcrumb}</h2><div>{landing.faqs.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section> : null}
            </>}
          </section>
        </div>
        <SearchAfterResults world="vacation" location={area} searchSuggestions={contextualSearchSuggestions} hideGuideAndFaq={Boolean(landing)} reviewHighlights={filtered.filter((property) => typeof property.score === "number").sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 3).map((property) => ({ name: property.name, href: `/business?id=${property.slug}`, rating: property.score || 0, reviews: property.reviews }))} />
        {filtersOpen && <button className="filter-backdrop" aria-label="סגירת סינון" onClick={closeFiltersPanel} />}
      </main>
    </PageShell>
  );
}

export default function SearchPage() {
  return <SearchExperience />;
}
