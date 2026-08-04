"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { PageShell } from "../../components/page-shell";
import { eventPlaces } from "../../data/site-data";
import { CalendarIcon, PinIcon } from "../../site-header";

export default function EventPlacePage() {
  const [index,setIndex] = useState(0);
  useEffect(() => { const timer = window.setTimeout(() => { const value = Number(new URLSearchParams(location.search).get("id") || 0); setIndex(Number.isFinite(value) ? Math.abs(value)%eventPlaces.length : 0); }, 0); return () => window.clearTimeout(timer); }, []);
  const place = eventPlaces[index];
  return <PageShell variant="events"><main id="main-content" className="event-place-page"><section className="shell event-place-hero"><div><span className="eyebrow">{place.type}</span><h1>{place.name}</h1><p><PinIcon />{place.location}</p><div className="event-place-actions"><a className="button primary" href={place.liveUrl} target="_blank" rel="noreferrer">הצגת פרטי קשר</a><button className="button subtle">שמירה</button></div></div><img src={place.image} alt={place.name} /></section><div className="shell event-place-layout"><div><section><h2>על המקום</h2><p>{place.name} הוא {place.type} באזור {place.location}. כל הפרטים המאומתים ודרכי ההתקשרות זמינים בעמוד המקור.</p></section><section><h2>מתכננים את האירוע</h2><div className="feature-list"><span>בוחרים תאריך</span><span>מגדירים כמות משתתפים</span><span>מציינים את סוג האירוע</span><span>בודקים התאמה מול המקום</span></div></section></div><aside className="booking-card"><CalendarIcon /><h2>בודקים התאמה לאירוע</h2><label>תאריך מבוקש<input type="date" /></label><label>כמות משתתפים<input type="number" min="1" defaultValue="40" /></label><label>סוג האירוע<select><option>אירוע פרטי</option><option>אירוע משפחתי</option><option>אירוע עסקי</option></select></label><a className="button primary wide" href={place.liveUrl} target="_blank" rel="noreferrer">המשך לבדיקת התאמה</a></aside></div></main></PageShell>;
}
