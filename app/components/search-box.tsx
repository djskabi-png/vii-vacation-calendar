"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDemo } from "../calendar-demo";
import { EventDatePicker } from "./event-date-picker";
import { SpaDatePicker } from "./spa-date-picker";
import { eventPlaces, properties } from "../data/site-data";
import { hourlyPlaces, spaPlaces, type WorldId } from "../data/world-data";
import { CalendarIcon, PeopleIcon, PinIcon, SearchIcon } from "../site-header";
import { SearchWorldTabs } from "./world-switcher";
import { useSiteLanguage } from "../i18n/locale-provider";
import { localizedPath } from "../i18n/locale-routing";

export type SearchMode = "vacation" | "events" | "spa" | "hourly";
type SpaAudience = "single" | "couple" | "group" | "day-pass";

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

export function SearchBox({ mode = "vacation", compact = false, showWorlds = false, initialLocation, initialGuests, basePath }: { mode?: SearchMode; compact?: boolean; showWorlds?: boolean; initialLocation?: string; initialGuests?: number; basePath?: string }) {
  const searchParams = useSearchParams();
  const { language } = useSiteLanguage();
  const isHourly = mode === "hourly";
  const shouldCollapse = compact || searchParams.has("location");
  const places = useMemo(() => {
    const source = mode === "events" ? eventPlaces : mode === "spa" ? spaPlaces : mode === "hourly" ? hourlyPlaces : properties;
    return ["כל הארץ", ...Array.from(new Set(source.flatMap((item) => [item.area, item.location])))];
  }, [mode]);
  const [locationValue, setLocationValue] = useState(() => searchParams.get("location") || initialLocation || "כל הארץ");
  const [dates, setDates] = useState(() => searchParams.get("dates") || defaultDateLabel(mode));
  const [eventDateRange, setEventDateRange] = useState<{ from: string | null; to: string | null }>(() => ({ from: searchParams.get("from"), to: searchParams.get("to") }));
  const [spaDate, setSpaDate] = useState<{ date: string | null; withoutDate: boolean }>(() => ({ date: searchParams.get("date"), withoutDate: searchParams.get("withoutDate") === "1" }));
  const [spaAudience, setSpaAudience] = useState<SpaAudience>(() => parseSpaAudience(searchParams.get("spaFor")));
  const [guests, setGuests] = useState(() => Number(searchParams.get("guests")) || initialGuests || defaultGuestCount(mode));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLocationValue(searchParams.get("location") || initialLocation || "כל הארץ");
      setDates(searchParams.get("dates") || defaultDateLabel(mode));
      setGuests(Number(searchParams.get("guests")) || initialGuests || defaultGuestCount(mode));

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
    const route = basePath && mode === "vacation" ? basePath : mode === "events" ? "/events/search/" : mode === "spa" ? "/spas/" : mode === "hourly" ? "/hourly/" : "/search/";
    let destination: string;
    if (isHourly) {
      destination = `${route}?location=${encodeURIComponent(locationValue)}`;
    } else {
      const eventRange = mode === "events" ? `&from=${encodeURIComponent(eventDateRange.from ?? "")}&to=${encodeURIComponent(eventDateRange.to ?? "")}` : "";
      const spaWithoutDate = mode === "spa" && !spaDate.date;
      const dateSummary = spaWithoutDate ? "בלי תאריך כרגע" : dates;
      const spaSelection = mode === "spa" ? `&spaFor=${encodeURIComponent(spaAudience)}&date=${encodeURIComponent(spaDate.date ?? "")}&withoutDate=${spaWithoutDate || spaDate.withoutDate ? "1" : "0"}` : "";
      const locationQuery = basePath && mode === "vacation" ? "" : `location=${encodeURIComponent(locationValue)}&`;
      destination = `${route}?${locationQuery}dates=${encodeURIComponent(dateSummary)}&guests=${guests}${eventRange}${spaSelection}`;
    }
    window.setTimeout(() => {
      try {
        window.location.assign(localizedPath(destination, language));
      } catch {
        setIsSearching(false);
      }
    }, 140);
  }

  const activeWorld = (mode === "spa" ? "spa" : mode === "hourly" ? "hourly" : mode) as WorldId;
  const peopleLabel = mode === "events" ? "כמות משתתפים" : mode === "spa" ? "למי מזמינים" : "מי מגיע";
  const peopleValue = mode === "events" ? (guests ? `${guests} משתתפים` : "בחרו כמות משתתפים") : mode === "spa" ? (SPA_AUDIENCES.find((option) => option.id === spaAudience)?.label ?? "יחיד") : `${guests} אורחים`;
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
        <div className={`search-box ${shouldCollapse ? "compact" : ""} ${isHourly ? "search-box--hourly" : ""}`} role="search" aria-label={mode === "events" ? "חיפוש מקום לאירוע" : mode === "spa" ? "חיפוש מתחם ספא" : isHourly ? "חיפוש חדרים לפי שעה" : "חיפוש חופשה"}>
        {shouldCollapse && <div className="search-mobile-sheet-head"><strong>שינוי חיפוש</strong><button type="button" onClick={() => setMobileExpanded(false)} aria-label="סגירת החיפוש">×</button></div>}
        <div className="search-field-wrap">
          <button type="button" className="search-field" aria-expanded={locationOpen} onClick={() => { setLocationOpen((value) => !value); setGuestOpen(false); }}><PinIcon /><span><small>{mode === "events" ? "אזור או מקום" : isHourly ? "עיר או אזור" : "לאן נוסעים"}</small><strong>{locationValue}</strong></span></button>
          {locationOpen && <div className="search-popover location-list">{places.map((place) => <button type="button" key={place} className={place === locationValue ? "selected" : ""} onClick={() => { setLocationValue(place); setLocationOpen(false); }}>{place}</button>)}</div>}
        </div>
        {!isHourly && <button type="button" className="search-field" onClick={() => { setCalendarOpen(true); setLocationOpen(false); setGuestOpen(false); }}><CalendarIcon /><span><small>{mode === "events" ? "מתי האירוע?" : mode === "spa" ? "מתי מגיעים?" : "מתי יוצאים"}</small><strong>{dates}</strong></span></button>}
        {!isHourly && <div className="search-field-wrap">
          <button type="button" className="search-field" aria-expanded={guestOpen} onClick={() => { setGuestOpen((value) => !value); setLocationOpen(false); }}><PeopleIcon /><span><small>{peopleLabel}</small><strong>{peopleValue}</strong></span></button>
          {guestOpen && (mode === "spa" ? <div className="search-popover spa-audience-picker"><strong>למי מזמינים?</strong><div>{SPA_AUDIENCES.map((option) => <button type="button" key={option.id} className={spaAudience === option.id ? "selected" : ""} aria-pressed={spaAudience === option.id} onClick={() => { setSpaAudience(option.id); setGuests(option.guests); setGuestOpen(false); }}><span>{option.label}</span><small>{option.description}</small></button>)}</div></div> : <div className="search-popover guest-picker"><strong>{mode === "events" ? "משתתפים" : "אורחים"}</strong><div><button type="button" disabled={guests <= (mode === "events" ? 0 : 1)} onClick={() => setGuests((value) => value - (mode === "events" ? 10 : 1))}>−</button><span>{mode === "events" && guests === 0 ? "לא נבחר" : guests}</span><button type="button" onClick={() => setGuests((value) => value + (mode === "events" ? 10 : 1))}>+</button></div><button type="button" className="popover-done" onClick={() => setGuestOpen(false)}>סיום</button></div>)}
        </div>}
        <button type="button" className={`search-submit ${isSearching ? "is-searching" : ""}`} onClick={search} disabled={isSearching} aria-busy={isSearching}><span className="search-submit__icon" aria-hidden="true">{isSearching ? <i /> : <SearchIcon />}</span><span>{isSearching ? "מחפשים..." : "חיפוש"}</span></button>
        </div>
        <span className="search-status" role="status" aria-live="polite">{isSearching ? "החיפוש התחיל, עוברים לתוצאות" : ""}</span>
      </div>
      {mode === "events" ? <EventDatePicker open={calendarOpen} onClose={() => setCalendarOpen(false)} onConfirm={(result) => { setDates(result.summary); setEventDateRange({ from: result.from, to: result.to }); }} /> : mode === "spa" ? <SpaDatePicker open={calendarOpen} onClose={() => setCalendarOpen(false)} onConfirm={(result) => { setDates(result.summary); setSpaDate({ date: result.date, withoutDate: result.withoutDate }); }} /> : !isHourly && <CalendarDemo mode="home" open={calendarOpen} onClose={() => setCalendarOpen(false)} onConfirm={(result) => setDates(result.summary)} />}
    </>
  );
}
