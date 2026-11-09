"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { vacationStayFromSearch } from "../lib/vacation-date-range";
// Date pickers are interaction-only. Keep the initial search shell small and
// load the relevant picker when the user opens dates, without changing its API.
const DatePickerCloseContext = createContext<() => void>(() => undefined);
const DatePickerLoading = ({ error, retry }: { error?: Error | null; retry?: () => void }) => {
  const { language } = useSiteLanguage();
  const close = useContext(DatePickerCloseContext);
  const copy = {
    he: { loading: "טוענים את לוח התאריכים…", error: "לא הצלחנו לפתוח את לוח התאריכים.", retry: "ניסיון חוזר", close: "סגירה" },
    en: { loading: "Loading dates…", error: "We couldn't open the calendar.", retry: "Try again", close: "Close" },
    ru: { loading: "Загрузка календаря…", error: "Не удалось открыть календарь.", retry: "Повторить", close: "Закрыть" },
    fr: { loading: "Chargement du calendrier…", error: "Le calendrier n’a pas pu être ouvert.", retry: "Réessayer", close: "Fermer" },
  }[language];
  return <div className="search-popover" role={error ? "alert" : "status"} aria-live="polite"><span>{error ? copy.error : copy.loading}</span>{error && retry ? <button type="button" onClick={retry}>{copy.retry}</button> : null}<button type="button" onClick={close}>{copy.close}</button></div>;
};
const CalendarDemo = dynamic(() => import("../calendar-demo").then((module) => module.CalendarDemo), { ssr: false, loading: DatePickerLoading });
const EventDatePicker = dynamic(() => import("./event-date-picker").then((module) => module.EventDatePicker), { ssr: false, loading: DatePickerLoading });
const SpaDatePicker = dynamic(() => import("./spa-date-picker").then((module) => module.SpaDatePicker), { ssr: false, loading: DatePickerLoading });
import { type WorldId } from "../data/world-data";
import { isWholeCountrySelection, searchLocationOptions, vacationLocationGroups, type SearchMode } from "../data/search-taxonomy";
import { CalendarIcon, GiftIcon, PeopleIcon, PinIcon, SearchIcon } from "./site-icons";
import { SearchWorldTabs } from "./world-switcher";
import { useSiteLanguage } from "../i18n/locale-provider";
import { languageFromPathname, localizedPath, type SiteLanguage } from "../i18n/locale-routing";
import { cleanVacationPath } from "../data/vacation-landings";
import { cleanAccommodationPath } from "../data/accommodation-landings";
import { spaSearchHref, spaSearchStateFromValues } from "../data/spa-search-landings";
import { canonicalSearchLocation, uniqueSearchLocations } from "../lib/geographic-names.ts";
import { eventSearchHref, hourlySearchHref, mergeSearchHref } from "../data/world-search-landings";
import { trackSearchSubmitted } from "../lib/analytics";
import type { PlaceSearchResult } from "../data/search-place-inventory";
import { useManagedGeography } from "./use-managed-geography";
import { destinationInventory, matchingDestinations, destinationChildren, destinationPage, recentDestinations, QUICK_DESTINATIONS, DESTINATION_PAGE_SIZE } from "../lib/destination-picker";
import { destinationPickerCopy } from "../i18n/destination-picker-copy";
import { requestNearbyOrigin } from "./use-nearby-sort";
import { latinBusinessAlias, localizedBusinessText } from "../i18n/localized-business-content";
import { useWorldAvailability } from "./world-availability-provider";
import { semanticNearbyPath } from "../lib/homepage-search-href";

type SpaAudience = "single" | "couple" | "group" | "day-pass";

type VacationParty = {
  adults: number;
  children: number;
  infants: number;
  pets: number;
  rooms: number;
};

type VacationFlexibleSearch = {
  stay: "weekend" | "long-weekend" | "week" | "month";
  month: string;
  days: number;
};

const FLEXIBLE_STAYS = new Set<VacationFlexibleSearch["stay"]>(["weekend", "long-weekend", "week", "month"]);
const FLEXIBLE_DAYS = new Set([0, 1, 3, 7]);

function flexibleSearchFromParams(searchParams: { get(name: string): string | null }): VacationFlexibleSearch | null {
  if (searchParams.get("dateMode") !== "flexible") return null;
  const stay = searchParams.get("stay") as VacationFlexibleSearch["stay"] | null;
  const month = searchParams.get("month");
  const days = Number(searchParams.get("flexDays"));
  if (!stay || !FLEXIBLE_STAYS.has(stay) || !month || !/^\d{4}-\d{2}$/.test(month) || !FLEXIBLE_DAYS.has(days)) return null;
  return { stay, month, days };
}

function flexibleDateLabel(search: VacationFlexibleSearch, language: SiteLanguage) {
  const locale = { he: "he-IL", en: "en-GB", ru: "ru-RU", fr: "fr-FR" }[language];
  const stayLabels: Record<SiteLanguage, Record<VacationFlexibleSearch["stay"], string>> = {
    he: { weekend: "סוף שבוע", "long-weekend": "סוף שבוע ארוך", week: "שבוע", month: "חודש" },
    en: { weekend: "Weekend", "long-weekend": "Long weekend", week: "Week", month: "Month" },
    ru: { weekend: "Выходные", "long-weekend": "Длинные выходные", week: "Неделя", month: "Месяц" },
    fr: { weekend: "Week-end", "long-weekend": "Long week-end", week: "Semaine", month: "Mois" },
  };
  const month = new Date(`${search.month}-01T12:00:00`);
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(month);
  const flexibility = search.days === 0
    ? { he: "ללא גמישות", en: "No flexibility", ru: "Без гибкости", fr: "Sans flexibilité" }[language]
    : `±${search.days} ${{ he: search.days === 1 ? "יום" : "ימים", en: search.days === 1 ? "day" : "days", ru: search.days === 1 ? "день" : "дней", fr: search.days === 1 ? "jour" : "jours" }[language]}`;
  return `${stayLabels[language][search.stay]} · ${monthLabel} · ${flexibility}`;
}

const VACATION_PARTY_ROWS: Array<{
  id: keyof VacationParty;
  label: string;
  description: string;
  minimum: number;
  maximum: number;
}> = [
  { id: "adults", label: "מבוגרים", description: "מגיל 13 ומעלה", minimum: 1, maximum: 30 },
  { id: "children", label: "ילדים", description: "בגיל 2 עד 12", minimum: 0, maximum: 20 },
  { id: "infants", label: "תינוקות", description: "מתחת לגיל שנתיים", minimum: 0, maximum: 10 },
  { id: "pets", label: "חיות מחמד", description: "מביאים אתכם חיית מחמד?", minimum: 0, maximum: 5 },
  { id: "rooms", label: "חדרים", description: "מספר חדרי השינה הדרוש", minimum: 1, maximum: 12 },
];

function initialVacationParty(searchParams: { get(name: string): string | null }, fallbackGuests: number): VacationParty {
  const adults = Math.max(1, Number(searchParams.get("adults")) || fallbackGuests);
  return {
    adults,
    children: Math.max(0, Number(searchParams.get("children")) || 0),
    infants: Math.max(0, Number(searchParams.get("infants")) || 0),
    pets: Math.max(0, Number(searchParams.get("pets")) || 0),
    rooms: Math.max(1, Number(searchParams.get("rooms")) || 1),
  };
}

const SPA_AUDIENCES: Array<{ id: SpaAudience; label: string; description: string; guests: number }> = [
  { id: "single", label: "יחיד", description: "טיפול או חבילת ספא לאדם אחד", guests: 1 },
  { id: "couple", label: "זוגי", description: "חוויה זוגית או שני טיפולים", guests: 2 },
  { id: "group", label: "קבוצה", description: "שלושה משתתפים ומעלה", guests: 3 },
  { id: "day-pass", label: "יום כיף (ללא טיפולים)", description: "כניסה למתקנים, מאדם אחד ומעלה", guests: 1 },
];

function defaultDateLabel(mode: SearchMode) {
  if (mode === "events") return "בחרו מועד";
  if (mode === "spa") return "בחרו תאריך או המשיכו בלי";
  return "בחרו תאריכים";
}

function dateLabelFromSearch(searchParams: { get(name: string): string | null }, mode: SearchMode, language: SiteLanguage) {
  const locale = { he: "he-IL", en: "en-GB", ru: "ru-RU", fr: "fr-FR" }[language];
  const separator = { he: "עד", en: "to", ru: "по", fr: "au" }[language];
  const formatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const parse = (value: string) => new Date(`${value}T12:00:00`);
  if (mode === "spa") {
    const date = searchParams.get("date");
    return date ? formatter.format(parse(date)) : defaultDateLabel(mode);
  }
  if (mode === "events") {
    const from = searchParams.get("from");
    const till = searchParams.get("to") || from;
    if (!from || !till) return defaultDateLabel(mode);
    return from === till ? formatter.format(parse(from)) : `${formatter.format(parse(from))} ${separator} ${formatter.format(parse(till))}`;
  }
  const flexibleSearch = flexibleSearchFromParams(searchParams);
  if (flexibleSearch) return flexibleDateLabel(flexibleSearch, language);
  const from = searchParams.get("from");
  const till = searchParams.get("till");
  if (!from || !till) return defaultDateLabel(mode);
  return `${formatter.format(parse(from))} ${separator} ${formatter.format(parse(till))}`;
}

function activeRouteLanguage(fallback: SiteLanguage): SiteLanguage {
  return typeof window === "undefined" ? fallback : languageFromPathname(window.location.pathname);
}

function defaultGuestCount(mode: SearchMode) {
  if (mode === "events") return 0;
  if (mode === "spa") return 0;
  return 2;
}

function parseSpaAudience(value: string | null): SpaAudience | null {
  return SPA_AUDIENCES.some((option) => option.id === value) ? value as SpaAudience : null;
}

const HOURLY_PRICE_OPTIONS = [0, 250, 400, 600] as const;

type ImmediateSearchOverrides = {
  location?: string;
  maximumPrice?: number;
  spaAudience?: SpaAudience | null;
  spaDate?: { date: string | null; withoutDate: boolean };
  eventGuests?: number;
  eventDateRange?: { from: string | null; to: string | null };
  vacationParty?: VacationParty;
  vacationDateRange?: { from: string | null; till: string | null };
  vacationFlexibleSearch?: VacationFlexibleSearch | null;
};

function isDesktopSearchViewport() {
  return window.matchMedia("(min-width: 821px)").matches;
}

function normalizeHourlyPrice(value: string | null) {
  const price = Number(value) || 0;
  return HOURLY_PRICE_OPTIONS.includes(price as typeof HOURLY_PRICE_OPTIONS[number]) ? price : 0;
}

export function SearchBox({ mode = "vacation", compact = false, forceExpanded = false, showWorlds = true, initialLocation, initialGuests, basePath, vacationType, initialSpaAudience, initialSpaFeatures = [], openDatesRequest = 0, openLocationRequest = 0 }: { mode?: SearchMode; compact?: boolean; forceExpanded?: boolean; showWorlds?: boolean; initialLocation?: string; initialGuests?: number; basePath?: string; vacationType?: string; initialSpaAudience?: string; initialSpaFeatures?: string[]; openDatesRequest?: number; openLocationRequest?: number }) {
  const router = useRouter();
  const { enabled } = useWorldAvailability();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const [nearbySelection, setNearbySelection] = useState(searchParams.get("sort") === "nearest");
  const nearbySelectionRef = useRef(nearbySelection);
  const { language, translate } = useSiteLanguage();
  const dateDisplayLanguage = language;
  const isHourly = mode === "hourly";
  const [searchCommitted, setSearchCommitted] = useState(() => compact || Boolean(searchParamsKey) || Boolean(initialLocation) || Boolean(initialSpaAudience) || initialSpaFeatures.length > 0);
  const shouldCollapse = forceExpanded ? false : compact || searchCommitted;
  const destinationOptions = useMemo(() => searchLocationOptions(mode), [mode]);
  const managedGeography = useManagedGeography();
  const [placeInventoryResult, setPlaceInventoryResult] = useState<{ mode: SearchMode; places: PlaceSearchResult[] } | null>(null);
  const [placeInventoryError, setPlaceInventoryError] = useState(false);
  const [locationValue, setLocationValue] = useState(() => {
    const requestedLocation = searchParams.get("location");
    return requestedLocation
      ? (isWholeCountrySelection(requestedLocation) ? "כל הארץ" : requestedLocation)
      : initialLocation || "כל הארץ";
  });
  // Keep the initial client render identical to the server, then localize from
  // the actual route in the synchronization effect below.
  const [dates, setDates] = useState(() => dateLabelFromSearch(searchParams, mode, language));
  const [vacationDateRange, setVacationDateRange] = useState<{ from: string | null; till: string | null }>(() => {
    const selectedStay = vacationStayFromSearch(searchParams, language);
    return { from: selectedStay?.from || null, till: selectedStay?.till || null };
  });
  const [vacationFlexibleSearch, setVacationFlexibleSearch] = useState<VacationFlexibleSearch | null>(() => flexibleSearchFromParams(searchParams));
  const [eventDateRange, setEventDateRange] = useState<{ from: string | null; to: string | null }>(() => ({ from: searchParams.get("from"), to: searchParams.get("to") }));
  const [spaDate, setSpaDate] = useState<{ date: string | null; withoutDate: boolean }>(() => ({ date: searchParams.get("date"), withoutDate: searchParams.get("withoutDate") === "1" }));
  const [spaAudience, setSpaAudience] = useState<SpaAudience | null>(() => parseSpaAudience(searchParams.get("spaFor") || initialSpaAudience || null));
  const [guests, setGuests] = useState(() => Number(searchParams.get("guests")) || initialGuests || defaultGuestCount(mode));
  const [vacationParty, setVacationParty] = useState<VacationParty>(() => initialVacationParty(searchParams, Number(searchParams.get("guests")) || initialGuests || 2));
  const locationValueRef = useRef(locationValue);
  const vacationDateRangeRef = useRef(vacationDateRange);
  const vacationFlexibleSearchRef = useRef(vacationFlexibleSearch);
  const eventDateRangeRef = useRef(eventDateRange);
  const spaDateRef = useRef(spaDate);
  const vacationPartyRef = useRef(vacationParty);
  locationValueRef.current = locationValue;
  vacationDateRangeRef.current = vacationDateRange;
  vacationFlexibleSearchRef.current = vacationFlexibleSearch;
  eventDateRangeRef.current = eventDateRange;
  spaDateRef.current = spaDate;
  vacationPartyRef.current = vacationParty;
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [datePickerMounted, setDatePickerMounted] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [browseKey, setBrowseKey] = useState<string | null | undefined>(undefined);
  const [browsePage, setBrowsePage] = useState(0);
  const [recentLocations, setRecentLocations] = useState<string[]>([]);
  const pickerCopy = destinationPickerCopy[language];
  useEffect(() => {
    if (!locationOpen) { setBrowseKey(undefined); setBrowsePage(0); return; }
    try { setRecentLocations(JSON.parse(localStorage.getItem("vii-recent-destinations") || "[]")); } catch { setRecentLocations([]); }
  }, [locationOpen]);
  const hasLocationQuery = locationQuery.trim().length > 0;
  const shouldLoadPlaceInventory = hasLocationQuery;
  const placeInventoryLoading = shouldLoadPlaceInventory && placeInventoryResult?.mode !== mode;
  const placeInventory = placeInventoryResult?.mode === mode ? placeInventoryResult.places : [];
  useEffect(() => {
    if (!shouldLoadPlaceInventory) return;
    const controller = new AbortController();
    const world = { vacation: "vacations", events: "events", spa: "spa", hourly: "rooms" }[mode];
    setPlaceInventoryResult(null);
    setPlaceInventoryError(false);
    void fetch(`/api/catalog?world=${world}&view=lookup`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("catalog_unavailable");
        const payload = await response.json() as { places?: PlaceSearchResult[] };
        if (!Array.isArray(payload.places)) throw new Error("catalog_unavailable");
        if (!controller.signal.aborted) setPlaceInventoryResult({ mode, places: payload.places });
      })
      .catch(() => {
        if (!controller.signal.aborted) { setPlaceInventoryResult({ mode, places: [] }); setPlaceInventoryError(true); }
      });
    return () => controller.abort();
  }, [mode, shouldLoadPlaceInventory]);
  const [locationStatus, setLocationStatus] = useState("");
  const [locating, setLocating] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [maximumPrice, setMaximumPrice] = useState(() => normalizeHourlyPrice(searchParams.get("maxPrice")));
  const [isSearching, setIsSearching] = useState(false);
  const isSearchingRef = useRef(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  useEffect(() => {
    if (calendarOpen) setDatePickerMounted(true);
  }, [calendarOpen]);
  const searchSurfaceRef = useRef<HTMLDivElement>(null);
  const handledEditSearchRef = useRef(false);
  const [mobileStep, setMobileStep] = useState<"overview" | "location" | "dates" | "guests">("overview");
  useEffect(() => {
    if (handledEditSearchRef.current || mode !== "vacation") return;
    if (new URLSearchParams(window.location.search).get("editSearch") !== "dates") return;
    handledEditSearchRef.current = true;
    setLocationOpen(false);
    setGuestOpen(false);
    setMobileStep("dates");
    if (window.matchMedia("(max-width: 820px)").matches) setMobileExpanded(true);
    setCalendarOpen(true);
  }, [mode]);
  useEffect(() => {
    if (!openDatesRequest || mode !== "vacation") return;
    setLocationOpen(false);
    setGuestOpen(false);
    setMobileStep("dates");
    if (window.matchMedia("(max-width: 820px)").matches) setMobileExpanded(true);
    setCalendarOpen(true);
  }, [openDatesRequest, mode]);
  useEffect(() => {
    if (!openLocationRequest) return;
    const frame = window.requestAnimationFrame(() => {
      setCalendarOpen(false);
      setGuestOpen(false);
      setPriceOpen(false);
      setMobileStep("location");
      if (window.matchMedia("(max-width: 820px)").matches) setMobileExpanded(true);
      setLocationOpen(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [openLocationRequest]);
  const visibleDates = mode === "vacation" && vacationDateRange.from && vacationDateRange.till
    // Render with the provider language so the server and the first client render
    // stay identical. LocaleProvider synchronizes the route language after hydration.
    ? dateLabelFromSearch({ get: (name) => name === "from" ? vacationDateRange.from : name === "till" ? vacationDateRange.till : null }, mode, dateDisplayLanguage)
    : mode === "vacation" && vacationFlexibleSearch
      ? flexibleDateLabel(vacationFlexibleSearch, dateDisplayLanguage)
      : dates;

  const restoreCommittedSearchState = useCallback(() => {
    const committedParams = new URLSearchParams(searchParamsKey);
    const requestedLocation = committedParams.get("location");
    const committedLocation = requestedLocation
      ? (isWholeCountrySelection(requestedLocation) ? "כל הארץ" : requestedLocation)
      : initialLocation || "כל הארץ";
    const committedStay = vacationStayFromSearch(committedParams, activeRouteLanguage(language));
    const committedVacationRange = { from: committedStay?.from || null, till: committedStay?.till || null };
    const committedFlexibleSearch = flexibleSearchFromParams(committedParams);
    const committedEventRange = { from: committedParams.get("from"), to: committedParams.get("to") };
    const committedSpaDate = { date: committedParams.get("date"), withoutDate: committedParams.get("withoutDate") === "1" };
    const committedParty = initialVacationParty(committedParams, Number(committedParams.get("guests")) || initialGuests || 2);
    nearbySelectionRef.current = committedParams.get("sort") === "nearest";
    setNearbySelection(nearbySelectionRef.current);
    locationValueRef.current = committedLocation;
    vacationDateRangeRef.current = committedVacationRange;
    vacationFlexibleSearchRef.current = committedFlexibleSearch;
    eventDateRangeRef.current = committedEventRange;
    spaDateRef.current = committedSpaDate;
    vacationPartyRef.current = committedParty;
    setLocationValue(committedLocation);
    setDates(dateLabelFromSearch(committedParams, mode, activeRouteLanguage(language)));
    setVacationDateRange(committedVacationRange);
    setVacationFlexibleSearch(committedFlexibleSearch);
    setEventDateRange(committedEventRange);
    setSpaDate(committedSpaDate);
    setSpaAudience(parseSpaAudience(committedParams.get("spaFor") || initialSpaAudience || null));
    setGuests(Number(committedParams.get("guests")) || initialGuests || defaultGuestCount(mode));
    setVacationParty(committedParty);
    setMaximumPrice(normalizeHourlyPrice(committedParams.get("maxPrice")));
  }, [initialGuests, initialLocation, initialSpaAudience, language, mode, searchParamsKey]);

  useEffect(() => {
    if (mode !== "vacation" || !searchParams.has("dates")) return;
    const params = new URLSearchParams(searchParamsKey);
    const recoveredStay = vacationStayFromSearch(params, activeRouteLanguage(language));
    params.delete("dates");
    if (recoveredStay) {
      if (!params.has("from")) params.set("from", recoveredStay.from);
      if (!params.has("till")) params.set("till", recoveredStay.till);
    }
    const query = params.toString();
    router.replace(`${window.location.pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [language, mode, router, searchParams, searchParamsKey]);

  const closeMobileSearch = useCallback(() => {
    setCalendarOpen(false);
    setLocationOpen(false);
    setGuestOpen(false);
    setPriceOpen(false);
    setMobileExpanded(false);
    setMobileStep("overview");
  }, []);

  const cancelMobileSearch = useCallback(() => {
    restoreCommittedSearchState();
    closeMobileSearch();
  }, [closeMobileSearch, restoreCommittedSearchState]);

  const closeGuestPicker = useCallback(() => {
    setGuestOpen(false);
    setMobileStep("overview");
    if (window.matchMedia("(max-width: 820px)").matches) setMobileExpanded(true);
  }, []);

  const closeLocationPicker = useCallback(() => {
    setLocationOpen(false);
    setMobileStep("overview");
    if (window.matchMedia("(max-width: 820px)").matches) setMobileExpanded(true);
  }, []);

  const closeActiveMobileSection = useCallback(() => {
    if (guestOpen) {
      closeGuestPicker();
      return;
    }
    if (locationOpen) {
      closeLocationPicker();
      return;
    }
    if (priceOpen) {
      setPriceOpen(false);
      setMobileStep("overview");
      setMobileExpanded(true);
      return;
    }
    cancelMobileSearch();
  }, [cancelMobileSearch, closeGuestPicker, closeLocationPicker, guestOpen, locationOpen, priceOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      restoreCommittedSearchState();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [restoreCommittedSearchState]);

  // The locale provider intentionally starts in Hebrew to keep hydration
  // stable. Run one route-aware pass after hydration so dynamic date labels
  // are localized even when the URL does not include the display-only
  // `dates` parameter.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDates(dateLabelFromSearch(searchParams, mode, languageFromPathname(window.location.pathname)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [mode, searchParams]);

  useEffect(() => {
    if (!mobileExpanded) return;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    const surface = searchSurfaceRef.current;
    surface?.querySelector<HTMLButtonElement>(".search-mobile-sheet-head button")?.focus({ preventScroll: true });
    const closeOnEscape = (event: KeyboardEvent) => {
      // The separate date dialog owns its keys while it is above this sheet.
      if (surface && event.target instanceof Node && !surface.contains(event.target)) return;
      if (event.key === "Escape") cancelMobileSearch();
      if (event.key !== "Tab" || !surface) return;
      const controls = [...surface.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex="0"]')]
        .filter((element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden");
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      window.removeEventListener("keydown", closeOnEscape);
      window.requestAnimationFrame(() => {
        searchSurfaceRef.current?.querySelector<HTMLElement>(".search-mobile-summary, .search-field")?.focus({ preventScroll: true });
      });
    };
  }, [cancelMobileSearch, mobileExpanded]);

  useEffect(() => {
    if (mobileExpanded || (!locationOpen && !guestOpen && !priceOpen)) return;
    const closeDesktopPopover = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setLocationOpen(false);
      setGuestOpen(false);
      setPriceOpen(false);
      setMobileStep("overview");
    };
    window.addEventListener("keydown", closeDesktopPopover);
    return () => window.removeEventListener("keydown", closeDesktopPopover);
  }, [guestOpen, locationOpen, mobileExpanded, priceOpen]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 821px)");
    const leaveMobileEditor = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) closeMobileSearch();
    };

    desktop.addEventListener("change", leaveMobileEditor);
    return () => desktop.removeEventListener("change", leaveMobileEditor);
  }, [closeMobileSearch]);

  function search(overrides: ImmediateSearchOverrides = {}) {
    if (isSearchingRef.current) return;
    isSearchingRef.current = true;
    setIsSearching(true);
    setSearchCommitted(true);
    closeMobileSearch();
    const selectedLocation = overrides.location === undefined ? locationValueRef.current : canonicalSearchLocation(overrides.location);
    const selectedMaximumPrice = overrides.maximumPrice === undefined ? maximumPrice : overrides.maximumPrice;
    const selectedSpaAudience = overrides.spaAudience === undefined ? spaAudience : overrides.spaAudience;
    const selectedSpaDate = overrides.spaDate || spaDateRef.current;
    const selectedEventGuests = overrides.eventGuests === undefined ? guests : overrides.eventGuests;
    const selectedEventDateRange = overrides.eventDateRange || eventDateRangeRef.current;
    const selectedVacationParty = overrides.vacationParty || vacationPartyRef.current;
    const selectedVacationDateRange = overrides.vacationDateRange || vacationDateRangeRef.current;
    const selectedVacationFlexibleSearch = overrides.vacationFlexibleSearch === undefined ? vacationFlexibleSearchRef.current : overrides.vacationFlexibleSearch;
    const cleanVacationRoute = mode === "vacation" ? (vacationType ? cleanAccommodationPath(vacationType, selectedLocation) : cleanVacationPath(selectedLocation)) : null;
    const cleanSpaRoute = mode === "spa" ? spaSearchHref(spaSearchStateFromValues(selectedLocation, selectedSpaAudience || undefined, initialSpaFeatures)) : null;
    const cleanEventRoute = mode === "events" ? eventSearchHref(selectedLocation) : null;
    const cleanHourlyRoute = mode === "hourly" ? hourlySearchHref(selectedLocation) : null;
    const route = cleanVacationRoute || cleanSpaRoute || cleanEventRoute || cleanHourlyRoute || (basePath && mode === "vacation" ? basePath : "/search/");
    let destination: string;
    const applyVacationDates = (params: URLSearchParams) => {
      params.delete("dates");
      params.delete("dateMode");
      params.delete("stay");
      params.delete("month");
      params.delete("flexDays");
      if (selectedVacationDateRange.from && selectedVacationDateRange.till) {
        params.set("from", selectedVacationDateRange.from);
        params.set("till", selectedVacationDateRange.till);
      } else {
        params.delete("from");
        params.delete("till");
        if (selectedVacationFlexibleSearch) {
          params.set("dateMode", "flexible");
          params.set("stay", selectedVacationFlexibleSearch.stay);
          params.set("month", selectedVacationFlexibleSearch.month);
          params.set("flexDays", String(selectedVacationFlexibleSearch.days));
        }
      }
    };
    if (isHourly) {
      const params = new URLSearchParams();
      if (selectedMaximumPrice > 0) params.set("maxPrice", String(selectedMaximumPrice));
      destination = mergeSearchHref(route, params);
    } else if (mode === "vacation" && cleanVacationRoute) {
      const params = new URLSearchParams();
      applyVacationDates(params);
      if (new URLSearchParams(searchParamsKey).get("online") === "1") params.set("online", "1");
      if (selectedVacationParty.adults !== 2) params.set("adults", String(selectedVacationParty.adults));
      if (selectedVacationParty.children) params.set("children", String(selectedVacationParty.children));
      if (selectedVacationParty.infants) params.set("infants", String(selectedVacationParty.infants));
      if (selectedVacationParty.pets) params.set("pets", String(selectedVacationParty.pets));
      if (selectedVacationParty.rooms !== 1) params.set("rooms", String(selectedVacationParty.rooms));
      destination = mergeSearchHref(route, params);
    } else {
      const params = new URLSearchParams();
      if (mode === "vacation" && !basePath) {
        params.set("location", isWholeCountrySelection(selectedLocation) && language !== "he" ? "all-country" : selectedLocation || "כל הארץ");
      } else if (mode !== "events" && !(basePath && mode === "vacation" && selectedLocation === initialLocation) && selectedLocation !== "כל הארץ") {
        params.set("location", selectedLocation);
      }
      if (mode === "events") {
        if (selectedEventDateRange.from) params.set("from", selectedEventDateRange.from);
        if (selectedEventDateRange.to) params.set("to", selectedEventDateRange.to);
        if (selectedEventGuests > 0) params.set("guests", String(selectedEventGuests));
        const selectedEventSlot = new URLSearchParams(searchParamsKey).get("slot");
        if (selectedEventSlot === "morning" || selectedEventSlot === "evening") params.set("slot", selectedEventSlot);
      } else if (mode === "spa") {
        if(/^\/(?:en\/|fr\/|ru\/)?spas(?:\/|$)/.test(window.location.pathname))for(const key of ['minPrice','maxPrice','sort']){const value=new URLSearchParams(searchParamsKey).get(key);if(value)params.set(key,value);}
        if (selectedSpaDate.date) params.set("date", selectedSpaDate.date);
        if (selectedSpaDate.withoutDate) params.set("withoutDate", "1");
      } else {
        applyVacationDates(params);
        if (mode === "vacation" && new URLSearchParams(searchParamsKey).get("online") === "1") params.set("online", "1");
        if (mode === "vacation" && selectedVacationParty.adults === 2 && selectedVacationParty.children === 0) params.set("guests", "2");
        if (selectedVacationParty.adults !== 2) params.set("adults", String(selectedVacationParty.adults));
        if (selectedVacationParty.children) params.set("children", String(selectedVacationParty.children));
        if (selectedVacationParty.infants) params.set("infants", String(selectedVacationParty.infants));
        if (selectedVacationParty.pets) params.set("pets", String(selectedVacationParty.pets));
        if (selectedVacationParty.rooms !== 1) params.set("rooms", String(selectedVacationParty.rooms));
      }
      destination = mergeSearchHref(route, params);
    }
    if (nearbySelectionRef.current) {
      const nearbyDestination = new URL(destination, window.location.origin);
      nearbyDestination.pathname = semanticNearbyPath(nearbyDestination.pathname, mode);
      // Clean category paths encode these selections in the pathname. Carry
      // them explicitly when moving to the permanent nearby landing page.
      if (mode === "vacation" && vacationType) nearbyDestination.searchParams.set("type", vacationType);
      if (mode === "spa") {
        if (selectedSpaAudience) nearbyDestination.searchParams.set("spaFor", selectedSpaAudience);
        if (initialSpaFeatures.length) nearbyDestination.searchParams.set("features", initialSpaFeatures.join(","));
      }
      nearbyDestination.searchParams.set("sort", "nearest");
      destination = `${nearbyDestination.pathname}${nearbyDestination.search}`;
    }
    try {
      trackSearchSubmitted({ world: mode, location: selectedLocation, hasDate: Boolean(mode === "spa" ? selectedSpaDate.date : mode === "events" ? selectedEventDateRange.from : selectedVacationDateRange.from) });
      const target = localizedPath(destination, language);
      const current = `${window.location.pathname}${window.location.search}`;
      if (current === target || `${current}/` === target || current === `${target}/`) {
        document.querySelector<HTMLElement>("[data-search-results], .results-heading, .search-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
        window.setTimeout(() => { isSearchingRef.current = false; setIsSearching(false); }, 240);
        return;
      }
      // Keep search transitions inside the app router. A document-level
      // navigation reloads the header, locale runtime, styles and route data,
      // which made every search feel like a cold page load.
      router.push(target);
      window.setTimeout(() => { isSearchingRef.current = false; setIsSearching(false); }, 1200);
    } catch {
      isSearchingRef.current = false;
      setIsSearching(false);
    }
  }

  function changeVacationParty(id: keyof VacationParty, difference: number) {
    setVacationParty((current) => {
      const row = VACATION_PARTY_ROWS.find((item) => item.id === id);
      if (!row) return current;
      const next = {
        ...current,
        [id]: Math.min(row.maximum, Math.max(row.minimum, current[id] + difference)),
      };
      vacationPartyRef.current = next;
      setGuests(next.adults + next.children);
      return next;
    });
  }

  function saveVacationParty() {
    if (isDesktopSearchViewport()) {
      search({ vacationParty });
      return;
    }
    closeGuestPicker();
  }

  function saveEventGuests() {
    if (isDesktopSearchViewport()) {
      search({ eventGuests: guests });
      return;
    }
    closeGuestPicker();
  }

  function chooseLocation(place: string, nearest = false) {
    nearbySelectionRef.current = nearest;
    setNearbySelection(nearest);
    const selectedLocation = canonicalSearchLocation(place);
    locationValueRef.current = selectedLocation;
    setLocationValue(selectedLocation);
    const recent = recentDestinations([place, ...(Array.isArray(recentLocations) ? recentLocations : [])], destinations);
    setRecentLocations(recent);
    try { localStorage.setItem("vii-recent-destinations", JSON.stringify(recent)); } catch { /* Search still works when storage is unavailable. */ }
    setLocationOpen(false);
    setLocationQuery("");
    setLocationStatus("");
    if (isDesktopSearchViewport()) {
      search({ location: selectedLocation });
      return;
    }
    if (isHourly) {
      setMobileStep("overview");
      setMobileExpanded(true);
      return;
    }
    setMobileStep("dates");
    setMobileExpanded(true);
    setCalendarOpen(true);
  }

  async function chooseNearbyLocation() {
    if (locating) return;
    setLocating(true);
    setLocationStatus("מאתרים את המיקום שלך...");
    try {
      await requestNearbyOrigin();
      // Do not turn precise coordinates into a city-only filter. The complete
      // country inventory is ranked by the retained browser point.
      chooseLocation("כל הארץ", true);
    } catch {
      setLocationStatus("לא הצלחנו לקבל מיקום מהדפדפן. אפשר לאפשר גישה למיקום ולנסות שוב, או לבחור עיר ואזור.");
    } finally { setLocating(false); }
  }
  function expandMobileSearch() {
    if (window.matchMedia("(max-width: 820px)").matches) setMobileExpanded(true);
  }

  const activeWorld = (mode === "spa" ? "spa" : mode === "hourly" ? "hourly" : mode) as WorldId;
  const peopleLabel = mode === "events" ? "כמות משתתפים" : mode === "spa" ? "למי מזמינים" : "מי מגיע";
  const vacationGuestCount = vacationParty.adults + vacationParty.children;
  const vacationRoomLabel = vacationParty.rooms === 1 ? "חדר אחד" : `${vacationParty.rooms} חדרים`;
  const peopleValue = mode === "events"
    ? (guests ? `${guests} משתתפים` : "בחרו כמות משתתפים")
    : mode === "spa"
      ? (SPA_AUDIENCES.find((option) => option.id === spaAudience)?.label ?? "לא חובה")
      : `${vacationGuestCount} אורחים · ${vacationRoomLabel}`;
  const displayedLocation = nearbySelection ? "קרוב אליי" : locationValue;
  const mobileSummary = [displayedLocation, !isHourly ? dates : "", !isHourly ? peopleValue : ""].filter(Boolean).join(" · ");
  const mobileSheetTitle = "עריכת חיפוש";
  const normalizedLocationQuery = locationQuery.trim().toLocaleLowerCase();
  const catalogDestinations = useMemo(() => placeInventory.flatMap((place) => [place.area, place.location]).filter(Boolean), [placeInventory]);
  const destinations = useMemo(() => destinationInventory(managedGeography, uniqueSearchLocations([...destinationOptions, ...vacationLocationGroups.flatMap(group => [...group.options]), ...catalogDestinations])), [catalogDestinations, managedGeography, destinationOptions]);
  const visibleDestinations = matchingDestinations(destinations, locationQuery, translate);
  const visibleNamedPlaces = normalizedLocationQuery
    ? placeInventory.filter((place) => [place.name, place.location, place.area, translate(place.name), translate(place.location), translate(place.area)].some((value) => value.toLocaleLowerCase().includes(normalizedLocationQuery))).slice(0, DESTINATION_PAGE_SIZE - visibleDestinations.length)
    : [];
  const browseParent = destinations.find(item => item.key === browseKey);
  const browseItems = destinationPage(destinationChildren(destinations, browseKey ?? null), browsePage);
  const visibleRecent = recentDestinations(recentLocations, destinations);
  const destinationKind = (level: string) => level === "city" ? pickerCopy.city : level === "country" ? pickerCopy.country : pickerCopy.region;

  const searchSurface = (
      <div ref={searchSurfaceRef} className={`search-box-shell ${shouldCollapse ? "search-box-shell--results" : ""} ${mobileExpanded ? "mobile-expanded" : "mobile-collapsed"}`} role={mobileExpanded ? "dialog" : undefined} aria-modal={mobileExpanded ? true : undefined} aria-label={mobileExpanded ? translate(mobileSheetTitle) : undefined} data-search-surface={mobileExpanded ? "portal" : "inline"}>
        {shouldCollapse && <button type="button" className="search-mobile-summary" onClick={() => { setMobileStep("overview"); setMobileExpanded(true); setLocationOpen(false); setCalendarOpen(false); setGuestOpen(false); }} aria-expanded={mobileExpanded} aria-label={`שינוי חיפוש. ${mobileSummary}`}>
          <span className="search-mobile-summary__copy"><strong>{translate(displayedLocation)}</strong><small>{!isHourly && <><span>{visibleDates}</span><span aria-hidden="true"> · </span><span>{peopleValue}</span></>}</small></span>
          <span className="search-mobile-summary__action"><SearchIcon /><b>שינוי חיפוש</b></span>
        </button>}
        {mobileExpanded && <button type="button" className="search-mobile-backdrop" onClick={cancelMobileSearch} aria-label="סגירת החיפוש" />}
        {!mobileExpanded && (locationOpen || guestOpen || priceOpen) && <button type="button" className="search-option-backdrop" onClick={cancelMobileSearch} aria-label="סגירת אפשרויות החיפוש" />}
        <div className={`search-box ${shouldCollapse ? "compact" : ""} ${isHourly ? "search-box--hourly" : ""} mobile-step-${mobileStep}`} role="search" aria-label={mode === "events" ? "חיפוש מקום לאירוע" : mode === "spa" ? "חיפוש מתחם ספא" : isHourly ? "חיפוש חדרים לפי שעה" : "חיפוש חופשה"}>
        {mobileExpanded && <div className="search-mobile-sheet-head"><strong>{translate(mobileSheetTitle)}</strong><div className="search-mobile-sheet-head__actions">{enabled("gift-card") ? <Link className="search-gift-card-link" href={localizedPath("/gift-card", language)} onClick={closeMobileSearch} aria-label={translate("קנה שובר מתנה")}><GiftIcon /><span>{translate("קנה שובר מתנה")}</span></Link> : null}<button type="button" onClick={closeActiveMobileSection} aria-label={guestOpen ? "סגירת בחירת האורחים" : "סגירת אפשרויות החיפוש"}>×</button></div></div>}
        {mobileExpanded && showWorlds && <div className="search-mobile-worlds"><SearchWorldTabs active={activeWorld} location={locationValue} onNavigate={closeMobileSearch} /></div>}
        <div className={`search-field-wrap search-step search-step--location ${mobileStep === "location" ? "active" : ""}`}>
          <button type="button" className="search-field" aria-expanded={locationOpen} onClick={() => { setMobileStep("location"); expandMobileSearch(); setLocationOpen((value) => !value); setGuestOpen(false); setPriceOpen(false); }}><PinIcon /><span><small>{mode === "events" ? "אזור או מקום" : isHourly ? "עיר או אזור" : "לאן נוסעים"}</small><strong>{translate(displayedLocation)}</strong></span></button>
          {locationOpen && <div className="search-popover location-list location-list--progressive" role="dialog" aria-modal="true" aria-labelledby={`location-dialog-title-${mode}`}>
            <header className="location-list__header">
              <div><h2 id={`location-dialog-title-${mode}`}>{translate("חיפוש יעד")}</h2><small>{translate("הקלידו עיר, אזור או שם מקום")}</small></div>
              <button type="button" className="location-list__close" onClick={closeLocationPicker} aria-label={translate("סגירת אפשרויות החיפוש")}>×</button>
            </header>
            {showWorlds && <div className="search-dialog-worlds search-desktop-worlds"><SearchWorldTabs active={activeWorld} location={locationValue} onNavigate={closeMobileSearch} /></div>}
            <div className="location-list__body">
            <div className="location-list__input-row"><label className="location-list__search"><input aria-label={translate("חיפוש יעד")} value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} placeholder={translate("הקלידו עיר, אזור או שם מקום")} autoFocus /></label>{locationQuery ? <button type="button" className="location-clear" aria-label={pickerCopy.clear} onClick={() => setLocationQuery("")}>×</button> : null}</div>
            <div className="location-list__content">
            {locationQuery.trim() ? (
              <div className="location-search-results">
                {placeInventoryLoading ? <p role="status">{translate("מחפשים מקומות...")}</p> : null}
                {visibleDestinations.length > 0 ? <h3>{translate("אזורים ויישובים")}</h3> : null}
                {visibleDestinations.map((place) => <button type="button" key={place.key} className={place.value === locationValue ? "selected" : ""} onClick={() => chooseLocation(place.value)}><PinIcon /><span>{translate(place.value)}<small>{destinationKind(place.level)}</small></span></button>)}
                {visibleNamedPlaces.length > 0 ? <h3>{translate("מקומות מתאימים")}</h3> : null}
                {visibleNamedPlaces.map((place) => { const name = localizedBusinessText(place.name, language, translate, latinBusinessAlias(place.name) || ({ he: "מקום", en: "Place", ru: "Место", fr: "Lieu" }[language])); const kind = localizedBusinessText(place.kind, language, translate, ({ he: "מקום", en: "Place", ru: "Место", fr: "Lieu" }[language])); const location = localizedBusinessText(place.location, language, translate, latinBusinessAlias(place.location) || ({ he: "ישראל", en: "Israel", ru: "Израиль", fr: "Israël" }[language])); return <Link key={`${mode}-${place.id}`} className="location-place-result" href={localizedPath(place.href, language)} target="_blank" rel="noopener noreferrer"><PinIcon /><span><strong>{name}</strong><small>{kind} · {location}</small></span></Link>; })}
                {placeInventoryError ? <p role="alert">{translate("לא ניתן לטעון את המקומות כרגע.")}</p> : null}
                {!placeInventoryLoading && !placeInventoryError && visibleDestinations.length === 0 && visibleNamedPlaces.length === 0 ? <p>{translate("לא מצאנו יעד או מקום מתאים.")}</p> : null}
              </div>
            ) : browseKey !== undefined ? (
              <div className="location-browser">
                <button type="button" className="location-browser__back" onClick={() => { setBrowseKey(browseParent ? browseParent.parentKey : undefined); setBrowsePage(0); }}>{pickerCopy.back}</button>
                <h3 aria-live="polite">{browseParent ? translate(browseParent.value) : pickerCopy.browse}</h3>
                {browseParent ? <button type="button" className="location-browser__select" onClick={() => chooseLocation(browseParent.value)}>{pickerCopy.searchRegion(translate(browseParent.value))}</button> : null}
                <div className="location-search-results">{browseItems.items.map(place => <button type="button" key={place.key} onClick={() => { if (destinationChildren(destinations, place.key).length) { setBrowseKey(place.key); setBrowsePage(0); } else chooseLocation(place.value); }}><PinIcon /><span>{translate(place.value)}<small>{destinationKind(place.level)}</small></span>{destinationChildren(destinations, place.key).length ? <span className="location-browser__refine">{pickerCopy.refine}</span> : null}</button>)}</div>
                {!browseItems.items.length ? <p role="status">{pickerCopy.typeInstead}</p> : null}
                {browseItems.pages > 1 ? <nav className="location-browser__pages" aria-label={pickerCopy.pages}><button type="button" disabled={browseItems.current === 0} onClick={() => setBrowsePage(browseItems.current - 1)}>{pickerCopy.previous}</button><span aria-live="polite">{browseItems.current + 1} / {browseItems.pages}</span><button type="button" disabled={browseItems.current + 1 >= browseItems.pages} onClick={() => setBrowsePage(browseItems.current + 1)}>{pickerCopy.next}</button></nav> : null}
              </div>
            ) : (
              <div className="location-discovery">
                <button type="button" className="location-nearby" onClick={chooseNearbyLocation} disabled={locating}>
                  <span className="location-nearby__icon"><PinIcon /></span>
                  <span><strong>{translate("מקומות בסביבה הקרובה")}</strong><small>{translate("נמצא את האזור הקרוב לפי המיקום שלכם")}</small></span>
                  <b aria-hidden="true">←</b>
                </button>
                {locationStatus ? <p className="location-status" role="status">{translate(locationStatus)}</p> : null}
                {visibleRecent.length ? <section className="location-group"><h3>{pickerCopy.recent}</h3><div className="location-recent">{visibleRecent.map(place => <button type="button" key={place} onClick={() => chooseLocation(place)}><PinIcon /><span>{translate(place)}</span></button>)}</div></section> : null}
                <section className="location-group location-group--primary"><h3>{pickerCopy.quick}</h3><div>{QUICK_DESTINATIONS.map(place => <button type="button" key={place} className={place === locationValue ? "selected" : ""} aria-pressed={place === locationValue} onClick={() => chooseLocation(place)}><PinIcon /><span>{translate(place)}</span></button>)}</div></section>
                <button type="button" className="location-browse-trigger" onClick={() => { setBrowseKey(null); setBrowsePage(0); }}>{pickerCopy.browse}</button>
              </div>
            )}
            </div>
            </div>
          </div>}
        </div>
        {isHourly && <div className="search-field-wrap search-field-wrap--price">
          <button type="button" className="search-field" aria-expanded={priceOpen} onClick={() => { setPriceOpen((value) => !value); setLocationOpen(false); }}><span><small>מחיר לשעתיים עד</small><strong>{maximumPrice ? `₪ ${maximumPrice}` : "ללא הגבלת מחיר"}</strong></span></button>
          {priceOpen && <div className="search-popover search-price-list">{HOURLY_PRICE_OPTIONS.map((price) => <button type="button" key={price} className={price === maximumPrice ? "selected" : ""} onClick={() => { setMaximumPrice(price); setPriceOpen(false); if (isDesktopSearchViewport()) search({ maximumPrice: price }); else { setMobileStep("overview"); setMobileExpanded(true); } }}>{price ? `עד ₪ ${price} לשעתיים` : "ללא הגבלת מחיר"}</button>)}</div>}
        </div>}
        {!isHourly && <button type="button" className={`search-field search-step search-step--dates ${mobileStep === "dates" ? "active" : ""}`} onClick={() => { setMobileStep("dates"); expandMobileSearch(); setCalendarOpen(true); setLocationOpen(false); setGuestOpen(false); }}><CalendarIcon /><span><small>{mode === "events" ? "מתי האירוע?" : mode === "spa" ? "מתי מגיעים?" : "מתי יוצאים"}</small><strong>{visibleDates}</strong></span></button>}
        {!isHourly && <div className={`search-field-wrap search-step search-step--guests ${mobileStep === "guests" ? "active" : ""}`}>
          <button type="button" className="search-field" aria-expanded={guestOpen} onClick={() => { if (guestOpen) { closeGuestPicker(); return; } setMobileStep("guests"); expandMobileSearch(); setGuestOpen(true); setLocationOpen(false); }}><PeopleIcon /><span><small>{peopleLabel}</small><strong>{peopleValue}</strong></span></button>
          {guestOpen && (mode === "spa"
            ? <div className="search-popover spa-audience-picker"><strong>למי מזמינים?<small>לא חובה</small></strong><button type="button" className={`spa-audience-clear ${spaAudience === null ? "selected" : ""}`} aria-pressed={spaAudience === null} onClick={() => { setSpaAudience(null); setGuests(0); search({ spaAudience: null }); }}><span>ללא העדפה</span><small>הציגו את כל בתי הספא</small></button><div>{SPA_AUDIENCES.map((option) => <button type="button" key={option.id} className={spaAudience === option.id ? "selected" : ""} aria-pressed={spaAudience === option.id} onClick={() => { setSpaAudience(option.id); setGuests(option.guests); search({ spaAudience: option.id }); }}><span>{option.label}</span><small>{option.description}</small></button>)}</div></div>
            : mode === "vacation"
              ? <div className="search-popover vacation-party-picker" aria-label="בחירת הרכב אורחים וחדרים">
                  <header><div><strong>מי מגיע?</strong><small>התאימו את ההרכב למקום הנכון</small></div><button type="button" onClick={closeGuestPicker} aria-label="סגירת בחירת האורחים">×</button></header>
                  <div className="vacation-party-picker__rows">
                    {VACATION_PARTY_ROWS.map((row) => <div className="vacation-party-row" key={row.id}>
                      <span><strong>{row.label}</strong><small>{row.description}</small></span>
                      <div className="vacation-party-counter" aria-label={row.label}>
                        <button type="button" disabled={vacationParty[row.id] <= row.minimum} onClick={() => changeVacationParty(row.id, -1)} aria-label={`הפחתת ${row.label}`}>−</button>
                        <b aria-live="polite">{vacationParty[row.id]}</b>
                        <button type="button" disabled={vacationParty[row.id] >= row.maximum} onClick={() => changeVacationParty(row.id, 1)} aria-label={`הוספת ${row.label}`}>+</button>
                      </div>
                    </div>)}
                  </div>
                  <button type="button" className="popover-done" onClick={saveVacationParty}>שמירת ההרכב</button>
                </div>
              : <div className="search-popover guest-picker"><strong>משתתפים</strong><div><button type="button" disabled={guests <= 0} onClick={() => setGuests((value) => value - 10)}>−</button><span>{guests === 0 ? "לא נבחר" : guests}</span><button type="button" onClick={() => setGuests((value) => value + 10)}>+</button></div><button type="button" className="popover-done" onClick={saveEventGuests}>סיום</button></div>)}
        </div>}
        <button type="button" className={`search-submit ${isSearching ? "is-searching" : ""}`} onClick={() => search()} disabled={isSearching} aria-busy={isSearching}><span className="search-submit__icon" aria-hidden="true">{isSearching ? <i /> : <SearchIcon />}</span><span>{isSearching ? "מחפשים..." : "חיפוש"}</span></button>
        </div>
        <span className="search-status" role="status" aria-live="polite">{isSearching ? "מחפשים" : ""}</span>
      </div>
  );

  return (
    <>
      {showWorlds && !shouldCollapse && !mobileExpanded && <SearchWorldTabs active={activeWorld} location={locationValue} />}
      {showWorlds && shouldCollapse && (guestOpen || priceOpen) && <div className="search-context-worlds"><SearchWorldTabs active={activeWorld} location={locationValue} onNavigate={closeMobileSearch} /></div>}
      {mobileExpanded && typeof document !== "undefined" ? createPortal(searchSurface, document.body) : searchSurface}
      <DatePickerCloseContext.Provider value={() => setCalendarOpen(false)}><div hidden={!calendarOpen} data-date-picker-container>{datePickerMounted && (mode === "events" ? <EventDatePicker open={calendarOpen} onClose={() => setCalendarOpen(false)} onCancel={cancelMobileSearch} onSkip={() => { const selection = { from: null, to: null }; eventDateRangeRef.current = selection; setDates("בחרו תאריכים"); setEventDateRange(selection); setCalendarOpen(false); if (isDesktopSearchViewport()) search({ eventDateRange: selection }); else { setMobileStep("guests"); setGuestOpen(true); } }} onConfirm={(result) => { const selection = { from: result.from, to: result.to }; eventDateRangeRef.current = selection; setDates(result.summary); setEventDateRange(selection); setCalendarOpen(false); if (isDesktopSearchViewport()) search({ eventDateRange: selection }); else { setMobileStep("guests"); setGuestOpen(true); } }} /> : mode === "spa" ? <SpaDatePicker open={calendarOpen} onClose={() => setCalendarOpen(false)} onCancel={cancelMobileSearch} onSkip={() => { const selection = { date: null, withoutDate: true }; spaDateRef.current = selection; setDates("בלי תאריך כרגע"); setSpaDate(selection); if (isDesktopSearchViewport()) search({ spaDate: selection }); else { setCalendarOpen(false); setMobileStep("guests"); setGuestOpen(true); } }} onConfirm={(result) => { const selection = { date: result.date, withoutDate: result.withoutDate }; spaDateRef.current = selection; setDates(result.summary); setSpaDate(selection); if (isDesktopSearchViewport()) search({ spaDate: selection }); else { setMobileStep("guests"); setGuestOpen(true); } }} /> : !isHourly ? <CalendarDemo mode="home" open={calendarOpen} onClose={() => setCalendarOpen(false)} onCancel={cancelMobileSearch} onSkip={() => { const selection = { from: null, till: null }; vacationDateRangeRef.current = selection; vacationFlexibleSearchRef.current = null; setDates("בחרו תאריכים"); setVacationDateRange(selection); setVacationFlexibleSearch(null); setCalendarOpen(false); if (isDesktopSearchViewport()) search({ vacationDateRange: selection, vacationFlexibleSearch: null }); else { setMobileStep("guests"); setGuestOpen(true); } }} onConfirm={(result) => { const selection = { from: result.checkIn, till: result.checkOut }; const flexibleSelection = result.flexible && result.flexibleStay && result.flexibleMonth && result.flexibleDays !== null ? { stay: result.flexibleStay, month: result.flexibleMonth, days: result.flexibleDays } : null; vacationDateRangeRef.current = selection; vacationFlexibleSearchRef.current = flexibleSelection; setDates(result.summary); setVacationDateRange(selection); setVacationFlexibleSearch(flexibleSelection); if (isDesktopSearchViewport()) search({ vacationDateRange: selection, vacationFlexibleSearch: flexibleSelection }); else { setMobileStep("guests"); setGuestOpen(true); } }} /> : null)}</div></DatePickerCloseContext.Provider>
    </>
  );
}
