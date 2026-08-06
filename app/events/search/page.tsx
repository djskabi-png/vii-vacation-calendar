"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ListingMap } from "../../components/listing-map";
import { ModernSelect } from "../../components/modern-select";
import { PageShell } from "../../components/page-shell";
import { SearchBox } from "../../components/search-box";
import { eventPlaceHref, eventPlaces } from "../../data/site-data";
import { getPlaceAccessibility } from "../../data/accessibility-data";
import { CloseIcon, MapIcon, PinIcon } from "../../site-header";
import { FavoriteButton } from "../../components/favorite-button";

export default function EventSearchPage() {
  const [area, setArea] = useState("הכל");
  const [type, setType] = useState("הכל");
  const [eventType, setEventType] = useState("הכל");
  const [guests, setGuests] = useState(0);
  const [noNoiseLimit, setNoNoiseLimit] = useState(false);
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [sort, setSort] = useState("recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(location.search);
      const requestedArea = params.get("location");
      const requestedGuests = Number(params.get("guests") || 0);
      if (requestedArea && requestedArea !== "כל הארץ") setArea(requestedArea);
      if (Number.isFinite(requestedGuests) && requestedGuests > 0) setGuests(Math.max(10, requestedGuests));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const areas = useMemo(() => ["הכל", ...Array.from(new Set(eventPlaces.map((place) => place.area)))], []);
  const types = useMemo(() => ["הכל", ...Array.from(new Set(eventPlaces.map((place) => place.type)))], []);
  const eventTypes = useMemo(() => ["הכל", ...Array.from(new Set(eventPlaces.flatMap((place) => place.eventTypes)))], []);
  const filtered = useMemo(() => {
    const result = eventPlaces.filter((place) => (area === "הכל" || place.area === area || place.location === area) && (type === "הכל" || place.type === type) && (eventType === "הכל" || place.eventTypes.includes(eventType)) && (!guests || place.guests >= guests) && (!noNoiseLimit || place.features.some((feature) => feature.includes("ללא הגבלת רעש"))) && (!accessibleOnly || getPlaceAccessibility(place.slug).status === "accessible"));
    return [...result].sort((a, b) => sort === "capacity" ? b.guests - a.guests : sort === "name" ? a.name.localeCompare(b.name, "he") : eventPlaces.indexOf(a) - eventPlaces.indexOf(b));
  }, [accessibleOnly, area, eventType, guests, noNoiseLimit, sort, type]);

  function reset() { setArea("הכל"); setType("הכל"); setEventType("הכל"); setGuests(0); setNoNoiseLimit(false); setAccessibleOnly(false); }

  return (
    <PageShell variant="events">
      <main id="main-content" className="results-page events-results-page">
        <div className="results-search shell"><SearchBox mode="events" compact /></div>
        <div className="shell breadcrumbs"><Link href="/">ראשי</Link><span>/</span><Link href="/events">אירועים</Link><span>/</span><span>מקומות לאירועים</span></div>
        <div className="shell event-results-layout">
          <aside className={`filter-panel ${filtersOpen ? "open" : ""}`}><div className="filter-head"><h2>סינון</h2><button type="button" onClick={() => setFiltersOpen(false)} aria-label="סגירה"><CloseIcon /></button></div>
            <ModernSelect label="אזור" value={area} onChange={setArea} options={areas.map((item) => ({ value: item, label: item }))} />
            <ModernSelect label="סוג מקום" value={type} onChange={setType} options={types.map((item) => ({ value: item, label: item }))} />
            <ModernSelect label="סוג אירוע" value={eventType} onChange={setEventType} options={eventTypes.map((item) => ({ value: item, label: item }))} />
            <fieldset><legend>כמות משתתפים</legend><input type="range" min="0" max="300" step="10" value={guests} aria-label="כמות משתתפים מינימלית" onChange={(event) => setGuests(Number(event.target.value))} /><div className="range-value">{guests ? `לפחות ${guests} משתתפים` : "ללא סינון לפי כמות"}</div></fieldset>
            <label><input type="checkbox" checked={noNoiseLimit} onChange={(event) => setNoNoiseLimit(event.target.checked)} /> ללא הגבלת רעש</label>
            <label><input type="checkbox" checked={accessibleOnly} onChange={(event) => setAccessibleOnly(event.target.checked)} /> נגישות מלאה ומאומתת</label>
            <button className="button primary filter-apply" type="button" onClick={() => setFiltersOpen(false)}>{`הצגת ${filtered.length} מקומות`}</button>
            <button className="button subtle wide" type="button" onClick={reset}>ניקוי סינונים</button>
          </aside>
          <section className="event-list">
            <section className="results-heading"><div><span className="eyebrow">אירוע שמרגיש בדיוק שלכם</span><h1>מקומות לאירועים</h1><p>{filtered.length} מתוך {eventPlaces.length} מקומות מאומתים מוצגים</p></div></section>
            <div className="results-toolbar"><div className="results-toolbar__actions"><button type="button" className="button mobile-filter" onClick={() => setFiltersOpen(true)}>סינון</button>{filtered.length > 0 && <button className={`button map-button mobile-map-fab ${mapOpen ? "active" : ""}`} type="button" aria-label={mapOpen ? "חזרה לתצוגת רשימה" : "הצגת תוצאות על המפה"} aria-pressed={mapOpen} onClick={() => setMapOpen((value) => !value)}><MapIcon /><span className="map-button__desktop-label">{mapOpen ? "תצוגת רשימה" : "תצוגה על מפה"}</span><span className="map-button__mobile-label" aria-hidden="true">מפה</span></button>}</div><ModernSelect compact label="מיון לפי" value={sort} onChange={setSort} options={[{ value: "recommended", label: "מומלצים" }, { value: "capacity", label: "קיבולת גבוהה" }, { value: "name", label: "שם המקום" }]} /></div>
            {mapOpen ? <ListingMap listings={filtered} mode="events" autoLoad onClose={() => setMapOpen(false)} /> : filtered.map((place) => <article key={place.slug}><div className="event-card-gallery"><img src={place.image} alt={place.name} /><span>{place.images.length} תמונות</span><FavoriteButton id={place.slug} world="events" name={place.name} location={`${place.location}, ${place.area}`} image={place.image} href={eventPlaceHref(place)} meta={`${place.type} · עד ${place.guests} אורחים`} /></div><div><small>{place.type}</small><h2>{place.name}</h2><p><PinIcon />{place.location}, {place.area}</p><p>{place.description}</p><div className="feature-chips">{place.features.slice(0, 3).map((feature) => <span key={feature}>{feature}</span>)}</div><div className="event-capacity">עד {place.guests} אורחים</div><Link className="button primary" href={eventPlaceHref(place)}>לפרטים על המקום</Link></div></article>)}
            {filtered.length === 0 && <div className="empty-state"><h2>לא נמצאה התאמה</h2><p>אפשר להפחית את כמות המשתתפים או להסיר סינון.</p><button className="button primary" type="button" onClick={reset}>ניקוי סינונים</button></div>}
          </section>
        </div>
        {filtersOpen && <button className="filter-backdrop" aria-label="סגירת סינון" onClick={() => setFiltersOpen(false)} />}
      </main>
    </PageShell>
  );
}
