"use client";

import "./search-tablet.css";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DeferredListingMap, preloadListingMap } from "../components/deferred-listing-map";
import { ModernSelect } from "../components/modern-select";
import { StructuredData } from "../components/structured-data";
import { breadcrumbSchema, collectionSchema } from "../lib/seo";
import { SupplierCapacityNotice } from "../components/supplier-capacity-notice";
import { UnavailablePlaceNotice } from "../components/unavailable-place-notice";
import { PageShell } from "../components/page-shell";
import { availabilityDemoSlugs, hasAvailablePriceForSearch, isAvailabilityDemoSearch, PropertyCard, resolveAvailabilityForStay } from "../components/property-card";
import { type LegacyAvailabilityState, useLegacyAvailabilityBatch, useLegacyFlexibleAvailabilityBatch } from "../components/use-legacy-availability";
import { legacyAvailabilitySourceFor } from "../lib/legacy-availability-sources";
import { SearchBox } from "../components/search-box";
import { BreadcrumbTrail } from "../components/breadcrumb-trail";
import type { Property } from "../data/site-data";
import { supplierDisplayDescription } from "../data/supplier-display-text";
import { usePublishedCatalog } from "../lib/use-published-catalog";
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
import { dailyRotationCompare } from "../lib/daily-rotation";
import { flexibleVacationCandidates, flexibleVacationSearchFromParams } from "../lib/flexible-vacation-search";
import { useMapViewState } from "../components/map-view-state";
import { useViiLiveSearch } from "../components/use-vii-live-search";
import { FilterControlIcon } from "../components/filter-control-icon";
import { SearchAfterResults, type ContextualSearchSuggestion } from "../components/search-after-results";
import { ResultsViewToggle, useResultsViewMode } from "../components/results-view-toggle";
import { ProgressiveResults } from "../components/progressive-results";
import { trackSearchResults } from "../lib/analytics";
import { matchesVacationSearchFilter } from "../lib/vacation-search-filter-index";
import { vacationRoomGuests, vacationRoomsFromSearchParams } from "../lib/vacation-party";
import { nearbyPlacesForSelection } from "../lib/geography-search";
import { completeNearbyResults } from "../lib/nearby-recommendations";
import { NearbySearchNotice } from "../components/nearby-search-notice";
import { useManagedGeography } from "../components/use-managed-geography";
import { matchesVacationOnlineBooking } from "../lib/vacation-online-booking-filter";

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
  onlineOnly: boolean;
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
    const matchingTypes: readonly string[] | undefined = landing?.types?.length && selectedType === landing.type ? landing.types : legacyType?.matches;
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
const VACATION_SORT_VALUES = ["recommended", "price-asc", "price-desc", "rating-desc", "rating-asc", "capacity", "units", "name"] as const;

function compareOptionalNumber(first: number | undefined, second: number | undefined, direction: "asc" | "desc") {
  const firstKnown = typeof first === "number" && Number.isFinite(first);
  const secondKnown = typeof second === "number" && Number.isFinite(second);
  if (!firstKnown && !secondKnown) return 0;
  if (!firstKnown) return 1;
  if (!secondKnown) return -1;
  return direction === "asc" ? first - second : second - first;
}

function compareVacationProperties(a: Property, b: Property, sort: string, order: Property[]) {
  if (sort === "recommended") return dailyRotationCompare(a.slug, b.slug, "vacation-search");
  if (sort === "price-asc") return compareOptionalNumber(a.price, b.price, "asc") || order.indexOf(a) - order.indexOf(b);
  if (sort === "price-desc") return compareOptionalNumber(a.price, b.price, "desc") || order.indexOf(a) - order.indexOf(b);
  if (sort === "rating-desc") return compareOptionalNumber(a.score, b.score, "desc") || order.indexOf(a) - order.indexOf(b);
  if (sort === "rating-asc") return compareOptionalNumber(a.score, b.score, "asc") || order.indexOf(a) - order.indexOf(b);
  if (sort === "capacity" && order.some((property) => property.capacityScope !== "unit")) return b.guests - a.guests;
  if (sort === "units") return (b.units || 1) - (a.units || 1);
  if (sort === "name") return a.name.localeCompare(b.name, "he");
  return order.indexOf(a) - order.indexOf(b);
}
const availabilityDemoCopy = {
  he: { title: "\u05d3\u05d5\u05d2\u05de\u05d0\u05d5\u05ea \u05dc\u05d6\u05de\u05d9\u05e0\u05d5\u05ea \u05d5\u05dc\u05de\u05d7\u05d9\u05e8 \u05d1\u05ea\u05d0\u05e8\u05d9\u05db\u05d9\u05dd \u05e9\u05d1\u05d7\u05e8\u05ea\u05dd", text: "\u05d4\u05ea\u05d5\u05e6\u05d0\u05d5\u05ea \u05de\u05d3\u05d2\u05d9\u05de\u05d5\u05ea \u05d0\u05ea \u05db\u05dc \u05de\u05e6\u05d1\u05d9 \u05d4\u05d6\u05de\u05d9\u05e0\u05d5\u05ea \u05d5\u05d4\u05de\u05d7\u05d9\u05e8 \u05dc\u05e4\u05d9 \u05de\u05d1\u05e0\u05d9 \u05d4\u05ea\u05e6\u05d5\u05d2\u05d4 \u05e9\u05dc VII \u05d4\u05d9\u05e9\u05df. \u05d6\u05d4\u05d5 \u05de\u05d9\u05d3\u05e2 \u05dc\u05d4\u05de\u05d7\u05e9\u05d4 \u05d5\u05dc\u05d0 \u05d6\u05de\u05d9\u05e0\u05d5\u05ea \u05d7\u05d9\u05d4." },
  en: { title: "Availability and price examples for your dates", text: "The results demonstrate every availability and price state based on the old VII display patterns. This is illustrative information, not live availability." },
  ru: { title: "\u041f\u0440\u0438\u043c\u0435\u0440\u044b \u043d\u0430\u043b\u0438\u0447\u0438\u044f \u0438 \u0446\u0435\u043d \u043d\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0435 \u0434\u0430\u0442\u044b", text: "\u0420\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u044b \u0434\u0435\u043c\u043e\u043d\u0441\u0442\u0440\u0438\u0440\u0443\u044e\u0442 \u0432\u0441\u0435 \u0441\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u044f \u043d\u0430\u043b\u0438\u0447\u0438\u044f \u0438 \u0446\u0435\u043d \u043f\u043e \u043e\u0431\u0440\u0430\u0437\u0446\u0443 \u0441\u0442\u0430\u0440\u043e\u0433\u043e VII. \u042d\u0442\u043e \u0438\u043b\u043b\u044e\u0441\u0442\u0440\u0430\u0446\u0438\u044f, \u0430 \u043d\u0435 \u043d\u0430\u043b\u0438\u0447\u0438\u0435 \u0432 \u0440\u0435\u0430\u043b\u044c\u043d\u043e\u043c \u0432\u0440\u0435\u043c\u0435\u043d\u0438." },
  fr: { title: "Exemples de disponibilit\u00e9 et de prix pour vos dates", text: "Les r\u00e9sultats pr\u00e9sentent tous les \u00e9tats de disponibilit\u00e9 et de prix inspir\u00e9s de l'ancien VII. Il s'agit d'une illustration, pas de disponibilit\u00e9s en direct." },
};

const flexibleAvailabilityCopy = {
  he: { title: "קודם מוצגים סופי שבוע פנויים עם מחיר", text: "בדקנו קודם את סופי השבוע בחודש שבחרתם, ואז תאריכים בטווח הגמישות שבחרתם." },
  en: { title: "Available weekends with a price appear first", text: "We check the weekends in your selected month first, then dates within your flexibility range." },
  ru: { title: "Сначала показываем свободные выходные с ценой", text: "Сначала проверяем выходные в выбранном месяце, затем даты в пределах выбранной гибкости." },
  fr: { title: "Les week-ends disponibles avec un prix s'affichent d'abord", text: "Nous vérifions d'abord les week-ends du mois sélectionné, puis les dates dans votre marge de flexibilité." },
};


function normalizeVacationPrice(value: string | null, fallback: number, maximum: number) {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(VACATION_PRICE_MIN, Math.round(parsed)));
}

function formatVacationPrice(value: number) {
  return `${value.toLocaleString("he-IL")} ₪`;
}

type VacationPriceInputProps = {
  value: number;
  minimum: number;
  maximum: number;
  emptyValue: number;
  ariaLabel: string;
  onValueChange: (value: number) => void;
};

function VacationPriceInput({ value, minimum, maximum, emptyValue, ariaLabel, onValueChange }: VacationPriceInputProps) {
  const [draftValue, setDraftValue] = useState(String(value));
  const editingRef = useRef(false);
  const initialValueRef = useRef(value);
  const cancelNextBlurRef = useRef(false);
  const selectOnNextClickRef = useRef(false);

  useEffect(() => {
    if (!editingRef.current) setDraftValue(String(value));
  }, [value]);

  function commitDraft() {
    if (cancelNextBlurRef.current) {
      cancelNextBlurRef.current = false;
      editingRef.current = false;
      setDraftValue(String(initialValueRef.current));
      return;
    }
    const requestedValue = draftValue === "" ? emptyValue : Number(draftValue);
    const committedValue = Math.min(maximum, Math.max(minimum, normalizeVacationPrice(String(requestedValue), emptyValue, maximum)));
    editingRef.current = false;
    setDraftValue(String(committedValue));
    onValueChange(committedValue);
  }

  return (
    <span className="vacation-price-input">
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        enterKeyHint="done"
        maxLength={String(maximum).length}
        role="spinbutton"
        aria-label={ariaLabel}
        aria-valuemin={minimum}
        aria-valuemax={maximum}
        aria-valuenow={draftValue === "" ? undefined : Number(draftValue)}
        aria-valuetext={draftValue === "" ? undefined : formatVacationPrice(Number(draftValue))}
        value={draftValue}
        onFocus={(event) => {
          editingRef.current = true;
          initialValueRef.current = value;
          selectOnNextClickRef.current = true;
          const input = event.currentTarget;
          window.requestAnimationFrame(() => input.select());
        }}
        onClick={(event) => {
          if (!selectOnNextClickRef.current) return;
          selectOnNextClickRef.current = false;
          event.currentTarget.select();
        }}
        onChange={(event) => {
          const digitsOnly = event.currentTarget.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
          setDraftValue(digitsOnly);
          if (digitsOnly === "") return;
          const nextValue = Number(digitsOnly);
          if (nextValue >= minimum && nextValue <= maximum) onValueChange(nextValue);
        }}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            cancelNextBlurRef.current = true;
            setDraftValue(String(initialValueRef.current));
            onValueChange(initialValueRef.current);
            event.currentTarget.blur();
          }
        }}
      />
      <b aria-hidden="true">₪</b>
    </span>
  );
}

function runtimeProperty(value: unknown): Property {
  const property = value as Property;
  if (property.type !== "מקום אירוח") return { ...property, description: supplierDisplayDescription(property) };
  const searchable = `${property.name} ${property.description} ${property.features.slice(0, 8).join(" ")}`;
  const inferredType = /וילה/.test(searchable) ? "וילה" : /בקת/.test(searchable) ? "בקתות עץ" : /סוויט/.test(searchable) ? "סוויטות" : /דיר/.test(searchable) ? "דירות נופש" : /צימר/.test(searchable) ? "צימרים" : "מתחם אירוח";
  return { ...property, type: inferredType, description: supplierDisplayDescription(property) };
}

export function SearchExperience({ landing }: { landing?: SearchLandingContext }) {
  const { items: properties, error: catalogError, loading: catalogLoading } = usePublishedCatalog("vacations", runtimeProperty);
  const [visibleResultCount, setVisibleResultCount] = useState(9);
  const supplierTypeFilterAvailable = useMemo(() => properties.some((property) => property.type !== "מקום אירוח"), [properties]);
  const supplierPriceFilterAvailable = useMemo(() => properties.some((property) => typeof property.price === "number"), [properties]);
  const VACATION_PRICE_MAX = useMemo(() => Math.max(5000, ...properties.map((property) => property.price || 0)), [properties]);
  const vacationSortOptions = [
    { value: "recommended", label: "התאמה מומלצת" },
    ...(supplierPriceFilterAvailable ? [{ value: "price-asc", label: "מחיר מהנמוך לגבוה" }, { value: "price-desc", label: "מחיר מהגבוה לנמוך" }] : []),
    { value: "rating-desc", label: "דירוג מהגבוה לנמוך" },
    { value: "rating-asc", label: "דירוג מהנמוך לגבוה" },
    ...(properties.some((property) => property.capacityScope !== "unit") ? [{ value: "capacity", label: "קיבולת גבוהה" }] : []),
    { value: "units", label: "מספר יחידות" },
    { value: "name", label: "א-ב (סדר עולה)" },
  ];
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.toString();
  const onlineOnly = searchParams.get("online") === "1";
  const [openDatesRequest, setOpenDatesRequest] = useState(0);
  const [onlineSearchRetry, setOnlineSearchRetry] = useState(0);
  const { language, translate } = useSiteLanguage();
  const managedGeography = useManagedGeography();
  const landingType = normalizedLandingType(landing);
  const initialParams = new URLSearchParams(searchQuery);
  const initialGuestCount = Number(initialParams.get("guests") || (Number(initialParams.get("adults") || 2) + Number(initialParams.get("children") || 0)));
  const initialArea = initialParams.get("location");
  const [sort, setSort] = useState(vacationSortOptions.some((option) => option.value === initialParams.get("sort")) ? initialParams.get("sort")! : "recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterSection, setFilterSection] = useState<"types" | "more">(supplierTypeFilterAvailable ? "types" : "more");
  const { mapOpen, openMap, closeMap } = useMapViewState();
  const { viewMode, setViewMode } = useResultsViewMode("vacation");
  const [area, setArea] = useState(initialArea && !isWholeCountrySelection(initialArea) ? initialArea : landing?.area || "הכל");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(landingType ? [landingType] : []);
  const [guests, setGuests] = useState(Number.isFinite(initialGuestCount) ? Math.max(1, initialGuestCount) : 2);
  const [minPrice, setMinPrice] = useState(VACATION_PRICE_MIN);
  const [maxPrice, setMaxPrice] = useState(VACATION_PRICE_MAX);
  const [pool, setPool] = useState(initialParams.get("pool") === "1");
  const [spa, setSpa] = useState(initialParams.get("spa") === "1");
  const [whole, setWhole] = useState(false);
  const [accessibleOnly, setAccessibleOnly] = useState(initialParams.get("accessible") === "1");
  const [selectedExtras, setSelectedExtras] = useState<string[]>((initialParams.get("features") || "").split(",").filter((id) => legacyExtraFilters.some((item) => item.id === id)));
  const [draftFilters, setDraftFilters] = useState<VacationFilterState | null>(null);
  const [, setVisibleMapCount] = useState(0);
  const [mapVisibleIds, setMapVisibleIds] = useState<string[] | null>(null);
  const [activeMapPropertyId, setActiveMapPropertyId] = useState<string | null>(null);

  const selectedStay = useMemo(() => vacationStayFromSearch(searchParams, language), [language, searchParams]);
  const flexibleSearch = useMemo(() => flexibleVacationSearchFromParams(searchParams), [searchParams]);
  const requestedRooms = useMemo(() => vacationRoomsFromSearchParams(searchParams), [searchParams]);
  const supplierGuests = vacationRoomGuests(requestedRooms);
  const supplierSearch = useViiLiveSearch("vacations", selectedStay?.from || null, selectedStay?.till || null, supplierGuests, undefined, requestedRooms, undefined, onlineSearchRetry);
  const onlineCheckPending = onlineOnly && (!selectedStay || supplierSearch.status !== "ready");
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
    return { area, selectedTypes, guests, minPrice, maxPrice, pool, spa, whole, accessibleOnly, onlineOnly, selectedExtras, sort };
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
    const normalizedMinimum = Math.min(normalizeVacationPrice(String(nextMinimum), VACATION_PRICE_MIN, VACATION_PRICE_MAX), nextMaximum);
    const normalizedMaximum = Math.max(normalizeVacationPrice(String(nextMaximum), VACATION_PRICE_MAX, VACATION_PRICE_MAX), normalizedMinimum);
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

  function changeOnlineFilter(nextValue: boolean) {
    if (filtersOpen && draftFilters) {
      setDraftFilters({ ...draftFilters, onlineOnly: nextValue });
      return;
    }
    updateSearchContext({ online: nextValue ? "1" : null });
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
      const requestedMinPrice = normalizeVacationPrice(params.get("minPrice"), VACATION_PRICE_MIN, VACATION_PRICE_MAX);
      const requestedMaxPrice = normalizeVacationPrice(params.get("maxPrice"), VACATION_PRICE_MAX, VACATION_PRICE_MAX);
      const requestedType = params.get("type");
      const requestedTypes = (supplierTypeFilterAvailable ? (params.get("types") || requestedType || "") : "")
        .split(",")
        .map(normalizeAccommodationType)
        .filter((label) => legacyAccommodationTypes.some((item) => item.label === label));
      const requestedPath = requestedTypes.length === 1
        ? cleanAccommodationPath(requestedTypes[0], requestedArea || "כל הארץ")
        : cleanVacationPath(requestedArea || "כל הארץ", properties);
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
      setMinPrice(supplierPriceFilterAvailable ? Math.min(requestedMinPrice, requestedMaxPrice) : VACATION_PRICE_MIN);
      setMaxPrice(supplierPriceFilterAvailable ? Math.max(requestedMinPrice, requestedMaxPrice) : VACATION_PRICE_MAX);
      if (requestedTypes.length) setSelectedTypes(requestedTypes);
      else if (landingType) setSelectedTypes([landingType]);
      else setSelectedTypes([]);
      setPool(params.get("pool") === "1");
      setSpa(params.get("spa") === "1");
      setWhole(false);
      setAccessibleOnly(params.get("accessible") === "1");
      setSelectedExtras((params.get("features") || "").split(",").filter((id) => legacyExtraFilters.some((item) => item.id === id)));
      setSort(VACATION_SORT_VALUES.includes((params.get("sort") || "recommended") as (typeof VACATION_SORT_VALUES)[number]) ? params.get("sort") || "recommended" : "recommended");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [VACATION_PRICE_MAX, landing, landingType, language, properties, router, searchQuery, supplierPriceFilterAvailable, supplierTypeFilterAvailable]);

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
      const matchesType = !supplierTypeFilterAvailable || matchesAnyAccommodationType(property.type, selectedTypes, landing);
      const matchesGuests = property.capacityScope === "unit" || property.guests >= guests;
      const priceFilterActive = minPrice > VACATION_PRICE_MIN || maxPrice < VACATION_PRICE_MAX;
      const matchesPrice = !supplierPriceFilterAvailable || !priceFilterActive || (typeof property.price === "number" && property.price >= minPrice && property.price <= maxPrice);
      const matchesPool = !pool || matchesVacationSearchFilter(property, "pool");
      const matchesSpa = !spa || ["spa", "jacuzzi", "sauna"].some((id) => matchesVacationSearchFilter(property, id));
      const matchesWhole = !whole || (property.capacityScope !== "unit" && property.scenario === "single");
      const matchesAccessibility = !accessibleOnly || getPlaceAccessibility(property.slug).status === "accessible";
      const matchesExtras = selectedExtras.every((id) => {
        if (id === "accessible") return getPlaceAccessibility(property.slug).status === "accessible";
        return matchesVacationSearchFilter(property, id);
      });
      return matchesType && matchesGuests && matchesPrice && matchesPool && matchesSpa && matchesWhole && matchesAccessibility && matchesExtras;
    }), [VACATION_PRICE_MAX, accessibleOnly, guests, landing, maxPrice, minPrice, pool, properties, selectedExtras, selectedTypes, spa, supplierPriceFilterAvailable, supplierTypeFilterAvailable, whole]);

  const flexibleCandidates = useMemo(
    () => flexibleVacationCandidates(flexibleSearch, guests),
    [flexibleSearch, guests],
  );
  const liveAvailabilityBySlug = useLegacyAvailabilityBatch(mapCandidates, selectedStay);
  const flexibleAvailabilityBySlug = useLegacyFlexibleAvailabilityBatch(mapCandidates, flexibleCandidates);
  const flexibleLocalAvailabilityBySlug = useMemo(() => Object.fromEntries(mapCandidates
    .filter((property) => !legacyAvailabilitySourceFor(property.slug))
    .map((property) => {
      let firstKnown: ReturnType<typeof resolveAvailabilityForStay> = null;
      let firstAvailable: ReturnType<typeof resolveAvailabilityForStay> = null;
      for (const candidate of flexibleCandidates) {
        const quote = resolveAvailabilityForStay(property, candidate, pathname, requestedLocation);
        if (!quote) continue;
        if (!firstKnown) firstKnown = quote;
        if (quote.availability === "available" && !firstAvailable) firstAvailable = quote;
        if (quote.availability === "available" && typeof quote.nightlyPrice === "number" && quote.nightlyPrice > 0) {
          return [property.slug, { quote, status: "ready" } satisfies LegacyAvailabilityState] as const;
        }
      }
      const quote = firstAvailable || firstKnown;
      return [property.slug, quote ? { quote, status: "ready" } satisfies LegacyAvailabilityState : { quote: null, status: "idle" } satisfies LegacyAvailabilityState] as const;
    })), [flexibleCandidates, mapCandidates, pathname, requestedLocation]);
  const liveAvailabilityFor = (slug: string): LegacyAvailabilityState | undefined => {
    if (selectedStay && /^vacation-\d+$/.test(slug)) {
      if (supplierSearch.status === "loading") return { quote: null, status: "loading" };
      if (supplierSearch.status === "error") return { quote: null, status: "error" };
      const result = supplierSearch.results[Number(slug.slice("vacation-".length))];
      if (!result) return { quote: { from: selectedStay.from, till: selectedStay.till, availability: "unknown", showSelectedDates: true }, status: "ready" };
      const from = result.from || selectedStay.from;
      const till = result.till || selectedStay.till;
      const nights = Math.max(1, Math.round((Date.parse(`${till}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000));
      return { quote: { from, till, availability: result.available === true ? "available" : result.available === false ? "unavailable" : "unknown", showSelectedDates: true, onlineBooking: result.onlineBooking, bookingSupported: result.roomCount === 1,
        ...(result.total ? { nightlyPrice: Math.round(result.total / nights), totalPrice: result.total, priceMode: result.priceMode } : {}),
        ...(result.priceGuests ? { includedGuests: result.priceGuests } : {}) }, status: "ready" };
    }
    if (flexibleSearch && !legacyAvailabilitySourceFor(slug)) return flexibleLocalAvailabilityBySlug[slug];
    if (!legacyAvailabilitySourceFor(slug)) return undefined;
    if (selectedStay) return liveAvailabilityBySlug[slug] || { quote: null, status: "loading" };
    if (flexibleSearch) return flexibleAvailabilityBySlug[slug] || { quote: null, status: "loading" };
    return undefined;
  };
  const selectedStayFor = (slug: string) => {
    const quote = flexibleSearch ? liveAvailabilityFor(slug)?.quote : null;
    if (!quote) return selectedStay;
    return { from: quote.from, till: quote.till, guests };
  };
  const hasVerifiedAvailablePrice = (property: typeof properties[number]) => {
    const quote = liveAvailabilityFor(property.slug)?.quote;
    return quote?.availability === "available" && typeof quote.nightlyPrice === "number" && quote.nightlyPrice > 0;
  };

  const filtered = useMemo(() => {
    const useLandingSet = Boolean(landing?.listingSlugs?.length
      && (!landingType || (selectedTypes.length === 1 && selectedTypes[0] === landingType))
      && (landing.area ? area === landing.area : area === "הכל"));
    const priceFilterActive = minPrice > VACATION_PRICE_MIN || maxPrice < VACATION_PRICE_MAX;
    const matches = mapCandidates
      .filter((property) => matchesVacationOnlineBooking(onlineOnly, liveAvailabilityFor(property.slug), selectedStayFor(property.slug)))
      .filter((property) => useLandingSet ? landing?.listingSlugs?.includes(property.slug) : matchesSearchLocation(property, area))
      .filter((property) => {
        if (!priceFilterActive) return true;
        const livePrice = liveAvailabilityFor(property.slug)?.quote?.nightlyPrice;
        const price = typeof livePrice === "number" && livePrice > 0 ? livePrice : property.price;
        return typeof price === "number" && price >= minPrice && price <= maxPrice;
      });
    return [...matches].sort((a, b) => {
      const liveRank = (property: typeof properties[number]) => {
        if (!selectedStay || !/^vacation-\d+$/.test(property.slug) || supplierSearch.status !== "ready") return 1;
        const result = supplierSearch.results[Number(property.slug.slice(9))];
        return result?.available === true ? 0 : result?.available === false ? 2 : 1;
      };
      const availabilityPriority = liveRank(a) - liveRank(b) || Number(hasVerifiedAvailablePrice(b) || hasAvailablePriceForSearch(b, selectedStayFor(b.slug), pathname, requestedLocation))
        - Number(hasVerifiedAvailablePrice(a) || hasAvailablePriceForSearch(a, selectedStayFor(a.slug), pathname, requestedLocation));
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
      return compareVacationProperties(a, b, sort, properties);
    });
  // landingType is derived from the immutable landing prop. Keeping the prop in
  // the dependency list lets the compiler preserve this memo across renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, availabilityDemoActive, flexibleAvailabilityBySlug, flexibleLocalAvailabilityBySlug, flexibleSearch, guests, landing, liveAvailabilityBySlug, maxPrice, minPrice, supplierSearch, mapCandidates, onlineOnly, pathname, requestedLocation, selectedStay, selectedTypes, sort]);

  const nearbyRecovery = useMemo(() => {
    if (filtered.length >= 3 || isWholeCountrySelection(area)) return [];
    // A nearby fallback may broaden geography only. An explicit supplier
    // unavailability for the selected dates remains a hard exclusion.
    const eligible = mapCandidates.filter((property) => {
      if (!matchesVacationOnlineBooking(onlineOnly, liveAvailabilityFor(property.slug), selectedStayFor(property.slug))) return false;
      const priceFilterActive = minPrice > VACATION_PRICE_MIN || maxPrice < VACATION_PRICE_MAX;
      if (priceFilterActive) {
        const livePrice = liveAvailabilityFor(property.slug)?.quote?.nightlyPrice;
        const price = typeof livePrice === "number" && livePrice > 0 ? livePrice : property.price;
        if (typeof price !== "number" || price < minPrice || price > maxPrice) return false;
      }
      if (!selectedStay && !flexibleSearch) return true;
      return liveAvailabilityFor(property.slug)?.quote?.availability !== "unavailable";
    });
    return nearbyPlacesForSelection(eligible, managedGeography, area, { limit: 12, maximumDistanceKm: 100, minimumResults: 3 });
  }, [VACATION_PRICE_MAX, VACATION_PRICE_MIN, area, filtered.length, managedGeography, mapCandidates, maxPrice, minPrice, onlineOnly, selectedStay, flexibleSearch, supplierSearch.results, supplierSearch.status, liveAvailabilityBySlug, flexibleAvailabilityBySlug, flexibleLocalAvailabilityBySlug]);
  const resultSet = useMemo(() => completeNearbyResults(filtered, nearbyRecovery.map((candidate) => candidate.place), (place) => place.slug), [filtered, nearbyRecovery]);

  useEffect(() => {
    if (catalogLoading || catalogError || onlineCheckPending) return;
    const timer = window.setTimeout(() => trackSearchResults({
      world: "vacation",
      location: area === "הכל" ? "כל הארץ" : area,
      hasDate: Boolean(selectedStay?.from),
      resultCount: resultSet.length,
      filters: {
        ...(selectedTypes.length ? { type: selectedTypes.join(",") } : {}),
        ...(guests > 2 ? { guests } : {}),
        ...(accessibleOnly ? { accessible: true } : {}),
        ...(onlineOnly ? { online: true } : {}),
        ...([...selectedExtras, ...(pool ? ["pool"] : []), ...(spa ? ["spa"] : [])].length
          ? { features: [...selectedExtras, ...(pool ? ["pool"] : []), ...(spa ? ["spa"] : [])].join(",") }
          : {}),
      },
    }), 650);
    return () => window.clearTimeout(timer);
  }, [accessibleOnly, area, catalogError, catalogLoading, resultSet.length, guests, onlineOnly, onlineCheckPending, pool, selectedExtras, selectedStay?.from, selectedTypes, spa]);

  const draftCandidates = properties.filter((property) => {
    if (shownFilters.onlineOnly && (shownFilters.guests !== guests || !matchesVacationOnlineBooking(true, liveAvailabilityFor(property.slug), selectedStayFor(property.slug)))) return false;
    const matchesType = !supplierTypeFilterAvailable || matchesAnyAccommodationType(property.type, shownFilters.selectedTypes, landing);
    const matchesExtras = shownFilters.selectedExtras.every((id) => {
      if (id === "accessible") return getPlaceAccessibility(property.slug).status === "accessible";
      return matchesVacationSearchFilter(property, id);
    });
    const priceFilterActive = shownFilters.minPrice > VACATION_PRICE_MIN || shownFilters.maxPrice < VACATION_PRICE_MAX;
    const draftPrice = shownFilters.onlineOnly ? liveAvailabilityFor(property.slug)?.quote?.nightlyPrice : property.price;
    const matchesPrice = !priceFilterActive || (!shownFilters.onlineOnly && !supplierPriceFilterAvailable)
      || (typeof draftPrice === "number" && draftPrice >= shownFilters.minPrice && draftPrice <= shownFilters.maxPrice);
    return matchesType
      && (property.capacityScope === "unit" || property.guests >= shownFilters.guests)
      && matchesPrice
      && (!shownFilters.pool || matchesVacationSearchFilter(property, "pool"))
      && (!shownFilters.spa || ["spa", "jacuzzi", "sauna"].some((id) => matchesVacationSearchFilter(property, id)))
      && (!shownFilters.whole || (property.capacityScope !== "unit" && property.scenario === "single"))
      && (!shownFilters.accessibleOnly || getPlaceAccessibility(property.slug).status === "accessible")
      && matchesExtras;
  });
  const draftUsesLandingSet = Boolean(landing?.listingSlugs?.length
      && (!landingType || (shownFilters.selectedTypes.length === 1 && shownFilters.selectedTypes[0] === landingType))
    && (landing.area ? shownFilters.area === landing.area : shownFilters.area === "הכל"));
  const draftMatches = draftCandidates.filter((property) => draftUsesLandingSet ? landing?.listingSlugs?.includes(property.slug) : matchesSearchLocation(property, shownFilters.area));
  const draftNearby = shownFilters.onlineOnly && draftMatches.length < 3 && !isWholeCountrySelection(shownFilters.area)
    ? nearbyPlacesForSelection(draftCandidates, managedGeography, shownFilters.area, { limit: 12, maximumDistanceKm: 100, minimumResults: 3 }).map(candidate => candidate.place) : [];
  const draftResultCount = shownFilters.onlineOnly ? completeNearbyResults(draftMatches, draftNearby, place => place.slug).length : draftMatches.length;
  const draftResultLabel = shownFilters.onlineOnly && !selectedStay ? "בחירת תאריכים"
    : shownFilters.onlineOnly && (supplierSearch.status !== "ready" || shownFilters.guests !== guests) ? "החלת סינונים"
    : draftResultCount === 1 ? "הצגת מקום אחד" : `הצגת ${draftResultCount} מקומות`;

  const displayedResults = useMemo(() => {
    if (!mapOpen || !mapVisibleIds) return resultSet;
    const visible = new Set(mapVisibleIds);
    return resultSet.filter((property) => visible.has(property.slug)).sort((a, b) => {
      const availabilityPriority = Number(hasVerifiedAvailablePrice(b) || hasAvailablePriceForSearch(b, selectedStayFor(b.slug), pathname, requestedLocation))
        - Number(hasVerifiedAvailablePrice(a) || hasAvailablePriceForSearch(a, selectedStayFor(a.slug), pathname, requestedLocation));
      if (availabilityPriority) return availabilityPriority;
      return compareVacationProperties(a, b, sort, properties);
    });
  // The availability helpers close over the same primitive query inputs listed
  // below. Listing them directly would invalidate this memo on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultSet, flexibleAvailabilityBySlug, flexibleLocalAvailabilityBySlug, flexibleSearch, guests, liveAvailabilityBySlug, supplierSearch, mapCandidates, mapOpen, mapVisibleIds, pathname, requestedLocation, selectedStay, sort]);
  const resultWindowKey = [area, selectedTypes.join(","), minPrice, maxPrice, pool, spa, whole, accessibleOnly, selectedExtras.join(","), sort, searchQuery, mapOpen ? "map" : "list"].join("|");
  useEffect(() => { setVisibleResultCount(9); }, [resultWindowKey]);
  const visibleResults = mapOpen ? displayedResults : displayedResults.slice(0, visibleResultCount);
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
    const timer = window.setTimeout(() => { setMapVisibleIds(null); setActiveMapPropertyId(null); }, 0);
    return () => window.clearTimeout(timer);
  }, [area, selectedTypes, guests, minPrice, maxPrice, pool, spa, whole, accessibleOnly, selectedExtras, sort, searchQuery]);

  function openResultsMap() {
    setMapVisibleIds(null);
    setVisibleMapCount(resultSet.length);
    openMap();
  }

  function closeResultsMap() {
    setMapVisibleIds(null);
    setActiveMapPropertyId(null);
    closeMap();
  }

  const activeFilters = [
    onlineOnly ? { id: "online", label: "ניתן להזמין אונליין", remove: () => changeOnlineFilter(false) } : null,
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
    ...(supplierTypeFilterAvailable ? legacyAccommodationTypes : [])
      .filter((item) => !selectedTypes.includes(item.label))
      .map((item) => ({ label: item.label, params: { type: null, types: item.label } })),
    ...[
      { label: "נופש לזוג", active: guests === 2, params: { guests: "2" } as Record<string, string | null> },
      { label: "נופש למשפחה", active: guests === 6, params: { guests: "6" } as Record<string, string | null> },
      { label: "נופש לקבוצה", active: guests === 12, params: { guests: "12" } as Record<string, string | null> },
      { label: "נופש עם בריכה", active: pool, params: { pool: "1" } as Record<string, string | null> },
      { label: "נופש עם ספא וג'קוזי", active: spa, params: { spa: "1" } as Record<string, string | null> },
      ...(properties.some((property) => property.capacityScope !== "unit" && property.scenario === "single") ? [{ label: "מקומות שלמים", active: whole, params: { whole: "1" } as Record<string, string | null> }] : []),
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
      setDraftFilters({ area, selectedTypes: [], guests, minPrice: VACATION_PRICE_MIN, maxPrice: VACATION_PRICE_MAX, pool: false, spa: false, whole: false, accessibleOnly: false, onlineOnly: false, selectedExtras: [], sort: "recommended" });
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
    updateSearchContext({ location: "כל הארץ", guests: null, type: null, types: null, minPrice: null, maxPrice: null, pool: null, spa: null, whole: null, accessible: null, online: null, features: null, sort: null }, [], "הכל");
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
      online: draftFilters.onlineOnly ? "1" : null,
      features: draftFilters.selectedExtras.length ? draftFilters.selectedExtras.join(",") : null,
      sort: draftFilters.sort === "recommended" ? null : draftFilters.sort,
    }, draftFilters.selectedTypes, draftFilters.area);
    closeFiltersPanel();
  }

  return (
    <PageShell footerTopic={footerTopicForPropertyType(selectedTypes[0] || "הכל")}>
      <main id="main-content" className="results-page">
        {catalogLoading ? <p className="shell" role="status">טוענים מקומות...</p> : null}
        {catalogError ? <p className="shell" role="alert">לא ניתן לטעון את המקומות כרגע.</p> : null}
        {!landing ? <StructuredData data={collectionSchema("מקומות נופש בישראל", "מקומות נופש עם תמונות, יחידות ומתקנים. התאמה להרכב האורחים נבדקת מול המקום.", "/search", filtered.map((property) => ({ name: property.name, path: `/business?id=${property.slug}`, image: property.image })))} /> : null}
        {!landing ? <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "נופש", path: "/search" }])} /> : null}
        <UnavailablePlaceNotice world="vacations" />
        <div className="results-search shell"><SearchBox compact openDatesRequest={openDatesRequest} initialLocation={area === "הכל" ? "כל הארץ" : area} initialGuests={guests} basePath={selectedTypes.length <= 1 ? landing?.path : undefined} vacationType={selectedTypes.length === 1 ? selectedTypes[0] : undefined} /></div>
        <BreadcrumbTrail items={breadcrumbItems} />
        <div className={`shell results-layout airbnb-results-layout ${mapOpen ? "with-map" : ""}`}>
          <aside className={`filter-panel ${filtersOpen ? "open" : ""} ${mapOpen ? "map-mode" : ""}`} aria-label="סינון תוצאות" role={filtersOpen ? "dialog" : undefined} aria-modal={filtersOpen || undefined}>
            <div className="filter-panel__scroll">
              <div className="filter-head"><h2>סינון תוצאות</h2><button type="button" onClick={closeFiltersPanel} aria-label="סגירה"><CloseIcon /></button></div>
              <div className="vacation-filter-sections" aria-label="קטגוריות סינון">
                <button type="button" className={filterSection === "types" ? "active" : ""} aria-pressed={filterSection === "types"} onClick={() => setFilterSection("types")}>סוגי אירוח</button>
                <button type="button" className={filterSection === "more" ? "active" : ""} aria-pressed={filterSection === "more"} onClick={() => setFilterSection("more")}>מחיר ומאפיינים</button>
              </div>
              <div className="filter-panel__mobile-sort">
                <ModernSelect label="מיון לפי" value={shownFilters.sort} onChange={changeSort} options={vacationSortOptions} />
              </div>
              {mapOpen && <div className="map-filter-status" aria-live="polite"><PinIcon /><span>האזור שמוצג במפה</span><strong>{area === "הכל" ? "כל הארץ" : area}</strong></div>}
              <fieldset className="vacation-online-filter"><legend>דרך הזמנה</legend><label><input type="checkbox" checked={shownFilters.onlineOnly} onChange={(event) => changeOnlineFilter(event.target.checked)} /><span>ניתן להזמין אונליין</span></label><p>רק מקומות עם מחיר וזמינות לתאריכים שבחרתם, שאפשר להזמין באתר.</p></fieldset>
              {filterSection === "types" ? <fieldset className="vacation-type-options"><legend>סוגי אירוח, אפשר לבחור כמה אפשרויות</legend>{legacyAccommodationTypes.map((item) => <label key={item.label}><input type="checkbox" checked={shownFilters.selectedTypes.includes(item.label)} onChange={() => toggleType(item.label)} /> {item.label}</label>)}</fieldset> : <div className="vacation-more-filters">
                <fieldset className="vacation-price-filter" disabled={!supplierPriceFilterAvailable && !selectedStay}>
                  <legend>מחיר ללילה</legend>
                  <p>בחרו את המחיר הנמוך והגבוה שמתאים לכם.</p>
                  <output className="vacation-price-filter__summary" aria-live="polite"><span>מ־<bdi>{shownFilters.minPrice.toLocaleString("he-IL")}</bdi> ₪</span><i aria-hidden="true">עד</i><span><bdi>{shownFilters.maxPrice.toLocaleString("he-IL")}</bdi> ₪</span></output>
                  <div className="vacation-price-filter__inputs">
                    <label><span>מחיר מינימלי</span><VacationPriceInput value={shownFilters.minPrice} minimum={VACATION_PRICE_MIN} maximum={shownFilters.maxPrice} emptyValue={VACATION_PRICE_MIN} ariaLabel="מחיר מינימום בשקלים" onValueChange={(nextValue) => changePriceRange(nextValue, shownFilters.maxPrice)} /></label>
                    <span aria-hidden="true">עד</span>
                    <label><span>מחיר מקסימלי</span><VacationPriceInput value={shownFilters.maxPrice} minimum={shownFilters.minPrice} maximum={VACATION_PRICE_MAX} emptyValue={VACATION_PRICE_MAX} ariaLabel="מחיר מקסימום בשקלים" onValueChange={(nextValue) => changePriceRange(shownFilters.minPrice, nextValue)} /></label>
                  </div>
                  {!supplierPriceFilterAvailable && !selectedStay ? <small className="vacation-price-filter__notice">טווח המחיר ייפתח לאחר בחירת תאריכים, כשמתקבלים מחירים חיים מהמקומות.</small> : null}
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
              <div><h1>{translate(landing?.title || (area === "הכל" ? "נופש ברחבי הארץ" : `נופש ב${area}`))}</h1><div className="results-heading__meta">{!onlineCheckPending ? <p className="results-heading__inventory" aria-live="polite">{inventorySummary}</p> : null}</div></div>
            </section>
            <nav className="search-quick-filters" aria-label="סינון מהיר">
              <button type="button" className={activeFilters.length ? "primary-filter active" : "primary-filter"} onClick={() => openFiltersPanel()}><FilterControlIcon /><span>מסננים</span>{activeFilters.length ? <b>{activeFilters.length}</b> : null}</button>
              <button type="button" className={onlineOnly ? "online-booking-quick-filter active" : "online-booking-quick-filter"} aria-pressed={onlineOnly} onClick={() => changeOnlineFilter(!onlineOnly)}>ניתן להזמין אונליין</button>
              <button type="button" className={selectedTypes.length ? "active" : ""} onClick={() => openFiltersPanel("types")}>סוג מקום</button>
              <button type="button" className={minPrice > VACATION_PRICE_MIN || maxPrice < VACATION_PRICE_MAX ? "active" : ""} onClick={() => openFiltersPanel("more")}>טווח מחיר</button>
              <button type="button" className={pool ? "active" : ""} aria-pressed={pool} onClick={() => changeBinaryFilter("pool", !pool)}>בריכה</button>
              <button type="button" className={spa ? "active" : ""} aria-pressed={spa} onClick={() => changeBinaryFilter("spa", !spa)}>ספא וג׳קוזי</button>
              {properties.some((property) => property.capacityScope !== "unit" && property.scenario === "single") ? <button type="button" className={whole ? "active" : ""} aria-pressed={whole} onClick={() => changeBinaryFilter("whole", !whole)}>מקום שלם</button> : null}
              <button type="button" className={accessibleOnly ? "active" : ""} aria-pressed={accessibleOnly} onClick={() => changeBinaryFilter("accessible", !accessibleOnly)}>נגישות</button>
            </nav>
            {activeFilters.length > 0 && <div className="active-filter-row"><span>סינונים פעילים:</span>{activeFilters.map((filter) => <button key={filter.id} className={filter.id === "online" ? "online-booking-active-filter" : undefined} type="button" onClick={filter.remove} aria-label={`הסרת הסינון ${filter.label}`}>{filter.label} ×</button>)}<button type="button" className="clear-all" onClick={resetFilters}>ניקוי הכל</button></div>}
            {onlineOnly ? <div className="online-booking-filter-notice" role={selectedStay && supplierSearch.status === "error" ? "alert" : "status"} aria-busy={Boolean(selectedStay && supplierSearch.status === "loading")}>
              <p>{!selectedStay ? "בחרו תאריכי כניסה ויציאה כדי לראות מקומות שניתן להזמין אונליין." : supplierSearch.status === "error" ? "לא הצלחנו לבדוק הזמנה אונליין כרגע." : supplierSearch.status !== "ready" ? "בודקים אילו מקומות ניתן להזמין אונליין..." : resultSet.length ? "רק מקומות עם מחיר וזמינות לתאריכים שבחרתם, שאפשר להזמין באתר." : "לא נמצאו מקומות להזמנה אונליין בבחירה הזו."}</p>
              {!selectedStay || supplierSearch.status === "ready" && !resultSet.length ? <button className="button secondary" type="button" onClick={() => setOpenDatesRequest((value) => value + 1)}>בחירת תאריכים</button> : null}
              {selectedStay && supplierSearch.status === "error" ? <button className="button secondary" type="button" onClick={() => setOnlineSearchRetry((value) => value + 1)}>לנסות שוב</button> : null}
              {selectedStay && supplierSearch.status === "ready" && !resultSet.length ? <button className="button subtle" type="button" onClick={() => changeOnlineFilter(false)}>הסרת סינון הזמנה אונליין</button> : null}
            </div> : null}
            {availabilityDemoActive ? <div className="availability-demo-summary" role="status"><strong>{availabilityDemoCopy[language].title}</strong><span>{availabilityDemoCopy[language].text}</span><small>{selectedStay?.from}{" "}{String.fromCharCode(183)}{" "}{selectedStay?.till}</small></div> : null}
            {flexibleSearch ? <div className="availability-demo-summary availability-demo-summary--live" role="status"><strong>{flexibleAvailabilityCopy[language].title}</strong><span>{flexibleAvailabilityCopy[language].text}</span></div> : null}
            {resultSet.length > filtered.length ? <NearbySearchNotice dated={Boolean(selectedStay || flexibleSearch)} /> : null}
            <div className="results-toolbar"><div className="results-toolbar__actions"><ResultsViewToggle value={viewMode} onChange={setViewMode} />{resultSet.length > 0 && <button className={`button map-button mobile-map-fab ${mapOpen ? "active" : ""}`} type="button" aria-label={mapOpen ? "חזרה לתוצאות" : "הצגת תוצאות על המפה"} aria-pressed={mapOpen} onPointerEnter={preloadListingMap} onFocus={preloadListingMap} onTouchStart={preloadListingMap} onClick={(event) => { event.preventDefault(); event.stopPropagation(); if (mapOpen) closeResultsMap(); else openResultsMap(); }}><MapIcon /><span className="map-button__desktop-label">{mapOpen ? "חזרה לתוצאות" : "תצוגה על מפה"}</span><span className="map-button__mobile-label" aria-hidden="true">מפה</span></button>}</div><ModernSelect className="results-toolbar__sort" compact label="מיון לפי" value={sort} onChange={changeSort} options={vacationSortOptions} /></div>
            {guests > 2 && properties.some((property) => property.capacityScope === "unit") ? <SupplierCapacityNotice /> : null}
            {!mapOpen && <ProgressiveResults autoLoad className={`result-cards results-view results-view--${viewMode}`} resetKey={resultWindowKey} totalCount={displayedResults.length} visibleCount={visibleResults.length} onShowMore={() => setVisibleResultCount((current) => Math.min(displayedResults.length, current + 9))}>{visibleResults.map((property) => <PropertyCard key={property.slug} property={property} selectedStay={selectedStayFor(property.slug)} liveAvailabilityState={liveAvailabilityFor(property.slug)} detailHref={detailHref(property.slug)} />)}</ProgressiveResults>}
            {mapOpen && <div className="airbnb-map-split">
              <div className={`airbnb-map-split__results result-cards results-view results-view--${viewMode}`}>{displayedResults.map((property) => <PropertyCard key={property.slug} property={property} selectedStay={selectedStayFor(property.slug)} liveAvailabilityState={liveAvailabilityFor(property.slug)} detailHref={detailHref(property.slug)} mapActive={activeMapPropertyId === property.slug} onActiveChange={(active) => setActiveMapPropertyId(active ? property.slug : null)} />)}</div>
              <div className="airbnb-map-split__map"><DeferredListingMap listings={resultSet} initialListings={resultSet} autoLoad detailQuery={detailQuery} onClose={closeResultsMap} onVisibleCountChange={setVisibleMapCount} onVisiblePlaceIdsChange={setMapVisibleIds} activePlaceId={activeMapPropertyId} onActivePlaceChange={setActiveMapPropertyId} /></div>
            </div>}
            {!onlineOnly && !catalogLoading && !catalogError && (mapOpen && mapVisibleIds ? displayedResults.length === 0 : resultSet.length === 0) && <div className="empty-state"><h2>לא נמצאה התאמה מדויקת או מקום קרוב</h2><p>אפשר לשנות אזור, להפחית את כמות האורחים או להסיר מאפיין.</p><button className="button primary" type="button" onClick={resetFilters}>ניקוי סינונים</button></div>}
            {landing && filtered.length > 0 && <>
              <section id="accommodation-guide" className="accommodation-page-guide" aria-labelledby="accommodation-page-guide-title"><span className="eyebrow">המדריך של העמוד</span><h2 id="accommodation-page-guide-title">{landing.guideTitle || `איך בוחרים ${landing.breadcrumb}`}</h2><div>{(landing.guideParagraphs || [landing.description]).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></section>
              {landing.faqs?.length ? <section id="accommodation-faq" className="accommodation-page-faq" aria-labelledby="accommodation-page-faq-title"><span className="eyebrow">תשובות ממוקדות לעמוד הזה</span><h2 id="accommodation-page-faq-title">שאלות ותשובות על {landing.breadcrumb}</h2><div>{landing.faqs.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section> : null}
            </>}
          </section>
        </div>
        {!catalogLoading && !catalogError ? <SearchAfterResults world="vacation" location={area} inventory={properties} searchSuggestions={contextualSearchSuggestions} hideGuideAndFaq={Boolean(landing)} reviewHighlights={filtered.filter((property) => typeof property.score === "number").sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 3).map((property) => ({ name: property.name, href: `/business?id=${property.slug}`, rating: property.score || 0, reviews: property.reviews }))} /> : null}
        {filtersOpen && <button className="filter-backdrop" aria-label="סגירת סינון" onClick={closeFiltersPanel} />}
      </main>
    </PageShell>
  );
}

export default function SearchPage() {
  return <SearchExperience />;
}
