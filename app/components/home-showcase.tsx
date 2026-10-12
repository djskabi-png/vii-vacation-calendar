"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRef } from "react";
import { DiscoveryCard } from "./discovery-card";
import { eventPlaceHref, type EventPlace, type Property } from "../data/site-data";
import { paidAttractions, providerProfiles, type DiscoveryItem } from "../data/world-data";
import { publicWorldNavigation } from "../data/world-navigation";
import { trails } from "../data/trail-data";
import { TrailCard } from "./trail-card";
import { PinIcon } from "../site-header";
import { useSiteLanguage } from "../i18n/locale-provider";
import { HomeLiveDeals } from "./home-live-deals";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { rotateDaily, rotateWithinTiers } from "../lib/daily-rotation";

const vacationDestinations = [
  { label: "נופש בצפון", note: "גליל, גולן ונוף ירוק", href: "/vacations/north?guests=2", image: "/media/f18d7c0469633ca0.jpeg" },
  { label: "נופש בכנרת", note: "חופשה רגועה ליד המים", href: "/vacations/kinneret?guests=2", image: "/media/9a403cb4d9d1cbde.jpg" },
  { label: "נופש בירושלים", note: "הרי יהודה ואוויר הרים", href: "/vacations/jerusalem?guests=2", image: "/media/231b0e706cc61cc1.jpg" },
  { label: "נופש במרכז", note: "קרוב, נוח ובלי להתפשר", href: "/vacations/center?guests=2", image: "/media/verified/vacation/vacation-tepers-estate-1.jpg" },
  { label: "נופש בדרום", note: "מדבר, שקט ומרחבים", href: "/vacations/south-negev?guests=2", image: "/media/verified/vacation/vacation-ahuzat-shaked-1.jpeg" },
  { label: "נופש באילת", note: "שמש, ים ומקומות שלמים", href: "/vacations/eilat?guests=2", image: "/media/322de460abbda5c6.jpg" },
] as const;

const destinationMatchers = [
  (area: string, location: string) => /גליל|גולן/.test(area) && location !== "",
  (area: string) => /כנרת/.test(area),
  (area: string) => /ירושלים|יהודה/.test(area),
  (area: string) => /מישור החוף|שרון|מרכז/.test(area),
  (area: string, location: string) => /נגב|דרום|ערבה/.test(area) && location !== "אילת",
  (_area: string, location: string) => location === "אילת",
];


function SliderControls({ onPrevious, onNext, label }: { onPrevious: () => void; onNext: () => void; label: string }) {
  const { language } = useSiteLanguage();
  const previous = { he: "הקודם", en: "Previous", ru: "Назад", fr: "Précédent" }[language];
  const next = { he: "הבא", en: "Next", ru: "Далее", fr: "Suivant" }[language];
  const PreviousIcon = language === "he" ? ChevronRight : ChevronLeft;
  const NextIcon = language === "he" ? ChevronLeft : ChevronRight;
  return <div className="home-slider__controls" role="group" aria-label={label}>
    <button type="button" onClick={onPrevious} aria-label={`${previous}, ${label}`} title={previous}><PreviousIcon aria-hidden="true" /></button>
    <button type="button" onClick={onNext} aria-label={`${next}, ${label}`} title={next}><NextIcon aria-hidden="true" /></button>
  </div>;
}

function reviewExcerpt(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= 118) return normalized;
  const candidate = normalized.slice(0, 119);
  const lastWord = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, lastWord > 82 ? lastWord : 118).trim()}...`;
}

export type HomeRatedPlace = {
  place: Property;
  reviewText: string;
  reviewAuthor: string;
  reviewDate: string;
};

export function HomeShowcase({ properties, eventPlaces, spaPlaces, hourlyPlaces, ratedPlaces }: {
  properties: Property[];
  eventPlaces: EventPlace[];
  spaPlaces: DiscoveryItem[];
  hourlyPlaces: DiscoveryItem[];
  ratedPlaces: HomeRatedPlace[];
}) {
  const tracks = useRef<Record<string, HTMLDivElement | null>>({});
  const worldCards = publicWorldNavigation.filter((world) => !["vacation", "events", "spa", "hourly"].includes(world.id));
  const featuredTours = rotateDaily(properties.flatMap((property) => (property.videos || []).map((video) => ({ property, video }))),
    ({ property, video }) => `${property.slug}:${video.src}`, "home-tours").slice(0, 7);
  const destinationImages = rotateDaily(properties.filter((property) => property.image), (property) => property.slug, "home-destination-images");
  const usedDestinationImages = new Set<string>();
  const destinationPlaces = vacationDestinations.map((_destination, index) => {
    const matches = destinationImages.filter((candidate) => destinationMatchers[index](candidate.area, candidate.location));
    const place = matches.find((candidate) => !usedDestinationImages.has(candidate.image)) || matches[0];
    if (place) usedDestinationImages.add(place.image);
    return place;
  });
  const featuredSpas = rotateWithinTiers(spaPlaces, (item) => item.image && item.priceLabel ? 0 : item.image ? 1 : 2,
    (item) => item.id, "home-spa").slice(0, 7);
  const featuredHourly = rotateWithinTiers(hourlyPlaces, (item) => item.image && item.priceLabel ? 0 : 1,
    (item) => item.id, "home-hourly");
  const featuredEvents = rotateDaily(eventPlaces.filter((place) => place.image), (place) => place.slug, "home-events");

  function scroll(id: string, direction: "previous" | "next") {
    const track = tracks.current[id];
    if (!track) return;
    const firstItem = track.querySelector<HTMLElement>(".home-slider__item, .home-last-minute__cards > a");
    const gap = Number.parseFloat(window.getComputedStyle(track).columnGap || window.getComputedStyle(track).gap) || 0;
    const step = firstItem ? firstItem.getBoundingClientRect().width + gap : track.clientWidth;
    const isRtl = window.getComputedStyle(track).direction === "rtl";
    const forward = isRtl ? -step : step;
    track.scrollBy({ left: direction === "next" ? forward : -forward, behavior: "smooth" });
  }

  return <>
    <HomeLiveDeals />
    <HomeLiveDeals mode="holidays" />

    <section className="section home-vacation-discovery" aria-labelledby="vacation-discovery-title">
      <div className="shell">
        <div className="home-vacation-discovery__intro">
          <span className="eyebrow">מכאן קל יותר לבחור</span>
          <h2 id="vacation-discovery-title">מוצאים את הנופש בדרך שמתאימה לכם</h2>
          <p>מתחילים באזור ובהרכב האורחים ומשווים את פרטי המקומות.</p>
        </div>

        <div className="home-vacation-strip">
          <div className="home-vacation-strip__head"><div><span>לפי אזור</span><h3>יעדים מומלצים לנופש</h3></div><SliderControls label="יעדי נופש" onPrevious={() => scroll("destinations", "previous")} onNext={() => scroll("destinations", "next")} /></div>
          <div className="home-vacation-strip__track home-vacation-strip__track--destinations" data-horizontal-rail ref={(node) => { tracks.current.destinations = node; }}>
            {vacationDestinations.map((item, index) => {
              const place = destinationPlaces[index];
              return place ? <Link className="home-vacation-card home-vacation-card--destination home-slider__item" href={item.href} key={item.label}><img src={place.image} alt="" loading="lazy" decoding="async" /><div><span>יעד מומלץ</span><h4>{item.label}</h4><p>{item.note}</p><b>לכל המקומות באזור</b></div></Link> : null;
            })}
          </div>
        </div>

      </div>
    </section>

    {featuredTours.length || ratedPlaces.length ? <section className="section home-trust-discovery" aria-labelledby={featuredTours.length ? "home-tours-title" : "home-ratings-title"}>
      <div className="shell">
        {featuredTours.length ? <div className="home-trust-strip">
          <div className="home-vacation-strip__head"><div><span>רואים לפני שבוחרים</span><h2 id="home-tours-title">סרטונים מובילים</h2></div><SliderControls label="סרטונים מובילים" onPrevious={() => scroll("tours", "previous")} onNext={() => scroll("tours", "next")} /></div>
          <div className="home-slider__track home-slider__track--trust" data-horizontal-rail ref={(node) => { tracks.current.tours = node; }}>
            {featuredTours.map(({ property, video }) => <article className="home-tour-card home-slider__item" key={`${property.slug}-${video.src}`}>
              <video controls playsInline preload="none" poster={video.poster} aria-label={`${video.title}, ${property.name}`}><source src={video.src} type="video/mp4" /></video>
              <div><span>{property.location}</span><h3>{property.name}</h3><p>{video.note}</p><Link href={`/business?id=${property.slug}`}>לפרטי המקום</Link></div>
            </article>)}
          </div>
        </div> : null}

        {ratedPlaces.length ? <div className="home-trust-strip">
          <div className="home-vacation-strip__head"><div><span>דירוגים ממקור המידע של המקום</span><h2 id="home-ratings-title">חוות דעת מובילות</h2></div><SliderControls label="חוות דעת מובילות" onPrevious={() => scroll("ratings", "previous")} onNext={() => scroll("ratings", "next")} /></div>
          <div className="home-slider__track home-slider__track--trust home-slider__track--ratings" data-horizontal-rail ref={(node) => { tracks.current.ratings = node; }} aria-labelledby="home-ratings-title">
            {ratedPlaces.map(({ place, reviewText, reviewAuthor, reviewDate }) => <Link className="home-rating-card home-slider__item" href={`/business?id=${place.slug}`} key={place.slug}>
              <div className="home-rating-card__top"><img src={place.image} alt="" loading="lazy" decoding="async" /><div><span>{place.location}</span><h3>{place.name}</h3><strong aria-label={`ציון ${place.score} מתוך 10, ${place.reviews} חוות דעת`}><b>{place.score}</b><small>{place.reviews} חוות דעת</small></strong></div></div><p lang="he" dir="rtl">{reviewExcerpt(reviewText)}</p><small className="home-rating-card__byline">{reviewAuthor}{reviewDate ? ` · ${reviewDate}` : ""}</small><b className="home-rating-card__cta">לפרטי המקום</b>
            </Link>)}
          </div>
        </div> : null}
      </div>
    </section> : null}

    <section className="section home-spa-strip" aria-labelledby="home-spa-title"><div className="shell"><div className="section-head"><div><span className="eyebrow">עוצרים לנשום</span><h2 id="home-spa-title">ספא ורוגע, כחלק מהחופשה</h2></div><div><Link href="/spas">לכל מתחמי הספא</Link><SliderControls label="מתחמי ספא" onPrevious={() => scroll("spa", "previous")} onNext={() => scroll("spa", "next")} /></div></div><div className="home-slider__track home-slider__track--discovery" data-horizontal-rail ref={(node) => { tracks.current.spa = node; }}>{featuredSpas.map((item) => <div className="home-slider__item" key={item.id}><DiscoveryCard item={item} /></div>)}</div></div></section>

    <section className="section home-short-stay" aria-labelledby="home-short-title"><div className="shell"><div className="section-head"><div><span className="eyebrow">כשלא צריך לילה שלם</span><h2 id="home-short-title">חדרים לכמה שעות</h2><p>שהייה קצרה, פרטית וגמישה. בוחרים מקום ובודקים את מסגרת הזמן והמחיר.</p></div><div><Link href="/hourly">לכל החדרים</Link><SliderControls label="חדרים לפי שעה" onPrevious={() => scroll("hourly", "previous")} onNext={() => scroll("hourly", "next")} /></div></div><div className="home-slider__track home-slider__track--discovery" data-horizontal-rail ref={(node) => { tracks.current.hourly = node; }}>{featuredHourly.map((item) => <div className="home-slider__item" key={item.id}><DiscoveryCard item={item} /></div>)}</div></div></section>

    <section className="home-events-world" aria-labelledby="home-events-title">
      <div className="shell home-events-world__head"><div><span className="eyebrow">עולם האירועים</span><h2 id="home-events-title">כל סיבה טובה הופכת כאן לאירוע</h2><p>לופטים ומתחמים לימי הולדת, מסיבות, אירועי חברה וחגיגות פרטיות, עם חיפוש לפי כמות ואופי האירוע.</p></div><Link className="button" href="/events">נכנסים לעולם האירועים</Link></div>
      <div className="shell home-events-world__layout">
        {featuredEvents[0] ? <Link className="home-event-feature" href={eventPlaceHref(featuredEvents[0])}><img src={featuredEvents[0].image} alt={featuredEvents[0].name} title={featuredEvents[0].name} loading="lazy" decoding="async" /><span>{featuredEvents[0].type}</span><div><small><PinIcon />{featuredEvents[0].location}</small><h3>{featuredEvents[0].name}</h3>{featuredEvents[0].description ? <p>{featuredEvents[0].description}</p> : null}<b>עד {featuredEvents[0].guests} אורחים ביחידה הגדולה</b></div></Link> : null}
        <div className="home-event-list">{featuredEvents.slice(1, 5).map((place) => <Link key={place.slug} href={eventPlaceHref(place)}><img src={place.image} alt={place.name} title={place.name} loading="lazy" decoding="async" /><div><span>{place.type}</span><h3>{place.name}</h3><small>{place.location}, עד {place.guests} אורחים ביחידה הגדולה</small></div></Link>)}</div>
      </div>
    </section>

    <section className="section home-worlds" aria-labelledby="home-worlds-title">
      <div className="shell"><div className="section-head"><div><span className="eyebrow">אתר אחד, הרבה דרכים ליהנות</span><h2 id="home-worlds-title">ממשיכים לכל העולמות</h2><p>לא רק מקום לישון. בונים את כל החופשה, הטיפול, השהייה הקצרה, הספקים והיום שמסביב.</p></div></div>
        <div className="home-world-gates">{worldCards.map((world) => {
          const item = world.id === "providers" ? providerProfiles[0] : world.id === "trails" ? trails[0] : paidAttractions[0];
          const image = "image" in item ? item.image : undefined;
          const description = "description" in item ? item.description : item.summary;
          return <Link key={world.id} className={`home-world-gate home-world-gate--${world.id}`} href={world.href}>{image ? <img src={image} alt={item.name} title={item.name} loading="lazy" decoding="async" /> : <span className="home-world-gate__visual">{world.shortLabel.slice(0,1)}</span>}<div><span>{world.label}</span><h3>{world.description}</h3><p>{"demo" in item && item.demo ? "פרופילים לדוגמה שממחישים איך השירות יעבוד באתר." : description}</p><b>לגלות את העולם</b></div></Link>;
        })}</div>
      </div>
    </section>

  </>;
}

export function HomeTrails() {
  return <section className="section home-trails" aria-labelledby="home-trails-title">
    <div className="shell"><div className="section-head"><div><span className="eyebrow">יוצאים מהצימר אל הטבע</span><h2 id="home-trails-title">מסלולים ליד החופשה</h2><p>מדריכי טיול עצמאיים עם זמן, קושי, עונה, בטיחות ומקור רשמי לבדיקה ביום היציאה.</p></div><Link href="/trails">לכל המסלולים</Link></div>
      <div className="trail-grid trail-grid--home">{rotateDaily(trails, (trail) => trail.slug, "home-trails").slice(0, 4).map((trail) => <TrailCard key={trail.slug} trail={trail} compact />)}</div>
    </div>
  </section>;
}
