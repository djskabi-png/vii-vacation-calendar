"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ListingMap } from "../../components/listing-map";
import { PageShell } from "../../components/page-shell";
import { ContactActions } from "../../components/contact-actions";
import { DiscoveryCard } from "../../components/discovery-card";
import { ListingAccessibility } from "../../components/listing-accessibility";
import { eventPlaces } from "../../data/site-data";
import { providerProfiles } from "../../data/world-data";
import { CalendarIcon, HeartIcon, PinIcon } from "../../site-header";

export default function EventPlacePage() {
  const [slug, setSlug] = useState(eventPlaces[0].slug);
  const [saved, setSaved] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const place = useMemo(() => eventPlaces.find((item) => item.slug === slug) || eventPlaces[0], [slug]);
  const eventProviders = useMemo(() => {
    const start = place.slug.length % providerProfiles.length;
    return [...providerProfiles.slice(start), ...providerProfiles.slice(0, start)].slice(0, 3);
  }, [place.slug]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const requested = new URLSearchParams(location.search).get("id");
      if (requested && eventPlaces.some((item) => item.slug === requested)) setSlug(requested);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const items = JSON.parse(localStorage.getItem("vii-event-favourites") || "[]") as string[];
      setSaved(items.includes(place.slug));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [place.slug]);

  function toggleSaved() {
    const items = JSON.parse(localStorage.getItem("vii-event-favourites") || "[]") as string[];
    const next = items.includes(place.slug) ? items.filter((item) => item !== place.slug) : [...items, place.slug];
    localStorage.setItem("vii-event-favourites", JSON.stringify(next));
    setSaved(next.includes(place.slug));
  }

  function submitInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(true);
  }

  async function share() {
    if (navigator.share) await navigator.share({ title: place.name, text: `מצאתי מקום לאירוע: ${place.name}`, url: location.href });
    else await navigator.clipboard.writeText(location.href);
  }

  return (
    <PageShell variant="events">
      <main id="main-content" className="event-place-page">
        <div className="shell breadcrumbs"><Link href="/events/">אירועים</Link><span>/</span><Link href="/events/search/">מקומות</Link><span>/</span><span>{place.name}</span></div>
        <section className="shell property-title event-title"><div><span className="eyebrow">{place.type}</span><h1>{place.name}</h1><p><PinIcon />{place.location}, {place.area}</p></div><div className="property-title__side"><div className="property-title__actions"><button type="button" aria-pressed={saved} onClick={toggleSaved}><HeartIcon filled={saved} />{saved ? "נשמר" : "שמירה"}</button><button type="button" onClick={() => void share()}>שיתוף</button></div><ContactActions key={place.slug} contact={place.contact} placeName={place.name} /></div></section>
        <section className="shell property-gallery">{place.images.map((image, index) => <button key={image} type="button" onClick={() => setGalleryOpen(true)} aria-label={`פתיחת תמונה ${index + 1} של ${place.name}`}><img src={image} alt={`${place.name}, תמונה ${index + 1}`} />{index === 4 && <span>לכל התמונות</span>}</button>)}</section>

        <nav className="shell property-anchor-nav"><a href="#event-about">על המקום</a><a href="#event-features">מתקנים</a><a href="#accessibility">נגישות במקום</a><a href="#event-map">מיקום</a><a href="#event-contact">בדיקת התאמה</a></nav>

        <div className="shell event-place-layout">
          <div>
            <section className="property-facts"><div><b>{place.guests}</b><span>אורחים לכל היותר</span></div><div><b>{place.units || 1}</b><span>{(place.units || 1) > 1 ? "מתחמים" : "מתחם"}</span></div><div><b>{place.eventTypes.length}</b><span>סוגי אירועים</span></div><div><b>{place.features.length}</b><span>מאפיינים מרכזיים</span></div></section>
            <section id="event-about"><span className="eyebrow">כל מה שחשוב לדעת</span><h2>על המקום</h2><p>{place.description}</p><div className="feature-chips audience-chips">{place.eventTypes.map((item) => <span key={item}>{item}</span>)}</div></section>
            <section id="event-features"><h2>מתקנים ואפשרויות</h2><div className="feature-list">{place.features.map((feature) => <span key={feature}>✓ {feature}</span>)}</div></section>
            <section><h2>למי המקום מתאים</h2><div className="event-suitable-grid">{place.audiences.map((audience) => <article key={audience}><span>✓</span><b>{audience}</b></article>)}</div></section>
            <ListingAccessibility slug={place.slug} />
            <section id="event-map" className="location-card"><div><span className="eyebrow">המיקום</span><h2>{place.location}</h2><p>{place.area}</p><a href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=15/${place.lat}/${place.lng}`} target="_blank" rel="noreferrer">פתיחה במפה מלאה</a></div><ListingMap listings={[place]} mode="events" single /></section>
            <section className="policies-section"><h2>חשוב לדעת</h2><div><article><b>קיבולת</b><p>עד {place.guests} אורחים לפי פרטי המקום.</p></article><article><b>זמינות</b><p>הזמינות הסופית תיבדק מול מערכת הניהול לאחר חיבור האתר.</p></article><article><b>מחיר</b><p>המחיר תלוי בתאריך, במספר המשתתפים ובאופי האירוע.</p></article><article><b>בקשת התאמה</b><p>אפשר למלא את הטופס בעמוד ולקבל מענה לאחר חיבור מערכת הלידים.</p></article></div></section>
          </div>

          <aside id="event-contact" className="booking-card event-inquiry"><CalendarIcon /><span className="eyebrow">בדיקת התאמה</span><h2>ספרו לנו על האירוע</h2>{sent ? <div className="inquiry-success" role="status"><b>הפרטים מוכנים להעברה</b><p>לאחר חיבור מערכת הלידים הבקשה תישלח ישירות לצוות המטפל.</p><button className="button primary wide" type="button" onClick={() => setSent(false)}>עריכת הפרטים</button></div> : <form onSubmit={submitInquiry}><label>תאריך מבוקש<input type="date" required /></label><label>כמות משתתפים<input type="number" min="1" max={place.guests} defaultValue={Math.min(40, place.guests)} required /></label><label>סוג האירוע<select required defaultValue=""><option value="" disabled>בחרו סוג אירוע</option>{place.eventTypes.map((item) => <option key={item}>{item}</option>)}</select></label><label>שם מלא<input type="text" required /></label><label>טלפון<input type="tel" inputMode="tel" required /></label><button className="button primary wide" type="submit">בדיקת התאמה</button><small>הטופס מוצג כחלק מהפרונט. השליחה תחובר למערכת הלידים הקיימת.</small></form>}</aside>
        </div>

        <section className="section property-complements">
          <div className="shell">
            <div className="section-head"><div><span className="eyebrow">מרכיבים את כל האירוע</span><h2>ספקים שיכולים להשלים את החגיגה</h2></div><Link href="/providers/">לכל הספקים</Link></div>
            <p className="property-complements__note">הפרופילים בשלב הזה הם דוגמאות עיצוב ותפקוד. הם מסומנים כהדגמה ולא מוצגים כעסקים פעילים.</p>
            <div className="discovery-grid discovery-grid--compact">{eventProviders.map((item) => <DiscoveryCard key={item.id} item={item} />)}</div>
          </div>
        </section>

        <section className="section section-tint"><div className="shell"><div className="section-head"><h2>מקומות נוספים לאירוע</h2></div><div className="event-more-grid">{eventPlaces.filter((item) => item.slug !== place.slug).slice(0, 3).map((item) => <Link key={item.slug} href={`/events/place/?id=${item.slug}`}><img src={item.image} alt={item.name} /><div><b>{item.name}</b><span>{item.location} · עד {item.guests} אורחים</span></div></Link>)}</div></div></section>
      </main>

      {galleryOpen && <div className="gallery-overlay" onMouseDown={(event) => event.target === event.currentTarget && setGalleryOpen(false)}><section role="dialog" aria-modal="true" aria-label={`תמונות ${place.name}`}><header><h2>{place.name}</h2><button type="button" onClick={() => setGalleryOpen(false)}>סגירה</button></header><div>{place.images.map((image, index) => <img key={image} src={image} alt={`${place.name}, תמונה ${index + 1}`} />)}</div></section></div>}
    </PageShell>
  );
}
