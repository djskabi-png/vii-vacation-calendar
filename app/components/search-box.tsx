"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { vacationStayFromSearch } from "../lib/vacation-date-range";
import { CalendarDemo } from "../calendar-demo";
import { EventDatePicker } from "./event-date-picker";
import { SpaDatePicker } from "./spa-date-picker";
import { type WorldId } from "../data/world-data";
import { isWholeCountrySelection, searchLocationOptions, vacationLocationGroups, type SearchMode } from "../data/search-taxonomy";
import { CalendarIcon, GiftIcon, PeopleIcon, PinIcon, SearchIcon } from "../site-header";
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
import { nearestSearchLocation } from "../lib/nearby-search-location.ts";

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
  if (mode !== "vacation") return defaultDateLabel(mode);
  const flexibleSearch = flexibleSearchFromParams(searchParams);
  if (flexibleSearch) return flexibleDateLabel(flexibleSearch, language);
  const from = searchParams.get("from");
  const till = searchParams.get("till");
  if (!from || !till) return defaultDateLabel(mode);
  const locale = { he: "he-IL", en: "en-GB", ru: "ru-RU", fr: "fr-FR" }[language];
  const separator = { he: "עד", en: "to", ru: "по", fr: "au" }[language];
  const formatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const parse = (value: string) => new Date(`${value}T12:00:00`);
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

function normalizeHourlyPrice(value: string | null) {
  const price = Number(value) || 0;
  return HOURLY_PRICE_OPTIONS.includes(price as typeof HOURLY_PRICE_OPTIONS[number]) ? price : 0;
}

export function SearchBox({ mode = "vacation", compact = false, showWorlds = true, initialLocation, initialGuests, basePath, vacationType, initialSpaAudience, initialSpaFeatures = [], openDatesRequest = 0 }: { mode?: SearchMode; compact?: boolean; showWorlds?: boolean; initialLocation?: string; initialGuests?: number; basePath?: string; vacationType?: string; initialSpaAudience?: string; initialSpaFeatures?: string[]; openDatesRequest?: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const { language, translate } = useSiteLanguage();
  const dateDisplayLanguage = language;
  const isHourly = mode === "hourly";
  const [searchCommitted, setSearchCommitted] = useState(() => compact || Boolean(searchParamsKey) || Boolean(initialLocation) || Boolean(initialSpaAudience) || initialSpaFeatures.length > 0);
  const shouldCollapse = compact || searchCommitted;
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
  const [calendarOpen, setCalendarOpen] = useState(false);
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
  const [mobileExpanded, setMobileExpanded] = useState(false);
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
    setLocationValue(requestedLocation
      ? (isWholeCountrySelection(requestedLocation) ? "כל הארץ" : requestedLocation)
      : initialLocation || "כל הארץ");
    setDates(dateLabelFromSearch(committedParams, mode, activeRouteLanguage(language)));
    const selectedStay = vacationStayFromSearch(committedParams, activeRouteLanguage(language));
    setVacationDateRange({ from: selectedStay?.from || null, till: selectedStay?.till || null });
    setVacationFlexibleSearch(flexibleSearchFromParams(committedParams));
    setEventDateRange({ from: committedParams.get("from"), to: committedParams.get("to") });
    setSpaDate({ date: committedParams.get("date"), withoutDate: committedParams.get("withoutDate") === "1" });
    setSpaAudience(parseSpaAudience(committedParams.get("spaFor") || initialSpaAudience || null));
    setGuests(Number(committedParams.get("guests")) || initialGuests || defaultGuestCount(mode));
    setVacationParty(initialVacationParty(committedParams, Number(committedParams.get("guests")) || initialGuests || 2));
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
      if (event.matches) cancelMobileSearch();
    };

    leaveMobileEditor(desktop);
    desktop.addEventListener("change", leaveMobileEditor);
    return () => desktop.removeEventListener("change", leaveMobileEditor);
  }, [cancelMobileSearch]);

  function search() {
    if (isSearching) return;
    setIsSearching(true);
    setSearchCommitted(true);
    closeMobileSearch();
    const cleanVacationRoute = mode === "vacation" ? (vacationType ? cleanAccommodationPath(vacationType, locationValue) : cleanVacationPath(locationValue)) : null;
    const cleanSpaRoute = mode === "spa" ? spaSearchHref(spaSearchStateFromValues(locationValue, spaAudience || undefined, initialSpaFeatures)) : null;
    const cleanEventRoute = mode === "events" ? eventSearchHref(locationValue) : null;
    const cleanHourlyRoute = mode === "hourly" ? hourlySearchHref(locationValue) : null;
    const route = cleanVacationRoute || cleanSpaRoute || cleanEventRoute || cleanHourlyRoute || (basePath && mode === "vacation" ? basePath : "/search/");
    let destination: string;
    const applyVacationDates = (params: URLSearchParams) => {
      params.delete("dates");
      params.delete("dateMode");
      params.delete("stay");
      params.delete("month");
      params.delete("flexDays");
      if (vacationDateRange.from && vacationDateRange.till) {
        params.set("from", vacationDateRange.from);
        params.set("till", vacationDateRange.till);
      } else {
        params.delete("from");
        params.delete("till");
        if (vacationFlexibleSearch) {
          params.set("dateMode", "flexible");
          params.set("stay", vacationFlexibleSearch.stay);
          params.set("month", vacationFlexibleSearch.month);
          params.set("flexDays", String(vacationFlexibleSearch.days));
        }
      }
    };
    if (isHourly) {
      const params = new URLSearchParams();
      if (maximumPrice > 0) params.set("maxPrice", String(maximumPrice));
      destination = mergeSearchHref(route, params);
    } else if (mode === "vacation" && cleanVacationRoute) {
      const params = new URLSearchParams();
      applyVacationDates(params);
      if (new URLSearchParams(searchParamsKey).get("online") === "1") params.set("online", "1");
      if (vacationParty.adults !== 2) params.set("adults", String(vacationParty.adults));
      if (vacationParty.children) params.set("children", String(vacationParty.children));
      if (vacationParty.infants) params.set("infants", String(vacationParty.infants));
      if (vacationParty.pets) params.set("pets", String(vacationParty.pets));
      if (vacationParty.rooms !== 1) params.set("rooms", String(vacationParty.rooms));
      destination = mergeSearchHref(route, params);
    } else {
      const params = new URLSearchParams();
      if (mode === "vacation" && !basePath) {
        params.set("location", isWholeCountrySelection(locationValue) && language !== "he" ? "all-country" : locationValue || "כל הארץ");
      } else if (mode !== "events" && !(basePath && mode === "vacation" && locationValue === initialLocation) && locationValue !== "כל הארץ") {
        params.set("location", locationValue);
      }
      if (mode === "events") {
        if (eventDateRange.from) params.set("from", eventDateRange.from);
        if (eventDateRange.to) params.set("to", eventDateRange.to);
        if (guests > 0) params.set("guests", String(guests));
        const selectedEventSlot = new URLSearchParams(searchParamsKey).get("slot");
        if (selectedEventSlot === "morning" || selectedEventSlot === "evening") params.set("slot", selectedEventSlot);
      } else if (mode === "spa") {
        if (spaDate.date) params.set("date", spaDate.date);
        if (spaDate.withoutDate) params.set("withoutDate", "1");
      } else {
        applyVacationDates(params);
        if (mode === "vacation" && new URLSearchParams(searchParamsKey).get("online") === "1") params.set("online", "1");
        if (mode === "vacation" && vacationParty.adults === 2 && vacationParty.children === 0) params.set("guests", "2");
        if (vacationParty.adults !== 2) params.set("adults", String(vacationParty.adults));
        if (vacationParty.children) params.set("children", String(vacationParty.children));
        if (vacationParty.infants) params.set("infants", String(vacationParty.infants));
        if (vacationParty.pets) params.set("pets", String(vacationParty.pets));
        if (vacationParty.rooms !== 1) params.set("rooms", String(vacationParty.rooms));
      }
      destination = mergeSearchHref(route, params);
    }
    try {
      trackSearchSubmitted({ world: mode, location: locationValue, hasDate: Boolean(mode === "spa" ? spaDate.date : mode === "events" ? eventDateRange.from : vacationDateRange.from) });
      const target = localizedPath(destination, language);
      const current = `${window.location.pathname}${window.location.search}`;
      if (current === target || `${current}/` === target || current === `${target}/`) {
        document.querySelector<HTMLElement>("[data-search-results], .results-heading, .search-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
        window.setTimeout(() => setIsSearching(false), 240);
        return;
      }
      // Keep search transitions inside the app router. A document-level
      // navigation reloads the header, locale runtime, styles and route data,
      // which made every search feel like a cold page load.
      router.push(target);
      window.setTimeout(() => setIsSearching(false), 1200);
    } catch {
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
      setGuests(next.adults + next.children);
      return next;
    });
  }

  function chooseLocation(place: string) {
    setLocationValue(canonicalSearchLocation(place));
    const recent = recentDestinations([place, ...(Array.isArray(recentLocations) ? recentLocations : [])], destinations);
    setRecentLocations(recent);
    try { localStorage.setItem("vii-recent-destinations", JSON.stringify(recent)); } catch { /* Search still works when storage is unavailable. */ }
    setLocationOpen(false);
    setLocationQuery("");
    setLocationStatus("");
    if (!isHourly && window.matchMedia("(max-width: 820px)").matches) {
      setMobileStep("dates");
      setCalendarOpen(true);
    }
  }

  async function chooseNearbyLocation() {
    if (locating) return;
    setLocating(true);
    setLocationStatus("מאתרים את האזור הקרוב...");
    let finished = false;
    let fallbackStarted = false;
    let watchdog = 0;
    const select = (location: string | null) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(watchdog);
      setLocating(false);
      if (location) chooseLocation(location);
      else setLocationStatus("לא הצלחנו לזהות את המיקום. אפשר לבחור יעד מהרשימה.");
    };
    const approximate = async () => {
      if (finished || fallbackStarted) return;
      fallbackStarted = true;
      setLocationStatus("מנסים לזהות את האזור הקרוב...");
      try {
        const response = await fetch("/api/vii/nearby-location", { cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(1800) });
        const payload = await response.json() as { location?: string };
        select(response.ok && typeof payload.location === "string" ? payload.location : null);
      } catch { select(null); }
    };
    if (!navigator.geolocation) { await approximate(); return; }
    watchdog = window.setTimeout(() => { void approximate(); }, 2200);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => select(nearestSearchLocation(coords.latitude, coords.longitude)),
      () => { void approximate(); },
      { enableHighAccuracy: false, timeout: 2000, maximumAge: 300000 },
    );
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
  const mobileSummary = [locationValue, !isHourly ? dates : "", !isHourly ? peopleValue : ""].filter(Boolean).join(" · ");
  const mobileSheetTitle = "עריכת חיפוש";
  const normalizedLocationQuery = locationQuery.trim().toLocaleLowerCase();
  const destinations = useMemo(() => destinationInventory(managedGeography, uniqueSearchLocations([...destinationOptions, ...vacationLocationGroups.flatMap(group => [...group.options])])), [managedGeography, destinationOptions]);
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
          <span className="search-mobile-summary__copy"><strong>{translate(locationValue)}</strong><small>{!isHourly && <><span>{visibleDates}</span><span aria-hidden="true"> · </span><span>{peopleValue}</span></>}</small></span>
          <span className="search-mobile-summary__action"><SearchIcon /><b>שינוי חיפוש</b></span>
        </button>}
        {mobileExpanded && <button type="button" className="search-mobile-backdrop" onClick={cancelMobileSearch} aria-label="סגירת החיפוש" />}
        {!mobileExpanded && (locationOpen || guestOpen || priceOpen) && <button type="button" className="search-option-backdrop" onClick={cancelMobileSearch} aria-label="סגירת אפשרויות החיפוש" />}
        <div className={`search-box ${shouldCollapse ? "compact" : ""} ${isHourly ? "search-box--hourly" : ""} mobile-step-${mobileStep}`} role="search" aria-label={mode === "events" ? "חיפוש מקום לאירוע" : mode === "spa" ? "חיפוש מתחם ספא" : isHourly ? "חיפוש חדרים לפי שעה" : "חיפוש חופשה"}>
        {mobileExpanded && <div className="search-mobile-sheet-head"><strong>{translate(mobileSheetTitle)}</strong><div className="search-mobile-sheet-head__actions"><Link className="search-gift-card-link" href={localizedPath("/gift-card", language)} onClick={closeMobileSearch} aria-label={translate("קנה שובר מתנה")}><GiftIcon /><span>{translate("קנה שובר מתנה")}</span></Link><button type="button" onClick={closeActiveMobileSection} aria-label={guestOpen ? "סגירת בחירת האורחים" : "סגירת אפשרויות החיפוש"}>×</button></div></div>}
        {mobileExpanded && showWorlds && <div className="search-mobile-worlds"><SearchWorldTabs active={activeWorld} location={locationValue} onNavigate={closeMobileSearch} /></div>}
        <div className={`search-field-wrap search-step search-step--location ${mobileStep === "location" ? "active" : ""}`}>
          <button type="button" className="search-field" aria-expanded={locationOpen} onClick={() => { setMobileStep("location"); expandMobileSearch(); setLocationOpen((value) => !value); setGuestOpen(false); setPriceOpen(false); }}><PinIcon /><span><small>{mode === "events" ? "אזור או מקום" : isHourly ? "עיר או אזור" : "לאן נוסעים"}</small><strong>{translate(locationValue)}</strong></span></button>
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
                {visibleNamedPlaces.map((place) => <Link key={`${mode}-${place.id}`} className="location-place-result" href={localizedPath(place.href, language)}><PinIcon /><span><strong>{translate(place.name)}</strong><small>{translate(place.kind)} · {translate(place.location)}</small></span></Link>)}
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
          <button type="button" className="search-field" aria-expanded={priceOpen} onClick={() => { setPriceOpen((value) => !value); setLocationOpen(false); }}><span><small>מחיר לשעתיים עד</small><strong>{maximumPrice ? `${maximumPrice} ₪` : "ללא הגבלת מחיר"}</strong></span></button>
          {priceOpen && <div className="search-popover search-price-list">{HOURLY_PRICE_OPTIONS.map((price) => <button type="button" key={price} className={price === maximumPrice ? "selected" : ""} onClick={() => { setMaximumPrice(price); setPriceOpen(false); }}>{price ? `עד ${price} ₪ לשעתיים` : "ללא הגבלת מחיר"}</button>)}</div>}
        </div>}
        {!isHourly && <button type="button" className={`search-field search-step search-step--dates ${mobileStep === "dates" ? "active" : ""}`} onClick={() => { setMobileStep("dates"); expandMobileSearch(); setCalendarOpen(true); setLocationOpen(false); setGuestOpen(false); }}><CalendarIcon /><span><small>{mode === "events" ? "מתי האירוע?" : mode === "spa" ? "מתי מגיעים?" : "מתי יוצאים"}</small><strong>{visibleDates}</strong></span></button>}
        {!isHourly && <div className={`search-field-wrap search-step search-step--guests ${mobileStep === "guests" ? "active" : ""}`}>
          <button type="button" className="search-field" aria-expanded={guestOpen} onClick={() => { if (guestOpen) { closeGuestPicker(); return; } setMobileStep("guests"); expandMobileSearch(); setGuestOpen(true); setLocationOpen(false); }}><PeopleIcon /><span><small>{peopleLabel}</small><strong>{peopleValue}</strong></span></button>
          {guestOpen && (mode === "spa"
            ? <div className="search-popover spa-audience-picker"><strong>למי מזמינים?<small>לא חובה</small></strong><button type="button" className={`spa-audience-clear ${spaAudience === null ? "selected" : ""}`} aria-pressed={spaAudience === null} onClick={() => { setSpaAudience(null); setGuests(0); if (!mobileExpanded) setGuestOpen(false); }}><span>ללא העדפה</span><small>הציגו את כל בתי הספא</small></button><div>{SPA_AUDIENCES.map((option) => <button type="button" key={option.id} className={spaAudience === option.id ? "selected" : ""} aria-pressed={spaAudience === option.id} onClick={() => { setSpaAudience(option.id); setGuests(option.guests); if (!mobileExpanded) setGuestOpen(false); }}><span>{option.label}</span><small>{option.description}</small></button>)}</div></div>
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
                  <button type="button" className="popover-done" onClick={closeGuestPicker}>שמירת ההרכב</button>
                </div>
              : <div className="search-popover guest-picker"><strong>משתתפים</strong><div><button type="button" disabled={guests <= 0} onClick={() => setGuests((value) => value - 10)}>−</button><span>{guests === 0 ? "לא נבחר" : guests}</span><button type="button" onClick={() => setGuests((value) => value + 10)}>+</button></div><button type="button" className="popover-done" onClick={() => setGuestOpen(false)}>סיום</button></div>)}
        </div>}
        <button type="button" className={`search-submit ${isSearching ? "is-searching" : ""}`} onClick={search} disabled={isSearching} aria-busy={isSearching}><span className="search-submit__icon" aria-hidden="true">{isSearching ? <i /> : <SearchIcon />}</span><span>{isSearching ? "מחפשים..." : "חיפוש"}</span></button>
        </div>
        <span className="search-status" role="status" aria-live="polite">{isSearching ? "מחפשים" : ""}</span>
      </div>
  );

  return (
    <>
      {showWorlds && !shouldCollapse && !mobileExpanded && <SearchWorldTabs active={activeWorld} location={locationValue} />}
      {showWorlds && shouldCollapse && (guestOpen || priceOpen) && <div className="search-context-worlds"><SearchWorldTabs active={activeWorld} location={locationValue} onNavigate={closeMobileSearch} /></div>}
      {mobileExpanded && typeof document !== "undefined" ? createPortal(searchSurface, document.body) : searchSurface}
      {mode === "events" ? <EventDatePicker open={calendarOpen} onClose={() => setCalendarOpen(false)} onCancel={cancelMobileSearch} onSkip={() => { setDates("בחרו תאריכים"); setEventDateRange({ from: null, to: null }); setCalendarOpen(false); setMobileStep("guests"); setGuestOpen(true); }} onConfirm={(result) => { setDates(result.summary); setEventDateRange({ from: result.from, to: result.to }); setMobileStep("guests"); setGuestOpen(true); }} /> : mode === "spa" ? <SpaDatePicker open={calendarOpen} onClose={() => setCalendarOpen(false)} onCancel={cancelMobileSearch} onSkip={() => { setDates("בלי תאריך כרגע"); setSpaDate({ date: null, withoutDate: true }); setCalendarOpen(false); setMobileStep("overview"); }} onConfirm={(result) => { setDates(result.summary); setSpaDate({ date: result.date, withoutDate: result.withoutDate }); setMobileStep("overview"); setGuestOpen(false); }} /> : !isHourly && <CalendarDemo mode="home" open={calendarOpen} onClose={() => setCalendarOpen(false)} onCancel={cancelMobileSearch} onSkip={() => { setDates("בחרו תאריכים"); setVacationDateRange({ from: null, till: null }); setVacationFlexibleSearch(null); setCalendarOpen(false); setMobileStep("guests"); setGuestOpen(true); }} onConfirm={(result) => { setDates(result.summary); setVacationDateRange({ from: result.checkIn, till: result.checkOut }); setVacationFlexibleSearch(result.flexible && result.flexibleStay && result.flexibleMonth && result.flexibleDays !== null ? { stay: result.flexibleStay, month: result.flexibleMonth, days: result.flexibleDays } : null); setMobileStep("guests"); setGuestOpen(true); }} />}
    </>
  );
}
