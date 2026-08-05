"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDemo } from "../calendar-demo";
import { ListingMap } from "../components/listing-map";
import { PageShell } from "../components/page-shell";
import { PropertyCard } from "../components/property-card";
import { properties, propertyFaq } from "../data/site-data";
import { CalendarIcon, HeartIcon, PinIcon } from "../site-header";

export default function BusinessPage() {
  const [slug, setSlug] = useState(properties[0].slug);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dates, setDates] = useState("בחרו תאריכים");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [allFeaturesOpen, setAllFeaturesOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const property = useMemo(() => properties.find((item) => item.slug === slug) || properties[0], [slug]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const requested = new URLSearchParams(location.search).get("id");
      if (requested && properties.some((item) => item.slug === requested)) setSlug(requested);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const items = JSON.parse(localStorage.getItem("vii-favourites") || "[]") as string[];
      setSaved(items.includes(property.slug));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [property.slug]);

  function toggleSaved() {
    const items = JSON.parse(localStorage.getItem("vii-favourites") || "[]") as string[];
    const next = items.includes(property.slug) ? items.filter((item) => item !== property.slug) : [...items, property.slug];
    localStorage.setItem("vii-favourites", JSON.stringify(next));
    setSaved(next.includes(property.slug));
    window.dispatchEvent(new Event("vii-favourites-change"));
  }

  async function share() {
    const data = { title: property.name, text: `מצאתי מקום ב־Vii: ${property.name}`, url: location.href };
    if (navigator.share) await navigator.share(data);
    else {
      await navigator.clipboard.writeText(location.href);
      setShareStatus("הקישור הועתק");
      window.setTimeout(() => setShareStatus(""), 1800);
    }
  }

  return (
    <PageShell>
      <main id="main-content" className="property-page">
        <div className="sticky-property-search"><div className="shell"><span><PinIcon />{property.location}</span><button type="button" onClick={() => setCalendarOpen(true)}><CalendarIcon />{dates}</button><button className="button primary" type="button" onClick={() => setCalendarOpen(true)}>בדיקת זמינות</button></div></div>
        <div className="shell breadcrumbs"><Link href="/">ראשי</Link><span>/</span><Link href={`/search/?location=${encodeURIComponent(property.area)}`}>{property.area}</Link><span>/</span><span>{property.name}</span></div>

        <section className="shell property-title">
          <div><span className="eyebrow">{property.type}</span><h1>{property.name}</h1><p><PinIcon />{property.location}, {property.area}</p></div>
          <div className="property-title__actions">
            <button type="button" aria-pressed={saved} onClick={toggleSaved}><HeartIcon filled={saved} />{saved ? "נשמר" : "שמירה"}</button>
            <button type="button" onClick={() => void share()}>שיתוף</button>
            {shareStatus && <span role="status">{shareStatus}</span>}
          </div>
        </section>

        <section className="shell property-gallery">{property.images.slice(0, 5).map((image, index) => <button key={image} type="button" aria-label={`פתיחת גלריית ${property.name}, תמונה ${index + 1}`} onClick={() => setGalleryOpen(true)}><img src={image} alt={`${property.name}, תמונה ${index + 1}`} />{index === 4 && <span>לכל התמונות</span>}</button>)}</section>

        <nav className="shell property-anchor-nav" aria-label="ניווט בעמוד"><a href="#about">על המקום</a><a href="#features">מאפיינים</a><a href="#location">מיקום</a><a href="#faq">שאלות ותשובות</a><a href="#policies">חשוב לדעת</a></nav>

        <div className="shell property-layout">
          <div className="property-content">
            <section className="property-facts" aria-label="עיקרי המקום">
              <div><b>{property.guests}</b><span>אורחים לכל היותר</span></div>
              {property.bedrooms && <div><b>{property.bedrooms}</b><span>חדרי שינה</span></div>}
              {property.scenario === "multi" && property.units ? <div><b>{property.units}</b><span>יחידות אירוח</span></div> : <div><b>שלם</b><span>המקום כולו</span></div>}
              <div><b>{property.features.length}</b><span>מאפיינים מרכזיים</span></div>
            </section>

            <section id="about"><span className="eyebrow">מידע מאומת מעמוד המקור</span><h2>על {property.name}</h2><p>{property.description}</p><div className="feature-chips audience-chips">{property.audiences.map((audience) => <span key={audience}>מתאים ל{audience}</span>)}</div></section>

            <section id="features" className="feature-section"><h2>מה מחכה לכם במקום</h2><div className="feature-list">{property.features.map((feature) => <span key={feature}>✓ {feature}</span>)}</div><button className="button subtle" type="button" onClick={() => setAllFeaturesOpen(true)}>כל המידע על המתקנים</button></section>

            {property.scenario === "multi" && property.units && <section className="units-section"><span className="eyebrow">מתחם עם כמה יחידות</span><h2>בוחרים את ההרכב שמתאים לכם</h2><p>במקום יש {property.units} יחידות. לאחר בחירת תאריכים, מנוע ההזמנות יציג אילו יחידות פנויות ומה המחיר לכל שילוב.</p><div className="unit-preview-grid">{Array.from({ length: Math.min(property.units, 4) }, (_, index) => <article key={index}><b>יחידה {index + 1}</b><span>הפרטים והזמינות יגיעו ממערכת הניהול</span></article>)}</div></section>}

            <section id="location" className="location-card"><div><span className="eyebrow">המיקום</span><h2>{property.location}</h2><p>{property.area}</p><a href={`https://www.openstreetmap.org/?mlat=${property.lat}&mlon=${property.lng}#map=15/${property.lat}/${property.lng}`} target="_blank" rel="noreferrer">פתיחה במפה מלאה</a></div><ListingMap listings={[property]} single /></section>

            <section id="faq" className="faq-section"><span className="eyebrow">כל מה שחשוב לפני שמזמינים</span><h2>שאלות ותשובות</h2>{propertyFaq.map((item, index) => <article key={item.question} className={openFaq === index ? "open" : ""}><button type="button" aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>{item.question}</span><b>{openFaq === index ? "−" : "+"}</b></button>{openFaq === index && <p>{item.answer}</p>}</article>)}</section>

            <section id="policies" className="policies-section"><span className="eyebrow">חשוב לדעת</span><h2>כללים ותנאי הזמנה</h2><div><article><b>כניסה ויציאה</b><p>שעות הכניסה והיציאה יוצגו לפי המקום והתאריך במנוע ההזמנות.</p></article><article><b>מחיר ותשלום</b><p>המחיר הסופי תלוי בתאריכים, בהרכב וביחידה שנבחרה.</p></article><article><b>ביטול ושינויים</b><p>התנאים המחייבים יוצגו לפני השלמת ההזמנה.</p></article><article><b>מידע מאומת</b><p>הנתונים והתמונות בעמוד זה נלקחו מעמוד המקום באתר הקיים.</p></article></div><a href={property.liveUrl} target="_blank" rel="noreferrer">לצפייה בעמוד המקור</a></section>
          </div>

          <aside className="booking-card"><span className="eyebrow">בדיקת זמינות</span><h2>{property.scenario === "single" ? "כל המקום בשבילכם" : "בוחרים תאריך ויחידה"}</h2><button type="button" className="date-choice" onClick={() => setCalendarOpen(true)}><CalendarIcon /><span><small>תאריכי השהייה</small><strong>{dates}</strong></span></button><label className="booking-guests">כמות אורחים<input type="number" min="1" max={property.guests} defaultValue={2} /></label><div className="booking-facts"><span>עד {property.guests} אורחים</span>{property.bedrooms && <span>{property.bedrooms} חדרי שינה</span>}</div><button className="button primary wide" type="button" onClick={() => setCalendarOpen(true)}>בחירת תאריך</button><small>זמינות ומחיר סופי יחוברו למערכת הניהול הקיימת.</small></aside>
        </div>

        <section className="section section-tint"><div className="shell"><div className="section-head"><h2>מקומות נוספים שיכולים להתאים</h2></div><div className="card-grid">{properties.filter((item) => item.slug !== property.slug).slice(0, 3).map((item) => <PropertyCard key={item.slug} property={item} />)}</div></div></section>
      </main>

      <CalendarDemo mode="business" businessKind={property.scenario} businessName={property.name} open={calendarOpen} onClose={() => setCalendarOpen(false)} onConfirm={(result) => setDates(result.summary)} />

      {galleryOpen && <div className="gallery-overlay" onMouseDown={(event) => event.target === event.currentTarget && setGalleryOpen(false)}><section role="dialog" aria-modal="true" aria-label={`תמונות ${property.name}`}><header><h2>{property.name}</h2><button type="button" onClick={() => setGalleryOpen(false)}>סגירה</button></header><div>{property.images.map((image, index) => <img key={image} src={image} alt={`${property.name}, תמונה ${index + 1}`} />)}</div></section></div>}

      {allFeaturesOpen && <div className="simple-modal" onMouseDown={(event) => event.target === event.currentTarget && setAllFeaturesOpen(false)}><section role="dialog" aria-modal="true" aria-labelledby="features-title"><header><h2 id="features-title">המתקנים של {property.name}</h2><button type="button" onClick={() => setAllFeaturesOpen(false)}>סגירה</button></header><div className="feature-list modal-features">{property.features.map((feature) => <span key={feature}>✓ {feature}</span>)}</div><p>המידע מבוסס על עמוד המקור של המקום באתר הקיים.</p></section></div>}
    </PageShell>
  );
}
