"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDemo } from "../calendar-demo";
import { EventDatePicker } from "./event-date-picker";
import { eventPlaces, properties } from "../data/site-data";
import { hourlyPlaces, spaPlaces, type WorldId } from "../data/world-data";
import { CalendarIcon, PeopleIcon, PinIcon, SearchIcon } from "../site-header";
import { SearchWorldTabs } from "./world-switcher";

export type SearchMode = "vacation" | "events" | "spa" | "hourly";

export function SearchBox({ mode = "vacation", compact = false, showWorlds = false }: { mode?: SearchMode; compact?: boolean; showWorlds?: boolean }) {
  const router = useRouter();
  const isHourly = mode === "hourly";
  const places = useMemo(() => {
    const source = mode === "events" ? eventPlaces : mode === "spa" ? spaPlaces : mode === "hourly" ? hourlyPlaces : properties;
    return ["כל הארץ", ...Array.from(new Set(source.flatMap((item) => [item.area, item.location])))];
  }, [mode]);
  const [locationValue, setLocationValue] = useState("כל הארץ");
  const [dates, setDates] = useState(mode === "events" ? "בחרו מועד" : "בחרו תאריכים");
  const [eventDateRange, setEventDateRange] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
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
    router.push(`${route}?location=${encodeURIComponent(locationValue)}&dates=${encodeURIComponent(dates)}&guests=${guests}${eventRange}`);
  }

  const activeWorld = (mode === "spa" ? "spa" : mode === "hourly" ? "hourly" : mode) as WorldId;
  const peopleLabel = mode === "events" ? "כמות משתתפים" : mode === "spa" ? "למי מזמינים" : "מי מגיע";
  const peopleValue = mode === "events" ? (guests ? `${guests} משתתפים` : "בחרו כמות משתתפים") : mode === "spa" ? (guests === 1 ? "יחיד" : "זוג") : `${guests} אורחים`;

  return (
    <>
      {showWorlds && !compact && <SearchWorldTabs active={activeWorld} />}
      <div className={`search-box ${compact ? "compact" : ""} ${isHourly ? "search-box--hourly" : ""}`} role="search" aria-label={mode === "events" ? "חיפוש מקום לאירוע" : isHourly ? "חיפוש חדרים לפי שעה" : "חיפוש חופשה"}>
        <div className="search-field-wrap">
          <button type="button" className="search-field" aria-expanded={locationOpen} onClick={() => { setLocationOpen((value) => !value); setGuestOpen(false); }}><PinIcon /><span><small>{mode === "events" ? "אזור או מקום" : isHourly ? "עיר או אזור" : "לאן נוסעים"}</small><strong>{locationValue}</strong></span></button>
          {locationOpen && <div className="search-popover location-list">{places.map((place) => <button type="button" key={place} className={place === locationValue ? "selected" : ""} onClick={() => { setLocationValue(place); setLocationOpen(false); }}>{place}</button>)}</div>}
        </div>
        {!isHourly && <button type="button" className="search-field" onClick={() => { setCalendarOpen(true); setLocationOpen(false); setGuestOpen(false); }}><CalendarIcon /><span><small>{mode === "events" ? "מתי האירוע?" : "מתי יוצאים"}</small><strong>{dates}</strong></span></button>}
        {!isHourly && <div className="search-field-wrap">
          <button type="button" className="search-field" aria-expanded={guestOpen} onClick={() => { setGuestOpen((value) => !value); setLocationOpen(false); }}><PeopleIcon /><span><small>{peopleLabel}</small><strong>{peopleValue}</strong></span></button>
          {guestOpen && <div className="search-popover guest-picker"><strong>{mode === "events" ? "משתתפים" : mode === "spa" ? "אורחים" : "אורחים"}</strong><div><button type="button" disabled={guests <= (mode === "events" ? 0 : 1)} onClick={() => setGuests((value) => value - (mode === "events" ? 10 : 1))}>−</button><span>{mode === "events" && guests === 0 ? "לא נבחר" : guests}</span><button type="button" disabled={mode === "spa" && guests >= 2} onClick={() => setGuests((value) => value + (mode === "events" ? 10 : 1))}>+</button></div><button type="button" className="popover-done" onClick={() => setGuestOpen(false)}>סיום</button></div>}
        </div>}
        <button type="button" className="search-submit" onClick={search}><SearchIcon /><span>חיפוש</span></button>
      </div>
      {mode === "events" ? <EventDatePicker open={calendarOpen} onClose={() => setCalendarOpen(false)} onConfirm={(result) => { setDates(result.summary); setEventDateRange({ from: result.from, to: result.to }); }} /> : !isHourly && <CalendarDemo mode="home" open={calendarOpen} onClose={() => setCalendarOpen(false)} onConfirm={(result) => setDates(result.summary)} />}
    </>
  );
}
