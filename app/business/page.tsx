"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDemo } from "../calendar-demo";
import { PageShell } from "../components/page-shell";
import { PropertyCard } from "../components/property-card";
import { properties } from "../data/site-data";
import { CalendarIcon, HeartIcon, PinIcon } from "../site-header";

export default function BusinessPage() {
  const [scenario, setScenario] = useState<"single" | "multi">("multi");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dates, setDates] = useState("בחרו תאריכים");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const property = scenario === "single" ? properties[1] : properties[0];
  useEffect(() => { const timer = window.setTimeout(() => { const value = new URLSearchParams(location.search).get("scenario"); setScenario(value === "single" ? "single" : "multi"); }, 0); return () => window.clearTimeout(timer); }, []);
  function changeScenario(value: "single" | "multi") { setScenario(value); const url = new URL(location.href); url.searchParams.set("scenario", value); history.replaceState({}, "", url); }
  return (
    <PageShell>
      <main id="main-content" className="property-page">
        <div className="sticky-property-search"><div className="shell"><span><PinIcon />{property.location}</span><button type="button" onClick={() => setCalendarOpen(true)}><CalendarIcon />{dates}</button><button className="button primary" type="button" onClick={() => setCalendarOpen(true)}>בדיקת זמינות</button></div></div>
        <div className="shell breadcrumbs"><Link href="/">ראשי</Link><span>/</span><Link href="/search/">{property.area}</Link><span>/</span><span>{property.name}</span></div>
        <section className="shell property-title"><div><span className="eyebrow">{property.type}</span><h1>{property.name}</h1><p><PinIcon />{property.location}, {property.area}</p></div><div className="property-title__actions"><button type="button" aria-pressed={saved} onClick={() => setSaved((value) => !value)}><HeartIcon filled={saved} />{saved ? "נשמר" : "שמירה"}</button><button type="button" onClick={() => navigator.clipboard?.writeText(location.href)}>שיתוף</button></div></section>
        <section className={`shell property-gallery ${property.images.length === 1 ? "single" : ""}`}>{property.images.slice(0,5).map((image,index) => <button key={image} type="button" aria-label={`פתיחת גלריית ${property.name}, תמונה ${index+1}`} onClick={() => setGalleryOpen(true)}><img src={image} alt={`${property.name}, תמונה ${index+1}`} />{index === Math.min(4, property.images.length-1) && property.images.length > 1 && <span>לכל התמונות</span>}</button>)}</section>
        <div className="shell property-layout">
          <div className="property-content">
            <section><div className="host-summary"><div><span>{property.scenario === "single" ? "מקום אירוח שלם" : `${property.units} יחידות אירוח`}</span><h2>{property.name} מחכה לכם</h2><p>עד {property.guests} אורחים · {property.bedrooms} חדרי שינה · {property.location}</p></div>{property.score && <div className="large-score"><b>{property.score}</b><span>{property.reviews} חוות דעת</span></div>}</div></section>
            <section className="feature-section"><h2>מה מחכה לכם במקום</h2><div className="feature-list">{property.features.concat(["מיזוג אוויר", "חניה", "אינטרנט אלחוטי"]).map((feature) => <span key={feature}>✓ {feature}</span>)}</div><button className="button subtle" type="button">לכל המאפיינים</button></section>
            <section><h2>על המקום</h2><p>{scenario === "single" ? "מקום אירוח שלם שמתאים לקבוצה או למשפחה שרוצות פרטיות מלאה. לאחר בחירת התאריכים בודקים זמינות של המקום כולו, בלי שלב של בחירת יחידות." : "מתחם אירוח שמתאים למשפחות ולקבוצות, עם כמה יחידות שאפשר לשלב לפי ההרכב. לאחר בחירת התאריכים רואים אילו יחידות פנויות ומה המחיר לכל אפשרות."}</p></section>
            <section className="location-card"><div><span className="eyebrow">המיקום</span><h2>{property.location}</h2><p>{property.area}</p></div><div className="mini-map"><PinIcon /><span>מיקום מדויק יוצג לאחר אישור הזמנה</span></div></section>
            {property.score && <section className="reviews"><div className="section-head"><div><span className="eyebrow">אורחים מספרים</span><h2>חוות דעת מאומתות</h2></div><b className="review-score">{property.score}</b></div><p>הציון מבוסס על {property.reviews} חוות דעת בעמוד המקום.</p><a className="button subtle" href={property.liveUrl} target="_blank" rel="noreferrer">לקריאת חוות הדעת</a></section>}
          </div>
          <aside className="booking-card"><span className="eyebrow">בדיקת זמינות</span><h2>{scenario === "single" ? "כל המקום בשבילכם" : "בוחרים תאריך ויחידה"}</h2><button type="button" className="date-choice" onClick={() => setCalendarOpen(true)}><CalendarIcon /><span><small>תאריכי השהייה</small><strong>{dates}</strong></span></button><div className="booking-facts"><span>כניסה החל מ־15:00</span><span>יציאה עד 11:00</span></div>{scenario === "multi" && <div className="unit-choices"><label><input type="radio" name="unit" defaultChecked /> יחידת סטודיו</label><label><input type="radio" name="unit" /> סוויטה משפחתית</label></div>}<button className="button primary wide" type="button" onClick={() => setCalendarOpen(true)}>בדיקת מחיר וזמינות</button><small>המחיר הסופי יוצג לפי התאריכים וההרכב</small></aside>
        </div>
        <section className="section section-tint"><div className="shell"><div className="section-head"><h2>אולי יתאים לכם גם</h2></div><div className="card-grid">{properties.filter((p) => p.slug !== property.slug).slice(0,3).map((p) => <PropertyCard key={p.slug} property={p} />)}</div></div></section>
        <section className="shell scenario-tools" aria-label="תרחישי מקום"><span>בדיקת תצוגה:</span><button className={scenario === "multi" ? "active" : ""} onClick={() => changeScenario("multi")}>מתחם עם יחידות</button><button className={scenario === "single" ? "active" : ""} onClick={() => changeScenario("single")}>מקום אירוח שלם</button></section>
      </main>
      <CalendarDemo mode="business" businessKind={scenario} businessName={property.name} open={calendarOpen} onClose={() => setCalendarOpen(false)} onConfirm={(result) => setDates(result.summary)} />
      {galleryOpen && <div className="gallery-overlay" onMouseDown={(e) => e.target === e.currentTarget && setGalleryOpen(false)}><section role="dialog" aria-modal="true" aria-label={`תמונות ${property.name}`}><header><h2>{property.name}</h2><button type="button" onClick={() => setGalleryOpen(false)}>סגירה</button></header><div>{property.images.map((image,index) => <img key={image} src={image} alt={`${property.name}, תמונה ${index+1}`} />)}</div></section></div>}
    </PageShell>
  );
}
