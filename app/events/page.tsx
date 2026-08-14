/* eslint-disable @next/next/no-img-element */

import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/page-shell";
import { SearchBox } from "../components/search-box";
import { eventPlaceHref, eventPlaces } from "../data/site-data";
import { PinIcon } from "../site-header";
import { StructuredData } from "../components/structured-data";
import { BreadcrumbTrail } from "../components/breadcrumb-trail";
import { breadcrumbSchema, collectionSchema } from "../lib/seo";
import { WorldQuickSearches } from "../components/world-quick-searches";
import { EventRegionCarousel, type EventRegionCarouselItem } from "../components/event-region-carousel";

export const metadata: Metadata = {
  title: "מקומות לאירועים פרטיים",
  description: "מחפשים מקומות לאירועים לפי אזור, תאריך וכמות משתתפים ומשווים בין מתחמים ברחבי הארץ.",
  alternates: { canonical: "/events" },
};

const eventRegionLabels = ["מישור החוף והשפלה", "חיפה וחוף הכרמל", "מישור החוף הדרומי", "תל אביב", "ראשון לציון", "נשר"];

function eventRegionItems(): EventRegionCarouselItem[] {
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

export default function EventsPage() {
  const regions = eventRegionItems();
  return (
    <PageShell variant="events">
      <main id="main-content" className="events-page">
        <StructuredData data={collectionSchema("מקומות לאירועים פרטיים", "מקומות לאירועים לפי אזור, כמות משתתפים וסוג האירוע.", "/events", eventPlaces.map((place) => ({ name: place.name, path: eventPlaceHref(place), image: place.image })))} />
        <StructuredData data={breadcrumbSchema([{ name: "ראשי", path: "/" }, { name: "אירועים", path: "/events" }])} />
        <section className="events-hero"><div className="shell"><h1>מוצאים מקום לחגוג בו</h1><p>מחפשים לפי אזור, תאריך וכמות משתתפים ומשווים בין מקומות אמיתיים.</p><SearchBox mode="events" showWorlds /><WorldQuickSearches mode="events" /></div></section>
        <BreadcrumbTrail className="world-breadcrumbs" items={[{ name: "ראשי", path: "/" }, { name: "אירועים" }]} />
        <section className="section shell event-region-section">
          <div className="section-head">
            <div>
              <span className="eyebrow">אזורים מבוקשים</span>
              <h2>איפה חוגגים?</h2>
            </div>
          </div>
          <EventRegionCarousel items={regions} />
        </section>
        <section className="section section-tint"><div className="shell"><div className="section-head"><div><span className="eyebrow">מקומות שכדאי להכיר</span><h2>מומלצים לאירוע הבא</h2></div><Link href="/events/search">לכל המקומות</Link></div><div className="event-card-grid">{eventPlaces.slice(0, 4).map((place) => <article className="event-card" key={place.slug}><Link href={eventPlaceHref(place)}><img src={place.image} alt={place.name} /><span className="event-card__body"><small>{place.type}</small><h3>{place.name}</h3><p><PinIcon />{place.location}</p><span>עד {place.guests} אורחים</span><span className="button secondary">לפרטים</span></span></Link></article>)}</div></div></section>
        <section className="section shell event-planning"><div><span className="eyebrow">בחירה חכמה יותר</span><h2>שלושה דברים שסוגרים לפני שבוחרים מקום</h2></div><ol><li><b>01</b><span><strong>הכמות</strong>מספר משתתפים ריאלי, כולל טווח ביטחון.</span></li><li><b>02</b><span><strong>הסגנון</strong>מסיבה, אירוע משפחתי או מפגש עסקי.</span></li><li><b>03</b><span><strong>הצרכים</strong>מוזיקה, אוכל, חניה ונגישות.</span></li></ol></section>
      </main>
    </PageShell>
  );
}
