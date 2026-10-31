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
import { availabilityDemoSlugs, isAvailabilityDemoSearch, PropertyCard, resolveAvailabilityForStay } from "../components/property-card";
import { type LegacyAvailabilityState, useLegacyAvailabilityBatch, useLegacyFlexibleAvailabilityBatch } from "../components/use-legacy-availability";
import { legacyAvailabilitySourceFor } from "../lib/legacy-availability-sources";
import { SearchBox } from "../components/search-box";
import { BreadcrumbTrail } from "../components/breadcrumb-trail";
import type { Property } from "../data/site-data";
import { supplierDisplayDescription } from "../data/supplier-display-text";
import { usePublishedCatalog } from "../lib/use-published-catalog";
import { useOnlineCapabilities } from "../lib/use-online-capabilities";
import { hasOnlineCapability } from "../lib/online-booking-capability";
import { useStartingPrices } from "../lib/use-starting-prices";
import { hasSearchDate, supplierStartingPrice } from "../lib/supplier-starting-price";
import { hasVerifiedAccessibilityFeature } from "../data/accessibility-data";
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
import { flexibleVacationCandidates, flexibleVacationSearchFromParams } from "../lib/flexible-vacation-search";
import { useMapViewState } from "../components/map-view-state";
import { useViiFlexibleLiveSearch, useViiLiveSearch } from "../components/use-vii-live-search";
import { FilterControlIcon } from "../components/filter-control-icon";
import { SearchAfterResults, type ContextualSearchSuggestion } from "../components/search-after-results";
import { ResultsViewToggle, useResultsViewMode } from "../components/results-view-toggle";
import { ProgressiveResults } from "../components/progressive-results";
import { trackSearchResults } from "../lib/analytics";
import { matchesVacationSearchFilter } from "../lib/vacation-search-filter-index";
import { vacationRoomGuests, vacationRoomsFromSearchParams } from "../lib/vacation-party";
import { completePlaceSearchResults, nearbySearchRecommendations, PLACE_SEARCH_MINIMUM_RESULTS } from "../lib/nearby-recommendations";
import { NearbySearchNotice } from "../components/nearby-search-notice";
import { useManagedGeography } from "../components/use-managed-geography";
import { matchesVacationOnlineBooking } from "../lib/vacation-online-booking-filter";
import { prioritizeOnlineFirst } from "../lib/vacation-online-first";
import { managedVacationPriority } from "../lib/vacation-priority.ts";
import { RegionalAvailability } from "../components/regional-availability";
import { canShowDatedSearchResult, datedSearchResultTier } from "../lib/dated-availability-eligibility";
import { useDocumentSeed } from "../components/use-document-seed";
import { discoverySeedCompare } from "../lib/discovery-slider-order";
import { discoverySortOptionLabel } from "../lib/discovery-result-sort";
import type { MapPriceQuote } from "../lib/map-price";

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
const VACATION_SORT_VALUES = ["recommended", "popular", "price-asc", "price-desc", "rating-desc", "rating-asc", "capacity", "units", "name"] as const;

function compareOptionalNumber(first: number | undefined, second: number | undefined, direction: "asc" | "desc") {
  const firstKnown = typeof first === "number" && Number.isFinite(first);
  const secondKnown = typeof second === "number" && Number.isFinite(second);
  if (!firstKnown && !secondKnown) return 0;
  if (!firstKnown) return 1;
  if (!secondKnown) return -1;
  return direction === "asc" ? first - second : second - first;
}

function compareVacationProperties(a: Property, b: Property, sort: string, order: Property[], seed: string) {
  if (sort === "recommended") return discoverySeedCompare(a.slug, b.slug, `${seed}:vacation-search`);
  if (sort === "popular") return compareOptionalNumber(a.reviews, b.reviews, "desc") || compareOptionalNumber(a.score, b.score, "desc") || discoverySeedCompare(a.slug, b.slug, `${seed}:vacation-popular`);
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
  he: { title: "\u05d3\u05d5\u05d2\u05de\u05d0\u05d5\u05ea \u05dc\u05d6\u05de\u05d9\u05e0\u05d5\u05ea \u05d5\u05dc\u05de\u05d7\u05d9\u05e8 \u05d1\u05ea\u05d0\u05e8\u05d9\u05db\u05d9\u05dd \u05e9\u05d1\u05d7\u05e8\u05ea\u05dd", text: "\u05d4\u05ea\u05d5\u05e6\u05d0\u05d5\u05ea \u05de\u05d3\u05d2\u05d9\u05de\u05d5\u05ea \u05d0\u05ea \u05db\u05dc \u05de\u05e6\u05d1\u05d9 \u05d4\u05d6\u05de\u05d9\u05e0\u05d5\u05ea \u05d5\u05d4\u05de\u05d7\u05d9\u05e8 \u05dc\u05e4\u05d9 \u05de\u05d1\u05e0\u05d9 \u05d4\u05ea\u05e6\u05d5\u05d2\u05d4 \u05e9\u05dc V \u05d4\u05d9\u05e9\u05df. \u05d6\u05d4\u05d5 \u05de\u05d9\u05d3\u05e2 \u05dc\u05d4\u05de\u05d7\u05e9\u05d4 \u05d5\u05dc\u05d0 \u05d6\u05de\u05d9\u05e0\u05d5\u05ea \u05d7\u05d9\u05d4." },
  en: { title: "Availability and price examples for your dates", text: "The results demonstrate every availability and price state based on the old V display patterns. This is illustrative information, not live availability." },
  ru: { title: "\u041f\u0440\u0438\u043c\u0435\u0440\u044b \u043d\u0430\u043b\u0438\u0447\u0438\u044f \u0438 \u0446\u0435\u043d \u043d\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0435 \u0434\u0430\u0442\u044b", text: "\u0420\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u044b \u0434\u0435\u043c\u043e\u043d\u0441\u0442\u0440\u0438\u0440\u0443\u044e\u0442 \u0432\u0441\u0435 \u0441\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u044f \u043d\u0430\u043b\u0438\u0447\u0438\u044f \u0438 \u0446\u0435\u043d \u043f\u043e \u043e\u0431\u0440\u0430\u0437\u0446\u0443 \u0441\u0442\u0430\u0440\u043e\u0433\u043e V. \u042d\u0442\u043e \u0438\u043b\u043b\u044e\u0441\u0442\u0440\u0430\u0446\u0438\u044f, \u0430 \u043d\u0435 \u043d\u0430\u043b\u0438\u0447\u0438\u0435 \u0432 \u0440\u0435\u0430\u043b\u044c\u043d\u043e\u043c \u0432\u0440\u0435\u043c\u0435\u043d\u0438." },
  fr: { title: "Exemples de disponibilit\u00e9 et de prix pour vos dates", text: "Les r\u00e9sultats pr\u00e9sentent tous les \u00e9tats de disponibilit\u00e9 et de prix inspir\u00e9s de l'ancien V. Il s'agit d'une illustration, pas de disponibilit\u00e9s en direct." },
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
  const { language, translate } = useSiteLanguage();
  const supplierTypeFilterAvailable = useMemo(() => properties.some((property) => property.type !== "מקום אירוח"), [properties]);
  const supplierPriceFilterAvailable = useMemo(() => properties.some((property) => typeof property.price === "number"), [properties]);
  const VACATION_PRICE_MAX = useMemo(() => Math.max(5000, ...properties.map((property) => property.price || 0)), [properties]);
  const vacationSortOptions = [
    { value: "recommended", label: discoverySortOptionLabel("recommended", language) },
    { value: "popular", label: discoverySortOptionLabel("popular", language) },
    ...(supplierPriceFilterAvailable ? [{ value: "price-asc", label: "מחיר מהנמוך לגבוה" }, { value: "price-desc", label: "מחיר מהגבוה לנמוך" }].map((option) => ({ ...option, label: translate(option.label) })) : []),
    ...[{ value: "rating-desc", label: "דירוג מהגבוה לנמוך" }, { value: "rating-asc", label: "דירוג מהנמוך לגבוה" }].map((option) => ({ ...option, label: translate(option.label) })),
    ...(properties.some((property) => property.capacityScope !== "unit") ? [{ value: "capacity", label: "קיבולת גבוהה" }] : []),
    { value: "units", label: "מספר יחידות" },
    { value: "name", label: translate("א-ב (סדר עולה)") },
  ];
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.toString();
  const onlineOnly = searchParams.get("online") === "1";
  const [openDatesRequest, setOpenDatesRequest] = useState(0);
  const [onlineSearchRetry, setOnlineSearchRetry] = useState(0);
  const documentSeed = useDocumentSeed();
  const managedGeography = useManagedGeography();
  const landingType = normalizedLandingType(landing);
  const initialParams = new URLSearchParams(searchQuery);
  const initialGuestCount = Number(initialParams.get("guests") || (Number(initialParams.get("adults") || 2) + Number(initialParams.get("children") || 0)));
  const initialArea = initialParams.get("location");
  const [sort, setSort] = useState(vacationSortOptions.some((option) => option.value === initialParams.get("sort")) ? initialParams.get("sort")! : "recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterSection, setFilterSection] = useState<"types" | "more">(supplierTypeFilterAvailable ? "types" : "more");
  const { mapOpen, mapInteractive, openMap, closeMap } = useMapViewState();
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
  const undatedSearch = !selectedStay && !hasSearchDate(searchParams);
  const onlineCapabilities = useOnlineCapabilities(undatedSearch, onlineSearchRetry);
  const startingPrices = useStartingPrices("vacations", undatedSearch);
  const priceFilterAvailable = supplierPriceFilterAvailable || Object.values(startingPrices).some((price) => supplierStartingPrice(price) !== null) || Boolean(selectedStay || flexibleSearch);
  const flexibleCandidates = useMemo(
    () => flexibleVacationCandidates(flexibleSearch, guests),
    [flexibleSearch, guests],
  );
  const requestedRooms = useMemo(() => vacationRoomsFromSearchParams(searchParams), [searchParams]);
  const supplierGuests = vacationRoomGuests(requestedRooms);
  const supplierSearch = useViiLiveSearch("vacations", selectedStay?.from || null, selectedStay?.till || null, supplierGuests, undefined, requestedRooms, undefined, onlineSearchRetry, false, undefined, Boolean(selectedStay));
  const flexibleSupplierSearch = useViiFlexibleLiveSearch(flexibleCandidates, supplierGuests, requestedRooms, onlineSearchRetry);
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
      setMinPrice(priceFilterAvailable ? Math.min(requestedMinPrice, requestedMaxPrice) : VACATION_PRICE_MIN);
      setMaxPrice(priceFilterAvailable ? Math.max(requestedMinPrice, requestedMaxPrice) : VACATION_PRICE_MAX);
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
  }, [VACATION_PRICE_MAX, landing, landingType, language, priceFilterAvailable, properties, router, searchQuery, supplierTypeFilterAvailable]);

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
      const catalogPrice = supplierStartingPrice(startingPrices[property.slug]);
      const matchesPrice = !priceFilterAvailable || !priceFilterActive || (typeof catalogPrice === "number" && catalogPrice >= minPrice && catalogPrice <= maxPrice);
      const matchesPool = !pool || matchesVacationSearchFilter(property, "pool");
      const matchesSpa = !spa || ["spa", "jacuzzi", "sauna"].some((id) => matchesVacationSearchFilter(property, id));
      const matchesWhole = !whole || (property.capacityScope !== "unit" && property.scenario === "single");
      const matchesAccessibility = !accessibleOnly || hasVerifiedAccessibilityFeature(property.features);
      const matchesExtras = selectedExtras.every((id) => {
        if (id === "accessible") return hasVerifiedAccessibilityFeature(property.features);
        return matchesVacationSearchFilter(property, id);
      });
      return matchesType && matchesGuests && matchesPrice && matchesPool && matchesSpa && matchesWhole && matchesAccessibility && matchesExtras;
    }), [VACATION_PRICE_MAX, accessibleOnly, guests, landing, maxPrice, minPrice, pool, priceFilterAvailable, properties, selectedExtras, selectedTypes, spa, startingPrices, supplierTypeFilterAvailable, whole]);

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
    if (flexibleSearch && /^vacation-\d+$/.test(slug)) {
      if (flexibleSupplierSearch.status === "loading") return { quote: null, status: "loading" };
      if (flexibleSupplierSearch.status === "error") return { quote: null, status: "error" };
      const result = flexibleSupplierSearch.results[Number(slug.slice("vacation-".length))];
      if (!result) return { quote: null, status: "ready" };
      const from = result.from || flexibleCandidates[0]?.from;
      const till = result.till || flexibleCandidates[0]?.till;
      if (!from || !till) return { quote: null, status: "ready" };
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
  const eligibleForSelectedStay = (property: Property) => !selectedStay
    || canShowDatedSearchResult(liveAvailabilityFor(property.slug), selectedStay);
  const legacyAvailabilityPending = Boolean(selectedStay) && Object.values(liveAvailabilityBySlug).some((state) => state.status === "loading");
  const flexibleAvailabilityPending = Boolean(flexibleSearch) && flexibleSupplierSearch.status === "loading";
  const flexibleAvailabilityError = Boolean(flexibleSearch) && flexibleSupplierSearch.status === "error";
  const datedAvailabilityPending = Boolean(selectedStay) && (supplierSearch.status === "loading" || legacyAvailabilityPending) || flexibleAvailabilityPending;
  const datedAvailabilityError = Boolean(selectedStay) && supplierSearch.status === "error" || flexibleAvailabilityError;
  const onlineCheckPending = onlineOnly && (undatedSearch ? onlineCapabilities.status === "loading" : datedAvailabilityPending);
  const undatedCapabilityUnavailable = undatedSearch && onlineCapabilities.status === "error";
  const matchesOnline = (property: Property, enabled = true) => enabled && undatedCapabilityUnavailable
    ? true
    : !property.demoOperations?.fictional && matchesVacationOnlineBooking(
    enabled, liveAvailabilityFor(property.slug), selectedStayFor(property.slug),
    { undated: undatedSearch, capability: onlineCapabilities.capabilities[property.slug] },
  );
  const searchPrice = (property: Property) => liveAvailabilityFor(property.slug)?.quote?.nightlyPrice
    ?? supplierStartingPrice(startingPrices[property.slug]) ?? property.price;

  const filtered = useMemo(() => {
    const useLandingSet = Boolean(landing?.listingSlugs?.length
      && (!landingType || (selectedTypes.length === 1 && selectedTypes[0] === landingType))
      && (landing.area ? area === landing.area : area === "הכל"));
    const priceFilterActive = minPrice > VACATION_PRICE_MIN || maxPrice < VACATION_PRICE_MAX;
    const matches = mapCandidates
      .filter((property) => eligibleForSelectedStay(property))
      .filter((property) => !onlineOnly || matchesOnline(property))
      .filter((property) => useLandingSet ? landing?.listingSlugs?.includes(property.slug) : matchesSearchLocation(property, area))
      .filter((property) => {
        if (!priceFilterActive) return true;
        const price = searchPrice(property);
        return typeof price === "number" && price >= minPrice && price <= maxPrice;
      });
    const compareMatches = (a: typeof properties[number], b: typeof properties[number]) => {
      if (undatedSearch && (sort === "price-asc" || sort === "price-desc")) {
        const aPrice = searchPrice(a), bPrice = searchPrice(b);
        if (!aPrice || !bPrice) return Number(!aPrice) - Number(!bPrice);
        return sort === "price-asc" ? aPrice - bPrice : bPrice - aPrice;
      }
      if (sort === "recommended") {
        return Number(managedVacationPriority(a.curatedRank) === undefined) - Number(managedVacationPriority(b.curatedRank) === undefined)
          || discoverySeedCompare(a.slug, b.slug, `${documentSeed}:vacation-search`);
      }
      if (selectedStay) {
        const datedTier = (property: typeof properties[number]) => {
          const quote = liveAvailabilityFor(property.slug)?.quote;
          const availability = quote?.availability || "unknown";
          const hasPrice = availability === "available"
            ? typeof quote?.nightlyPrice === "number" && quote.nightlyPrice > 0
            : Boolean(supplierStartingPrice(startingPrices[property.slug] ?? property));
          return datedSearchResultTier({ availability, hasPrice });
        };
        const tierPriority = datedTier(a) - datedTier(b);
        if (tierPriority) return tierPriority;
        const availablePriceTier = datedTier(a) === 0;
        if (availablePriceTier) {
          const onlinePriority = Number(!matchesOnline(a)) - Number(!matchesOnline(b));
          if (onlinePriority) return onlinePriority;
        }
      }
      if (sort === "recommended" && availabilityDemoActive) {
        const aDemoIndex = availabilityDemoSlugs.indexOf(a.slug);
        const bDemoIndex = availabilityDemoSlugs.indexOf(b.slug);
        if (aDemoIndex >= 0 || bDemoIndex >= 0) {
          if (aDemoIndex < 0) return 1;
          if (bDemoIndex < 0) return -1;
          return aDemoIndex - bDemoIndex;
        }
      }
      return compareVacationProperties(a, b, sort, properties, documentSeed);
    };
    return selectedStay
      ? [...matches].sort(compareMatches)
      : prioritizeOnlineFirst(matches, property => matchesOnline(property), compareMatches);
  // landingType is derived from the immutable landing prop. Keeping the prop in
  // the dependency list lets the compiler preserve this memo across renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, availabilityDemoActive, documentSeed, flexibleAvailabilityBySlug, flexibleLocalAvailabilityBySlug, flexibleSearch, guests, landing, liveAvailabilityBySlug, maxPrice, minPrice, supplierSearch, mapCandidates, onlineOnly, onlineCapabilities, undatedSearch, pathname, requestedLocation, selectedStay, selectedTypes, sort]);

  const nearbyRecovery = useMemo(() => {
    if (filtered.length >= PLACE_SEARCH_MINIMUM_RESULTS || isWholeCountrySelection(area)) return [];
    // A nearby fallback may broaden geography only. An explicit supplier
    // unavailability for the selected dates remains a hard exclusion.
    const eligible = mapCandidates.filter((property) => {
      if (onlineOnly && !matchesOnline(property)) return false;
      const priceFilterActive = minPrice > VACATION_PRICE_MIN || maxPrice < VACATION_PRICE_MAX;
      if (priceFilterActive) {
        const price = searchPrice(property);
        if (typeof price !== "number" || price < minPrice || price > maxPrice) return false;
      }
      if (!selectedStay && !flexibleSearch) return true;
      if (selectedStay) return eligibleForSelectedStay(property);
      return liveAvailabilityFor(property.slug)?.quote?.availability !== "unavailable";
    });
    return nearbySearchRecommendations(eligible, area, managedGeography, { key: (property) => property.slug });
  }, [VACATION_PRICE_MAX, VACATION_PRICE_MIN, area, filtered.length, managedGeography, mapCandidates, maxPrice, minPrice, onlineOnly, onlineCapabilities, undatedSearch, selectedStay, flexibleSearch, supplierSearch.results, supplierSearch.status, liveAvailabilityBySlug, flexibleAvailabilityBySlug, flexibleLocalAvailabilityBySlug]);
  // Keep the exact location cohort first. The exact cohort is already ranked by
  // the selected sort and booking priority; nearby recovery is distance-ranked.
  const resultSet = useMemo(() => completePlaceSearchResults(filtered, nearbyRecovery, (place) => place.slug), [filtered, nearbyRecovery]);
  const mapPriceById = Object.fromEntries(resultSet.flatMap<[string, MapPriceQuote]>((property) => {
    const availability = liveAvailabilityFor(property.slug)?.quote;
    if (selectedStay || flexibleSearch) {
      if (availability?.availability !== "available") return [];
      const amount = availability.priceMode === "stay_total" ? availability.totalPrice : availability.nightlyPrice;
      if (typeof amount !== "number" || amount <= 0) return [];
      const mode = availability.priceMode === "stay_total" ? "stay_total" : "nightly";
      return [[property.slug, { amount, mode }]];
    }
    const amount = supplierStartingPrice(startingPrices[property.slug] ?? property);
    return amount ? [[property.slug, { amount, mode: "from" }]] : [];
  })) as Record<string, MapPriceQuote>;

  useEffect(() => {
    if (catalogLoading || catalogError || onlineCheckPending || datedAvailabilityPending || datedAvailabilityError) return;
    if (onlineOnly && undatedCapabilityUnavailable) return;
    const timer = window.setTimeout(() => trackSearchResults({
      world: "vacation",
      location: area === "הכל" ? "כל הארץ" : area,
      hasDate: Boolean(selectedStay?.from || flexibleSearch),
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
  }, [accessibleOnly, area, catalogError, catalogLoading, resultSet.length, guests, onlineOnly, onlineCheckPending, datedAvailabilityPending, datedAvailabilityError, undatedCapabilityUnavailable, flexibleSearch, pool, selectedExtras, selectedStay?.from, selectedTypes, spa]);

  const draftCandidates = properties.filter((property) => {
    if (selectedStay && shownFilters.guests === guests && !eligibleForSelectedStay(property)) return false;
    if (shownFilters.onlineOnly && ((!undatedSearch && shownFilters.guests !== guests) || !matchesOnline(property))) return false;
    const matchesType = !supplierTypeFilterAvailable || matchesAnyAccommodationType(property.type, shownFilters.selectedTypes, landing);
    const matchesExtras = shownFilters.selectedExtras.every((id) => {
      if (id === "accessible") return hasVerifiedAccessibilityFeature(property.features);
      return matchesVacationSearchFilter(property, id);
    });
    const priceFilterActive = shownFilters.minPrice > VACATION_PRICE_MIN || shownFilters.maxPrice < VACATION_PRICE_MAX;
    const draftPrice = searchPrice(property);
    const matchesPrice = !priceFilterActive || (!shownFilters.onlineOnly && !priceFilterAvailable)
      || (typeof draftPrice === "number" && draftPrice >= shownFilters.minPrice && draftPrice <= shownFilters.maxPrice);
    return matchesType
      && (property.capacityScope === "unit" || property.guests >= shownFilters.guests)
      && matchesPrice
      && (!shownFilters.pool || matchesVacationSearchFilter(property, "pool"))
      && (!shownFilters.spa || ["spa", "jacuzzi", "sauna"].some((id) => matchesVacationSearchFilter(property, id)))
      && (!shownFilters.whole || (property.capacityScope !== "unit" && property.scenario === "single"))
      && (!shownFilters.accessibleOnly || hasVerifiedAccessibilityFeature(property.features))
      && matchesExtras;
  });
  const draftUsesLandingSet = Boolean(landing?.listingSlugs?.length
      && (!landingType || (shownFilters.selectedTypes.length === 1 && shownFilters.selectedTypes[0] === landingType))
    && (landing.area ? shownFilters.area === landing.area : shownFilters.area === "הכל"));
  const draftMatches = draftCandidates.filter((property) => draftUsesLandingSet ? landing?.listingSlugs?.includes(property.slug) : matchesSearchLocation(property, shownFilters.area));
  const draftNearby = (shownFilters.onlineOnly || Boolean(selectedStay)) && shownFilters.guests === guests && draftMatches.length < PLACE_SEARCH_MINIMUM_RESULTS && !isWholeCountrySelection(shownFilters.area)
    ? nearbySearchRecommendations(draftCandidates, shownFilters.area, managedGeography, { key: (property) => property.slug }) : [];
  const draftResultCount = shownFilters.onlineOnly || selectedStay ? completePlaceSearchResults(draftMatches, draftNearby, place => place.slug).length : draftMatches.length;
  const draftResultLabel = shownFilters.onlineOnly && undatedCapabilityUnavailable ? "הצגת המקומות באזור"
    : !undatedSearch && (datedAvailabilityPending || shownFilters.guests !== guests) ? "החלת סינונים"
    : draftResultCount === 1 ? "הצגת מקום אחד" : `הצגת ${draftResultCount} מקומות`;

  const displayedResults = useMemo(() => {
    if (!mapOpen || !mapVisibleIds) return resultSet;
    const visible = new Set(mapVisibleIds);
    return resultSet.filter((property) => visible.has(property.slug));
  }, [resultSet, mapOpen, mapVisibleIds]);
  const resultWindowKey = [area, selectedTypes.join(","), minPrice, maxPrice, pool, spa, whole, accessibleOnly, selectedExtras.join(","), sort, searchQuery, mapOpen ? "map" : "list"].join("|");
  // Keep the initial SSR window small while preserving total, ranking,
  // filters and the progressive continuation.
  // A search page must open with a useful comparison set. Six cards made a
  // healthy result set look truncated until the user reached the sentinel.
  const initialResultWindow = 18;
  const [resultWindow, setResultWindow] = useState({ key: resultWindowKey, count: initialResultWindow });
  const visibleResultCount = resultWindow.key === resultWindowKey ? resultWindow.count : initialResultWindow;
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
    for (const key of ["adults", "children", "infants"]) {
      const value = searchParams.get(key);
      if (value !== null) params.set(key, value);
    }
    return params.toString();
  }, [guests, searchParams]);
  const detailHref = (slug: string) => {
    if (!flexibleSearch) return `/business?id=${slug}${detailQuery ? `&${detailQuery}` : ""}`;
    const stay = selectedStayFor(slug);
    if (!stay) return `/business?id=${slug}`;
    const params = new URLSearchParams({ source: "search", from: stay.from, till: stay.till, guests: String(guests), rooms: String(requestedRooms.length) });
    return `/business?id=${slug}&${params.toString()}`;
  };

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
    accessibleOnly ? { id: "accessible", label: "נגישות לנכים", remove: () => changeBinaryFilter("accessible", false) } : null,
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
              <fieldset className="vacation-online-filter"><legend>דרך הזמנה</legend><label><input type="checkbox" checked={shownFilters.onlineOnly} onChange={(event) => changeOnlineFilter(event.target.checked)} /><span>ניתן להזמין אונליין</span></label><p data-no-translate>{translate(undatedSearch ? "מקומות שאפשר להזמין באתר. בחרו תאריכים לבדיקת זמינות ומחיר לשהייה שלכם." : "רק מקומות עם מחיר וזמינות לתאריכים שבחרתם, שאפשר להזמין באתר.")}</p></fieldset>
              {filterSection === "types" ? <fieldset className="vacation-type-options"><legend>סוגי אירוח, אפשר לבחור כמה אפשרויות</legend>{legacyAccommodationTypes.map((item) => <label key={item.label}><input type="checkbox" checked={shownFilters.selectedTypes.includes(item.label)} onChange={() => toggleType(item.label)} /> {item.label}</label>)}</fieldset> : <div className="vacation-more-filters">
                <fieldset className="vacation-price-filter" disabled={!priceFilterAvailable}>
                  <legend>מחיר ללילה</legend>
                  <p>בחרו את המחיר הנמוך והגבוה שמתאים לכם.</p>
                  <output className="vacation-price-filter__summary" aria-live="polite"><span>מ־<bdi>{shownFilters.minPrice.toLocaleString("he-IL")}</bdi> ₪</span><i aria-hidden="true">עד</i><span><bdi>{shownFilters.maxPrice.toLocaleString("he-IL")}</bdi> ₪</span></output>
                  <div className="vacation-price-filter__inputs">
                    <label><span>מחיר מינימלי</span><VacationPriceInput value={shownFilters.minPrice} minimum={VACATION_PRICE_MIN} maximum={shownFilters.maxPrice} emptyValue={VACATION_PRICE_MIN} ariaLabel="מחיר מינימום בשקלים" onValueChange={(nextValue) => changePriceRange(nextValue, shownFilters.maxPrice)} /></label>
                    <span aria-hidden="true">עד</span>
                    <label><span>מחיר מקסימלי</span><VacationPriceInput value={shownFilters.maxPrice} minimum={shownFilters.minPrice} maximum={VACATION_PRICE_MAX} emptyValue={VACATION_PRICE_MAX} ariaLabel="מחיר מקסימום בשקלים" onValueChange={(nextValue) => changePriceRange(shownFilters.minPrice, nextValue)} /></label>
                  </div>
                  {!priceFilterAvailable ? <small className="vacation-price-filter__notice">טווח המחיר ייפתח כשהמחירים המעודכנים ייטענו.</small> : null}
                </fieldset>
                <div className="vacation-extra-groups">{legacyExtraFilterGroups.map((group) => <fieldset key={group.title}><legend>{group.title}</legend>{group.options.map((item) => <label key={item.id}><input type="checkbox" checked={shownFilters.selectedExtras.includes(item.id)} onChange={() => toggleExtraFilter(item.id)} /> {item.label}</label>)}</fieldset>)}</div>
              </div>}
            </div>
            <div className="filter-panel__actions">
              <button type="button" className="button primary filter-apply" data-no-translate onClick={applyFilters}>{translate(draftResultLabel)}</button>
              <button type="button" className="button subtle wide filter-reset" onClick={resetFilters}>ניקוי סינונים</button>
            </div>
          </aside>

          <section className="results-list" aria-label="תוצאות">
            <section className="results-heading">
              <div><h1>{translate(landing?.title || (area === "הכל" ? "נופש ברחבי הארץ" : `נופש ב${area}`))}</h1><div className="results-heading__meta">{!onlineCheckPending && !datedAvailabilityPending && !datedAvailabilityError && !undatedCapabilityUnavailable ? <p className="results-heading__inventory" aria-live="polite">{inventorySummary}</p> : null}</div></div>
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
            {onlineOnly && (!undatedSearch || !resultSet.length || undatedCapabilityUnavailable) ? <div className="online-booking-filter-notice" role={(undatedSearch ? onlineCapabilities.status === "error" : datedAvailabilityError) ? "alert" : "status"} aria-busy={undatedSearch ? onlineCapabilities.status === "loading" : datedAvailabilityPending}>
              <p data-no-translate>{translate(undatedSearch
                ? onlineCapabilities.status === "loading" ? "טוענים מקומות להזמנה אונליין..." : onlineCapabilities.status === "error" ? "לא הצלחנו להחיל כרגע את סינון ההזמנה אונליין. מוצגים כל המקומות באזור, בלי סימון הזמנה אונליין." : "לא נמצאו מקומות להזמנה אונליין בבחירה הזו."
                : !selectedStay && !flexibleSearch ? "בחרו תאריכים תקינים לבדיקת זמינות." : datedAvailabilityError ? "לא הצלחנו לבדוק הזמנה אונליין כרגע." : datedAvailabilityPending ? "בודקים אילו מקומות ניתן להזמין אונליין..." : resultSet.length ? "רק מקומות עם מחיר וזמינות לתאריכים שבחרתם, שאפשר להזמין באתר." : "לא נמצאו מקומות להזמנה אונליין בבחירה הזו.")}</p>
              {!undatedSearch && (!selectedStay && !flexibleSearch || !datedAvailabilityPending && !datedAvailabilityError && !resultSet.length) ? <button className="button secondary" type="button" onClick={() => setOpenDatesRequest((value) => value + 1)}>בחירת תאריכים</button> : null}
              {(undatedSearch ? onlineCapabilities.status === "error" : datedAvailabilityError) ? <button className="button secondary" type="button" onClick={() => setOnlineSearchRetry((value) => value + 1)}>לנסות שוב</button> : null}
              {!onlineCheckPending && !resultSet.length ? <button className="button subtle" type="button" onClick={() => changeOnlineFilter(false)}>הסרת סינון הזמנה אונליין</button> : null}
            </div> : null}
            {selectedStay && !onlineOnly && (datedAvailabilityPending || datedAvailabilityError || supplierSearch.stale || !resultSet.length) ? <div className="online-booking-filter-notice" role={datedAvailabilityError ? "alert" : "status"} aria-busy={datedAvailabilityPending}>
              <p>{datedAvailabilityPending ? "בודקים אילו מקומות פנויים לתאריכים שבחרתם..." : datedAvailabilityError ? "לא הצלחנו לבדוק זמינות כרגע. אפשר לנסות שוב או לשנות תאריכים." : supplierSearch.stale ? "מוצגות תוצאות הבדיקה האחרונה. הזמינות תאושר שוב לפני ההזמנה." : "לא נמצאו מקומות פנויים בבחירה הזו."}</p>
              {datedAvailabilityError ? <button className="button secondary" type="button" onClick={() => setOnlineSearchRetry((value) => value + 1)}>לנסות שוב</button> : null}
              {!datedAvailabilityPending && !resultSet.length ? <button className="button subtle" type="button" onClick={() => setOpenDatesRequest((value) => value + 1)}>בחירת תאריכים אחרים</button> : null}
            </div> : null}
            {availabilityDemoActive ? <div className="availability-demo-summary" role="status"><strong>{availabilityDemoCopy[language].title}</strong><span>{availabilityDemoCopy[language].text}</span><small>{selectedStay?.from}{" "}{String.fromCharCode(183)}{" "}{selectedStay?.till}</small></div> : null}
            {flexibleSearch ? <div className="availability-demo-summary availability-demo-summary--live" role="status"><strong>{flexibleAvailabilityCopy[language].title}</strong><span>{flexibleAvailabilityCopy[language].text}</span></div> : null}
            {resultSet.length > filtered.length ? <NearbySearchNotice dated={Boolean(selectedStay || flexibleSearch)} /> : null}
            <div className="results-toolbar"><div className="results-toolbar__actions"><ResultsViewToggle value={viewMode} onChange={setViewMode} />{resultSet.length > 0 && <button className={`button map-button mobile-map-fab ${mapOpen ? "active" : ""}`} type="button" aria-label={mapOpen ? "חזרה לתוצאות" : "הצגת תוצאות על המפה"} aria-pressed={mapOpen} data-map-interactive={mapInteractive} disabled={!mapInteractive} onPointerEnter={preloadListingMap} onFocus={preloadListingMap} onTouchStart={preloadListingMap} onClick={(event) => { event.preventDefault(); event.stopPropagation(); if (mapOpen) closeResultsMap(); else openResultsMap(); }}><MapIcon /><span className="map-button__desktop-label">{mapOpen ? "חזרה לתוצאות" : "תצוגה על מפה"}</span><span className="map-button__mobile-label" aria-hidden="true">מפה</span></button>}</div><ModernSelect className="results-toolbar__sort" compact label="מיון לפי" value={sort} onChange={changeSort} options={vacationSortOptions} /></div>
            {guests > 2 && properties.some((property) => property.capacityScope === "unit") ? <SupplierCapacityNotice /> : null}
            {!mapOpen && <ProgressiveResults autoLoad initialCount={initialResultWindow} className={`result-cards results-view results-view--${viewMode}`} resetKey={resultWindowKey} totalCount={displayedResults.length} visibleCount={visibleResults.length} onShowMore={() => setResultWindow((current) => ({ key: resultWindowKey, count: Math.min(displayedResults.length, (current.key === resultWindowKey ? current.count : initialResultWindow) + 9) }))}>{visibleResults.map((property) => <PropertyCard key={property.slug} property={property} catalogStartingPrices={startingPrices[property.slug]} onlineCapability={undatedSearch && hasOnlineCapability(onlineCapabilities.capabilities[property.slug])} selectedStay={selectedStayFor(property.slug)} liveAvailabilityState={liveAvailabilityFor(property.slug)} detailHref={detailHref(property.slug)} />)}</ProgressiveResults>}
            {mapOpen && <div className="airbnb-map-split">
              <div className={`airbnb-map-split__results result-cards results-view results-view--${viewMode}`}>{displayedResults.map((property) => <PropertyCard key={property.slug} property={property} catalogStartingPrices={startingPrices[property.slug]} onlineCapability={undatedSearch && hasOnlineCapability(onlineCapabilities.capabilities[property.slug])} selectedStay={selectedStayFor(property.slug)} liveAvailabilityState={liveAvailabilityFor(property.slug)} detailHref={detailHref(property.slug)} mapActive={activeMapPropertyId === property.slug} onActiveChange={(active) => setActiveMapPropertyId(active ? property.slug : null)} />)}</div>
              <div className="airbnb-map-split__map"><DeferredListingMap listings={resultSet} initialListings={resultSet} autoLoad detailQuery={detailQuery} priceById={mapPriceById} onClose={closeResultsMap} onVisibleCountChange={setVisibleMapCount} onVisiblePlaceIdsChange={setMapVisibleIds} activePlaceId={activeMapPropertyId} onActivePlaceChange={setActiveMapPropertyId} /></div>
            </div>}
            {!onlineOnly && !selectedStay && !catalogLoading && !catalogError && (mapOpen && mapVisibleIds ? displayedResults.length === 0 : resultSet.length === 0) && <div className="empty-state"><h2>לא נמצאה התאמה מדויקת או מקום קרוב</h2><p>אפשר לשנות אזור, להפחית את כמות האורחים או להסיר מאפיין.</p><button className="button primary" type="button" onClick={resetFilters}>ניקוי סינונים</button></div>}
            {!mapOpen && !selectedStay && !flexibleSearch && selectedTypes.length === 0 && !pool && !spa && !whole && !accessibleOnly && !onlineOnly && !selectedExtras.length ? <RegionalAvailability world="vacation" region={area} guests={guests} embedded /> : null}
            {landing && filtered.length > 0 && <>
              <section id="accommodation-guide" className="accommodation-page-guide" aria-labelledby="accommodation-page-guide-title"><h2 id="accommodation-page-guide-title">{landing.guideTitle || `איך בוחרים ${landing.breadcrumb}`}</h2><div>{(landing.guideParagraphs || [landing.description]).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></section>
              {landing.faqs?.length ? <section id="accommodation-faq" className="accommodation-page-faq" aria-labelledby="accommodation-page-faq-title"><h2 id="accommodation-page-faq-title">שאלות ותשובות על {landing.breadcrumb}</h2><div>{landing.faqs.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section> : null}
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
