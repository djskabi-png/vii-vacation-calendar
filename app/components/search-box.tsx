"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDemo } from "../calendar-demo";
import { EventDatePicker } from "./event-date-picker";
import { SpaDatePicker } from "./spa-date-picker";
import { type WorldId } from "../data/world-data";
import { searchLocationOptions, type SearchMode } from "../data/search-taxonomy";
import { CalendarIcon, PeopleIcon, PinIcon, SearchIcon } from "../site-header";
import { SearchWorldTabs } from "./world-switcher";
import { useSiteLanguage } from "../i18n/locale-provider";
import { localizedPath } from "../i18n/locale-routing";
import { cleanVacationPath } from "../data/vacation-landings";
import { cleanAccommodationPath } from "../data/accommodation-landings";

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

function defaultGuestCount(mode: SearchMode) {
  if (mode === "events") return 0;
  if (mode === "spa") return 1;
  return 2;
}

function parseSpaAudience(value: string | null): SpaAudience {
  return SPA_AUDIENCES.some((option) => option.id === value) ? value as SpaAudience : "single";
}

export function SearchBox({ mode = "vacation", compact = false, showWorlds = false, initialLocation, initialGuests, basePath, vacationType }: { mode?: SearchMode; compact?: boolean; showWorlds?: boolean; initialLocation?: string; initialGuests?: number; basePath?: string; vacationType?: string }) {
  const searchParams = useSearchParams();
  const { language } = useSiteLanguage();
  const isHourly = mode === "hourly";
  const shouldCollapse = compact || searchParams.has("location");
  const places = useMemo(() => searchLocationOptions(mode), [mode]);
  const [locationValue, setLocationValue] = useState(() => searchParams.get("location") || initialLocation || "כל הארץ");
  const [dates, setDates] = useState(() => searchParams.get("dates") || defaultDateLabel(mode));
  const [eventDateRange, setEventDateRange] = useState<{ from: string | null; to: string | null }>(() => ({ from: searchParams.get("from"), to: searchParams.get("to") }));
  const [spaDate, setSpaDate] = useState<{ date: string | null; withoutDate: boolean }>(() => ({ date: searchParams.get("date"), withoutDate: searchParams.get("withoutDate") === "1" }));
  const [spaAudience, setSpaAudience] = useState<SpaAudience>(() => parseSpaAudience(searchParams.get("spaFor")));
  const [guests, setGuests] = useState(() => Number(searchParams.get("guests")) || initialGuests || defaultGuestCount(mode));
  const [vacationParty, setVacationParty] = useState<VacationParty>(() => initialVacationParty(searchParams, Number(searchParams.get("guests")) || initialGuests || 2));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [maximumPrice, setMaximumPrice] = useState(() => Number(searchParams.get("maxPrice")) || 0);
  const [isSearching, setIsSearching] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLocationValue(searchParams.get("location") || initialLocation || "כל הארץ");
      setDates(searchParams.get("dates") || defaultDateLabel(mode));
      setGuests(Number(searchParams.get("guests")) || initialGuests || defaultGuestCount(mode));
      setMaximumPrice(Number(searchParams.get("maxPrice")) || 0);
      if (mode === "vacation") {
        setVacationParty(initialVacationParty(searchParams, Number(searchParams.get("guests")) || initialGuests || 2));
      }

      if (mode === "events") {
        setEventDateRange({ from: searchParams.get("from"), to: searchParams.get("to") });
      }

      if (mode === "spa") {
        setSpaAudience(parseSpaAudience(searchParams.get("spaFor")));
        setSpaDate({ date: searchParams.get("date"), withoutDate: searchParams.get("withoutDate") === "1" });
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialGuests, initialLocation, mode, searchParams]);

  useEffect(() => {
    if (!mobileExpanded) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileExpanded(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileExpanded]);

  function search() {
    if (isSearching) return;
    setIsSearching(true);
    const cleanVacationRoute = mode === "vacation" ? (vacationType ? cleanAccommodationPath(vacationType, locationValue) : cleanVacationPath(locationValue)) : null;
    const route = cleanVacationRoute || (basePath && mode === "vacation" ? basePath : mode === "events" ? "/events/search/" : mode === "spa" ? "/spas/" : mode === "hourly" ? "/hourly/" : "/search/");
    let destination: string;
    if (isHourly) {
      const params = new URLSearchParams();
      if (locationValue !== "כל הארץ") params.set("location", locationValue);
      if (maximumPrice > 0) params.set("maxPrice", String(maximumPrice));
      const query = params.toString();
      destination = query ? `${route}?${query}` : route;
    } else if (mode === "vacation" && cleanVacationRoute) {
      const params = new URLSearchParams();
      if (dates !== defaultDateLabel(mode)) params.set("dates", dates);
      if (vacationParty.adults !== 2) params.set("adults", String(vacationParty.adults));
      if (vacationParty.children) params.set("children", String(vacationParty.children));
      if (vacationParty.infants) params.set("infants", String(vacationParty.infants));
      if (vacationParty.pets) params.set("pets", String(vacationParty.pets));
      if (vacationParty.rooms !== 1) params.set("rooms", String(vacationParty.rooms));
      const query = params.toString();
      destination = query ? `${route}?${query}` : route;
    } else {
      const params = new URLSearchParams();
      if (!(basePath && mode === "vacation" && locationValue === initialLocation) && locationValue !== "כל הארץ") {
        params.set("location", locationValue);
      }
      if (mode === "events") {
        if (eventDateRange.from) params.set("from", eventDateRange.from);
        if (eventDateRange.to) params.set("to", eventDateRange.to);
        if (guests > 0) params.set("guests", String(guests));
      } else if (mode === "spa") {
        if (spaAudience !== "single") params.set("spaFor", spaAudience);
        if (spaDate.date) params.set("date", spaDate.date);
        if (spaDate.withoutDate) params.set("withoutDate", "1");
      } else {
        if (dates !== defaultDateLabel(mode)) params.set("dates", dates);
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
      window.location.assign(target);
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

  const activeWorld = (mode === "spa" ? "spa" : mode === "hourly" ? "hourly" : mode) as WorldId;
  const peopleLabel = mode === "events" ? "כמות משתתפים" : mode === "spa" ? "למי מזמינים" : "מי מגיע";
  const vacationGuestCount = vacationParty.adults + vacationParty.children;
  const vacationRoomLabel = vacationParty.rooms === 1 ? "חדר אחד" : `${vacationParty.rooms} חדרים`;
  const peopleValue = mode === "events"
    ? (guests ? `${guests} משתתפים` : "בחרו כמות משתתפים")
    : mode === "spa"
      ? (SPA_AUDIENCES.find((option) => option.id === spaAudience)?.label ?? "יחיד")
      : `${vacationGuestCount} אורחים · ${vacationRoomLabel}`;
  const mobileSummary = [locationValue, !isHourly ? dates : "", !isHourly ? peopleValue : ""].filter(Boolean).join(" · ");

  return (
    <>
      {showWorlds && !shouldCollapse && <SearchWorldTabs active={activeWorld} />}
      <div className={`search-box-shell ${shouldCollapse ? "search-box-shell--results" : ""} ${mobileExpanded ? "mobile-expanded" : "mobile-collapsed"}`}>
        {shouldCollapse && <button type="button" className="search-mobile-summary" onClick={() => setMobileExpanded(true)} aria-expanded={mobileExpanded} aria-label={`שינוי חיפוש. ${mobileSummary}`}>
          <span className="search-mobile-summary__copy"><strong>{locationValue}</strong><small>{!isHourly && <><span>{dates}</span><span aria-hidden="true"> · </span><span>{peopleValue}</span></>}</small></span>
          <span className="search-mobile-summary__action"><SearchIcon /><b>שינוי חיפוש</b></span>
        </button>}
        {shouldCollapse && mobileExpanded && <button type="button" className="search-mobile-backdrop" onClick={() => setMobileExpanded(false)} aria-label="סגירת החיפוש" />}
        {(locationOpen || guestOpen || priceOpen) && <button type="button" className="search-option-backdrop" onClick={() => { setLocationOpen(false); setGuestOpen(false); setPriceOpen(false); }} aria-label="סגירת אפשרויות החיפוש" />}
        <div className={`search-box ${shouldCollapse ? "compact" : ""} ${isHourly ? "search-box--hourly" : ""}`} role="search" aria-label={mode === "events" ? "חיפוש מקום לאירוע" : mode === "spa" ? "חיפוש מתחם ספא" : isHourly ? "חיפוש חדרים לפי שעה" : "חיפוש חופשה"}>
        {shouldCollapse && <div className="search-mobile-sheet-head"><strong>שינוי חיפוש</strong><button type="button" onClick={() => setMobileExpanded(false)} aria-label="סגירת החיפוש">×</button></div>}
        <div className="search-field-wrap">
          <button type="button" className="search-field" aria-expanded={locationOpen} onClick={() => { setLocationOpen((value) => !value); setGuestOpen(false); setPriceOpen(false); }}><PinIcon /><span><small>{mode === "events" ? "אזור או מקום" : isHourly ? "עיר או אזור" : "לאן נוסעים"}</small><strong>{locationValue}</strong></span></button>
          {locationOpen && <div className="search-popover location-list">{places.map((place) => <button type="button" key={place} className={place === locationValue ? "selected" : ""} onClick={() => { setLocationValue(place); setLocationOpen(false); }}>{place}</button>)}</div>}
        </div>
        {isHourly && <div className="search-field-wrap search-field-wrap--price">
          <button type="button" className="search-field" aria-expanded={priceOpen} onClick={() => { setPriceOpen((value) => !value); setLocationOpen(false); }}><span><small>מחיר התחלתי עד</small><strong>{maximumPrice ? `${maximumPrice} ₪` : "ללא הגבלה"}</strong></span></button>
          {priceOpen && <div className="search-popover search-price-list">{[0, 200, 250, 300, 400].map((price) => <button type="button" key={price} className={price === maximumPrice ? "selected" : ""} onClick={() => { setMaximumPrice(price); setPriceOpen(false); }}>{price ? `${price} ₪` : "ללא הגבלה"}</button>)}</div>}
        </div>}
        {!isHourly && <button type="button" className="search-field" onClick={() => { setCalendarOpen(true); setLocationOpen(false); setGuestOpen(false); }}><CalendarIcon /><span><small>{mode === "events" ? "מתי האירוע?" : mode === "spa" ? "מתי מגיעים?" : "מתי יוצאים"}</small><strong>{dates}</strong></span></button>}
        {!isHourly && <div className="search-field-wrap">
          <button type="button" className="search-field" aria-expanded={guestOpen} onClick={() => { setGuestOpen((value) => !value); setLocationOpen(false); }}><PeopleIcon /><span><small>{peopleLabel}</small><strong>{peopleValue}</strong></span></button>
          {guestOpen && (mode === "spa"
            ? <div className="search-popover spa-audience-picker"><strong>למי מזמינים?</strong><div>{SPA_AUDIENCES.map((option) => <button type="button" key={option.id} className={spaAudience === option.id ? "selected" : ""} aria-pressed={spaAudience === option.id} onClick={() => { setSpaAudience(option.id); setGuests(option.guests); setGuestOpen(false); }}><span>{option.label}</span><small>{option.description}</small></button>)}</div></div>
            : mode === "vacation"
              ? <div className="search-popover vacation-party-picker" aria-label="בחירת הרכב אורחים וחדרים">
                  <header><div><strong>מי מגיע?</strong><small>התאימו את ההרכב למקום הנכון</small></div><button type="button" onClick={() => setGuestOpen(false)} aria-label="סגירת בחירת האורחים">×</button></header>
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
      {mode === "events" ? <EventDatePicker open={calendarOpen} onClose={() => setCalendarOpen(false)} onConfirm={(result) => { setDates(result.summary); setEventDateRange({ from: result.from, to: result.to }); }} /> : mode === "spa" ? <SpaDatePicker open={calendarOpen} onClose={() => setCalendarOpen(false)} onConfirm={(result) => { setDates(result.summary); setSpaDate({ date: result.date, withoutDate: result.withoutDate }); }} /> : !isHourly && <CalendarDemo mode="home" open={calendarOpen} onClose={() => setCalendarOpen(false)} onConfirm={(result) => setDates(result.summary)} />}
    </>
  );
}
