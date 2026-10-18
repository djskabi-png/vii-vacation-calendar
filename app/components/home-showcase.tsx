"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent as ReactMouseEvent } from "react";
import { DiscoveryCard } from "./discovery-card";
import type { EventPlace, Property } from "../data/site-data";
import { eventPlaceHref } from "../lib/event-place-href";
import type { DiscoveryItem } from "../data/world-data";
import { publicWorldNavigation } from "../data/world-navigation";
import { trails } from "../data/trail-data";
import { TrailCard } from "./trail-card";
import { PinIcon } from "../site-header";
import { useSiteLanguage } from "../i18n/locale-provider";
import { HomeLiveDeals } from "./home-live-deals";
import { EventLastMinute } from "./event-last-minute";
import { rotateDaily } from "../lib/daily-rotation";
import { HomeManagedDiscovery } from "./home-discovery-sections";
import { HomeSliderControls } from "./home-slider-controls";
import { PlacePreviewCard } from "./place-preview-card";
import { SpaPackageDeals } from "./spa-package-deals";
import { HomeMobileRail } from "./home-mobile-rail";
import { homeEventPhotography, homeReviewExcerpt } from "../lib/home-preview-content";
import { worldTopicMedia, worldTopicImageCopy } from "../lib/world-topic-media";
import { orderDiscoveryRail } from "../lib/discovery-slider-order";
import { useDocumentSeed } from "./use-document-seed";

// These sliders fetch their own availability. They must not wait for the
// unrelated four-world catalog or below-the-fold review queries.
export function HomeLiveSections() {
  return <><HomeLiveDeals /><HomeLiveDeals mode="holidays" /></>;
}

export function HomeCatalogLoading() {
  const { language } = useSiteLanguage();
  const label = { he: "טוענים מקומות", en: "Loading places", ru: "Загружаем места", fr: "Chargement des lieux" }[language];
  return <div className="section shell home-live-deals__loading" role="status" aria-label={label}>
    <div className="home-live-deals__loading-cards" aria-hidden="true">{[0, 1, 2].map((index) =>
      <div className="home-live-deals__loading-card" key={index}><div className="home-live-deals__loading-image" />
        <div className="home-live-deals__loading-lines"><span /><span /><span /></div></div>)}</div>
  </div>;
}

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

const destinationLoadingCopy = {
  he: { opening: "פותחים את המקומות...", waiting: "רק רגע, כבר נכנסים", prefix: "פותחים את" },
  en: { opening: "Opening places...", waiting: "Just a moment, we’re almost there", prefix: "Opening" },
  ru: { opening: "Открываем места...", waiting: "Ещё мгновение", prefix: "Открываем" },
  fr: { opening: "Ouverture des lieux...", waiting: "Encore un instant", prefix: "Ouverture de" },
} as const;


export type HomeRatedPlace = {
  place: Property;
  reviewText: string;
  reviewAuthor: string;
  reviewDate: string;
};

export function HomeShowcase({ properties, eventPlaces, hourlyPlaces, ratedPlaces, providerPreview, attractionPreview }: {
  properties: Pick<Property, "slug" | "name" | "location" | "area" | "image" | "videos">[];
  eventPlaces: EventPlace[];
  hourlyPlaces: DiscoveryItem[];
  ratedPlaces: HomeRatedPlace[];
  providerPreview: DiscoveryItem;
  attractionPreview: DiscoveryItem;
}) {
  const router = useRouter();
  const documentSeed = useDocumentSeed();
  const { language } = useSiteLanguage();
  const destinationLoading = destinationLoadingCopy[language];
  const [pendingDestination, setPendingDestination] = useState<string | null>(null);
  const worldCards = publicWorldNavigation.filter((world) => !["vacation", "events", "spa", "hourly"].includes(world.id));
  const featuredTours = orderDiscoveryRail(properties.flatMap((property) => (property.videos || []).map((video) => ({ property, video }))),
    { id: ({ property, video }) => `${property.slug}:${video.src}`, seed: `${documentSeed}:home-tours`, limit: 7 });
  const featuredRatings = orderDiscoveryRail(ratedPlaces, { id: item => item.place.slug, seed: `${documentSeed}:home-ratings`,
    compare: (a, b) => (b.place.score || 0) - (a.place.score || 0) });
  const destinationImages = rotateDaily(properties.filter((property) => property.image), (property) => property.slug, "home-destination-images");
  const usedDestinationImages = new Set<string>();
  const destinationPlaces = vacationDestinations.map((_destination, index) => {
    const matches = destinationImages.filter((candidate) => destinationMatchers[index](candidate.area, candidate.location));
    const place = matches.find((candidate) => !usedDestinationImages.has(candidate.image)) || matches[0];
    if (place) usedDestinationImages.add(place.image);
    return place;
  });
  const featuredHourly = orderDiscoveryRail(hourlyPlaces, { id: item => item.id, seed: `${documentSeed}:home-hourly`,
    compare: (a, b) => Number(!(a.image && a.priceLabel)) - Number(!(b.image && b.priceLabel)) });
  const featuredEvents = orderDiscoveryRail(eventPlaces.filter((place) => place.image).map(homeEventPhotography), { id: place => place.slug, seed: `${documentSeed}:home-events` });

  function warmDestination(href: string) {
    router.prefetch(href);
  }

  function selectDestination(event: ReactMouseEvent<HTMLAnchorElement>, href: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (pendingDestination) {
      event.preventDefault();
      return;
    }
    setPendingDestination(href);
  }

  return <>
    <section className="section home-vacation-discovery" aria-labelledby="vacation-discovery-title">
      <div className="shell">
        <div className="home-vacation-discovery__intro">
          <span className="eyebrow">מכאן קל יותר לבחור</span>
          <h2 id="vacation-discovery-title">מוצאים את הנופש בדרך שמתאימה לכם</h2>
          <p>מתחילים באזור ובהרכב האורחים ומשווים את פרטי המקומות.</p>
        </div>

        <div className="home-vacation-strip">
          <div className="home-vacation-strip__head"><div><span>לפי אזור</span><h3>יעדים מומלצים לנופש</h3></div><HomeSliderControls railId="home-destinations-rail" label="יעדי נופש" itemSelector=".home-slider__item" /></div>
          <div id="home-destinations-rail" className="home-vacation-strip__track home-vacation-strip__track--destinations" data-horizontal-rail>
            {vacationDestinations.map((item, index) => {
              const place = destinationPlaces[index];
              const isPending = pendingDestination === item.href;
              return place ? <Link
                className={`home-vacation-card home-vacation-card--destination home-slider__item${isPending ? " is-destination-pending" : ""}`}
                href={item.href}
                prefetch={false}
                key={item.label}
                onPointerEnter={() => warmDestination(item.href)}
                onFocus={() => warmDestination(item.href)}
                onPointerDown={() => warmDestination(item.href)}
                onClick={(event) => selectDestination(event, item.href)}
                aria-busy={isPending}
                aria-disabled={pendingDestination !== null}
                data-global-feedback="true"
                data-loading-label={`${destinationLoading.prefix} ${item.label}...`}
              ><img src={place.image} alt="" title="" data-image-role="decorative" loading="lazy" decoding="async" /><div><span>יעד מומלץ</span><h4>{item.label}</h4><p>{item.note}</p><b>{isPending ? destinationLoading.opening : "לכל המקומות באזור"}</b></div>{isPending ? <span className="home-vacation-card__pending" aria-hidden="true"><i /><small>{destinationLoading.waiting}</small></span> : null}</Link> : null;
            })}
          </div>
        </div>

        <HomeManagedDiscovery />

      </div>
    </section>

    {featuredTours.length || ratedPlaces.length ? <section className="section home-trust-discovery" aria-labelledby={featuredTours.length ? "home-tours-title" : "home-ratings-title"}>
      <div className="shell">
        {featuredTours.length ? <div className="home-trust-strip">
          <div className="home-vacation-strip__head"><div><span>רואים לפני שבוחרים</span><h2 id="home-tours-title">סרטונים מובילים</h2></div><HomeSliderControls railId="home-tours-rail" label="סרטונים מובילים" itemSelector=".home-slider__item" /></div>
          <div id="home-tours-rail" className="home-slider__track home-slider__track--trust" data-horizontal-rail>
            {featuredTours.map(({ property, video }) => <article className="home-tour-card home-slider__item" key={`${property.slug}-${video.src}`}>
              <video controls playsInline preload="none" poster={video.poster} aria-label={`${video.title}, ${property.name}`}><source src={video.src} type="video/mp4" /></video>
              <div><span>{property.location}</span><h3>{property.name}</h3><p>{video.note}</p><Link href={`/business?id=${property.slug}`}>לפרטי המקום</Link></div>
            </article>)}
          </div>
        </div> : null}

        {ratedPlaces.length ? <div className="home-trust-strip">
          <div className="home-vacation-strip__head"><div><span>דירוגי מקומות</span><h2 id="home-ratings-title">חוות דעת מובילות</h2></div><HomeSliderControls railId="home-ratings-rail" label="חוות דעת מובילות" itemSelector=".home-slider__item" /></div>
          <div id="home-ratings-rail" className="home-slider__track home-slider__track--trust home-slider__track--ratings" data-horizontal-rail aria-labelledby="home-ratings-title">
            {featuredRatings.map(({ place, reviewText, reviewAuthor, reviewDate }) => <article className="home-rating-card home-slider__item" key={place.slug}>
              <div className="home-rating-card__top"><Link className="home-rating-card__gallery" href={`/business?id=${place.slug}`} target="_blank" rel="noopener noreferrer"><img src={place.image} alt={place.name} title={place.name} loading="lazy" decoding="async" /></Link><div><span>{place.location}</span><h3><Link href={`/business?id=${place.slug}`}>{place.name}</Link></h3><strong aria-label={`ציון ${place.score} מתוך 10, ${place.reviews} חוות דעת`}><b>{place.score}</b><small>{place.reviews} חוות דעת</small></strong></div></div><p lang="he" dir="rtl">{homeReviewExcerpt(reviewText)}</p><small className="home-rating-card__byline">{reviewAuthor}{reviewDate ? ` · ${reviewDate}` : ""}</small><Link className="home-rating-card__cta" href={`/business?id=${place.slug}`}>לפרטי המקום</Link>
            </article>)}
          </div>
        </div> : null}
      </div>
    </section> : null}

    <SpaPackageDeals />

    <section className="section home-short-stay" aria-labelledby="home-short-title"><div className="shell"><div className="section-head"><div><span className="eyebrow">כשלא צריך לילה שלם</span><h2 id="home-short-title">חדרים לכמה שעות</h2><p>שהייה קצרה, פרטית וגמישה. בוחרים מקום ובודקים את מסגרת הזמן והמחיר.</p></div><div><Link href="/hourly">לכל החדרים</Link><HomeSliderControls railId="home-hourly-rail" label="חדרים לפי שעה" itemSelector=".home-slider__item" /></div></div><div id="home-hourly-rail" className="home-slider__track home-slider__track--discovery" data-horizontal-rail>{featuredHourly.map((item) => <div className="home-slider__item" key={item.id}><DiscoveryCard item={item} /></div>)}</div></div></section>

    <EventLastMinute places={eventPlaces} sectionId="home-event-deals" />
    <section className="home-events-world" aria-labelledby="home-events-title">
      <div className="shell home-events-world__head"><div><span className="eyebrow">עולם האירועים</span><h2 id="home-events-title">כל סיבה טובה הופכת כאן לאירוע</h2><p>לופטים ומתחמים לימי הולדת, מסיבות, אירועי חברה וחגיגות פרטיות, עם חיפוש לפי כמות ואופי האירוע.</p></div><Link className="button" href="/events">נכנסים לעולם האירועים</Link></div>
      <div className="shell home-mobile-rail-controls"><HomeSliderControls railId="home-event-stories" label="מקומות לאירועים" itemSelector=".home-event-feature, .home-event-list__card" /></div>
      <div id="home-event-stories" className="shell home-events-world__layout" data-horizontal-rail>
        {featuredEvents[0] ? <PlacePreviewCard className="home-event-feature" name={featuredEvents[0].name} image={featuredEvents[0].image} images={featuredEvents[0].images} href={eventPlaceHref(featuredEvents[0])}><span className="home-event-feature__type">{featuredEvents[0].type}</span><div><small><PinIcon />{featuredEvents[0].location}</small><h3>{featuredEvents[0].name}</h3>{featuredEvents[0].description ? <p>{featuredEvents[0].description}</p> : null}<b>עד {featuredEvents[0].guests} אורחים ביחידה הגדולה</b></div></PlacePreviewCard> : null}
        <div className="home-event-list">{featuredEvents.slice(1, 5).map((place) => <PlacePreviewCard className="home-event-list__card" key={place.slug} name={place.name} image={place.image} images={place.images} href={eventPlaceHref(place)}><div><span>{place.type}</span><h3>{place.name}</h3><small>{place.location}, עד {place.guests} אורחים ביחידה הגדולה</small></div></PlacePreviewCard>)}</div>
      </div>
    </section>

    <section className="section home-worlds" aria-labelledby="home-worlds-title">
      <div className="shell"><div className="section-head"><div><span className="eyebrow">אתר אחד, הרבה דרכים ליהנות</span><h2 id="home-worlds-title">ממשיכים לכל העולמות</h2><p>לא רק מקום לישון. בונים את כל החופשה, הטיפול, השהייה הקצרה, הספקים והיום שמסביב.</p></div></div>
        <HomeMobileRail id="home-worlds-rail" label="ממשיכים לכל העולמות" className="home-world-gates">{worldCards.map((world) => {
          const item = world.id === "providers" ? providerPreview : world.id === "trails" ? trails[0] : attractionPreview;
          const topicImage = world.id === "trails" ? worldTopicMedia.trails : null;
          const topicCopy = topicImage ? worldTopicImageCopy(topicImage, language) : null;
          const image = topicImage?.src || ("image" in item ? item.image : undefined);
          const imageAlt = topicCopy?.alt || item.name;
          const description = "description" in item ? item.description : item.summary;
          return <Link key={world.id} className={`home-world-gate home-world-gate--${world.id}`} href={world.href}>{image ? <img src={image} alt={imageAlt} title={imageAlt} loading="lazy" decoding="async" /> : <span className="home-world-gate__visual">{world.shortLabel.slice(0,1)}</span>}{topicCopy ? <span className="home-world-gate__image-label" data-no-translate>{topicCopy.caption}</span> : null}<div><span>{world.label}</span><h3>{world.description}</h3><p>{"demo" in item && item.demo ? "פרופילים לדוגמה שממחישים איך השירות יעבוד באתר." : description}</p><b>לגלות את העולם</b></div></Link>;
        })}</HomeMobileRail>
      </div>
    </section>

  </>;
}

export function HomeTrails() {
  const documentSeed = useDocumentSeed();
  return <section className="section home-trails" aria-labelledby="home-trails-title">
    <div className="shell"><div className="section-head"><div><span className="eyebrow">יוצאים מהצימר אל הטבע</span><h2 id="home-trails-title">מסלולים ליד החופשה</h2><p>מדריכי טיול עצמאיים עם זמן, קושי, עונה, בטיחות ומקור רשמי לבדיקה ביום היציאה.</p></div><Link href="/trails">לכל המסלולים</Link></div>
      <HomeMobileRail id="home-trails-rail" label="מסלולים ליד החופשה" className="trail-grid trail-grid--home">{orderDiscoveryRail(trails, { id: trail => trail.slug, seed: `${documentSeed}:home-trails`, limit: 20 }).map((trail) => <TrailCard key={trail.slug} trail={trail} compact />)}</HomeMobileRail>
    </div>
  </section>;
}
