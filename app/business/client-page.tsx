"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
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

function formatInitialStay(from?: string, till?: string) {
  if (!from || !till) return "בחרו תאריכים";
  const arrival = new Date(`${from}T12:00:00`);
  const departure = new Date(`${till}T12:00:00`);
  if (Number.isNaN(arrival.getTime()) || Number.isNaN(departure.getTime())) return "בחרו תאריכים";
  const format = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric" });
  return `${format.format(arrival)} עד ${format.format(departure)}`;
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
export default function BusinessPage({ initialSlug, initialWorld = "vacation", initialDates, initialFrom, initialTill, initialGuests = "2", initialRooms = "1", initialPrice, initialIllustrative = false, initialSource }: { initialSlug: string; initialWorld?: BusinessWorld; initialDates?: string; initialFrom?: string; initialTill?: string; initialGuests?: string; initialRooms?: string; initialPrice?: string; initialIllustrative?: boolean; initialSource?: string }) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dates, setDates] = useState(initialDates || formatInitialStay(initialFrom, initialTill));
  const [dateRange, setDateRange] = useState({ from: initialFrom || "", till: initialTill || "" });
  const [guests, setGuests] = useState(Math.max(1, Number(initialGuests) || 2));
  const [selectedPrice, setSelectedPrice] = useState(initialPrice || "");
  const rooms = Math.max(1, Number(initialRooms) || 1);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryStart, setGalleryStart] = useState(0);
  const [galleryTab, setGalleryTab] = useState<"all" | "guests">("all");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [allFeaturesOpen, setAllFeaturesOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
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
  const hasSearchContext = initialSource === "search" && Boolean(initialDates || hasSelectedDates);
  const selectedStay = hasSelectedDates ? { from: dateRange.from, till: dateRange.till } : null;
  const liveLegacyAvailability = useLegacyAvailability(property, selectedStay);
  const resolvedAvailability = liveLegacyAvailability || resolveAvailabilityForStay(property, selectedStay, "/business", null);
  const resolvedSelectedPrice = selectedPrice || (resolvedAvailability?.nightlyPrice ? String(resolvedAvailability.nightlyPrice) : "");
  const hasSelectedPrice = Boolean(resolvedSelectedPrice && Number(resolvedSelectedPrice) > 0);
  const vacationOnlineReady = activeWorld === "vacation" && hasSelectedDates && resolvedAvailability?.availability === "available" && hasSelectedPrice;
  const vacationPhoneFallback = activeWorld === "vacation" && !vacationOnlineReady;
  const vacationRequest = activeWorld === "vacation" && !vacationOnlineReady;
  const onlineBooking = activeWorld === "vacation" ? vacationOnlineReady : activeOffering.bookingMode !== "call-only";
  const phoneBooking = activeOffering.bookingMode === "call-only" || activeOffering.bookingMode === "online-or-call";
  const phoneHref = property.contact?.phone ? `tel:${property.contact.phone.replace(/[^\d+]/g, "")}` : undefined;
  const bookingQuery = new URLSearchParams({ world: activeWorld, place: property.slug, ...(dateRange.from ? { from: dateRange.from } : {}), ...(dateRange.till ? { till: dateRange.till } : {}), guests: String(guests), ...(resolvedSelectedPrice ? { price: resolvedSelectedPrice } : {}), ...(initialIllustrative || resolvedAvailability?.illustrative ? { illustrative: "1" } : {}) }).toString();
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
              {ownerWhatsapp && activeWorld !== "vacation" ? <WhatsAppLeadButton world={activeWorld} placeId={property.slug} placeName={property.name} businessPhone={ownerWhatsapp} serviceName={activeOffering.label} initialDate={dateRange.from} initialGuests={guests} buttonClassName="property-whatsapp-action" /> : null}
            </div>
            {activeWorld === "vacation" ? null : onlineBooking ? <Link className="button primary" href={bookingActionHref}>הזמנה אונליין</Link> : property.contact?.phone ? <Link className="button primary" href="#booking-summary">טלפון להזמנה</Link> : null}
          </div>
        </section>

        {hasSearchContext && activeWorld === "vacation" ? <section className="search-context-summary shell" aria-label="החיפוש שממנו הגעתם">
          <div><span>החיפוש שבחרתם</span><strong>{dates}</strong><small>{guests} אורחים · {rooms} {rooms === 1 ? "חדר" : "חדרים"}</small></div>

        </section> : null}

        {offerings.length > 1 ? <section className="shell multiworld-offerings" aria-labelledby="multiworld-title">
          <div><span className="eyebrow">מקום אחד, כמה אפשרויות</span><h2 id="multiworld-title">מה תרצו לעשות במקום?</h2><p>המידע על המקום נשאר זהה. הזמינות, המחיר ותהליך ההזמנה משתנים לפי הבחירה.</p></div>
          <div className="multiworld-offerings__options" role="group" aria-label="בחירת סוג הזמנה">
            {offerings.map((offering) => <button key={offering.world} type="button" aria-pressed={activeWorld === offering.world} className={activeWorld === offering.world ? "active" : ""} onClick={() => chooseWorld(offering.world)}><span>{worldLabels[offering.world]}</span><strong>{offering.label}</strong><small>{offering.summary}</small></button>)}
          </div>
        </section> : null}

        <section className="shell property-gallery">{property.images.slice(0, 5).map((image, index) => <button key={image} type="button" aria-label={`פתיחת גלריית ${property.name}, תמונה ${index + 1}`} onClick={() => { setGalleryTab("all"); setGalleryStart(index); setGalleryOpen(true); }}><img src={image} alt={`${property.name}, תמונה ${index + 1}`} />{index === 4 && <span>לגלריה המלאה</span>}</button>)}</section>

        {property.demoOperations?.fictional && property.videos?.[0] ? <section className="shell palumbo-media-story" aria-labelledby="palumbo-media-title">
          <header><div><span className="eyebrow">הסיפור המלא של המקום</span><h2 id="palumbo-media-title">רואים את הווילה לפני שבוחרים</h2><p>סיור מלא, חדרים, חללים ותמונות אורחים במקום אחד.</p></div><button type="button" className="button secondary" onClick={() => { setGalleryTab("all"); setGalleryStart(0); setGalleryOpen(true); }}>פתיחת הגלריה המלאה</button></header>
          <div className="palumbo-media-story__grid">
            <article className="palumbo-media-story__video"><video controls playsInline preload="metadata" poster={property.videos[0].poster} aria-label={property.videos[0].title}><source src={property.videos[0].src} type="video/mp4" /></video><div><span>סיור בווידאו</span><h3>{property.videos[0].title}</h3><p>עוברים בין החללים ומכירים את מבנה הווילה לפני הבחירה.</p></div></article>
            <aside className="palumbo-media-story__guests"><div className="palumbo-media-story__guests-heading"><span className="eyebrow">גלריית אורחים</span><h3>רגעים מהאירוח</h3><p>תמונות אורחים מוצגות לאחר אימות ואישור לפרסום.</p></div><div>{property.guestPhotos?.map((photo) => <button type="button" key={photo.src} onClick={() => { setGalleryTab("guests"); setGalleryStart(0); setGalleryOpen(true); }}><img src={photo.src} alt={photo.alt} /><span>{photo.author}</span></button>)}</div></aside>
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

        {activeWorld === "vacation" ? <VacationBookingHub
          property={property}
          dates={dates}
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

        <div className={`shell property-layout ${activeWorld === "vacation" ? "property-layout--vacation" : ""}`}>
          <div className="property-content">
            <section className="property-facts" aria-label="עיקרי המקום">
              <div><b>{property.guests}</b><span>אורחים לכל היותר</span></div>
              {property.bedrooms && <div><b>{property.bedrooms}</b><span>חדרי שינה</span></div>}
              {property.scenario === "multi" && property.units ? <div><b>{property.units}</b><span>יחידות אירוח</span></div> : <div><b>שלם</b><span>המקום כולו</span></div>}
              <div><b>{property.features.length}</b><span>מאפיינים מרכזיים</span></div>
            </section>

            <section id="about" className="property-about"><span className="eyebrow">תיאור מקום האירוח</span><h2>על {property.name}</h2><p>{property.description}</p><div className="feature-chips audience-chips">{property.audiences.map((audience) => <span key={audience}>מתאים ל{audience}</span>)}</div>{highlights.length ? <div className="property-highlights" aria-label="הדברים הבולטים במקום">{highlights.map((highlight) => <article key={highlight.label}><PropertyHighlightIcon icon={highlight.icon} /><strong>{highlight.label}</strong></article>)}</div> : null}</section>

            {property.roomOptions?.length ? <section id="rooms" className="units-section">
              <div className="units-heading">
                <div><span className="eyebrow">מבנה מקום האירוח</span><h2>{property.scenario === "single" ? "המקום שמזמינים" : "הסוויטות והיחידות"}</h2></div>
                <span className="units-total">{property.scenario === "single" ? "מקום אירוח שלם" : roomQuantity === 1 ? "יחידת אירוח אחת" : `${roomQuantity} יחידות אירוח`}</span>
              </div>
              <p>{property.scenario === "single" ? "זהו מקום אירוח שמוזמן בשלמותו. פירוט חדרי השינה מוצג בנפרד ואינו נחשב ליחידות אירוח נוספות." : "כל כרטיס מייצג יחידת אירוח נפרדת. בתוך כל יחידה מוצג בנפרד מספר חדרי השינה וסידור המיטות שנמסר עבורה."}</p>
              <div className="room-card-list">
                {property.roomOptions.map((room) => <article className="room-card" key={room.name}>
                  <div className="room-card__image"><img src={room.image} alt={`${room.name} ב${property.name}`} loading="lazy" /><span>{property.scenario === "single" ? "המקום כולו" : room.quantity === 1 ? "יחידה אחת" : `${room.quantity} יחידות`}</span></div>
                  <div className="room-card__body">
                    <div className="room-card__title"><div><span>{property.type}</span><h3>{room.name}</h3></div><b>עד {room.guests} אורחים</b></div>
                    <div className="room-card__facts"><span>{bedroomLabel(room.bedrooms)}</span>{room.area ? <span>{room.area} מ״ר</span> : null}</div>
                    <div className="room-card__features">{room.features.map((feature) => <span key={feature}>{feature}</span>)}</div>
                    {property.sleepingArrangements?.length ? <div className="room-card__sleeping room-card__sleeping--linked"><div><strong>חדרי השינה במקום</strong><span>{bedroomLabel(room.bedrooms)}</span></div><a href="#sleeping">לצפייה בפירוט החדרים, המיטות והתמונות</a></div> : <div className="room-card__sleeping"><div><strong>חדרי השינה בתוך היחידה</strong><span>{bedroomLabel(room.bedrooms)}</span></div>{bedDetails(room.features).length ? <div className="room-card__bed-list">{bedDetails(room.features).map((detail) => <span key={detail}>{detail}</span>)}</div> : <small>סוג המיטה טרם פורט במידע שנמסר על היחידה.</small>}</div>}
                    <div className="room-card__actions">{activeWorld === "vacation" ? null : onlineBooking ? <Link className="button primary" href={bookingActionHref}>הזמנה אונליין</Link> : phoneHref ? <Link className="button primary" href="#booking-summary">טלפון להזמנה</Link> : null}</div>
                  </div>
                </article>)}
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
              <details className="feature-section__mobile-details">
                <summary>כל המידע על המתקנים</summary>
                <div className="feature-section__mobile-groups">{featureGroups.map((group) => <section key={group.title}><h3>{group.title}</h3><div>{group.items.map((feature) => <span key={feature}>✓ {feature}</span>)}</div></section>)}</div>
              </details>
              <button className="button subtle feature-section__desktop-more" type="button" onClick={() => setAllFeaturesOpen(true)}>כל המידע על המתקנים</button>
            </section>

            <ListingAccessibility slug={property.slug} />

            <section id="location" className="location-card"><div><span className="eyebrow">המיקום</span><h2>{property.location}</h2><p>{property.area}</p><span className="location-card__inline-note">מגדילים, מקטינים ומזיזים את המפה כאן בעמוד.</span></div><ListingMap listings={[property]} single /></section>

            <section id="faq" className="faq-section"><span className="eyebrow">כל מה שחשוב לפני שמזמינים</span><h2>שאלות ותשובות</h2>{propertyFaq.map((item, index) => <article key={item.question} className={openFaq === index ? "open" : ""}><button type="button" aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>{item.question}</span><b>{openFaq === index ? "−" : "+"}</b></button>{openFaq === index && <p>{item.answer}</p>}</article>)}</section>

            <GuestReviewStudio placeName={property.name} subjectId={property.slug} rating={property.score} reviewCount={property.reviews} publishedReviews={property.reviewHighlights} illustrative={property.reviewSource === "fictional-demo"} open={reviewOpen} onClose={() => setReviewOpen(false)} onOpenGallery={() => { setGalleryTab("guests"); setGalleryStart(0); setGalleryOpen(true); }} />

            <section id="policies" className="policies-section"><span className="eyebrow">חשוב לדעת</span><h2>כללים ותנאי הזמנה</h2><div><article><b>כניסה ויציאה</b><p>שעות הכניסה והיציאה יוצגו לפי המקום והתאריך במנוע ההזמנות.</p></article><article><b>מחיר ותשלום</b><p>המחיר הסופי תלוי בתאריכים, בהרכב וביחידה שנבחרה.</p></article><article><b>ביטול ושינויים</b><p>התנאים המחייבים יוצגו לפני השלמת ההזמנה.</p></article><article><b>מידע על המקום</b><p>פרטי המקום והתמונות נבדקו כחלק מהכנת העמוד.</p></article></div></section>
            {property.demoOperations?.fictional ? <section className="palumbo-practical" aria-labelledby="palumbo-practical-title"><span className="eyebrow">מידע מעשי</span><h2 id="palumbo-practical-title">כל מה שצריך לדעת לפני ההזמנה</h2><div><article><strong>15:00</strong><span>כניסה החל משעה זו</span></article><article><strong>11:00</strong><span>עזיבה עד שעה זו</span></article><article><strong>2 לילות</strong><span>מינימום להזמנה</span></article><article><strong>8 אורחים</strong><span>תפוסה מרבית</span></article></div></section> : null}
          </div>

          {activeWorld === "vacation" ? null : activeWorld !== "vacation" && !onlineBooking && phoneHref ? <aside className="booking-card booking-card--phone"><span className="eyebrow">הזמנה בטלפון</span><h2>מדברים ישירות עם המקום</h2><p>הצוות בודק את התאריך, ההרכב והמחיר בשיחה אחת.</p><a className="button primary wide" href={phoneHref}>חיוג להזמנה</a><small>ההזמנה סופית רק לאחר אישור המקום.</small></aside> : activeWorld === "events" ? <aside className="booking-card booking-card--event"><span className="eyebrow">הזמנת אירוע</span><h2>בוחרים תאריך והרכב</h2><label>תאריך האירוע<input type="date" /></label><label>כמות משתתפים<input type="number" min="1" max={activeOffering.maxGuests} placeholder="כמה משתתפים צפויים?" /></label>{activeOffering.eventTypes?.length ? <ModernSelect label="סוג האירוע" defaultValue={activeOffering.eventTypes[0]} options={activeOffering.eventTypes.map((eventType) => ({ value: eventType, label: eventType }))} /> : null}<div className="booking-facts"><span>ההזמנה נבדקת לפי סוג האירוע</span><span>האירוח והאירוע מנוהלים בנפרד</span></div><div className="booking-card__actions"><Link className="button primary wide" href={`/booking?${bookingQuery}`}>המשך להזמנה אונליין</Link>{phoneBooking && phoneHref ? <a className="button secondary wide" href={phoneHref}>או חיוג למקום</a> : null}</div><small>הזמינות, המחיר וכללי המקום לאירוע מאושרים לפני חיוב.</small></aside> : <aside id="booking-summary" className={`booking-card ${vacationRequest ? "booking-card--request" : "booking-card--instant"}`}><span className="eyebrow">{vacationRequest ? "בדיקת זמינות במתחם" : "הזמנה אונליין"}</span><h2>{vacationRequest ? hasSelectedDates ? "בודקים את החופשה שבחרתם" : "מתי תרצו להתארח?" : property.scenario === "single" ? "סיכום השהייה" : "תאריכים והרכב"}</h2><p className="booking-card__lead">{vacationRequest ? hasSelectedDates ? "התאריכים והרכב האורחים נשמרו מהחיפוש. אפשר לשנות אותם או לשלוח בקשת זמינות מסודרת." : "בחרו תאריכים וכמות אורחים. לאחר הבחירה תוכלו לשלוח למקום בקשת זמינות מסודרת." : "הזמינות והמחיר מחוברים למנוע ההזמנות של המקום."}</p><div className="booking-card__selection"><button type="button" className="date-choice" onClick={() => setCalendarOpen(true)}><CalendarIcon /><span><small>תאריכי השהייה</small><strong>{dates}</strong></span></button></div><label className="booking-guests">כמות אורחים<input type="number" min="1" max={activeOffering.maxGuests || property.guests} value={guests} onChange={(event) => setGuests(Math.max(1, Number(event.target.value) || 1))} /></label><div className="booking-facts"><span>עד {activeOffering.maxGuests || property.guests} אורחים</span>{property.bedrooms && <span>{property.bedrooms} חדרי שינה</span>}</div><div className="booking-card__actions"><Link className="button primary wide" href={`/booking?${bookingQuery}`}>המשך להזמנה</Link></div></aside>}
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

      <GalleryExperience key={`${property.slug}-${galleryOpen ? `${galleryTab}-${galleryStart}` : "closed"}`} property={property} guestPhotos={property.guestPhotos} open={galleryOpen} initialIndex={galleryStart} initialTab={galleryTab} onAddGuestContent={() => { setGalleryOpen(false); setReviewOpen(true); }} onClose={() => setGalleryOpen(false)} />

      {allFeaturesOpen && <div className="simple-modal" onMouseDown={(event) => event.target === event.currentTarget && setAllFeaturesOpen(false)}><section role="dialog" aria-modal="true" aria-labelledby="features-title"><header><h2 id="features-title">המתקנים של {property.name}</h2><button type="button" onClick={() => setAllFeaturesOpen(false)}>סגירה</button></header><div className="modal-feature-groups">{featureGroups.map((group) => <section key={group.title}><h3>{group.title}</h3><div className="feature-list modal-features">{group.items.map((feature) => <span key={feature}>✓ {feature}</span>)}</div></section>)}</div><p>המידע המוצג נבדק כחלק מהכנת עמוד המקום.</p></section></div>}
    </PageShell>
  );
}
