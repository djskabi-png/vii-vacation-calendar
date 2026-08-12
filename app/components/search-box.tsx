"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { eventSearchHref, hourlySearchHref } from "../data/world-search-landings";

type SpaAudience = "single" | "couple" | "group" | "day-pass";

type VacationParty = {
  adults: number;
  children: number;
  infants: number;
  pets: number;
  rooms: number;
};

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
  const explicitLabel = searchParams.get("dates");
  if (explicitLabel) return explicitLabel;
  if (mode !== "vacation") return defaultDateLabel(mode);
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

export function SearchBox({ mode = "vacation", compact = false, showWorlds = true, initialLocation, initialGuests, basePath, vacationType, initialSpaAudience, initialSpaFeatures = [] }: { mode?: SearchMode; compact?: boolean; showWorlds?: boolean; initialLocation?: string; initialGuests?: number; basePath?: string; vacationType?: string; initialSpaAudience?: string; initialSpaFeatures?: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, translate } = useSiteLanguage();
  const isHourly = mode === "hourly";
  const shouldCollapse = compact || searchParams.has("location");
  const places = useMemo(() => searchLocationOptions(mode), [mode]);
  const [locationValue, setLocationValue] = useState(() => {
    const requestedLocation = searchParams.get("location");
    return requestedLocation
      ? (isWholeCountrySelection(requestedLocation) ? "כל הארץ" : requestedLocation)
      : initialLocation || "כל הארץ";
  });
  // Keep the initial client render identical to the server, then localize from
  // the actual route in the synchronization effect below.
  const [dates, setDates] = useState(() => dateLabelFromSearch(searchParams, mode, language));
  const [vacationDateRange, setVacationDateRange] = useState<{ from: string | null; till: string | null }>(() => ({ from: searchParams.get("from"), till: searchParams.get("till") }));
  const [eventDateRange, setEventDateRange] = useState<{ from: string | null; to: string | null }>(() => ({ from: searchParams.get("from"), to: searchParams.get("to") }));
  const [spaDate, setSpaDate] = useState<{ date: string | null; withoutDate: boolean }>(() => ({ date: searchParams.get("date"), withoutDate: searchParams.get("withoutDate") === "1" }));
  const [spaAudience, setSpaAudience] = useState<SpaAudience | null>(() => parseSpaAudience(searchParams.get("spaFor") || initialSpaAudience || null));
  const [guests, setGuests] = useState(() => Number(searchParams.get("guests")) || initialGuests || defaultGuestCount(mode));
  const [vacationParty, setVacationParty] = useState<VacationParty>(() => initialVacationParty(searchParams, Number(searchParams.get("guests")) || initialGuests || 2));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationStatus, setLocationStatus] = useState("");
  const [locating, setLocating] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [maximumPrice, setMaximumPrice] = useState(() => normalizeHourlyPrice(searchParams.get("maxPrice")));
  const [isSearching, setIsSearching] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [mobileStep, setMobileStep] = useState<"overview" | "location" | "dates" | "guests">("overview");

  const restoreCommittedSearchState = useCallback(() => {
    const requestedLocation = searchParams.get("location");
    setLocationValue(requestedLocation
      ? (isWholeCountrySelection(requestedLocation) ? "כל הארץ" : requestedLocation)
      : initialLocation || "כל הארץ");
    setDates(dateLabelFromSearch(searchParams, mode, activeRouteLanguage(language)));
    setVacationDateRange({ from: searchParams.get("from"), till: searchParams.get("till") });
    setEventDateRange({ from: searchParams.get("from"), to: searchParams.get("to") });
    setSpaDate({ date: searchParams.get("date"), withoutDate: searchParams.get("withoutDate") === "1" });
    setSpaAudience(parseSpaAudience(searchParams.get("spaFor") || initialSpaAudience || null));
    setGuests(Number(searchParams.get("guests")) || initialGuests || defaultGuestCount(mode));
    setVacationParty(initialVacationParty(searchParams, Number(searchParams.get("guests")) || initialGuests || 2));
    setMaximumPrice(normalizeHourlyPrice(searchParams.get("maxPrice")));
  }, [initialGuests, initialLocation, initialSpaAudience, language, mode, searchParams]);

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
    setDates(dateLabelFromSearch(searchParams, mode, languageFromPathname(window.location.pathname)));
  }, [mode, searchParams]);

  useEffect(() => {
    if (!mobileExpanded) return;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelMobileSearch();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [cancelMobileSearch, mobileExpanded]);

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
    closeMobileSearch();
    const cleanVacationRoute = mode === "vacation" ? (vacationType ? cleanAccommodationPath(vacationType, locationValue) : cleanVacationPath(locationValue)) : null;
    const cleanSpaRoute = mode === "spa" ? spaSearchHref(spaSearchStateFromValues(locationValue, spaAudience || undefined, initialSpaFeatures)) : null;
    const cleanEventRoute = mode === "events" ? eventSearchHref(locationValue) : null;
    const cleanHourlyRoute = mode === "hourly" ? hourlySearchHref(locationValue) : null;
    const route = cleanVacationRoute || cleanSpaRoute || cleanEventRoute || cleanHourlyRoute || (basePath && mode === "vacation" ? basePath : "/search/");
    let destination: string;
    if (isHourly) {
      const params = new URLSearchParams();
      if (maximumPrice > 0) params.set("maxPrice", String(maximumPrice));
      const query = params.toString();
      destination = query ? `${route}?${query}` : route;
    } else if (mode === "vacation" && cleanVacationRoute) {
      const params = new URLSearchParams();
      if (dates !== defaultDateLabel(mode)) params.set("dates", dates);
      if (vacationDateRange.from) params.set("from", vacationDateRange.from);
      if (vacationDateRange.till) params.set("till", vacationDateRange.till);
      if (vacationParty.adults !== 2) params.set("adults", String(vacationParty.adults));
      if (vacationParty.children) params.set("children", String(vacationParty.children));
      if (vacationParty.infants) params.set("infants", String(vacationParty.infants));
      if (vacationParty.pets) params.set("pets", String(vacationParty.pets));
      if (vacationParty.rooms !== 1) params.set("rooms", String(vacationParty.rooms));
      const query = params.toString();
      destination = query ? `${route}?${query}` : route;
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
      } else if (mode === "spa") {
        if (spaDate.date) params.set("date", spaDate.date);
        if (spaDate.withoutDate) params.set("withoutDate", "1");
      } else {
        if (dates !== defaultDateLabel(mode)) params.set("dates", dates);
        if (vacationDateRange.from) params.set("from", vacationDateRange.from);
        if (vacationDateRange.till) params.set("till", vacationDateRange.till);
        if (mode === "vacation" && vacationParty.adults === 2 && vacationParty.children === 0) params.set("guests", "2");
        if (vacationParty.adults !== 2) params.set("adults", String(vacationParty.adults));
        if (vacationParty.children) params.set("children", String(vacationParty.children));
        if (vacationParty.infants) params.set("infants", String(vacationParty.infants));
        if (vacationParty.pets) params.set("pets", String(vacationParty.pets));
        if (vacationParty.rooms !== 1) params.set("rooms", String(vacationParty.rooms));
      }
      const query = params.toString();
      destination = query ? `${route}?${query}` : route;
    }
    try {
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
    setLocationValue(place);
    setLocationOpen(false);
    setLocationQuery("");
    setLocationStatus("");
    if (!isHourly && window.matchMedia("(max-width: 820px)").matches) {
      setMobileStep("dates");
      setCalendarOpen(true);
    }
  }

  function chooseNearbyLocation() {
    if (!navigator.geolocation || locating) {
      setLocationStatus("לא הצלחנו לזהות את המיקום. אפשר לבחור יעד מהרשימה.");
      return;
    }
    setLocating(true);
    setLocationStatus("מאתרים את האזור הקרוב...");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const centers = [
          { label: "צפון", lat: 32.96, lng: 35.5 },
          { label: "מרכז", lat: 32.08, lng: 34.8 },
          { label: "ירושלים והרי יהודה", lat: 31.78, lng: 35.21 },
          { label: "דרום", lat: 31.25, lng: 34.79 },
          { label: "אילת והערבה", lat: 29.56, lng: 34.95 },
        ];
        const nearest = centers.reduce((best, item) => {
          const distance = (coords.latitude - item.lat) ** 2 + (coords.longitude - item.lng) ** 2;
          return distance < best.distance ? { label: item.label, distance } : best;
        }, { label: "מרכז", distance: Number.POSITIVE_INFINITY });
        setLocating(false);
        chooseLocation(nearest.label);
      },
      () => {
        setLocating(false);
        setLocationStatus("לא הצלחנו לזהות את המיקום. אפשר לבחור יעד מהרשימה.");
      },
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 },
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
  const visiblePlaces = places.filter((place) => place.includes(locationQuery.trim()));

  return (
    <>
      {showWorlds && !shouldCollapse && !mobileExpanded && <SearchWorldTabs active={activeWorld} />}
      {showWorlds && shouldCollapse && (locationOpen || guestOpen || priceOpen) && <div className="search-context-worlds"><SearchWorldTabs active={activeWorld} onNavigate={closeMobileSearch} /></div>}
      <div className={`search-box-shell ${shouldCollapse ? "search-box-shell--results" : ""} ${mobileExpanded ? "mobile-expanded" : "mobile-collapsed"}`}>
        {shouldCollapse && <button type="button" className="search-mobile-summary" onClick={() => { setMobileStep("overview"); setMobileExpanded(true); setLocationOpen(false); setCalendarOpen(false); setGuestOpen(false); }} aria-expanded={mobileExpanded} aria-label={`שינוי חיפוש. ${mobileSummary}`}>
          <span className="search-mobile-summary__copy"><strong>{translate(locationValue)}</strong><small>{!isHourly && <><span>{dates}</span><span aria-hidden="true"> · </span><span>{peopleValue}</span></>}</small></span>
          <span className="search-mobile-summary__action"><SearchIcon /><b>שינוי חיפוש</b></span>
        </button>}
        {mobileExpanded && <button type="button" className="search-mobile-backdrop" onClick={cancelMobileSearch} aria-label="סגירת החיפוש" />}
        {(locationOpen || guestOpen || priceOpen) && <button type="button" className="search-option-backdrop" onClick={cancelMobileSearch} aria-label="סגירת אפשרויות החיפוש" />}
        <div className={`search-box ${shouldCollapse ? "compact" : ""} ${isHourly ? "search-box--hourly" : ""} mobile-step-${mobileStep}`} role="search" aria-label={mode === "events" ? "חיפוש מקום לאירוע" : mode === "spa" ? "חיפוש מתחם ספא" : isHourly ? "חיפוש חדרים לפי שעה" : "חיפוש חופשה"}>
        {mobileExpanded && <div className="search-mobile-sheet-head"><strong>{translate(mobileSheetTitle)}</strong><div className="search-mobile-sheet-head__actions"><Link className="search-gift-card-link" href={localizedPath("/gift-card", language)} onClick={closeMobileSearch} aria-label={translate("קנה שובר מתנה")}><GiftIcon /><span>{translate("קנה שובר מתנה")}</span></Link><button type="button" onClick={cancelMobileSearch} aria-label="סגירת החיפוש">×</button></div></div>}
        {mobileExpanded && showWorlds && <div className="search-mobile-worlds"><SearchWorldTabs active={activeWorld} onNavigate={closeMobileSearch} /></div>}
        <div className={`search-field-wrap search-step search-step--location ${mobileStep === "location" ? "active" : ""}`}>
          <button type="button" className="search-field" aria-expanded={locationOpen} onClick={() => { setMobileStep("location"); expandMobileSearch(); setLocationOpen((value) => !value); setGuestOpen(false); setPriceOpen(false); }}><PinIcon /><span><small>{mode === "events" ? "אזור או מקום" : isHourly ? "עיר או אזור" : "לאן נוסעים"}</small><strong>{translate(locationValue)}</strong></span></button>
          {locationOpen && <div className="search-popover location-list">
            <label className="location-list__search"><span>{translate("חיפוש יעד")}</span><input value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} placeholder={translate("הקלידו עיר או אזור")} autoFocus /></label>
            {locationQuery.trim() ? (
              <div className="location-search-results">
                {visiblePlaces.map((place) => <button type="button" key={place} className={place === locationValue ? "selected" : ""} onClick={() => chooseLocation(place)}><PinIcon /><span>{translate(place)}</span></button>)}
                {visiblePlaces.length === 0 ? <p>{translate("לא מצאנו יעד מתאים.")}</p> : null}
              </div>
            ) : mode === "vacation" ? (
              <div className="location-discovery">
                <button type="button" className="location-nearby" onClick={chooseNearbyLocation} disabled={locating}>
                  <span className="location-nearby__icon"><PinIcon /></span>
                  <span><strong>{translate("מקומות בסביבה הקרובה")}</strong><small>{translate("נמצא את האזור הקרוב לפי המיקום שלכם")}</small></span>
                  <b aria-hidden="true">←</b>
                </button>
                {locationStatus ? <p className="location-status" role="status">{translate(locationStatus)}</p> : null}
                {vacationLocationGroups.map((group) => (
                  <section className={`location-group location-group--${group.id}`} key={group.id}>
                    <h3>{translate(group.title)}</h3>
                    <div>
                      {group.options.map((place) => <button type="button" key={place} className={place === locationValue ? "selected" : ""} aria-pressed={place === locationValue} onClick={() => chooseLocation(place)}><PinIcon /><span>{translate(place)}</span></button>)}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="location-search-results">
                {visiblePlaces.map((place) => <button type="button" key={place} className={place === locationValue ? "selected" : ""} onClick={() => chooseLocation(place)}><PinIcon /><span>{translate(place)}</span></button>)}
              </div>
            )}
          </div>}
        </div>
        {isHourly && <div className="search-field-wrap search-field-wrap--price">
          <button type="button" className="search-field" aria-expanded={priceOpen} onClick={() => { setPriceOpen((value) => !value); setLocationOpen(false); }}><span><small>מחיר לשעתיים עד</small><strong>{maximumPrice ? `${maximumPrice} ₪` : "ללא הגבלת מחיר"}</strong></span></button>
          {priceOpen && <div className="search-popover search-price-list">{HOURLY_PRICE_OPTIONS.map((price) => <button type="button" key={price} className={price === maximumPrice ? "selected" : ""} onClick={() => { setMaximumPrice(price); setPriceOpen(false); }}>{price ? `עד ${price} ₪ לשעתיים` : "ללא הגבלת מחיר"}</button>)}</div>}
        </div>}
        {!isHourly && <button type="button" className={`search-field search-step search-step--dates ${mobileStep === "dates" ? "active" : ""}`} onClick={() => { setMobileStep("dates"); expandMobileSearch(); setCalendarOpen(true); setLocationOpen(false); setGuestOpen(false); }}><CalendarIcon /><span><small>{mode === "events" ? "מתי האירוע?" : mode === "spa" ? "מתי מגיעים?" : "מתי יוצאים"}</small><strong>{dates}</strong></span></button>}
        {!isHourly && <div className={`search-field-wrap search-step search-step--guests ${mobileStep === "guests" ? "active" : ""}`}>
          <button type="button" className="search-field" aria-expanded={guestOpen} onClick={() => { setMobileStep("guests"); expandMobileSearch(); setGuestOpen((value) => mobileExpanded ? true : !value); setLocationOpen(false); }}><PeopleIcon /><span><small>{peopleLabel}</small><strong>{peopleValue}</strong></span></button>
          {guestOpen && (mode === "spa"
            ? <div className="search-popover spa-audience-picker"><strong>למי מזמינים?<small>לא חובה</small></strong><button type="button" className={`spa-audience-clear ${spaAudience === null ? "selected" : ""}`} aria-pressed={spaAudience === null} onClick={() => { setSpaAudience(null); setGuests(0); if (!mobileExpanded) setGuestOpen(false); }}><span>ללא העדפה</span><small>הציגו את כל בתי הספא</small></button><div>{SPA_AUDIENCES.map((option) => <button type="button" key={option.id} className={spaAudience === option.id ? "selected" : ""} aria-pressed={spaAudience === option.id} onClick={() => { setSpaAudience(option.id); setGuests(option.guests); if (!mobileExpanded) setGuestOpen(false); }}><span>{option.label}</span><small>{option.description}</small></button>)}</div></div>
            : mode === "vacation"
              ? <div className="search-popover vacation-party-picker" aria-label="בחירת הרכב אורחים וחדרים">
                  <header><div><strong>מי מגיע?</strong><small>התאימו את ההרכב למקום הנכון</small></div><button type="button" onClick={cancelMobileSearch} aria-label="סגירת בחירת האורחים">×</button></header>
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
                  <button type="button" className="popover-done" onClick={() => setGuestOpen(false)}>שמירת ההרכב</button>
                </div>
              : <div className="search-popover guest-picker"><strong>משתתפים</strong><div><button type="button" disabled={guests <= 0} onClick={() => setGuests((value) => value - 10)}>−</button><span>{guests === 0 ? "לא נבחר" : guests}</span><button type="button" onClick={() => setGuests((value) => value + 10)}>+</button></div><button type="button" className="popover-done" onClick={() => setGuestOpen(false)}>סיום</button></div>)}
        </div>}
        <button type="button" className={`search-submit ${isSearching ? "is-searching" : ""}`} onClick={search} disabled={isSearching} aria-busy={isSearching}><span className="search-submit__icon" aria-hidden="true">{isSearching ? <i /> : <SearchIcon />}</span><span>{isSearching ? "מחפשים..." : "חיפוש"}</span></button>
        </div>
        <span className="search-status" role="status" aria-live="polite">{isSearching ? "מחפשים" : ""}</span>
      </div>
      {mode === "events" ? <EventDatePicker open={calendarOpen} onClose={() => setCalendarOpen(false)} onCancel={cancelMobileSearch} onConfirm={(result) => { setDates(result.summary); setEventDateRange({ from: result.from, to: result.to }); setMobileStep("guests"); setGuestOpen(true); }} /> : mode === "spa" ? <SpaDatePicker open={calendarOpen} onClose={() => setCalendarOpen(false)} onCancel={cancelMobileSearch} onConfirm={(result) => { setDates(result.summary); setSpaDate({ date: result.date, withoutDate: result.withoutDate }); setMobileStep("overview"); setGuestOpen(false); }} /> : !isHourly && <CalendarDemo mode="home" open={calendarOpen} onClose={() => setCalendarOpen(false)} onCancel={cancelMobileSearch} onConfirm={(result) => { setDates(result.summary); setVacationDateRange({ from: result.checkIn, till: result.checkOut }); setMobileStep("guests"); setGuestOpen(true); }} />}
    </>
  );
}
