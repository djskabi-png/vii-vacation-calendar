"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import Link from "next/link";
import type { EventPlace } from "../data/site-data";
import { eventPlaceHref } from "../lib/event-place-href";
import { useViiLiveSearch } from "./use-vii-live-search";
import { EventRail } from "./event-rail";

function israelDate(offset: number) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (name: string) => Number(parts.find((part) => part.type === name)?.value || 0);
  const date = new Date(Date.UTC(value("year"), value("month") - 1, value("day") + offset));
  return date.toISOString().slice(0, 10);
}

export function EventLastMinute({ places }: { places: EventPlace[] }) {
  const [date, setDate] = useState<string | null>(null);
  useEffect(() => { setDate(israelDate(1)); }, []);
  const search = useViiLiveSearch("events", date, date, 20, 3);
  const available = places.flatMap((place) => {
    const match = /^event-(\d+)$/.exec(place.slug);
    const result = match ? search.results[Number(match[1])] : null;
    return result?.available === true && result.total && result.start && result.from
      ? [{ place, price: result.total, start: result.start, date: result.from }] : [];
  }).sort((a, b) => a.price - b.price).slice(0, 12);

  return <section className="section shell event-discovery-section" aria-labelledby="event-last-minute-title">
    <div className="section-head"><div><span className="eyebrow">בדיקה מול יומן המקומות</span><h2 id="event-last-minute-title">אירועים פנויים בקרוב</h2></div><Link href={`/events/search?${new URLSearchParams({ from: date || "", to: date || "", guests: "20", hours: "3" })}`}>לכל המקומות</Link></div>
    <div className="event-last-minute-controls"><label>תאריך האירוע <input type="date" value={date || ""} min={israelDate(0)} max={israelDate(30)} onChange={(event) => setDate(event.target.value || null)} /></label><span>הבדיקה היא ל־20 משתתפים ול־3 שעות. בעמוד המקום אפשר לשנות את ההרכב.</span></div>
    {search.status === "loading" || search.status === "idle" ? <p className="event-rail-status" role="status">בודקים זמינות ומחירים...</p> : null}
    {search.status === "error" ? <p className="event-rail-status" role="alert">לא ניתן לבדוק זמינות כרגע. אפשר לבחור תאריך אחר או לחפש בכל המקומות.</p> : null}
    {search.status === "ready" && !available.length ? <p className="event-rail-status">לא נמצאו מקומות עם זמינות ומחיר מאומתים לתאריך הזה. נסו תאריך אחר.</p> : null}
    {available.length ? <EventRail title="אירועים פנויים בקרוב">{available.map(({ place, price, start, date: eventDate }) => <Link className="event-rail-card" key={place.slug} href={`${eventPlaceHref(place)}?${new URLSearchParams({ from: eventDate, guests: "20", hours: "3" })}`}><img src={place.image} alt={place.name} loading="lazy" /><span className="event-rail-card__body"><small>{place.location} · {start}</small><strong>{place.name}</strong><span>פנוי לפי בדיקת ה־API</span><b>{price.toLocaleString("he-IL")} ₪ לאירוע</b></span></Link>)}</EventRail> : null}
  </section>;
}
