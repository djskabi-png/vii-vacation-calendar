"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ListingMap } from "../../components/listing-map";
import { PageShell } from "../../components/page-shell";
import { SearchBox } from "../../components/search-box";
import { eventPlaces } from "../../data/site-data";
import { CloseIcon, PinIcon } from "../../site-header";

export default function EventSearchPage() {
  const [area, setArea] = useState("הכל");
  const [type, setType] = useState("הכל");
  const [eventType, setEventType] = useState("הכל");
  const [guests, setGuests] = useState(20);
  const [noNoiseLimit, setNoNoiseLimit] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [sort, setSort] = useState("recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(location.search);
      const requestedArea = params.get("location");
      const requestedGuests = Number(params.get("guests") || 20);
      if (requestedArea && requestedArea !== "כל הארץ") setArea(requestedArea);
      if (Number.isFinite(requestedGuests)) setGuests(Math.max(10, requestedGuests));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const areas = useMemo(() => ["הכל", ...Array.from(new Set(eventPlaces.map((place) => place.area)))], []);
  const types = useMemo(() => ["הכל", ...Array.from(new Set(eventPlaces.map((place) => place.type)))], []);
  const eventTypes = useMemo(() => ["הכל", ...Array.from(new Set(eventPlaces.flatMap((place) => place.eventTypes)))], []);
  const filtered = useMemo(() => {
    const result = eventPlaces.filter((place) => (area === "הכל" || place.area === area || place.location === area) && (type === "הכל" || place.type === type) && (eventType === "הכל" || place.eventTypes.includes(eventType)) && place.guests >= guests && (!noNoiseLimit || place.features.some((feature) => feature.includes("ללא הגבלת רעש"))));
    return [...result].sort((a, b) => sort === "capacity" ? b.guests - a.guests : sort === "name" ? a.name.localeCompare(b.name, "he") : eventPlaces.indexOf(a) - eventPlaces.indexOf(b));
  }, [area, eventType, guests, noNoiseLimit, sort, type]);

  function reset() { setArea("הכל"); setType("הכל"); setEventType("הכל"); setGuests(20); setNoNoiseLimit(false); }

  return (
    <PageShell variant="events">
      <main id="main-content" className="results-page events-results-page">
        <div className="results-search shell"><SearchBox mode="events" compact /></div>
        <section className="shell results-heading"><div><span className="eyebrow">אירוע שמרגיש בדיוק שלכם</span><h1>מקומות לאירועים</h1><p>{filtered.length} מתוך {eventPlaces.length} מקומות מאומתים מוצגים</p></div><button className={`button map-button ${mapOpen ? "active" : ""}`} type="button" onClick={() => setMapOpen((value) => !value)}><PinIcon />{mapOpen ? "תצוגת רשימה" : "תצוגה על מפה"}</button></section>
        <div className="shell event-results-layout">
          <aside className={`filter-panel ${filtersOpen ? "open" : ""}`}><div className="filter-head"><h2>סינון</h2><button type="button" onClick={() => setFiltersOpen(false)} aria-label="סגירה"><CloseIcon /></button></div>
            <label className="filter-select">אזור<select value={area} onChange={(event) => setArea(event.target.value)}>{areas.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="filter-select">סוג מקום<select value={type} onChange={(event) => setType(event.target.value)}>{types.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="filter-select">סוג אירוע<select value={eventType} onChange={(event) => setEventType(event.target.value)}>{eventTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
            <fieldset><legend>כמות משתתפים</legend><input type="range" min="10" max="300" step="10" value={guests} onChange={(event) => setGuests(Number(event.target.value))} /><div className="range-value">לפחות {guests} משתתפים</div></fieldset>
            <label><input type="checkbox" checked={noNoiseLimit} onChange={(event) => setNoNoiseLimit(event.target.checked)} /> ללא הגבלת רעש</label>
            <button className="button primary filter-apply" type="button" onClick={() => setFiltersOpen(false)}>הצגת {filtered.length} מקומות</button>
            <button className="button subtle wide" type="button" onClick={reset}>ניקוי סינונים</button>
          </aside>
          <section className="event-list">
            <div className="results-toolbar"><button type="button" className="button mobile-filter" onClick={() => setFiltersOpen(true)}>סינון</button><span>{filtered.length} תוצאות</span><label>מיון לפי <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="recommended">מומלצים</option><option value="capacity">קיבולת גבוהה</option><option value="name">שם המקום</option></select></label></div>
            {mapOpen ? <ListingMap listings={filtered} mode="events" /> : filtered.map((place) => <article key={place.slug}><div className="event-card-gallery"><img src={place.image} alt={place.name} /><span>{place.images.length} תמונות</span></div><div><small>{place.type}</small><h2>{place.name}</h2><p><PinIcon />{place.location}, {place.area}</p><p>{place.description}</p><div className="feature-chips">{place.features.slice(0, 3).map((feature) => <span key={feature}>{feature}</span>)}</div><div className="event-capacity">עד {place.guests} אורחים</div><Link className="button primary" href={`/events/place/?id=${place.slug}`}>לפרטים על המקום</Link></div></article>)}
            {filtered.length === 0 && <div className="empty-state"><h2>לא נמצאה התאמה</h2><p>אפשר להפחית את כמות המשתתפים או להסיר סינון.</p><button className="button primary" type="button" onClick={reset}>ניקוי סינונים</button></div>}
          </section>
        </div>
        {filtersOpen && <button className="filter-backdrop" aria-label="סגירת סינון" onClick={() => setFiltersOpen(false)} />}
      </main>
    </PageShell>
  );
}
