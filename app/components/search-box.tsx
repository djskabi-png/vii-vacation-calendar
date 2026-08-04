"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDemo } from "../calendar-demo";
import { CalendarIcon, PeopleIcon, PinIcon, SearchIcon } from "../site-header";

const places = ["כל הארץ", "צפון", "כנרת", "גליל מערבי", "מרכז", "ירושלים", "ים המלח", "אילת"];

export function SearchBox({ mode = "vacation", compact = false }: { mode?: "vacation" | "events"; compact?: boolean }) {
  const router = useRouter();
  const [location, setLocation] = useState("כל הארץ");
  const [dates, setDates] = useState("בחרו תאריכים");
  const [guests, setGuests] = useState(mode === "events" ? 40 : 2);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);

  function search() {
    const route = mode === "events" ? "/events/search/" : "/search/";
    router.push(`${route}?location=${encodeURIComponent(location)}&dates=${encodeURIComponent(dates)}&guests=${guests}`);
  }

  return (
    <>
      <div className={`search-box ${compact ? "compact" : ""}`} role="search" aria-label={mode === "events" ? "חיפוש מקום לאירוע" : "חיפוש חופשה"}>
        <div className="search-field-wrap">
          <button type="button" className="search-field" aria-expanded={locationOpen} onClick={() => { setLocationOpen((value) => !value); setGuestOpen(false); }}><PinIcon /><span><small>{mode === "events" ? "אזור או מקום" : "לאן נוסעים"}</small><strong>{location}</strong></span></button>
          {locationOpen && <div className="search-popover location-list">{places.map((place) => <button type="button" key={place} className={place === location ? "selected" : ""} onClick={() => { setLocation(place); setLocationOpen(false); }}>{place}</button>)}</div>}
        </div>
        <button type="button" className="search-field" onClick={() => { setCalendarOpen(true); setLocationOpen(false); setGuestOpen(false); }}><CalendarIcon /><span><small>{mode === "events" ? "מתי חוגגים" : "מתי יוצאים"}</small><strong>{dates}</strong></span></button>
        <div className="search-field-wrap">
          <button type="button" className="search-field" aria-expanded={guestOpen} onClick={() => { setGuestOpen((value) => !value); setLocationOpen(false); }}><PeopleIcon /><span><small>{mode === "events" ? "כמות משתתפים" : "מי מגיע"}</small><strong>{mode === "events" ? `${guests} משתתפים` : `${guests} אורחים`}</strong></span></button>
          {guestOpen && <div className="search-popover guest-picker"><strong>{mode === "events" ? "משתתפים" : "אורחים"}</strong><div><button type="button" disabled={guests <= (mode === "events" ? 10 : 1)} onClick={() => setGuests((value) => value - (mode === "events" ? 10 : 1))}>−</button><span>{guests}</span><button type="button" onClick={() => setGuests((value) => value + (mode === "events" ? 10 : 1))}>+</button></div><button type="button" className="popover-done" onClick={() => setGuestOpen(false)}>סיום</button></div>}
        </div>
        <button type="button" className="search-submit" onClick={search}><SearchIcon /><span>חיפוש</span></button>
      </div>
      <CalendarDemo mode="home" open={calendarOpen} onClose={() => setCalendarOpen(false)} onConfirm={(result) => setDates(result.summary)} />
    </>
  );
}
