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
import { EventRegionCarousel, type EventRegionCarouselItem } from "../components/event-region-carousel";
import { EventRail } from "../components/event-rail";
import { EventLastMinute } from "../components/event-last-minute";
import { DiscoveryCard } from "../components/discovery-card";
import { PlacePreviewCard } from "../components/place-preview-card";
import { discoveryItems } from "../data/world-data";
import { EventQuickSearches } from "../components/event-quick-searches";
import { readEventLandingPresentation } from "../lib/event-landing-presentation";
import { WorldTopicImage } from "../components/world-topic-image";
import { SearchAfterResults } from "../components/search-after-results";
import { serverPublicCopy } from "../i18n/server-public-copy";
import { localizedPath, type SiteLanguage } from "../i18n/locale-routing";

export async function generateMetadata(): Promise<Metadata> {
  const [presentation, { language, translate }] = await Promise.all([readEventLandingPresentation(), serverPublicCopy()]);
  const title = translate(presentation.title);
  const description = translate(presentation.description);
  const canonical = localizedPath("/events", language);
  return { title, description, alternates: { canonical },
    openGraph: { type: "website", url: canonical, title, description } };
}

const eventRegionLabels = ["מישור החוף והשפלה", "חיפה וחוף הכרמל", "מישור החוף הדרומי", "תל אביב", "ראשון לציון", "נשר"];

function eventRegionItems(eventPlaces: EventPlace[], translate: (value: string) => string, language: SiteLanguage): EventRegionCarouselItem[] {
  const usedImages = new Set<string>();
  return eventRegionLabels.flatMap((label) => {
    const matchingPlaces = eventPlaces.filter((place) => place.area === label || place.location === label);
    const visual = matchingPlaces.find((place) => !usedImages.has(place.image)) || matchingPlaces[0];
    if (!visual) return [];
    usedImages.add(visual.image);
    return [{
      label: translate(label),
      href: localizedPath(`/events/search?location=${encodeURIComponent(label)}`, language),
      image: visual.image,
      venueCount: matchingPlaces.length,
    }];
  });
}

export default async function EventsPage() {
  const [eventPlaces, sourcePresentation, { language, translate }] = await Promise.all([
    publicCatalogSummaries<EventPlace>("events"),
    readEventLandingPresentation(),
    serverPublicCopy(),
  ]);
  const presentation = {
    ...sourcePresentation,
    title: translate(sourcePresentation.title),
    description: translate(sourcePresentation.description),
    eyebrow: translate(sourcePresentation.eyebrow),
    proof: sourcePresentation.proof.map(translate),
    quickSearchEyebrow: translate(sourcePresentation.quickSearchEyebrow),
    quickSearchTitle: translate(sourcePresentation.quickSearchTitle),
    heroImages: sourcePresentation.heroImages.map((image) => ({ ...image, alt: translate(image.alt) })),
    quickSearches: sourcePresentation.quickSearches.map((item) => ({ ...item, label: translate(item.label), note: translate(item.note), imageAlt: translate(item.imageAlt), href: localizedPath(item.href, language) })),
  };
  const regions = eventRegionItems(eventPlaces, translate, language);
  const recommended = eventPlaces.filter((place) => place.image && (place.score || 0) > 0 && (place.reviews || 0) > 0)
    .sort((a, b) => (b.score || 0) - (a.score || 0) || (b.reviews || 0) - (a.reviews || 0)).slice(0, 12);
  const eventTypes = [...new Set(eventPlaces.map((place) => place.type).filter(Boolean))].slice(0, 12);
  const eventProviders = discoveryItems.filter((item) => item.world === "providers" && item.image
    && /אירוע|קייטרינג|שף|תקליט|מוזיק|צילום|עיצוב|הפקה|בלונים/i.test(`${item.name} ${item.area} ${item.description} ${item.features.join(" ")}`)).slice(0, 12);
  return (
    <PageShell variant="events">
      <main id="main-content" className="events-page">
        <StructuredData data={collectionSchema(presentation.title, presentation.description, localizedPath("/events", language), eventPlaces.map((place) => ({ name: translate(place.name), path: localizedPath(eventPlaceHref(place), language), image: place.image })))} />
        <StructuredData data={breadcrumbSchema([{ name: translate("ראשי"), path: localizedPath("/", language) }, { name: translate("אירועים"), path: localizedPath("/events", language) }])} />
        <section className="events-hero">
          <div className="shell events-hero__layout">
            <div className="events-hero__content">
              <BreadcrumbTrail className="events-hero__breadcrumbs" items={[{ name: translate("ראשי"), path: localizedPath("/", language) }, { name: translate("אירועים") }]} />
              <h1>{presentation.title}</h1>
              <p>{presentation.description}</p>
              <div className="events-hero__proof" aria-label={translate("יתרונות החיפוש")} tabIndex={0}>{presentation.proof.map((item, index) => <span key={item}>{index === 0 ? <b>{eventPlaces.length}</b> : null}{item}</span>)}</div>
            </div>
            <div className="events-hero__visual">
              <WorldTopicImage image={presentation.heroImages[0]} />
            </div>
            <div className="events-hero__search"><SearchBox mode="events" compact showWorlds /></div>
          </div>
        </section>
        <EventQuickSearches eyebrow={presentation.quickSearchEyebrow} title={presentation.quickSearchTitle} items={presentation.quickSearches} />
        <EventLastMinute places={eventPlaces} />
        <section className="section shell event-region-section">
          <div className="section-head">
            <div>
              <span className="eyebrow">{translate("אזורים מבוקשים")}</span>
              <h2>{translate("איפה חוגגים?")}</h2>
            </div>
          </div>
          <EventRegionCarousel items={regions} />
        </section>
        {recommended.length ? <section className="section shell event-discovery-section" aria-labelledby="recommended-events-title"><div className="section-head"><div><span className="eyebrow">{translate("על בסיס דירוגים שפורסמו")}</span><h2 id="recommended-events-title">{translate("מקומות עם חוות דעת מובילות")}</h2></div><Link href={localizedPath("/events/search", language)}>{translate("לכל המקומות")}</Link></div><EventRail shufflePlaces title={translate("מקומות עם חוות דעת מובילות")}>{recommended.map((place) => <PlacePreviewCard className="event-rail-card" contact={{ placeId: place.slug, phone: place.contact?.phone, whatsapp: place.contact?.whatsapp, serviceName: place.type }} key={place.slug} name={translate(place.name)} image={place.image} images={place.images} href={localizedPath(eventPlaceHref(place), language)}><span className="event-rail-card__body"><small>{translate(place.location)} · {translate(place.type)}</small><strong>{translate(place.name)}</strong><span>{translate("ציון")} {place.score} {translate("מתוך 10")} · {place.reviews} {translate("חוות דעת")}</span></span></PlacePreviewCard>)}</EventRail></section> : null}
        {eventTypes.length > 1 ? <section className="section shell event-discovery-section" aria-labelledby="event-types-title"><div className="section-head"><div><h2 id="event-types-title">{translate("מקומות לפי סוג")}</h2></div></div><EventRail title={translate("סוגי מקומות לאירועים")}>{eventTypes.map((type) => { const places = eventPlaces.filter((place) => place.type === type); const image = places.find((place) => place.image)?.image; return <Link className="event-rail-card event-rail-card--type" key={type} href={localizedPath(`/events/search?type=${encodeURIComponent(type)}`, language)}>{image ? <img src={image} alt="" title="" data-image-role="decorative" loading="lazy" /> : null}<span className="event-rail-card__body"><strong>{translate(type)}</strong><span>{places.length} {translate("מקומות")}</span></span></Link>; })}</EventRail></section> : null}
        {eventProviders.length ? <section className="section shell event-discovery-section" aria-labelledby="event-providers-title"><div className="section-head"><div><h2 id="event-providers-title">{translate("ספקים לאירוע")}</h2></div><Link href={localizedPath("/providers", language)}>{translate("לכל הספקים")}</Link></div><EventRail shufflePlaces title={translate("ספקים לאירוע")}>{eventProviders.map((item) => <div className="event-rail-discovery" key={item.id}><DiscoveryCard item={item} /></div>)}</EventRail></section> : null}
        <section className="section section-tint"><div className="shell"><div className="section-head"><div><h2>{translate("מקומות לאירועים")}</h2></div><Link href={localizedPath("/events/search", language)}>{translate("לכל המקומות")}</Link></div><EventRail shufflePlaces warmAheadImages title={translate("מקומות לאירועים")}>{eventPlaces.map((place) => <PlacePreviewCard className="event-rail-card event-card event-world-card" contact={{ placeId: place.slug, phone: place.contact?.phone, whatsapp: place.contact?.whatsapp, serviceName: place.type }} key={place.slug} name={translate(place.name)} image={place.image} images={place.images} href={localizedPath(eventPlaceHref(place), language)}><span className="event-rail-card__body event-card__body"><small>{translate(place.type)}</small><h3>{translate(place.name)}</h3><p><PinIcon />{translate(place.location)}</p><span>{translate(`עד ${place.guests} אורחים ביחידה הגדולה`)}</span></span></PlacePreviewCard>)}</EventRail></div></section>
        <section className="section shell event-planning"><div><span className="eyebrow">{translate("בחירה חכמה יותר")}</span><h2>{translate("שלושה דברים שסוגרים לפני שבוחרים מקום")}</h2></div><ol><li><b>01</b><span><strong>{translate("הכמות")}</strong>{translate("מספר משתתפים ריאלי, כולל טווח ביטחון.")}</span></li><li><b>02</b><span><strong>{translate("הסגנון")}</strong>{translate("מסיבה, אירוע משפחתי או מפגש עסקי.")}</span></li><li><b>03</b><span><strong>{translate("הצרכים")}</strong>{translate("מוזיקה, אוכל, חניה ונגישות.")}</span></li></ol></section>
        <SearchAfterResults world="events" discoveryOnly inventory={eventPlaces.map(item => ({ location: item.location, area: item.area, type: item.type, eventTypes: item.eventTypes }))} />
      </main>
    </PageShell>
  );
}
