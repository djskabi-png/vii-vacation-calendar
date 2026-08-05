"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDemo } from "../calendar-demo";
import { eventPlaces, properties } from "../data/site-data";
import { hourlyPlaces, spaPlaces, type WorldId } from "../data/world-data";
import { CalendarIcon, PeopleIcon, PinIcon, SearchIcon } from "../site-header";
import { SearchWorldTabs } from "./world-switcher";

export type SearchMode = "vacation" | "events" | "spa" | "hourly";

export function SearchBox({ mode = "vacation", compact = false, showWorlds = false }: { mode?: SearchMode; compact?: boolean; showWorlds?: boolean }) {
  const router = useRouter();
  const places = useMemo(() => {
    const source = mode === "events" ? eventPlaces : mode === "spa" ? spaPlaces : mode === "hourly" ? hourlyPlaces : properties;
    return ["כל הארץ", ...Array.from(new Set(source.flatMap((item) => [item.area, item.location])))];
  }, [mode]);
  const [locationValue, setLocationValue] = useState("כל הארץ");
  const [dates, setDates] = useState("בחרו תאריכים");
  const [guests, setGuests] = useState(mode === "events" ? 40 : mode === "spa" ? 1 : 2);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);

  function search() {
    const route = mode === "events" ? "/events/search/" : mode === "spa" ? "/spas/" : mode === "hourly" ? "/hourly/" : "/search/";
    router.push(`${route}?location=${encodeURIComponent(locationValue)}&dates=${encodeURIComponent(dates)}&guests=${guests}`);
  }

  const activeWorld = (mode === "spa" ? "spa" : mode === "hourly" ? "hourly" : mode) as WorldId;
  const peopleLabel = mode === "events" ? "כמות משתתפים" : mode === "spa" ? "למי מזמינים" : "מי מגיע";
  const peopleValue = mode === "events" ? `${guests} משתתפים` : mode === "spa" ? (guests === 1 ? "יחיד" : "זוג") : `${guests} אורחים`;

  return (
    <>
      {showWorlds && !compact && <SearchWorldTabs active={activeWorld} />}
      <div className={`search-box ${compact ? "compact" : ""}`} role="search" aria-label={mode === "events" ? "חיפוש מקום לאירוע" : "חיפוש חופשה"}>
        <div className="search-field-wrap">
          <button type="button" className="search-field" aria-expanded={locationOpen} onClick={() => { setLocationOpen((value) => !value); setGuestOpen(false); }}><PinIcon /><span><small>{mode === "events" ? "אזור או מקום" : "לאן נוסעים"}</small><strong>{locationValue}</strong></span></button>
          {locationOpen && <div className="search-popover location-list">{places.map((place) => <button type="button" key={place} className={place === locationValue ? "selected" : ""} onClick={() => { setLocationValue(place); setLocationOpen(false); }}>{place}</button>)}</div>}
        </div>
        <button type="button" className="search-field" onClick={() => { setCalendarOpen(true); setLocationOpen(false); setGuestOpen(false); }}><CalendarIcon /><span><small>{mode === "events" ? "מתי חוגגים" : "מתי יוצאים"}</small><strong>{dates}</strong></span></button>
        <div className="search-field-wrap">
          <button type="button" className="search-field" aria-expanded={guestOpen} onClick={() => { setGuestOpen((value) => !value); setLocationOpen(false); }}><PeopleIcon /><span><small>{peopleLabel}</small><strong>{peopleValue}</strong></span></button>
          {guestOpen && <div className="search-popover guest-picker"><strong>{mode === "events" ? "משתתפים" : mode === "spa" ? "אורחים" : "אורחים"}</strong><div><button type="button" disabled={guests <= (mode === "events" ? 10 : 1)} onClick={() => setGuests((value) => value - (mode === "events" ? 10 : 1))}>−</button><span>{guests}</span><button type="button" disabled={mode === "spa" && guests >= 2} onClick={() => setGuests((value) => value + (mode === "events" ? 10 : 1))}>+</button></div><button type="button" className="popover-done" onClick={() => setGuestOpen(false)}>סיום</button></div>}
        </div>
        <button type="button" className="search-submit" onClick={search}><SearchIcon /><span>חיפוש</span></button>
      </div>
      <CalendarDemo mode="home" open={calendarOpen} onClose={() => setCalendarOpen(false)} onConfirm={(result) => setDates(result.summary)} />
    </>
  );
}
