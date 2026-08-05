"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDemo } from "../calendar-demo";
import { EventDatePicker } from "./event-date-picker";
import { SpaDatePicker } from "./spa-date-picker";
import { eventPlaces, properties } from "../data/site-data";
import { hourlyPlaces, spaPlaces, type WorldId } from "../data/world-data";
import { CalendarIcon, PeopleIcon, PinIcon, SearchIcon } from "../site-header";
import { SearchWorldTabs } from "./world-switcher";

export type SearchMode = "vacation" | "events" | "spa" | "hourly";
type SpaAudience = "single" | "couple" | "group" | "day-pass";

const SPA_AUDIENCES: Array<{ id: SpaAudience; label: string; description: string; guests: number }> = [
  { id: "single", label: "יחיד", description: "טיפול או חבילת ספא לאדם אחד", guests: 1 },
  { id: "couple", label: "זוגי", description: "חוויה זוגית או שני טיפולים", guests: 2 },
  { id: "group", label: "קבוצה", description: "שלושה משתתפים ומעלה", guests: 3 },
  { id: "day-pass", label: "יום כיף (ללא טיפולים)", description: "כניסה למתקנים, מאדם אחד ומעלה", guests: 1 },
];

export function SearchBox({ mode = "vacation", compact = false, showWorlds = false }: { mode?: SearchMode; compact?: boolean; showWorlds?: boolean }) {
  const router = useRouter();
  const isHourly = mode === "hourly";
  const places = useMemo(() => {
    const source = mode === "events" ? eventPlaces : mode === "spa" ? spaPlaces : mode === "hourly" ? hourlyPlaces : properties;
    return ["כל הארץ", ...Array.from(new Set(source.flatMap((item) => [item.area, item.location])))];
  }, [mode]);
  const [locationValue, setLocationValue] = useState("כל הארץ");
  const [dates, setDates] = useState(mode === "events" ? "בחרו מועד" : mode === "spa" ? "בחרו תאריך או המשיכו בלי" : "בחרו תאריכים");
  const [eventDateRange, setEventDateRange] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const [spaDate, setSpaDate] = useState<{ date: string | null; withoutDate: boolean }>({ date: null, withoutDate: false });
  const [spaAudience, setSpaAudience] = useState<SpaAudience>("single");
  const [guests, setGuests] = useState(mode === "events" ? 0 : mode === "spa" ? 1 : 2);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);

  function search() {
    const route = mode === "events" ? "/events/search/" : mode === "spa" ? "/spas/" : mode === "hourly" ? "/hourly/" : "/search/";
    if (isHourly) {
      router.push(`${route}?location=${encodeURIComponent(locationValue)}`);
      return;
    }
    const eventRange = mode === "events" ? `&from=${encodeURIComponent(eventDateRange.from ?? "")}&to=${encodeURIComponent(eventDateRange.to ?? "")}` : "";
    const spaWithoutDate = mode === "spa" && !spaDate.date;
    const dateSummary = spaWithoutDate ? "בלי תאריך כרגע" : dates;
    const spaSelection = mode === "spa" ? `&spaFor=${encodeURIComponent(spaAudience)}&date=${encodeURIComponent(spaDate.date ?? "")}&withoutDate=${spaWithoutDate || spaDate.withoutDate ? "1" : "0"}` : "";
    router.push(`${route}?location=${encodeURIComponent(locationValue)}&dates=${encodeURIComponent(dateSummary)}&guests=${guests}${eventRange}${spaSelection}`);
  }

  const activeWorld = (mode === "spa" ? "spa" : mode === "hourly" ? "hourly" : mode) as WorldId;
  const peopleLabel = mode === "events" ? "כמות משתתפים" : mode === "spa" ? "למי מזמינים" : "מי מגיע";
  const peopleValue = mode === "events" ? (guests ? `${guests} משתתפים` : "בחרו כמות משתתפים") : mode === "spa" ? (SPA_AUDIENCES.find((option) => option.id === spaAudience)?.label ?? "יחיד") : `${guests} אורחים`;

  return (
    <>
      {showWorlds && !compact && <SearchWorldTabs active={activeWorld} />}
      <div className={`search-box ${compact ? "compact" : ""} ${isHourly ? "search-box--hourly" : ""}`} role="search" aria-label={mode === "events" ? "חיפוש מקום לאירוע" : mode === "spa" ? "חיפוש מתחם ספא" : isHourly ? "חיפוש חדרים לפי שעה" : "חיפוש חופשה"}>
        <div className="search-field-wrap">
          <button type="button" className="search-field" aria-expanded={locationOpen} onClick={() => { setLocationOpen((value) => !value); setGuestOpen(false); }}><PinIcon /><span><small>{mode === "events" ? "אזור או מקום" : isHourly ? "עיר או אזור" : "לאן נוסעים"}</small><strong>{locationValue}</strong></span></button>
          {locationOpen && <div className="search-popover location-list">{places.map((place) => <button type="button" key={place} className={place === locationValue ? "selected" : ""} onClick={() => { setLocationValue(place); setLocationOpen(false); }}>{place}</button>)}</div>}
        </div>
        {!isHourly && <button type="button" className="search-field" onClick={() => { setCalendarOpen(true); setLocationOpen(false); setGuestOpen(false); }}><CalendarIcon /><span><small>{mode === "events" ? "מתי האירוע?" : mode === "spa" ? "מתי מגיעים?" : "מתי יוצאים"}</small><strong>{dates}</strong></span></button>}
        {!isHourly && <div className="search-field-wrap">
          <button type="button" className="search-field" aria-expanded={guestOpen} onClick={() => { setGuestOpen((value) => !value); setLocationOpen(false); }}><PeopleIcon /><span><small>{peopleLabel}</small><strong>{peopleValue}</strong></span></button>
          {guestOpen && (mode === "spa" ? <div className="search-popover spa-audience-picker"><strong>למי מזמינים?</strong><div>{SPA_AUDIENCES.map((option) => <button type="button" key={option.id} className={spaAudience === option.id ? "selected" : ""} aria-pressed={spaAudience === option.id} onClick={() => { setSpaAudience(option.id); setGuests(option.guests); setGuestOpen(false); }}><span>{option.label}</span><small>{option.description}</small></button>)}</div></div> : <div className="search-popover guest-picker"><strong>{mode === "events" ? "משתתפים" : "אורחים"}</strong><div><button type="button" disabled={guests <= (mode === "events" ? 0 : 1)} onClick={() => setGuests((value) => value - (mode === "events" ? 10 : 1))}>−</button><span>{mode === "events" && guests === 0 ? "לא נבחר" : guests}</span><button type="button" onClick={() => setGuests((value) => value + (mode === "events" ? 10 : 1))}>+</button></div><button type="button" className="popover-done" onClick={() => setGuestOpen(false)}>סיום</button></div>)}
        </div>}
        <button type="button" className="search-submit" onClick={search}><SearchIcon /><span>חיפוש</span></button>
      </div>
      {mode === "events" ? <EventDatePicker open={calendarOpen} onClose={() => setCalendarOpen(false)} onConfirm={(result) => { setDates(result.summary); setEventDateRange({ from: result.from, to: result.to }); }} /> : mode === "spa" ? <SpaDatePicker open={calendarOpen} onClose={() => setCalendarOpen(false)} onConfirm={(result) => { setDates(result.summary); setSpaDate({ date: result.date, withoutDate: result.withoutDate }); }} /> : !isHourly && <CalendarDemo mode="home" open={calendarOpen} onClose={() => setCalendarOpen(false)} onConfirm={(result) => setDates(result.summary)} />}
    </>
  );
}
