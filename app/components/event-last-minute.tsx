"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import Link from "next/link";
import type { EventPlace } from "../data/site-data";
import { eventPlaceHref } from "../lib/event-place-href";
import { useViiLiveSearch } from "./use-vii-live-search";
import { EventRail } from "./event-rail";
import { dailyRotationCompare } from "../lib/daily-rotation";

function israelDate(offset: number) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (name: string) => Number(parts.find((part) => part.type === name)?.value || 0);
  const date = new Date(Date.UTC(value("year"), value("month") - 1, value("day") + offset));
  return date.toISOString().slice(0, 10);
}

function nextWeekdayOffset(targetDay: number) {
  const [year, month, day] = israelDate(0).split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const offset = (targetDay - weekday + 7) % 7;
  return offset || 7;
}

export function EventLastMinute({ places }: { places: EventPlace[] }) {
  const [date, setDate] = useState<string | null>(null);
  useEffect(() => { setDate(israelDate(1)); }, []);
  const search = useViiLiveSearch("events", date, date, 20, 3);
  const candidates = places.flatMap((place) => {
    const match = /^event-(\d+)$/.exec(place.slug);
    const result = match ? search.results[Number(match[1])] : null;
    if (!result || result.available === false) return [];
    return [{ place, confirmed: result.available === true, price: result.total || null, start: result.start || null, date: result.from || date }];
  }).sort((a, b) => Number(b.confirmed) - Number(a.confirmed)
    || (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER)
    || dailyRotationCompare(a.place.slug, b.place.slug, `event-last-minute-${date || "none"}`)).slice(0, 12);
  const presets = [
    { label: "מחר", value: israelDate(1) },
    { label: "חמישי הקרוב", value: israelDate(nextWeekdayOffset(4)) },
    { label: "שישי הקרוב", value: israelDate(nextWeekdayOffset(5)) },
  ];

  return <section className="section shell event-discovery-section" aria-labelledby="event-last-minute-title">
    <div className="section-head"><div><span className="eyebrow">בדיקה ישירה מול ה־API</span><h2 id="event-last-minute-title">מקומות לאירוע קרוב</h2></div><Link href={`/events/search?${new URLSearchParams({ from: date || "", to: date || "", guests: "20", hours: "3" })}`}>לכל המקומות</Link></div>
    <div className="event-last-minute-controls"><div className="event-last-minute-tabs" aria-label="בחירת תאריך מהירה">{presets.map((preset) => <button type="button" key={preset.value} className={date === preset.value ? "active" : ""} aria-pressed={date === preset.value} onClick={() => setDate(preset.value)}>{preset.label}</button>)}</div><label>תאריך אחר <input type="date" value={date || ""} min={israelDate(0)} max={israelDate(30)} onChange={(event) => setDate(event.target.value || null)} /></label><span>הבדיקה היא ל־20 משתתפים ול־3 שעות. ״לבירור״ פירושו שה־API לא אישר ולא שלל זמינות.</span></div>
    {search.status === "loading" || search.status === "idle" ? <p className="event-rail-status" role="status">בודקים זמינות ומחירים...</p> : null}
    {search.status === "error" ? <p className="event-rail-status" role="alert">לא ניתן לבדוק זמינות כרגע. אפשר לבחור תאריך אחר או לחפש בכל המקומות.</p> : null}
    {search.status === "ready" && !candidates.length ? <p className="event-rail-status">לא נמצאו מקומות שניתן להציג לתאריך הזה. נסו תאריך אחר.</p> : null}
    {candidates.length ? <EventRail title="מקומות לאירוע קרוב">{candidates.map(({ place, confirmed, price, start, date: eventDate }) => <Link className="event-rail-card" key={place.slug} href={`${eventPlaceHref(place)}?${new URLSearchParams({ from: eventDate || date || "", guests: "20", hours: "3" })}`}><img src={place.image} alt={place.name} loading="lazy" /><span className="event-rail-card__body"><small>{place.location}{start ? ` · ${start}` : ""}</small><strong>{place.name}</strong><span>{confirmed ? "פנוי לפי בדיקת ה־API" : "לבירור זמינות ומחיר"}</span><b>{confirmed && price ? `${price.toLocaleString("he-IL")} ₪ לאירוע` : "פנייה ישירה למקום"}</b></span></Link>)}</EventRail> : null}
  </section>;
}
