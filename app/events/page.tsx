/* eslint-disable @next/next/no-img-element */

import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { SearchBox } from "../components/search-box";
import { eventPlaceHref, type EventPlace } from "../data/site-data";
import { publicCatalogSummaries } from "../lib/public-catalog-read.ts";
import { PinIcon } from "../site-header";
import { StructuredData } from "../components/structured-data";
import { BreadcrumbTrail } from "../components/breadcrumb-trail";
import { breadcrumbSchema, collectionSchema } from "../lib/seo";
import { WorldQuickSearches } from "../components/world-quick-searches";
import { EventRegionCarousel, type EventRegionCarouselItem } from "../components/event-region-carousel";
import { EventRail } from "../components/event-rail";
import { EventLastMinute } from "../components/event-last-minute";
import { DiscoveryCard } from "../components/discovery-card";
import { discoveryItems } from "../data/world-data";

export const metadata: Metadata = {
  title: "מקומות לאירועים פרטיים",
  description: "מחפשים מקומות לאירועים לפי אזור, תאריך וכמות משתתפים ומשווים בין מתחמים ברחבי הארץ.",
  alternates: { canonical: "/events" },
};

const eventRegionLabels = ["מישור החוף והשפלה", "חיפה וחוף הכרמל", "מישור החוף הדרומי", "תל אביב", "ראשון לציון", "נשר"];

function eventRegionItems(eventPlaces: EventPlace[]): EventRegionCarouselItem[] {
  const usedImages = new Set<string>();
  return eventRegionLabels.flatMap((label) => {
    const matchingPlaces = eventPlaces.filter((place) => place.area === label || place.location === label);
    const visual = matchingPlaces.find((place) => !usedImages.has(place.image)) || matchingPlaces[0];
    if (!visual) return [];
    usedImages.add(visual.image);
    return [{
      label,
      href: `/events/search?location=${encodeURIComponent(label)}`,
      image: visual.image,
      venueCount: matchingPlaces.length,
    }];
  });
}

export default async function EventsPage() {
  const eventPlaces = await publicCatalogSummaries<EventPlace>("events");
  const regions = eventRegionItems(eventPlaces);
  const recommended = eventPlaces.filter((place) => place.image && (place.score || 0) > 0 && (place.reviews || 0) > 0)
    .sort((a, b) => (b.score || 0) - (a.score || 0) || (b.reviews || 0) - (a.reviews || 0)).slice(0, 12);
  const eventTypes = [...new Set(eventPlaces.map((place) => place.type).filter(Boolean))].slice(0, 12);
  const eventProviders = discoveryItems.filter((item) => item.world === "providers" && item.image
    && /אירוע|קייטרינג|שף|תקליט|מוזיק|צילום|עיצוב|הפקה|בלונים/i.test(`${item.name} ${item.area} ${item.description} ${item.features.join(" ")}`)).slice(0, 12);
  return (
    <PageShell variant="events">
      <main id="main-content" className="events-page">
        <StructuredData data={collectionSchema("מקומות לאירועים פרטיים", "מקומות לאירועים לפי אזור, כמות משתתפים וסוג האירוע.", "/events", eventPlaces.map((place) => ({ name: place.name, path: eventPlaceHref(place), image: place.image })))} />
        <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "אירועים", path: "/events" }])} />
        <section className="events-hero"><div className="shell"><SearchBox mode="events" compact showWorlds /></div></section>
        <BreadcrumbTrail className="world-breadcrumbs" items={[{ name: "ראשי", path: "/" }, { name: "אירועים" }]} />
        <section className="world-page-heading shell"><h1>מוצאים מקום לחגוג בו</h1><p>מחפשים לפי אזור, תאריך וכמות משתתפים ומשווים בין מקומות אמיתיים.</p><WorldQuickSearches mode="events" /></section>
        <EventLastMinute places={eventPlaces} />
        <section className="section shell event-region-section">
          <div className="section-head">
            <div>
              <span className="eyebrow">אזורים מבוקשים</span>
              <h2>איפה חוגגים?</h2>
            </div>
          </div>
          <EventRegionCarousel items={regions} />
        </section>
        {recommended.length ? <section className="section shell event-discovery-section" aria-labelledby="recommended-events-title"><div className="section-head"><div><span className="eyebrow">על בסיס דירוגים שפורסמו</span><h2 id="recommended-events-title">מקומות עם חוות דעת מובילות</h2></div><Link href="/events/search">לכל המקומות</Link></div><EventRail title="מקומות עם חוות דעת מובילות">{recommended.map((place) => <Link className="event-rail-card" key={place.slug} href={eventPlaceHref(place)}><img src={place.image} alt={place.name} loading="lazy" /><span className="event-rail-card__body"><small>{place.location} · {place.type}</small><strong>{place.name}</strong><span>ציון {place.score} מתוך 10 · {place.reviews} חוות דעת</span></span></Link>)}</EventRail></section> : null}
        {eventTypes.length > 1 ? <section className="section shell event-discovery-section" aria-labelledby="event-types-title"><div className="section-head"><div><h2 id="event-types-title">מקומות לפי סוג</h2></div></div><EventRail title="סוגי מקומות לאירועים">{eventTypes.map((type) => { const places = eventPlaces.filter((place) => place.type === type); const image = places.find((place) => place.image)?.image; return <Link className="event-rail-card event-rail-card--type" key={type} href={`/events/search?type=${encodeURIComponent(type)}`}>{image ? <img src={image} alt="" loading="lazy" /> : null}<span className="event-rail-card__body"><strong>{type}</strong><span>{places.length} מקומות</span></span></Link>; })}</EventRail></section> : null}
        {eventProviders.length ? <section className="section shell event-discovery-section" aria-labelledby="event-providers-title"><div className="section-head"><div><h2 id="event-providers-title">ספקים לאירוע</h2></div><Link href="/providers">לכל הספקים</Link></div><EventRail title="ספקים לאירוע">{eventProviders.map((item) => <div className="event-rail-discovery" key={item.id}><DiscoveryCard item={item} /></div>)}</EventRail></section> : null}
        <section className="section section-tint"><div className="shell"><div className="section-head"><div><h2>מקומות לאירועים</h2></div><Link href="/events/search">לכל המקומות</Link></div><div className="event-card-grid">{eventPlaces.slice(0, 4).map((place) => <article className="event-card" key={place.slug}><Link href={eventPlaceHref(place)}><img src={place.image} alt={place.name} title={place.name} /><span className="event-card__body"><small>{place.type}</small><h3>{place.name}</h3><p><PinIcon />{place.location}</p><span>עד {place.guests} אורחים ביחידה הגדולה</span><span className="button secondary">לפרטים</span></span></Link></article>)}</div></div></section>
        <section className="section shell event-planning"><div><span className="eyebrow">בחירה חכמה יותר</span><h2>שלושה דברים שסוגרים לפני שבוחרים מקום</h2></div><ol><li><b>01</b><span><strong>הכמות</strong>מספר משתתפים ריאלי, כולל טווח ביטחון.</span></li><li><b>02</b><span><strong>הסגנון</strong>מסיבה, אירוע משפחתי או מפגש עסקי.</span></li><li><b>03</b><span><strong>הצרכים</strong>מוזיקה, אוכל, חניה ונגישות.</span></li></ol></section>
      </main>
    </PageShell>
  );
}
