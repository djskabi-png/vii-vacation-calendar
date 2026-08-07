"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRef, useState } from "react";
import { DiscoveryCard } from "./discovery-card";
import { PropertyCard } from "./property-card";
import { eventPlaceHref, eventPlaces, properties } from "../data/site-data";
import { hourlyPlaces, paidAttractions, providerProfiles, spaPlaces, worlds } from "../data/world-data";
import { CalendarIcon, PinIcon } from "../site-header";

function pickProperties(...slugs: string[]) {
  return slugs
    .map((slug) => properties.find((property) => property.slug === slug))
    .filter((property): property is (typeof properties)[number] => Boolean(property));
}

const lastMinutePeriods = [
  { id: "today", label: "היום", group: "immediate", dateSummary: "6 עד 7 באוגוסט", from: "2026-08-06", till: "2026-08-07", slugs: ["aqua-resort", "ar-suites", "kesem-harimon", "ahuzat-or", "rose-estate"] },
  { id: "tomorrow", label: "מחר", group: "immediate", dateSummary: "7 עד 8 באוגוסט", from: "2026-08-07", till: "2026-08-08", slugs: ["perfumes-villa", "aqua-resort", "anael-estate", "magic-garden-gefen", "kesem-harimon"] },
  { id: "weekend", label: "סוף השבוע הקרוב", group: "immediate", dateSummary: "7 עד 9 באוגוסט", from: "2026-08-07", till: "2026-08-09", slugs: ["rose-estate", "ahuzat-or", "sol-gilgal", "perfumes-villa", "aqua-resort"] },
  { id: "august", label: "אוגוסט", group: "upcoming", dateSummary: "20 עד 22 באוגוסט", from: "2026-08-20", till: "2026-08-22", slugs: ["aqua-resort", "perfumes-villa", "ar-suites", "kesem-harimon", "ahuzat-or"] },
  { id: "rosh-hashana", label: "ראש השנה", group: "upcoming", dateSummary: "11 עד 13 בספטמבר", from: "2026-09-11", till: "2026-09-13", slugs: ["anael-estate", "magic-garden-gefen", "rose-estate", "sol-gilgal", "ahuzat-or"] },
  { id: "sukkot", label: "סוכות", group: "upcoming", dateSummary: "25 עד 27 בספטמבר", from: "2026-09-25", till: "2026-09-27", slugs: ["kesem-harimon", "aqua-resort", "anael-estate", "perfumes-villa", "rose-estate"] },
] as const;

const lastMinuteStartingPrices: Record<string, number> = {
  "aqua-resort": 3500,
  "ar-suites": 950,
  "kesem-harimon": 1200,
  "ahuzat-or": 1200,
  "rose-estate": 6000,
  "perfumes-villa": 3500,
  "anael-estate": 4800,
  "magic-garden-gefen": 2400,
  "sol-gilgal": 2200,
};

type LastMinutePeriodId = (typeof lastMinutePeriods)[number]["id"];

function SliderControls({ onPrevious, onNext, label }: { onPrevious: () => void; onNext: () => void; label: string }) {
  return <div className="home-slider__controls" aria-label={`דפדוף ${label}`}><button type="button" onClick={onPrevious} aria-label={`הקודם, ${label}`}>הקודם</button><button type="button" onClick={onNext} aria-label={`הבא, ${label}`}>הבא</button></div>;
}

export function HomeShowcase() {
  const tracks = useRef<Record<string, HTMLDivElement | null>>({});
  const [lastMinuteTab, setLastMinuteTab] = useState<LastMinutePeriodId>("today");
  const worldCards = worlds.filter((world) => !["vacation", "events", "spa", "hourly"].includes(world.id));
  const recommendedPlaces = pickProperties("aqua-resort", "kesem-harimon", "ahuzat-or", "anael-estate", "magic-garden-gefen", "perfumes-villa", "rose-estate");
  const selectedLastMinutePeriod = lastMinutePeriods.find((period) => period.id === lastMinuteTab) ?? lastMinutePeriods[0];
  const spontaneousPlaces = pickProperties(...selectedLastMinutePeriod.slugs);
  const lastMinuteSearchHref = `/search?period=${encodeURIComponent(selectedLastMinutePeriod.id)}&dates=${encodeURIComponent(selectedLastMinutePeriod.dateSummary)}&from=${selectedLastMinutePeriod.from}&till=${selectedLastMinutePeriod.till}&guests=2`;

  function scroll(id: string, direction: "previous" | "next") {
    const track = tracks.current[id];
    if (!track) return;
    const firstItem = track.querySelector<HTMLElement>(".home-slider__item");
    const gap = Number.parseFloat(window.getComputedStyle(track).columnGap || window.getComputedStyle(track).gap) || 0;
    const step = firstItem ? firstItem.getBoundingClientRect().width + gap : track.clientWidth;
    track.scrollBy({ left: direction === "next" ? -step : step, behavior: "smooth" });
  }

  return <>
    <section className="section home-recommended" aria-labelledby="home-recommended-title">
      <div className="shell"><div className="section-head"><div><span className="eyebrow">המקומות שעושים חשק לארוז</span><h2 id="home-recommended-title">מומלצים שכדאי להכיר</h2><p>מקומות אמיתיים מתוך האתר, עם חדרים, מתקנים וכל המידע שצריך לפני שבוחרים.</p></div><div><Link href="/search">לכל המקומות</Link><SliderControls label="מקומות מומלצים" onPrevious={() => scroll("recommended", "previous")} onNext={() => scroll("recommended", "next")} /></div></div>
        <div className="home-slider__track home-slider__track--properties" ref={(node) => { tracks.current.recommended = node; }}>{recommendedPlaces.map((property) => <div className="home-slider__item" key={property.slug}><PropertyCard property={property} /></div>)}</div>
      </div>
    </section>

    <section className="section home-last-minute" aria-labelledby="last-minute-title">
      <div className="shell">
        <div className="home-last-minute__top"><div className="home-last-minute__intro"><span className="eyebrow">לא צריך לתכנן חודשים מראש</span><h2 id="last-minute-title">ספונטניים לרגע האחרון</h2><p>מתחילים מהיום, ממחר או מסוף השבוע הקרוב, ואפשר לקפוץ ישר גם לאוגוסט ולחגים. כל בחירה פותחת חיפוש ממוקד לתקופה שבחרתם.</p></div><div><Link className="button" href={lastMinuteSearchHref}>לכל המקומות בתקופה</Link><Link href="/guides/eilat-slow-weekend">איך בונים סוף שבוע בלי לרוץ</Link></div></div>
        <div className="home-last-minute__period-picker">
          <div className="home-last-minute__period-group"><span>זמינות קרובה</span><div className="home-last-minute__tabs" role="tablist" aria-label="חיפוש לפי תאריך קרוב">{lastMinutePeriods.filter((period) => period.group === "immediate").map((period) => <button key={period.id} type="button" role="tab" aria-selected={lastMinuteTab === period.id} onClick={() => setLastMinuteTab(period.id)}>{period.label}</button>)}</div></div>
          <div className="home-last-minute__period-group"><span>תקופות מבוקשות</span><div className="home-last-minute__tabs" role="tablist" aria-label="חיפוש לפי תקופה מבוקשת">{lastMinutePeriods.filter((period) => period.group === "upcoming").map((period) => <button key={period.id} type="button" role="tab" aria-selected={lastMinuteTab === period.id} onClick={() => setLastMinuteTab(period.id)}>{period.label}</button>)}</div></div>
        </div>
        <div className="home-last-minute__selection" aria-live="polite"><span>התקופה שבחרתם</span><strong>{selectedLastMinutePeriod.label}</strong><b>{selectedLastMinutePeriod.dateSummary}</b><small>זהו אומדן ראשוני. המחיר והזמינות הסופיים יאומתו לפי התאריך והרכב האורחים.</small></div>
        <div className="home-last-minute__cards" role="tabpanel">{spontaneousPlaces.map((property) => {
          const price = property.price || lastMinuteStartingPrices[property.slug] || 1200;
          const detailHref = `/business?id=${property.slug}&period=${encodeURIComponent(selectedLastMinutePeriod.id)}&dates=${encodeURIComponent(selectedLastMinutePeriod.dateSummary)}&from=${selectedLastMinutePeriod.from}&till=${selectedLastMinutePeriod.till}&guests=2&price=${price}`;
          return <Link key={property.slug} href={detailHref}><img src={property.image} alt={property.name} /><span><strong>{selectedLastMinutePeriod.label}</strong><small>{selectedLastMinutePeriod.dateSummary}</small></span><div><small><PinIcon />{property.location}</small><h3>{property.name}</h3><div className="home-last-minute__deal"><b><CalendarIcon /><span>{selectedLastMinutePeriod.dateSummary}</span></b><strong><small>אומדן לתקופה</small>{price.toLocaleString("he-IL")} ₪</strong></div><em className="home-last-minute__continue">לפרטים ולהמשך הזמנה</em></div></Link>;
        })}</div>
      </div>
    </section>

    <section className="section home-spa-strip" aria-labelledby="home-spa-title"><div className="shell"><div className="section-head"><div><span className="eyebrow">עוצרים לנשום</span><h2 id="home-spa-title">ספא ורוגע, כחלק מהחופשה</h2></div><div><Link href="/spas">לכל מתחמי הספא</Link><SliderControls label="מתחמי ספא" onPrevious={() => scroll("spa", "previous")} onNext={() => scroll("spa", "next")} /></div></div><div className="home-slider__track home-slider__track--discovery" ref={(node) => { tracks.current.spa = node; }}>{spaPlaces.slice(0,7).map((item) => <div className="home-slider__item" key={item.id}><DiscoveryCard item={item} /></div>)}</div></div></section>

    <section className="section home-short-stay" aria-labelledby="home-short-title"><div className="shell"><div className="section-head"><div><span className="eyebrow">כשלא צריך לילה שלם</span><h2 id="home-short-title">חדרים לכמה שעות</h2><p>שהייה קצרה, פרטית וגמישה. בוחרים מקום ובודקים את מסגרת הזמן והמחיר.</p></div><div><Link href="/hourly">לכל החדרים</Link><SliderControls label="חדרים לפי שעה" onPrevious={() => scroll("hourly", "previous")} onNext={() => scroll("hourly", "next")} /></div></div><div className="home-slider__track home-slider__track--discovery" ref={(node) => { tracks.current.hourly = node; }}>{hourlyPlaces.slice(0,7).map((item) => <div className="home-slider__item" key={item.id}><DiscoveryCard item={item} /></div>)}</div></div></section>

    <section className="home-events-world" aria-labelledby="home-events-title">
      <div className="shell home-events-world__head"><div><span className="eyebrow">עולם האירועים</span><h2 id="home-events-title">כל סיבה טובה הופכת כאן לאירוע</h2><p>לופטים ומתחמים לימי הולדת, מסיבות, אירועי חברה וחגיגות פרטיות, עם חיפוש לפי כמות ואופי האירוע.</p></div><Link className="button" href="/events">נכנסים לעולם האירועים</Link></div>
      <div className="shell home-events-world__layout">
        <Link className="home-event-feature" href={eventPlaceHref(eventPlaces[3])}><img src={eventPlaces[3].image} alt={eventPlaces[3].name} /><span>{eventPlaces[3].type}</span><div><small><PinIcon />{eventPlaces[3].location}</small><h3>{eventPlaces[3].name}</h3><p>{eventPlaces[3].description}</p><b>עד {eventPlaces[3].guests} אורחים</b></div></Link>
        <div className="home-event-list">{eventPlaces.filter((place) => ![eventPlaces[0].slug,eventPlaces[3].slug].includes(place.slug)).slice(0,4).map((place) => <Link key={place.slug} href={eventPlaceHref(place)}><img src={place.image} alt={place.name} /><div><span>{place.type}</span><h3>{place.name}</h3><small>{place.location}, עד {place.guests} אורחים</small></div></Link>)}</div>
      </div>
    </section>

    <section className="section home-worlds" aria-labelledby="home-worlds-title">
      <div className="shell"><div className="section-head"><div><span className="eyebrow">אתר אחד, הרבה דרכים ליהנות</span><h2 id="home-worlds-title">ממשיכים לכל העולמות</h2><p>לא רק מקום לישון. בונים את כל החופשה, הטיפול, השהייה הקצרה, הספקים והיום שמסביב.</p></div></div>
        <div className="home-world-gates">{worldCards.map((world) => {
          const item = world.id === "providers" ? providerProfiles[0] : paidAttractions[0];
          return <Link key={world.id} className={`home-world-gate home-world-gate--${world.id}`} href={world.href}>{item.image ? <img src={item.image} alt={item.name} /> : <span className="home-world-gate__visual">{world.shortLabel.slice(0,1)}</span>}<div><span>{world.label}</span><h3>{world.description}</h3><p>{item.demo ? "פרופילים לדוגמה שממחישים איך השירות יעבוד באתר." : item.description}</p><b>לגלות את העולם</b></div></Link>;
        })}</div>
      </div>
    </section>

  </>;
}
