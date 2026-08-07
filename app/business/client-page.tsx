"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDemo } from "../calendar-demo";
import { ListingMap } from "../components/listing-map";
import { PageShell } from "../components/page-shell";
import { PropertyCard } from "../components/property-card";
import { DiscoveryCard } from "../components/discovery-card";
import { ListingAccessibility } from "../components/listing-accessibility";
import { SleepingArrangements } from "../components/sleeping-arrangements";
import { getListingOfferings, properties, propertyFaq, type BusinessWorld } from "../data/site-data";
import { discoveryItems, type DiscoveryItem } from "../data/world-data";
import { nearbyTrails } from "../data/trail-data";
import { TrailCard } from "../components/trail-card";
import { GalleryExperience } from "../components/gallery-experience";
import { GuestReviewStudio } from "../components/guest-review-studio";
import { MasuExperience } from "../components/masu-experience";
import { DetailStickyDock, type DetailSectionLink } from "../components/detail-sticky-dock";
import { ModernSelect } from "../components/modern-select";
import { CalendarIcon, HeartIcon, PinIcon } from "../site-header";

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

const worldLabels: Record<BusinessWorld, string> = {
  vacation: "נופש ולינה",
  events: "אירועים",
  hourly: "שהייה לפי שעה",
  spa: "ספא",
};

function whatsappNumber(phone?: string) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  return digits;
}

export default function BusinessPage({ initialSlug, initialWorld = "vacation", initialDates, initialFrom, initialTill, initialGuests = "2", initialPrice }: { initialSlug: string; initialWorld?: BusinessWorld; initialDates?: string; initialFrom?: string; initialTill?: string; initialGuests?: string; initialPrice?: string }) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dates, setDates] = useState(initialDates || "בחרו תאריכים");
  const [dateRange, setDateRange] = useState({ from: initialFrom || "", till: initialTill || "" });
  const [guests, setGuests] = useState(Math.max(1, Number(initialGuests) || 2));
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [bookingNote, setBookingNote] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryStart, setGalleryStart] = useState(0);
  const [galleryTab, setGalleryTab] = useState<"all" | "guests">("all");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [allFeaturesOpen, setAllFeaturesOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
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
  const onlineBooking = activeOffering.bookingMode !== "call-only";
  const instantBooking = activeOffering.bookingMode === "instant-book";
  const vacationRequest = activeWorld === "vacation" && !instantBooking;
  const phoneBooking = activeOffering.bookingMode === "call-only" || activeOffering.bookingMode === "online-or-call";
  const phoneHref = property.contact?.phone ? `tel:${property.contact.phone.replace(/[^\d+]/g, "")}` : undefined;
  const bookingQuery = new URLSearchParams({ world: activeWorld, place: property.slug, ...(dateRange.from ? { from: dateRange.from } : {}), ...(dateRange.till ? { till: dateRange.till } : {}), guests: String(guests), ...(initialPrice ? { price: initialPrice } : {}) }).toString();
  const ownerWhatsapp = whatsappNumber(property.contact?.whatsapp || property.contact?.phone);
  const whatsappMessage = [
    "שלום, אני רוצה לשלוח בקשת הזמנה דרך VII.",
    `מקום: ${property.name}`,
    `תאריכים: ${dateRange.from && dateRange.till ? `${dateRange.from} עד ${dateRange.till}` : dates}`,
    `כמות אורחים: ${guests}`,
    ...(guestName.trim() ? [`שם: ${guestName.trim()}`] : []),
    ...(guestPhone.trim() ? [`טלפון לחזרה: ${guestPhone.trim()}`] : []),
    ...(bookingNote.trim() ? [`הערה: ${bookingNote.trim()}`] : []),
    "אשמח לקבל אישור זמינות ומחיר סופי.",
  ].join("\n");
  const whatsappHref = ownerWhatsapp ? `https://wa.me/${ownerWhatsapp}?text=${encodeURIComponent(whatsappMessage)}` : undefined;
  const bookingActionHref = vacationRequest ? "#booking-summary" : `/booking?${bookingQuery}`;
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
  const complements = useMemo(() => complementaryItems(property.area, property.location), [property.area, property.location]);
  const localTrails = useMemo(() => nearbyTrails(property.area, property.location, 6), [property.area, property.location]);

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

  function chooseWorld(world: BusinessWorld) {
    setWorldSelection({ slug: property.slug, world });
    const url = new URL(window.location.href);
    if (world === offerings[0].world) url.searchParams.delete("mode");
    else url.searchParams.set("mode", world);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
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
    <PageShell variant={activeWorld}>
      <main id="main-content" className="property-page">
        <div className="shell breadcrumbs"><Link href="/">ראשי</Link><span>/</span><Link href={`/search?location=${encodeURIComponent(property.area)}`}>{property.area}</Link><span>/</span><span>{property.name}</span></div>

        <section className="shell property-title">
          <div><span className="eyebrow">{property.type} · {activeOffering.label}</span><h1>{property.name}</h1><p><PinIcon />{property.location}, {property.area}</p></div>
          <div className="property-title__side">
            <div className="property-title__actions">
              <button type="button" aria-pressed={saved} onClick={toggleSaved}><HeartIcon filled={saved} />{saved ? "נשמר" : "שמירה"}</button>
              <button type="button" onClick={() => void share()}>שיתוף</button>
              {shareStatus && <span role="status">{shareStatus}</span>}
            </div>
            {onlineBooking ? <Link className="button primary" href={bookingActionHref}>{vacationRequest ? "בקשת הזמנה" : "הזמנה אונליין"}</Link> : property.contact?.phone ? <a className="button primary" href={`tel:${property.contact.phone.replace(/[^\d+]/g, "")}`}>הזמנה בטלפון</a> : null}
          </div>
        </section>

        {offerings.length > 1 ? <section className="shell multiworld-offerings" aria-labelledby="multiworld-title">
          <div><span className="eyebrow">מקום אחד, כמה אפשרויות</span><h2 id="multiworld-title">מה תרצו לעשות במקום?</h2><p>המידע על המקום נשאר זהה. הזמינות, המחיר ותהליך ההזמנה משתנים לפי הבחירה.</p></div>
          <div className="multiworld-offerings__options" role="group" aria-label="בחירת סוג הזמנה">
            {offerings.map((offering) => <button key={offering.world} type="button" aria-pressed={activeWorld === offering.world} className={activeWorld === offering.world ? "active" : ""} onClick={() => chooseWorld(offering.world)}><span>{worldLabels[offering.world]}</span><strong>{offering.label}</strong><small>{offering.summary}</small></button>)}
          </div>
        </section> : null}

        <section className="shell property-gallery">{property.images.slice(0, 5).map((image, index) => <button key={image} type="button" aria-label={`פתיחת גלריית ${property.name}, תמונה ${index + 1}`} onClick={() => { setGalleryTab("all"); setGalleryStart(index); setGalleryOpen(true); }}><img src={image} alt={`${property.name}, תמונה ${index + 1}`} />{index === 4 && <span>לגלריה המלאה</span>}</button>)}</section>

        <DetailStickyDock
          name={property.name}
          location={`${property.location}, ${property.area}`}
          sections={sectionLinks}
          onlineHref={onlineBooking ? bookingActionHref : undefined}
          onlineLabel={activeWorld === "events" ? "בדיקת תאריך לאירוע" : vacationRequest ? "סיכום ובקשת הזמנה" : "הזמנה אונליין"}
          phone={phoneBooking ? property.contact?.phone : undefined}
        />

        <div className="shell property-layout">
          <div className="property-content">
            <section className="property-facts" aria-label="עיקרי המקום">
              <div><b>{property.guests}</b><span>אורחים לכל היותר</span></div>
              {property.bedrooms && <div><b>{property.bedrooms}</b><span>חדרי שינה</span></div>}
              {property.scenario === "multi" && property.units ? <div><b>{property.units}</b><span>יחידות אירוח</span></div> : <div><b>שלם</b><span>המקום כולו</span></div>}
              <div><b>{property.features.length}</b><span>מאפיינים מרכזיים</span></div>
            </section>

            <section id="about"><span className="eyebrow">כל מה שחשוב לדעת</span><h2>על {property.name}</h2><p>{property.description}</p><div className="feature-chips audience-chips">{property.audiences.map((audience) => <span key={audience}>מתאים ל{audience}</span>)}</div></section>

            <section id="features" className="feature-section"><h2>מה מחכה לכם במקום</h2><div className="feature-list">{property.features.map((feature) => <span key={feature}>✓ {feature}</span>)}</div><button className="button subtle" type="button" onClick={() => setAllFeaturesOpen(true)}>כל המידע על המתקנים</button></section>

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
                    <div className="room-card__actions">{onlineBooking ? <button className="button primary" type="button" onClick={() => setCalendarOpen(true)}>{instantBooking ? "בחירת תאריך להזמנה" : "בדיקת תאריכים"}</button> : phoneHref ? <a className="button primary" href={phoneHref}>הזמנה בטלפון</a> : null}</div>
                  </div>
                </article>)}
              </div>
            </section> : null}

            {property.sleepingArrangements?.length ? <SleepingArrangements placeName={property.name} arrangements={property.sleepingArrangements} /> : property.bedrooms ? <section id="sleeping" className="sleeping-summary" aria-labelledby="sleeping-summary-title"><span className="eyebrow">חדרי שינה אינם יחידות אירוח</span><h2 id="sleeping-summary-title">איפה ישנים?</h2><p>{property.scenario === "multi" ? `במתחם יש ${property.units || roomQuantity} יחידות אירוח ובהן ${property.bedrooms} חדרי שינה בסך הכול. פירוט השינה מופיע בתוך כל כרטיס יחידה.` : `במקום יש ${property.bedrooms} חדרי שינה. סוגי המיטות ותמונות החדרים יוצגו כאן לאחר שיוך ואימות מול נתוני המקום.`}</p></section> : null}

            <ListingAccessibility slug={property.slug} />

            <section id="location" className="location-card"><div><span className="eyebrow">המיקום</span><h2>{property.location}</h2><p>{property.area}</p><span className="location-card__inline-note">מגדילים, מקטינים ומזיזים את המפה כאן בעמוד.</span></div><ListingMap listings={[property]} single /></section>

            <section id="faq" className="faq-section"><span className="eyebrow">כל מה שחשוב לפני שמזמינים</span><h2>שאלות ותשובות</h2>{propertyFaq.map((item, index) => <article key={item.question} className={openFaq === index ? "open" : ""}><button type="button" aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>{item.question}</span><b>{openFaq === index ? "−" : "+"}</b></button>{openFaq === index && <p>{item.answer}</p>}</article>)}</section>

            <GuestReviewStudio placeName={property.name} subjectId={property.slug} rating={property.score} reviewCount={property.reviews} open={reviewOpen} onClose={() => setReviewOpen(false)} onOpenGallery={() => { setGalleryTab("guests"); setGalleryStart(0); setGalleryOpen(true); }} />

            <section id="policies" className="policies-section"><span className="eyebrow">חשוב לדעת</span><h2>כללים ותנאי הזמנה</h2><div><article><b>כניסה ויציאה</b><p>שעות הכניסה והיציאה יוצגו לפי המקום והתאריך במנוע ההזמנות.</p></article><article><b>מחיר ותשלום</b><p>המחיר הסופי תלוי בתאריכים, בהרכב וביחידה שנבחרה.</p></article><article><b>ביטול ושינויים</b><p>התנאים המחייבים יוצגו לפני השלמת ההזמנה.</p></article><article><b>מידע על המקום</b><p>פרטי המקום והתמונות נבדקו כחלק מהכנת העמוד.</p></article></div></section>
          </div>

          {!onlineBooking && phoneHref ? <aside className="booking-card booking-card--phone"><span className="eyebrow">הזמנה בטלפון</span><h2>מדברים ישירות עם המקום</h2><p>הצוות בודק את התאריך, ההרכב והמחיר בשיחה אחת.</p><a className="button primary wide" href={phoneHref}>חיוג להזמנה</a><small>ההזמנה סופית רק לאחר אישור המקום.</small></aside> : activeWorld === "events" ? <aside className="booking-card booking-card--event"><span className="eyebrow">הזמנת אירוע</span><h2>בוחרים תאריך והרכב</h2><label>תאריך האירוע<input type="date" /></label><label>כמות משתתפים<input type="number" min="1" max={activeOffering.maxGuests} placeholder="כמה משתתפים צפויים?" /></label>{activeOffering.eventTypes?.length ? <ModernSelect label="סוג האירוע" defaultValue={activeOffering.eventTypes[0]} options={activeOffering.eventTypes.map((eventType) => ({ value: eventType, label: eventType }))} /> : null}<div className="booking-facts"><span>ההזמנה נבדקת לפי סוג האירוע</span><span>האירוח והאירוע מנוהלים בנפרד</span></div><Link className="button primary wide" href={`/booking?${bookingQuery}`}>המשך להזמנה אונליין</Link>{phoneBooking && phoneHref ? <a className="button secondary wide" href={phoneHref}>או חיוג למקום</a> : null}<small>הזמינות, המחיר וכללי המקום לאירוע מאושרים לפני חיוב.</small></aside> : <aside id="booking-summary" className={`booking-card ${vacationRequest ? "booking-card--request" : "booking-card--instant"}`}><span className="eyebrow">{vacationRequest ? "בקשת הזמנה מהירה" : "הזמנה אונליין"}</span><h2>{property.scenario === "single" ? "סיכום השהייה" : "תאריכים והרכב"}</h2><p className="booking-card__lead">{vacationRequest ? "בוחרים תאריכים ושולחים לבעל המקום בקשה מסודרת עם כל הפרטים." : "הזמינות והמחיר מחוברים למנוע ההזמנות של המקום."}</p><button type="button" className="date-choice" onClick={() => setCalendarOpen(true)}><CalendarIcon /><span><small>תאריכי השהייה</small><strong>{dates}</strong></span></button>{instantBooking && initialPrice ? <div className="booking-card__illustrative-price"><small>מחיר לתקופה שנבחרה</small><strong>{Number(initialPrice).toLocaleString("he-IL")} ₪</strong></div> : null}<label className="booking-guests">כמות אורחים<input type="number" min="1" max={activeOffering.maxGuests || property.guests} value={guests} onChange={(event) => setGuests(Math.max(1, Number(event.target.value) || 1))} /></label><div className="booking-facts"><span>עד {activeOffering.maxGuests || property.guests} אורחים</span>{property.bedrooms && <span>{property.bedrooms} חדרי שינה</span>}</div>{vacationRequest ? <div className="booking-request-fields"><label>שם להזמנה<input type="text" autoComplete="name" value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder="איך לפנות אליכם?" /></label><label>טלפון לחזרה<input type="tel" inputMode="tel" autoComplete="tel" value={guestPhone} onChange={(event) => setGuestPhone(event.target.value)} placeholder="מספר טלפון" /></label><label>הערה לבעל המקום<textarea value={bookingNote} onChange={(event) => setBookingNote(event.target.value)} placeholder="בקשה מיוחדת, גילאי ילדים או כל פרט חשוב" /></label></div> : null}<button className="button secondary wide" type="button" onClick={() => setCalendarOpen(true)}>{dateRange.from && dateRange.till ? "שינוי תאריכים" : "בחירת תאריכים"}</button>{vacationRequest ? dateRange.from && dateRange.till && whatsappHref ? <a className="button primary wide booking-whatsapp" href={whatsappHref} target="_blank" rel="noreferrer">שליחת בקשת הזמנה בוואטסאפ</a> : <button className="button primary wide" type="button" onClick={() => setCalendarOpen(true)}>{ownerWhatsapp ? "בחרו תאריכים כדי לשלוח בקשה" : "בחרו תאריכים לבדיקת זמינות"}</button> : <Link className="button primary wide" href={`/booking?${bookingQuery}`}>המשך להזמנה אונליין</Link>}{phoneHref ? <a className="button subtle wide" href={phoneHref}>העדפה לשיחה? חיוג למקום</a> : null}<small>{vacationRequest ? ownerWhatsapp ? "הבקשה נפתחת בוואטסאפ עם התאריכים, מספר האורחים והפרטים שמילאתם. ההזמנה סופית רק לאחר אישור המקום." : "פרטי הקשר הישירים של המקום טרם חוברו. אין אפשרות לשלוח בקשה עד להשלמת החיבור." : "המחיר ותנאי הביטול מוצגים לפני אישור התשלום."}</small></aside>}
        </div>

        <section className="section property-complements">
          <div className="shell">
            <div className="section-head">
              <div><span className="eyebrow">משלימים את החופשה</span><h2>מה אפשר לעשות מסביב</h2></div>
              <Link href="/activities">לכל הרעיונות והחוויות</Link>
            </div>
            <p className="property-complements__note">ההצעות מוצגות לפי האזור ורק לאחר אימות התאמה, פרטים ואופן הזמנה.</p>
            <div className="discovery-grid discovery-grid--compact">{complements.map((item) => <DiscoveryCard key={`${item.world}-${item.id}`} item={item} />)}</div>
            <div className="property-nearby-trails"><div className="section-head"><div><span className="eyebrow">טיול עצמאי ליד מקום האירוח</span><h2>מסלולים באזור</h2><p>ההתאמה נעשית לפי אזור כללי. המרחק המדויק והמצב בשטח נבדקים לפני היציאה.</p></div><Link href="/trails">לכל המסלולים</Link></div><div className="trail-grid trail-grid--business">{localTrails.map((trail) => <TrailCard key={trail.slug} trail={trail} compact />)}</div></div>
          </div>
        </section>

        <div className="section shell"><MasuExperience context={activeWorld === "events" ? "event" : "stay"} /></div>

        <section className="section section-tint"><div className="shell"><div className="section-head"><h2>מקומות נוספים שיכולים להתאים</h2></div><div className="card-grid">{properties.filter((item) => item.slug !== property.slug).slice(0, 3).map((item) => <PropertyCard key={item.slug} property={item} />)}</div></div></section>
      </main>

      <CalendarDemo mode="business" businessKind={property.scenario} businessName={property.name} open={calendarOpen && activeWorld === "vacation"} onClose={() => setCalendarOpen(false)} onConfirm={(result) => { setDates(result.summary); setDateRange({ from: result.checkIn || "", till: result.checkOut || "" }); }} />

      <GalleryExperience key={`${property.slug}-${galleryOpen ? `${galleryTab}-${galleryStart}` : "closed"}`} property={property} open={galleryOpen} initialIndex={galleryStart} initialTab={galleryTab} onAddGuestContent={() => { setGalleryOpen(false); setReviewOpen(true); }} onClose={() => setGalleryOpen(false)} />

      {allFeaturesOpen && <div className="simple-modal" onMouseDown={(event) => event.target === event.currentTarget && setAllFeaturesOpen(false)}><section role="dialog" aria-modal="true" aria-labelledby="features-title"><header><h2 id="features-title">המתקנים של {property.name}</h2><button type="button" onClick={() => setAllFeaturesOpen(false)}>סגירה</button></header><div className="feature-list modal-features">{property.features.map((feature) => <span key={feature}>✓ {feature}</span>)}</div><p>המידע המוצג נבדק כחלק מהכנת עמוד המקום.</p></section></div>}
    </PageShell>
  );
}
