"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { PropertyCard } from "../components/property-card";
import { eventPlaces, properties } from "../data/site-data";

export default function FavoritesPage() {
  const [propertyIds, setPropertyIds] = useState<string[]>([]);
  const [eventIds, setEventIds] = useState<string[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPropertyIds(JSON.parse(localStorage.getItem("vii-favourites") || "[]"));
      setEventIds(JSON.parse(localStorage.getItem("vii-event-favourites") || "[]"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const savedProperties = properties.filter((property) => propertyIds.includes(property.slug));
  const savedEvents = eventPlaces.filter((place) => eventIds.includes(place.slug));

  return (
    <PageShell>
      <main id="main-content">
        <section className="inner-hero shell"><span className="eyebrow">שומרים וחוזרים</span><h1>המקומות שאהבתי</h1><p>כל מקומות הנופש והאירועים ששמרתם מרוכזים כאן להשוואה נוחה.</p></section>
        <section className="section shell">
          {savedProperties.length > 0 && <><div className="section-head"><h2>נופש</h2></div><div className="card-grid">{savedProperties.map((property) => <PropertyCard key={property.slug} property={property} />)}</div></>}
          {savedEvents.length > 0 && <><div className="section-head favorites-event-head"><h2>אירועים</h2></div><div className="event-more-grid">{savedEvents.map((place) => <Link key={place.slug} href={`/events/place/?id=${place.slug}`}><img src={place.image} alt={place.name} /><div><b>{place.name}</b><span>{place.location} · עד {place.guests} אורחים</span></div></Link>)}</div></>}
          {savedProperties.length === 0 && savedEvents.length === 0 && <div className="empty-state"><h2>עוד לא שמרתם מקומות</h2><p>לחצו על הלב במקום שאהבתם והוא יחכה לכם כאן.</p><div className="empty-actions"><Link className="button primary" href="/search/">למציאת חופשה</Link><Link className="button subtle" href="/events/search/">למציאת מקום לאירוע</Link></div></div>}
        </section>
      </main>
    </PageShell>
  );
}
