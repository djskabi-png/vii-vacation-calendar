"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRef } from "react";
import { DiscoveryCard } from "./discovery-card";
import { PropertyCard } from "./property-card";
import { eventPlaces, properties } from "../data/site-data";
import { activityIdeas, hourlyPlaces, providerProfiles, spaPlaces, worlds } from "../data/world-data";
import { trails } from "../data/trail-data";
import { TrailCard } from "./trail-card";
import { CalendarIcon, PinIcon } from "../site-header";

function SliderControls({ onPrevious, onNext, label }: { onPrevious: () => void; onNext: () => void; label: string }) {
  return <div className="home-slider__controls" aria-label={`דפדוף ${label}`}><button type="button" onClick={onPrevious} aria-label={`הקודם, ${label}`}>הקודם</button><button type="button" onClick={onNext} aria-label={`הבא, ${label}`}>הבא</button></div>;
}

export function HomeShowcase() {
  const tracks = useRef<Record<string, HTMLDivElement | null>>({});
  const worldCards = worlds.filter((world) => !["vacation", "events"].includes(world.id));
  const recommendedPlaces = [properties[0],properties[1],properties[2],properties[5],properties[6],properties[7],properties[8],properties[9]];
  const spontaneousPlaces = [properties[0],properties[8],properties[7]];

  function scroll(id: string, direction: "previous" | "next") {
    const track = tracks.current[id];
    if (!track) return;
    track.scrollBy({ left: direction === "next" ? -track.clientWidth * .82 : track.clientWidth * .82, behavior: "smooth" });
  }

  return <>
    <section className="section home-recommended" aria-labelledby="home-recommended-title">
      <div className="shell"><div className="section-head"><div><span className="eyebrow">המקומות שעושים חשק לארוז</span><h2 id="home-recommended-title">מומלצים שכדאי להכיר</h2><p>מקומות אמיתיים מתוך האתר, עם חדרים, מתקנים וכל המידע שצריך לפני שבוחרים.</p></div><div><Link href="/search/">לכל המקומות</Link><SliderControls label="מקומות מומלצים" onPrevious={() => scroll("recommended", "previous")} onNext={() => scroll("recommended", "next")} /></div></div>
        <div className="home-slider__track home-slider__track--properties" ref={(node) => { tracks.current.recommended = node; }}>{recommendedPlaces.map((property) => <div className="home-slider__item" key={property.slug}><PropertyCard property={property} /></div>)}</div>
      </div>
    </section>

    <section className="section home-last-minute" aria-labelledby="last-minute-title">
      <div className="shell home-last-minute__layout">
        <div className="home-last-minute__intro"><span className="eyebrow">לא צריך לתכנן חודשים מראש</span><h2 id="last-minute-title">ספונטניים לרגע האחרון</h2><p>בוחרים מקום, מסמנים תאריך ובודקים זמינות. המחיר והזמינות הסופיים יאומתו לפי התאריך וההרכב.</p><div><Link className="button light" href="/search/">בדיקת מקומות לתאריך קרוב</Link><Link href="/guides/eilat-slow-weekend/">איך בונים סוף שבוע בלי לרוץ</Link></div></div>
        <div className="home-last-minute__cards">{spontaneousPlaces.map((property,index) => <Link key={property.slug} href={`/business/?id=${property.slug}`}><img src={property.image} alt={property.name} /><span>{index === 0 ? "לקפוץ לאילת" : index === 1 ? "וילה לקבוצה" : "שקט בצפון"}</span><div><small><PinIcon />{property.location}</small><h3>{property.name}</h3><b><CalendarIcon />בדיקת תאריך</b></div></Link>)}</div>
      </div>
    </section>

    <section className="home-events-world" aria-labelledby="home-events-title">
      <div className="shell home-events-world__head"><div><span className="eyebrow">עולם האירועים</span><h2 id="home-events-title">כל סיבה טובה הופכת כאן לאירוע</h2><p>לופטים ומתחמים לימי הולדת, מסיבות, אירועי חברה וחגיגות פרטיות, עם חיפוש לפי כמות ואופי האירוע.</p></div><Link className="button light" href="/events/">נכנסים לעולם האירועים</Link></div>
      <div className="shell home-events-world__layout">
        <Link className="home-event-feature" href={`/events/place/?id=${eventPlaces[3].slug}`}><img src={eventPlaces[3].image} alt={eventPlaces[3].name} /><span>{eventPlaces[3].type}</span><div><small><PinIcon />{eventPlaces[3].location}</small><h3>{eventPlaces[3].name}</h3><p>{eventPlaces[3].description}</p><b>עד {eventPlaces[3].guests} אורחים</b></div></Link>
        <div className="home-event-list">{eventPlaces.filter((place) => ![eventPlaces[0].slug,eventPlaces[3].slug].includes(place.slug)).slice(0,4).map((place) => <Link key={place.slug} href={`/events/place/?id=${place.slug}`}><img src={place.image} alt={place.name} /><div><span>{place.type}</span><h3>{place.name}</h3><small>{place.location}, עד {place.guests} אורחים</small></div></Link>)}</div>
      </div>
    </section>

    <section className="section home-worlds" aria-labelledby="home-worlds-title">
      <div className="shell"><div className="section-head"><div><span className="eyebrow">אתר אחד, הרבה דרכים ליהנות</span><h2 id="home-worlds-title">ממשיכים לכל העולמות</h2><p>לא רק מקום לישון. בונים את כל החופשה, הטיפול, השהייה הקצרה, הספקים והיום שמסביב.</p></div></div>
        <div className="home-world-gates">{worldCards.map((world,index) => {
          const item = index === 0 ? spaPlaces[5] : index === 1 ? hourlyPlaces[3] : index === 2 ? providerProfiles[0] : activityIdeas[1];
          return <Link key={world.id} className={`home-world-gate home-world-gate--${world.id}`} href={world.href}>{item.image ? <img src={item.image} alt={item.name} /> : <span className="home-world-gate__visual">{world.shortLabel.slice(0,1)}</span>}<div><span>{world.label}</span><h3>{world.description}</h3><p>{item.demo ? "פרופילים לדוגמה שממחישים איך השירות יעבוד באתר." : item.description}</p><b>לגלות את העולם</b></div></Link>;
        })}</div>
      </div>
    </section>

    <section className="section home-trails" aria-labelledby="home-trails-title">
      <div className="shell"><div className="section-head"><div><span className="eyebrow">יוצאים מהצימר אל הטבע</span><h2 id="home-trails-title">מסלולים ליד החופשה</h2><p>מדריכי טיול עצמאיים עם זמן, קושי, עונה, בטיחות ומקור רשמי לבדיקה ביום היציאה.</p></div><Link href="/trails/">לכל המסלולים</Link></div>
        <div className="trail-grid trail-grid--home">{trails.slice(0, 4).map((trail) => <TrailCard key={trail.slug} trail={trail} compact />)}</div>
      </div>
    </section>

    <section className="section home-spa-strip" aria-labelledby="home-spa-title"><div className="shell"><div className="section-head"><div><span className="eyebrow">עוצרים לנשום</span><h2 id="home-spa-title">ספא ורוגע, כחלק מהחופשה</h2></div><div><Link href="/spas/">לכל מתחמי הספא</Link><SliderControls label="מתחמי ספא" onPrevious={() => scroll("spa", "previous")} onNext={() => scroll("spa", "next")} /></div></div><div className="home-slider__track home-slider__track--discovery" ref={(node) => { tracks.current.spa = node; }}>{spaPlaces.slice(0,7).map((item) => <div className="home-slider__item" key={item.id}><DiscoveryCard item={item} /></div>)}</div></div></section>

    <section className="section home-short-stay" aria-labelledby="home-short-title"><div className="shell"><div className="section-head"><div><span className="eyebrow">כשלא צריך לילה שלם</span><h2 id="home-short-title">חדרים לכמה שעות</h2><p>שהייה קצרה, פרטית וגמישה. בוחרים מקום ובודקים את מסגרת הזמן והמחיר.</p></div><div><Link href="/hourly/">לכל החדרים</Link><SliderControls label="חדרים לפי שעה" onPrevious={() => scroll("hourly", "previous")} onNext={() => scroll("hourly", "next")} /></div></div><div className="home-slider__track home-slider__track--discovery" ref={(node) => { tracks.current.hourly = node; }}>{hourlyPlaces.slice(0,7).map((item) => <div className="home-slider__item" key={item.id}><DiscoveryCard item={item} /></div>)}</div></div></section>
  </>;
}
