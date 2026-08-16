"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { BreadcrumbTrail } from "../components/breadcrumb-trail";
import { vacationBreadcrumbForLocation } from "../data/vacation-landings";
import { CalendarDemo } from "../calendar-demo";
import { ListingMap } from "../components/listing-map";
import { PageShell } from "../components/page-shell";
import { PropertyCard, resolveAvailabilityForStay } from "../components/property-card";
import { DiscoveryCard } from "../components/discovery-card";
import { ListingAccessibility } from "../components/listing-accessibility";
import { SleepingArrangements } from "../components/sleeping-arrangements";
import { getListingOfferings, properties, propertyFaq, type BusinessWorld, type ListingFeatureGroup, type ListingHighlightIcon } from "../data/site-data";
import { discoveryItems, type DiscoveryItem } from "../data/world-data";
import { nearbyTrails } from "../data/trail-data";
import { TrailCard } from "../components/trail-card";
import { GalleryExperience } from "../components/gallery-experience";
import { useGalleryDeepLink } from "../components/use-gallery-deep-link";
import { GuestReviewStudio } from "../components/guest-review-studio";
import { WhatsAppLeadButton } from "../components/whatsapp-lead-button";
import { ListingContactPreview, SampleListingDisclosure } from "../components/listing-contact-preview";
import { MasuExperience } from "../components/masu-experience";
import { DetailStickyDock, type DetailSectionLink } from "../components/detail-sticky-dock";
import { ModernSelect } from "../components/modern-select";
import { FavoriteButton } from "../components/favorite-button";
import { ShareButton } from "../components/share-dialog";
import { CalendarIcon, PinIcon } from "../site-header";
import { VacationBookingHub } from "../components/vacation-booking-hub";
import { useLegacyAvailability } from "../components/use-legacy-availability";
import { legacyAvailabilitySourceFor } from "../lib/legacy-availability-sources";
import { ViewedItemTracker } from "../components/viewed-item-tracker";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";
import { publishedLastMinuteDeal } from "../data/last-minute-deals";
import { UnitDetailsDialog } from "../components/unit-details-dialog";

function complementaryItems(area: string, location: string): DiscoveryItem[] {
  const query = `${area} ${location}`.toLocaleLowerCase("he");
  const queryTerms = new Set(query.split(/\s+/).filter((term) => term.length > 2));

  return discoveryItems
    .filter((item) => item.world !== "hourly")
    .map((item, index) => {
      const candidate = `${item.area} ${item.location}`.toLocaleLowerCase("he");
      const candidateTerms = new Set(candidate.split(/\s+/).filter((term) => term.length > 2));
      const overlap = [...queryTerms].filter((term) => candidateTerms.has(term)).length;
      const score = (item.location === location ? 80 : 0)
        + (item.area === area ? 60 : 0)
        + (candidate.includes(location.toLocaleLowerCase("he")) ? 35 : 0)
        + (candidate.includes(area.toLocaleLowerCase("he")) ? 25 : 0)
        + overlap * 12;
      return { item, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item)
    .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
    .slice(0, 6);
}

function bedroomLabel(count: number) {
  return count === 1 ? "חדר שינה אחד" : `${count} חדרי שינה`;
}

function bedDetails(features: string[]) {
  return features.filter((feature) => /מיטה|מיטות|ספה נפתחת|מזרן|מזרנים/.test(feature));
}

function highlightIconFor(label: string): ListingHighlightIcon {
  if (/בריכ/.test(label)) return "pool";
  if (/ג׳קוזי|ג'קוזי|סאונה|ספא/.test(label)) return "spa";
  if (/משחק|סנוקר|פינג פונג|קריוקי/.test(label)) return "games";
  if (/חצר|גינה|מדשא|מרפסת/.test(label)) return "garden";
  if (/מטבח|מטבחון/.test(label)) return "kitchen";
  if (/נוף|ים/.test(label)) return "view";
  if (/חניה/.test(label)) return "parking";
  if (/נגיש/.test(label)) return "accessibility";
  if (/אירוע/.test(label)) return "events";
  if (/יחיד|סוויט|חדר/.test(label)) return "units";
  return "default";
}

function derivedFeatureGroups(features: string[]): ListingFeatureGroup[] {
  const groups: ListingFeatureGroup[] = [
    { title: "מתחם חיצוני", items: features.filter((item) => /בריכ|ג׳קוזי|ג'קוזי|סאונה|חצר|גינה|מדשא|מרפסת|מנגל/.test(item)) },
    { title: "מתחם פנימי", items: features.filter((item) => /מטבח|מטבחון|סלון|מיזוג|טלוויז|מסך|חדר רחצה/.test(item)) },
  ];
  const assigned = new Set(groups.flatMap((group) => group.items));
  const general = features.filter((item) => !assigned.has(item));
  return [...(general.length ? [{ title: "כללי", items: general }] : []), ...groups.filter((group) => group.items.length)];
}

function PropertyHighlightIcon({ icon }: { icon: ListingHighlightIcon }) {
  const path = icon === "pool" ? <><path d="M3 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /><path d="M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /></>
    : icon === "spa" ? <><path d="M8 4c-2 3 2 4 0 7M12 3c-2 3 2 4 0 7M16 4c-2 3 2 4 0 7" /><path d="M5 14h14l-1 5H6z" /></>
    : icon === "games" ? <><rect x="4" y="7" width="16" height="10" rx="4" /><path d="M8 12h4M10 10v4" /><circle cx="16" cy="11" r="1" /><circle cx="18" cy="14" r="1" /></>
    : icon === "garden" ? <><path d="M12 20v-9" /><path d="M12 12C8 12 5 9 5 5c4 0 7 2 7 7ZM12 15c4 0 7-2 7-6-4 0-7 2-7 6Z" /></>
    : icon === "kitchen" ? <><path d="M7 3v8M4 3v5c0 2 6 2 6 0V3M7 11v10M16 3v18M16 3c4 3 4 8 0 10" /></>
    : icon === "view" ? <><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>
    : icon === "parking" ? <><rect x="5" y="3" width="14" height="18" rx="3" /><path d="M10 17V7h3.5a3 3 0 0 1 0 6H10" /></>
    : icon === "accessibility" ? <><circle cx="12" cy="4" r="2" /><path d="M9 8h5l2 5h-5l-2 7M7 11a6 6 0 1 0 9 6" /></>
    : icon === "events" ? <path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" />
    : icon === "units" ? <><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></>
    : <path d="m5 12 4 4L19 6" />;
  return <span className={`property-highlight-icon property-highlight-icon--${icon}`} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{path}</svg></span>;
}

const worldLabels: Record<BusinessWorld, string> = {
  vacation: "נופש ולינה",
  events: "אירועים",
  hourly: "שהייה לפי שעה",
  spa: "ספא",
};

function formatInitialStay(from: string | undefined, till: string | undefined, language: SiteLanguage) {
  if (!from || !till) return "בחרו תאריכים";
  const arrival = new Date(`${from}T12:00:00`);
  const departure = new Date(`${till}T12:00:00`);
  if (Number.isNaN(arrival.getTime()) || Number.isNaN(departure.getTime())) return "בחרו תאריכים";
  const locale: Record<SiteLanguage, string> = { he: "he-IL", en: "en-GB", ru: "ru-RU", fr: "fr-FR" };
  const separator: Record<SiteLanguage, string> = { he: " עד ", en: " to ", ru: " – ", fr: " au " };
  const format = new Intl.DateTimeFormat(locale[language], { day: "numeric", month: "numeric" });
  return `${format.format(arrival)}${separator[language]}${format.format(departure)}`;
}

function demoAvailabilityForDate(date: Date) {
  const today = new Date(2026, 7, 4);
  if (date < today) return { kind: "past" as const, units: 0, label: "תאריך שעבר" };
  const epochDay = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  const open = Math.floor(epochDay / 2) % 2 === 0;
  return open
    ? { kind: "open" as const, units: 1, label: "פנוי, מחיר מחובר" }
    : { kind: "busy" as const, units: 0, label: "תפוס" };
}

function demoNightlyPrice(from: string, weekday: number, weekend: number) {
  const date = new Date(`${from}T12:00:00`);
  return date.getDay() === 4 || date.getDay() === 5 ? weekend : weekday;
}

function roomBookingHref(bookingQuery: string, index: number, nightlyPrice: number) {
  const params = new URLSearchParams(bookingQuery);
  params.set("unitIndex", String(index + 1));
  params.set("price", String(nightlyPrice));
  return `/booking?${params.toString()}`;
}
export default function BusinessPage({ initialSlug, initialWorld = "vacation", initialDates, initialFrom, initialTill, initialGuests = "2", initialPrice, initialIllustrative = false, initialSource, initialPeriod }: { initialSlug: string; initialWorld?: BusinessWorld; initialDates?: string; initialFrom?: string; initialTill?: string; initialGuests?: string; initialRooms?: string; initialPrice?: string; initialIllustrative?: boolean; initialSource?: string; initialPeriod?: string }) {
  const { language, translate } = useSiteLanguage();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dates, setDates] = useState(initialDates || "");
  const displayDates = dates || formatInitialStay(initialFrom, initialTill, language);
  const [dateRange, setDateRange] = useState({ from: initialFrom || "", till: initialTill || "" });
  const [guests, setGuests] = useState(Math.max(1, Number(initialGuests) || 2));
  const [selectedPrice, setSelectedPrice] = useState(initialPrice || "");
  const { galleryOpen, galleryStart, galleryTab, openGallery, closeGallery, updateGallerySelection } = useGalleryDeepLink();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [allFeaturesOpen, setAllFeaturesOpen] = useState(false);
  const [mobileFeaturesOpen, setMobileFeaturesOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [selectedRoomIndex, setSelectedRoomIndex] = useState<number | null>(null);
  const closeUnitDetails = useCallback(() => setSelectedRoomIndex(null), []);
  const property = useMemo(() => properties.find((item) => item.slug === initialSlug) || properties[0], [initialSlug]);
  const offerings = useMemo(() => getListingOfferings(property), [property]);
  const [worldSelection, setWorldSelection] = useState<{ slug: string; world: BusinessWorld } | null>(null);
  const initialActiveWorld = offerings.some((offering) => offering.world === initialWorld) ? initialWorld : offerings[0].world;
  const activeWorld = worldSelection?.slug === property.slug
    && offerings.some((offering) => offering.world === worldSelection.world)
    ? worldSelection.world
    : initialActiveWorld;
  const activeOffering = offerings.find((offering) => offering.world === activeWorld) || offerings[0];
  const hasSelectedDates = Boolean(dateRange.from && dateRange.till);
  const selectedStay = hasSelectedDates ? { from: dateRange.from, till: dateRange.till, guests } : null;
  const liveLegacyAvailability = useLegacyAvailability(property, selectedStay);
  const verifiedLastMinuteDeal = activeWorld === "vacation" && selectedStay
    ? publishedLastMinuteDeal({ slug: property.slug, period: initialPeriod, from: selectedStay.from, till: selectedStay.till, guests, nightlyPrice: Number(selectedPrice) || 0 })
    : null;
  const resolvedAvailability = verifiedLastMinuteDeal || liveLegacyAvailability.quote || resolveAvailabilityForStay(property, selectedStay, "/business", null);
  const usesLiveLegacyAvailability = Boolean(legacyAvailabilitySourceFor(property.slug));
  // A quote supplied in a link is useful only for properties without a live source.
  // For migrated listings the source response always wins, so an old shared link
  // cannot display a stale or manipulated amount as a current price.
  const resolvedSelectedPrice = resolvedAvailability?.nightlyPrice
    ? String(resolvedAvailability.nightlyPrice)
    : usesLiveLegacyAvailability ? "" : selectedPrice;
  const hasSelectedPrice = Boolean(resolvedSelectedPrice && Number(resolvedSelectedPrice) > 0);
  const vacationOnlineReady = activeWorld === "vacation" && hasSelectedDates && resolvedAvailability?.availability === "available" && hasSelectedPrice;
  const vacationPhoneFallback = activeWorld === "vacation" && !vacationOnlineReady;
  const vacationRequest = activeWorld === "vacation" && !vacationOnlineReady;
  const onlineBooking = activeWorld === "vacation" ? vacationOnlineReady : activeOffering.bookingMode !== "call-only";
  const phoneBooking = activeOffering.bookingMode === "call-only" || activeOffering.bookingMode === "online-or-call";
  const phoneHref = property.contact?.phone ? `tel:${property.contact.phone.replace(/[^\d+]/g, "")}` : undefined;
  const bookingQuery = new URLSearchParams({ world: activeWorld, place: property.slug, ...(dateRange.from ? { from: dateRange.from } : {}), ...(dateRange.till ? { till: dateRange.till } : {}), guests: String(guests), ...(resolvedSelectedPrice ? { price: resolvedSelectedPrice } : {}), ...(verifiedLastMinuteDeal ? { period: initialPeriod || "last-minute", source: initialSource || "last-minute" } : {}), ...(initialIllustrative || resolvedAvailability?.illustrative ? { illustrative: "1" } : {}) }).toString();
  const ownerWhatsapp = property.contact?.whatsapp || property.contact?.phone;
  const bookingActionHref = vacationPhoneFallback ? "#booking-summary" : `/booking?${bookingQuery}`;
  const sectionLinks = useMemo<DetailSectionLink[]>(() => [
    { href: "#about", label: "על המקום" },
    ...(property.roomOptions?.length ? [{ href: "#rooms" as const, label: property.scenario === "multi" ? "סוויטות ויחידות" : "מבנה המקום" }] : []),
    ...(property.bedrooms ? [{ href: "#sleeping" as const, label: "איפה ישנים" }] : []),
    { href: "#features", label: "מאפיינים" },
    { href: "#accessibility", label: "נגישות" },
    { href: "#location", label: "מיקום" },
    { href: "#faq", label: "שאלות ותשובות" },
    { href: "#reviews", label: "חוות דעת" },
    { href: "#policies", label: "חשוב לדעת" },
  ], [property.bedrooms, property.roomOptions?.length, property.scenario]);
  const roomQuantity = property.roomOptions?.reduce((total, room) => total + room.quantity, 0) || 0;
  const highlights = (property.highlights?.length ? property.highlights : property.features.map((label) => ({ label, icon: highlightIconFor(label) }))).slice(0, 5);
  const featureGroups = property.featureGroups?.length ? property.featureGroups : derivedFeatureGroups(property.features);
  const mobileFeaturePreview = featureGroups.flatMap((group) => group.items).slice(0, 4);
  const complements = useMemo(() => complementaryItems(property.area, property.location), [property.area, property.location]);
  const localTrails = useMemo(() => nearbyTrails(property.area, property.location, 6), [property.area, property.location]);
  const unitCopy = {
    he: { available: "פנויה בתאריכים שבחרתם", unavailable: "לא פנויה בתאריכים שבחרתם", confirm: "הזמינות תאושר מול המקום", quick: "הזמנה מהירה של", otherDate: "בדיקת תאריך אחר", check: "בדיקת זמינות", dates: "בדיקת תאריכים ל", perNight: "ללילה", total: "לכל השהייה" },
    en: { available: "Available for your selected dates", unavailable: "Unavailable for your selected dates", confirm: "Availability will be confirmed with the property", quick: "Quick book", otherDate: "Check another date", check: "Check availability for", dates: "Check dates for", perNight: "per night", total: "for the entire stay" },
    ru: { available: "Доступна на выбранные даты", unavailable: "Недоступна на выбранные даты", confirm: "Доступность подтвердит объект", quick: "Быстро забронировать", otherDate: "Проверить другую дату", check: "Проверить доступность", dates: "Проверить даты для", perNight: "за ночь", total: "за всё проживание" },
    fr: { available: "Disponible aux dates choisies", unavailable: "Indisponible aux dates choisies", confirm: "La disponibilité sera confirmée par l’établissement", quick: "Réservation rapide", otherDate: "Vérifier une autre date", check: "Vérifier la disponibilité de", dates: "Vérifier les dates pour", perNight: "par nuit", total: "pour tout le séjour" },
  }[language];
  const numberLocale = language === "he" ? "he-IL" : language === "en" ? "en-GB" : language === "ru" ? "ru-RU" : "fr-FR";

  function chooseWorld(world: BusinessWorld) {
    setWorldSelection({ slug: property.slug, world });
    const url = new URL(window.location.href);
    if (world === offerings[0].world) url.searchParams.delete("mode");
    else url.searchParams.set("mode", world);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <PageShell variant={activeWorld}>
      <main id="main-content" className="property-page">
        <ViewedItemTracker id={property.slug} world={activeWorld} name={property.name} location={`${property.location}, ${property.area}`} image={property.image} href={`/business?id=${property.slug}${activeWorld === offerings[0].world ? "" : `&mode=${activeWorld}`}`} meta={`${property.type} · עד ${property.guests} אורחים`} />
        <BreadcrumbTrail items={activeWorld === "events"
          ? [{ name: "ראשי", path: "/" }, { name: "אירועים", path: "/events" }, { name: "מקומות לאירועים", path: "/events/search" }, { name: property.name }]
          : activeWorld === "spa"
            ? [{ name: "ראשי", path: "/" }, { name: "בתי ספא", path: "/spas" }, { name: property.name }]
            : activeWorld === "hourly"
              ? [{ name: "ראשי", path: "/" }, { name: "חדרים לפי שעה", path: "/hourly" }, { name: property.name }]
              : [{ name: "ראשי", path: "/" }, { name: "נופש", path: "/search" }, vacationBreadcrumbForLocation(property.area), { name: property.name }]} />

        <section className="shell property-title">
          <div><span className="eyebrow">{property.type} · {activeOffering.label}</span><h1>{property.name}</h1><p><PinIcon />{property.location}, {property.area}</p>{property.demoOperations?.fictional ? <SampleListingDisclosure /> : null}</div>
          <div className="property-title__side">
            <div className="property-title__actions">
              <FavoriteButton compact={false} id={property.slug} world={activeWorld} name={property.name} location={`${property.location}, ${property.area}`} image={property.image} href={`/business?id=${property.slug}${activeWorld === offerings[0].world ? "" : `&mode=${activeWorld}`}`} meta={`${property.type} · עד ${property.guests} אורחים`} />
              <ShareButton title={property.name} />
              {property.demoOperations?.fictional && !vacationOnlineReady ? <ListingContactPreview placeName={property.name} className="listing-contact-preview--title" /> : null}
              {phoneHref ? <a className="property-phone-action" href={phoneHref}>{translate("טלפון")} <span dir="ltr">{property.contact?.phone}</span></a> : null}
              {ownerWhatsapp ? <WhatsAppLeadButton world={activeWorld} placeId={property.slug} placeName={property.name} businessPhone={ownerWhatsapp} serviceName={activeOffering.label} initialDate={dateRange.from} initialGuests={guests} buttonClassName="property-whatsapp-action" /> : null}
            </div>
            {activeWorld === "vacation" ? null : onlineBooking ? <Link className="button primary" href={bookingActionHref}>הזמנה אונליין</Link> : property.contact?.phone ? <Link className="button primary" href="#booking-summary">טלפון להזמנה</Link> : null}
          </div>
        </section>

        {offerings.length > 1 ? <section className="shell multiworld-offerings" aria-labelledby="multiworld-title">
          <div><span className="eyebrow">מקום אחד, כמה אפשרויות</span><h2 id="multiworld-title">מה תרצו לעשות במקום?</h2><p>המידע על המקום נשאר זהה. הזמינות, המחיר ותהליך ההזמנה משתנים לפי הבחירה.</p></div>
          <div className="multiworld-offerings__options" role="group" aria-label="בחירת סוג הזמנה">
            {offerings.map((offering) => <button key={offering.world} type="button" aria-pressed={activeWorld === offering.world} className={activeWorld === offering.world ? "active" : ""} onClick={() => chooseWorld(offering.world)}><span>{worldLabels[offering.world]}</span><strong>{offering.label}</strong><small>{offering.summary}</small></button>)}
          </div>
        </section> : null}

        <section className="shell property-gallery">{property.images.slice(0, 5).map((image, index) => <button key={image} type="button" data-gallery-trigger aria-label={`פתיחת גלריית ${property.name}, תמונה ${index + 1}`} onClick={() => openGallery("all", index)}><img src={image} alt={`${property.name}, תמונת המקום ${index + 1}`} title={`${property.name}, תמונת המקום ${index + 1}`} />{index === 4 && <span>לגלריה המלאה</span>}</button>)}</section>

        {property.demoOperations?.fictional && property.videos?.[0] ? <section className="shell palumbo-media-story" aria-labelledby="palumbo-media-title">
          <header><div><span className="eyebrow">הסיפור המלא של המקום</span><h2 id="palumbo-media-title">רואים את הווילה לפני שבוחרים</h2><p>סיור מלא, חדרים, חללים ותמונות אורחים במקום אחד.</p></div><button type="button" data-gallery-trigger className="button secondary" onClick={() => openGallery("all", 0)}>פתיחת הגלריה המלאה</button></header>
          <div className="palumbo-media-story__grid">
            <article className="palumbo-media-story__video"><video controls playsInline preload="metadata" poster={property.videos[0].poster} aria-label={property.videos[0].title}><source src={property.videos[0].src} type="video/mp4" /></video><div><span>סיור בווידאו</span><h3>{property.videos[0].title}</h3><p>עוברים בין החללים ומכירים את מבנה הווילה לפני הבחירה.</p></div></article>
            <aside className="palumbo-media-story__guests"><div className="palumbo-media-story__guests-heading"><span className="eyebrow">גלריית אורחים</span><h3>רגעים מהאירוח</h3><p>תמונות אורחים מוצגות לאחר אימות ואישור לפרסום.</p></div><div>{property.guestPhotos?.map((photo) => <button type="button" data-gallery-trigger key={photo.src} onClick={() => openGallery("guests", 0)}><img src={photo.src} alt={photo.alt} title={photo.alt} /><span>{photo.author}</span></button>)}</div></aside>
          </div>
        </section> : null}

        <DetailStickyDock
          name={property.name}
          location={`${property.location}, ${property.area}`}
          sections={sectionLinks}
          onlineHref={activeWorld === "vacation" ? undefined : onlineBooking || vacationPhoneFallback ? bookingActionHref : undefined}
          onlineLabel={activeWorld === "events" ? "בדיקת תאריך לאירוע" : "הזמנה אונליין"}
          phone={phoneBooking ? property.contact?.phone : undefined}
        />

        <div className={`shell property-layout ${activeWorld === "vacation" ? "property-layout--vacation" : ""}`}>
          <div className="property-content">
            <section className="property-facts" aria-label="עיקרי המקום">
              <div><b>{property.guests}</b><span>אורחים לכל היותר</span></div>
              {property.bedrooms && <div><b>{property.bedrooms}</b><span>חדרי שינה</span></div>}
              {property.scenario === "multi" && property.units ? <div><b>{property.units}</b><span>יחידות אירוח</span></div> : <div><b>שלם</b><span>המקום כולו</span></div>}
              <div><b>{property.features.length}</b><span>מאפיינים מרכזיים</span></div>
            </section>

            <section id="about" className="property-about"><span className="eyebrow">תיאור מקום האירוח</span><h2>על {property.name}</h2><p>{property.description}</p><div className="feature-chips audience-chips">{property.audiences.map((audience) => <span key={audience}>מתאים ל{audience}</span>)}</div>{highlights.length ? <div className="property-highlights" aria-label="הדברים הבולטים במקום">{highlights.map((highlight) => <article key={highlight.label}><PropertyHighlightIcon icon={highlight.icon} /><strong>{highlight.label}</strong></article>)}</div> : null}</section>

            {activeWorld === "vacation" ? <VacationBookingHub
              property={property}
              dates={displayDates}
              from={dateRange.from}
              till={dateRange.till}
              guests={guests}
              selectedPrice={resolvedSelectedPrice}
              availability={resolvedAvailability}
              bookingHref={`/booking?${bookingQuery}`}
              ownerWhatsapp={ownerWhatsapp}
              phoneHref={phoneHref}
              illustrative={initialIllustrative || Boolean(resolvedAvailability?.illustrative)}
              onOpenCalendar={() => setCalendarOpen(true)}
              onGuestsChange={setGuests}
            /> : null}

            {property.roomOptions?.length ? <section id="rooms" className="units-section">
              <div className="units-heading">
                <div><span className="eyebrow">מבנה מקום האירוח</span><h2>{property.scenario === "single" ? "המקום שמזמינים" : "הסוויטות והיחידות"}</h2></div>
                <span className="units-total">{property.scenario === "single" ? "מקום אירוח שלם" : roomQuantity === 1 ? "יחידת אירוח אחת" : `${roomQuantity} יחידות אירוח`}</span>
              </div>
              <div className="room-card-list">
                {property.roomOptions.map((room, roomIndex) => {
                  // A place sold as one whole property has one live quote. Its
                  // editorial room entry is descriptive, not a separately priced
                  // inventory unit, so it must reuse that quote.
                  const roomAvailability = property.scenario === "single" && usesLiveLegacyAvailability
                    ? resolvedAvailability
                    : resolvedAvailability?.units?.find((unit) => unit.index === roomIndex);
                  const roomAvailable = roomAvailability?.availability === "available";
                  const roomUnavailable = roomAvailability?.availability === "unavailable";
                  const roomNightlyPrice = roomAvailability?.nightlyPrice || 0;
                  const roomTotalPrice = (roomAvailability && "totalPrice" in roomAvailability ? roomAvailability.totalPrice : undefined) || (roomNightlyPrice && dateRange.from && dateRange.till ? roomNightlyPrice * Math.max(1, Math.round((Date.parse(`${dateRange.till}T12:00:00`) - Date.parse(`${dateRange.from}T12:00:00`)) / 86_400_000)) : 0);
                  const unitGalleryStart = property.roomOptions!.slice(0, roomIndex).reduce((total, option) => total + (option.images?.length || 1), 0);
                  return <article className={`room-card${roomAvailable ? " room-card--available" : roomUnavailable ? " room-card--unavailable" : ""}`} key={room.name}>
                  <button className="room-card__image" type="button" data-gallery-trigger onClick={() => openGallery("units", unitGalleryStart)} aria-label={`פתיחת גלריית ${room.name}`}><img src={room.image} alt={`${room.name} ב${property.name}`} title={`${room.name} ב${property.name}`} loading="lazy" /><span>{property.scenario === "single" ? "המקום כולו" : room.images?.length ? `${room.images.length} תמונות` : room.quantity === 1 ? "יחידה אחת" : `${room.quantity} יחידות`}</span></button>
                  <div className="room-card__body">
                    <div className="room-card__title"><div><span>{property.type}</span><h3>{room.name}</h3></div><b>עד {room.guests} אורחים</b></div>
                    <div className="room-card__facts"><span>{bedroomLabel(room.bedrooms)}</span>{room.area ? <span>{room.area} מ״ר</span> : null}</div>
                    <div className="room-card__features">{room.features.map((feature) => <span key={feature}>{feature}</span>)}</div>
                    {property.sleepingArrangements?.length ? <div className="room-card__sleeping room-card__sleeping--linked"><div><strong>חדרי השינה במקום</strong><span>{bedroomLabel(room.bedrooms)}</span></div><a href="#sleeping">לצפייה בפירוט החדרים, המיטות והתמונות</a></div> : <div className="room-card__sleeping"><div><strong>חדרי השינה בתוך היחידה</strong><span>{bedroomLabel(room.bedrooms)}</span></div>{bedDetails(room.features).length ? <div className="room-card__bed-list">{bedDetails(room.features).map((detail) => <span key={detail}>{detail}</span>)}</div> : <small>סוג המיטה טרם פורט במידע שנמסר על היחידה.</small>}</div>}
                    {activeWorld === "vacation" && hasSelectedDates ? <div className="room-card__availability" role="status"><strong>{roomAvailable ? unitCopy.available : roomUnavailable ? unitCopy.unavailable : unitCopy.confirm}</strong>{roomNightlyPrice ? <span>{roomNightlyPrice.toLocaleString(numberLocale)} ₪ {unitCopy.perNight}{roomTotalPrice ? ` · ${roomTotalPrice.toLocaleString(numberLocale)} ₪ ${unitCopy.total}` : ""}</span> : null}</div> : null}
                    <div className="room-card__actions"><button className="button subtle room-card__more" type="button" onClick={() => setSelectedRoomIndex(roomIndex)}>כל פרטי היחידה +</button>{activeWorld === "vacation"
                      ? roomAvailable && roomNightlyPrice ? <Link className="button primary" href={roomBookingHref(bookingQuery, roomIndex, roomNightlyPrice)}>{unitCopy.quick} {translate(room.name)}</Link>
                        : roomUnavailable ? <button className="button secondary" type="button" onClick={() => setCalendarOpen(true)}>{unitCopy.otherDate}</button>
                          : <button className="button secondary" type="button" onClick={() => setCalendarOpen(true)}>{hasSelectedDates ? `${unitCopy.check} ${translate(room.name)}` : `${unitCopy.dates} ${translate(room.name)}`}</button>
                      : onlineBooking ? <Link className="button primary" href={bookingActionHref}>הזמנה אונליין</Link> : phoneHref ? <Link className="button primary" href="#booking-summary">טלפון להזמנה</Link> : null}</div>
                  </div>
                </article>;
                })}
              </div>
            </section> : null}

            {property.sleepingArrangements?.length ? <SleepingArrangements placeName={property.name} arrangements={property.sleepingArrangements} /> : property.bedrooms ? <section id="sleeping" className="sleeping-summary" aria-labelledby="sleeping-summary-title"><span className="eyebrow">חדרי שינה אינם יחידות אירוח</span><h2 id="sleeping-summary-title">איפה ישנים?</h2><p>{property.scenario === "multi" ? `במתחם יש ${property.units || roomQuantity} יחידות אירוח ובהן ${property.bedrooms} חדרי שינה בסך הכול. פירוט השינה מופיע בתוך כל כרטיס יחידה.` : `במקום יש ${property.bedrooms} חדרי שינה. סוגי המיטות ותמונות החדרים יוצגו כאן לאחר שיוך ואימות מול נתוני המקום.`}</p></section> : null}

            <section id="features" className="feature-section">
              <span className="eyebrow">מאפייני המתחם</span>
              <h2>מה מחכה לכם במקום</h2>
              <div className="feature-section__mobile-preview" aria-label="הדברים הבולטים במקום">
                {mobileFeaturePreview.map((feature) => <span key={feature}><b aria-hidden="true">✓</b>{feature}</span>)}
              </div>
              <div className="property-feature-groups">{featureGroups.map((group) => <article key={group.title}><h3>{group.title}</h3><div className="feature-list">{group.items.map((feature) => <span key={feature}>✓ {feature}</span>)}</div></article>)}</div>
              <div className={`feature-section__mobile-details ${mobileFeaturesOpen ? "is-open" : ""}`}>
                <button className="feature-section__mobile-toggle" type="button" aria-expanded={mobileFeaturesOpen} aria-controls="mobile-feature-groups" onClick={() => setMobileFeaturesOpen((open) => !open)}>כל המידע על המתקנים</button>
                <div id="mobile-feature-groups" className="feature-section__mobile-groups" hidden={!mobileFeaturesOpen}>{featureGroups.map((group) => <section key={group.title}><h3>{group.title}</h3><div>{group.items.map((feature) => <span key={feature}>✓ {feature}</span>)}</div></section>)}</div>
              </div>
              <button className="button subtle feature-section__desktop-more" type="button" onClick={() => setAllFeaturesOpen(true)}>כל המידע על המתקנים</button>
            </section>

            <ListingAccessibility slug={property.slug} />

            <section id="location" className="location-card"><div><span className="eyebrow">המיקום</span><h2>{property.location}</h2><p>{property.area}</p><span className="location-card__inline-note">מגדילים, מקטינים ומזיזים את המפה כאן בעמוד.</span></div><ListingMap listings={[property]} single /></section>

            <section id="faq" className="faq-section"><span className="eyebrow">כל מה שחשוב לפני שמזמינים</span><h2>שאלות ותשובות</h2>{propertyFaq.map((item, index) => <article key={item.question} className={openFaq === index ? "open" : ""}><button type="button" aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>{item.question}</span><b>{openFaq === index ? "−" : "+"}</b></button>{openFaq === index && <p>{item.answer}</p>}</article>)}</section>

            <GuestReviewStudio placeName={property.name} subjectId={property.slug} rating={property.score} reviewCount={property.reviews} publishedReviews={property.reviewHighlights} illustrative={property.reviewSource === "fictional-demo"} open={reviewOpen} onClose={() => setReviewOpen(false)} onOpenGallery={() => openGallery("guests", 0)} />

            <section id="policies" className="policies-section"><span className="eyebrow">חשוב לדעת</span><h2>כללים ותנאי הזמנה</h2><div><article><b>כניסה ויציאה</b><p>שעות הכניסה והיציאה יוצגו לפי המקום והתאריך במנוע ההזמנות.</p></article><article><b>מחיר ותשלום</b><p>המחיר הסופי תלוי בתאריכים, בהרכב וביחידה שנבחרה.</p></article><article><b>ביטול ושינויים</b><p>התנאים המחייבים יוצגו לפני השלמת ההזמנה.</p></article><article><b>מידע על המקום</b><p>פרטי המקום והתמונות נבדקו כחלק מהכנת העמוד.</p></article></div></section>
            {property.demoOperations?.fictional ? <section className="palumbo-practical" aria-labelledby="palumbo-practical-title"><span className="eyebrow">מידע מעשי</span><h2 id="palumbo-practical-title">כל מה שצריך לדעת לפני ההזמנה</h2><div><article><strong>15:00</strong><span>כניסה החל משעה זו</span></article><article><strong>11:00</strong><span>עזיבה עד שעה זו</span></article><article><strong>2 לילות</strong><span>מינימום להזמנה</span></article><article><strong>8 אורחים</strong><span>תפוסה מרבית</span></article></div></section> : null}
          </div>

        {activeWorld === "vacation" ? null : !onlineBooking && phoneHref ? <aside className="booking-card booking-card--phone"><span className="eyebrow">הזמנה בטלפון</span><h2>מדברים ישירות עם המקום</h2><p>הצוות בודק את התאריך, ההרכב והמחיר בשיחה אחת.</p><a className="button primary wide" href={phoneHref}>חיוג להזמנה</a><small>ההזמנה סופית רק לאחר אישור המקום.</small></aside> : activeWorld === "events" ? <aside className="booking-card booking-card--event"><span className="eyebrow">הזמנת אירוע</span><h2>בוחרים תאריך והרכב</h2><label>תאריך האירוע<input type="date" /></label><label>כמות משתתפים<input type="number" min="1" max={activeOffering.maxGuests} placeholder="כמה משתתפים צפויים?" /></label>{activeOffering.eventTypes?.length ? <ModernSelect label="סוג האירוע" defaultValue={activeOffering.eventTypes[0]} options={activeOffering.eventTypes.map((eventType) => ({ value: eventType, label: eventType }))} /> : null}<div className="booking-facts"><span>ההזמנה נבדקת לפי סוג האירוע</span><span>האירוח והאירוע מנוהלים בנפרד</span></div><div className="booking-card__actions"><Link className="button primary wide" href={`/booking?${bookingQuery}`}>המשך להזמנה אונליין</Link>{phoneBooking && phoneHref ? <a className="button secondary wide" href={phoneHref}>או חיוג למקום</a> : null}</div><small>הזמינות, המחיר וכללי המקום לאירוע מאושרים לפני חיוב.</small></aside> : <aside id="booking-summary" className={`booking-card ${vacationRequest ? "booking-card--request" : "booking-card--instant"}`}><span className="eyebrow">{vacationRequest ? "בדיקת זמינות במתחם" : "הזמנה אונליין"}</span><h2>{vacationRequest ? hasSelectedDates ? "בודקים את החופשה שבחרתם" : "מתי תרצו להתארח?" : property.scenario === "single" ? "סיכום השהייה" : "תאריכים והרכב"}</h2><p className="booking-card__lead">{vacationRequest ? hasSelectedDates ? "התאריכים והרכב האורחים נשמרו מהחיפוש. אפשר לשנות אותם או לשלוח בקשת זמינות מסודרת." : "בחרו תאריכים וכמות אורחים. לאחר הבחירה תוכלו לשלוח למקום בקשת זמינות מסודרת." : "הזמינות והמחיר מחוברים למנוע ההזמנות של המקום."}</p><div className="booking-card__selection"><button type="button" className="date-choice" onClick={() => setCalendarOpen(true)}><CalendarIcon /><span><small>תאריכי השהייה</small><strong>{displayDates}</strong></span></button></div><label className="booking-guests">כמות אורחים<input type="number" min="1" max={activeOffering.maxGuests || property.guests} value={guests} onChange={(event) => setGuests(Math.max(1, Number(event.target.value) || 1))} /></label><div className="booking-facts"><span>עד {activeOffering.maxGuests || property.guests} אורחים</span>{property.bedrooms && <span>{property.bedrooms} חדרי שינה</span>}</div><div className="booking-card__actions"><Link className="button primary wide" href={`/booking?${bookingQuery}`}>המשך להזמנה</Link></div></aside>}
        </div>

        <section className="section property-complements">
          <div className="shell">
            <div className="section-head">
              <div><span className="eyebrow">משלימים את החופשה</span><h2>מה אפשר לעשות מסביב</h2></div>
              <span className="section-head__links"><Link href="/trails">למסלולי טיול</Link><Link href="/attractions">לאטרקציות</Link></span>
            </div>
            <p className="property-complements__note">רעיונות לבילוי ולטיול באזור מקום האירוח. בכל הצעה תוכלו לראות את הפרטים ואת דרך ההזמנה.</p>
            <div className="discovery-grid discovery-grid--compact">{complements.map((item) => <DiscoveryCard key={`${item.world}-${item.id}`} item={item} />)}</div>
            <div className="property-nearby-trails"><div className="section-head"><div><span className="eyebrow">טיול עצמאי ליד מקום האירוח</span><h2>מסלולים באזור</h2><p>ההתאמה נעשית לפי אזור כללי. המרחק המדויק והמצב בשטח נבדקים לפני היציאה.</p></div><Link href="/trails">לכל המסלולים</Link></div><div className="trail-grid trail-grid--business">{localTrails.map((trail) => <TrailCard key={trail.slug} trail={trail} compact />)}</div></div>
          </div>
        </section>

        <div className="section shell"><MasuExperience context={activeWorld === "events" ? "event" : "stay"} /></div>

        <section className="section section-tint"><div className="shell"><div className="section-head"><h2>מקומות נוספים שיכולים להתאים</h2></div><div className="card-grid">{properties.filter((item) => item.slug !== property.slug).slice(0, 3).map((item) => <PropertyCard key={item.slug} property={item} promotional />)}</div></div></section>
      </main>

      <CalendarDemo mode="business" businessKind={property.scenario} businessName={property.name} open={calendarOpen && activeWorld === "vacation"} onClose={() => setCalendarOpen(false)} availabilityResolver={property.demoOperations?.fictional ? demoAvailabilityForDate : undefined} priceResolver={property.demoOperations?.fictional ? (date) => demoNightlyPrice(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`, property.demoOperations!.weekdayNightlyPrice, property.demoOperations!.weekendNightlyPrice) : undefined} onConfirm={(result) => { const from = result.checkIn || ""; setDates(result.summary); setDateRange({ from, till: result.checkOut || "" }); setSelectedPrice(property.demoOperations?.fictional && from ? String(demoNightlyPrice(from, property.demoOperations.weekdayNightlyPrice, property.demoOperations.weekendNightlyPrice)) : ""); }} />

      <GalleryExperience key={`${property.slug}-${galleryOpen ? `${galleryTab}-${galleryStart}` : "closed"}`} property={property} guestPhotos={property.guestPhotos} open={galleryOpen} initialIndex={galleryStart} initialTab={galleryTab} onAddGuestContent={() => { closeGallery(); setReviewOpen(true); }} onSelectionChange={updateGallerySelection} onClose={closeGallery} />
      <UnitDetailsDialog propertyName={property.name} room={selectedRoomIndex === null ? null : property.roomOptions?.[selectedRoomIndex] || null} open={selectedRoomIndex !== null} onClose={closeUnitDetails} onOpenGallery={() => { if (selectedRoomIndex === null || !property.roomOptions) return; const start = property.roomOptions.slice(0, selectedRoomIndex).reduce((total, room) => total + (room.images?.length || 1), 0); closeUnitDetails(); window.setTimeout(() => openGallery("units", start), 0); }} />

      {allFeaturesOpen && <div className="simple-modal" onMouseDown={(event) => event.target === event.currentTarget && setAllFeaturesOpen(false)}><section role="dialog" aria-modal="true" aria-labelledby="features-title"><header><h2 id="features-title">המתקנים של {property.name}</h2><button type="button" onClick={() => setAllFeaturesOpen(false)}>סגירה</button></header><div className="modal-feature-groups">{featureGroups.map((group) => <section key={group.title}><h3>{group.title}</h3><div className="feature-list modal-features">{group.items.map((feature) => <span key={feature}>✓ {feature}</span>)}</div></section>)}</div><p>המידע המוצג נבדק כחלק מהכנת עמוד המקום.</p></section></div>}
    </PageShell>
  );
}
