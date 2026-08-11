"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { BreadcrumbTrail } from "../../components/breadcrumb-trail";
import { worldBreadcrumb } from "../../lib/seo";
import { FavoriteButton } from "../../components/favorite-button";
import { useMemo, useState } from "react";
import { DiscoveryCard } from "../../components/discovery-card";
import { ListingAccessibility } from "../../components/listing-accessibility";
import { PageShell } from "../../components/page-shell";
import { getSpaDetails, type SpaDetails, type SpaPackage } from "../../data/spa-details";
import { getProviderDetails, type ProviderDetails, type ProviderService } from "../../data/provider-details";
import { getHourlyDetails, type HourlyDetails } from "../../data/hourly-details";
import { getActivityDetails, type ActivityDetails } from "../../data/activity-details";
import { discoveryItems, worlds, type WorldId } from "../../data/world-data";
import { PinIcon } from "../../site-header";
import { DiscoveryMap } from "../../components/listing-map";
import { MasuExperience } from "../../components/masu-experience";
import { GalleryExperience } from "../../components/gallery-experience";
import { DetailStickyDock, type DetailSectionLink } from "../../components/detail-sticky-dock";
import { GuestReviewStudio } from "../../components/guest-review-studio";
import { WhatsAppLeadButton } from "../../components/whatsapp-lead-button";

function SpaPackageCard({ itemId, pack }: { itemId: string; pack: SpaPackage }) {
  const requestHref = `/booking?world=spa&place=${encodeURIComponent(itemId)}&package=${encodeURIComponent(pack.id)}`;
  return <article className="spa-package-card">
    <header><span>{pack.audience}</span>{pack.duration && <small>{pack.duration}</small>}</header>
    <h3>{pack.title}</h3>
    <ul>{pack.includes.map((entry) => <li key={entry}>{entry}</li>)}</ul>
    <footer><strong>{pack.price}</strong><Link className="button primary" href={requestHref}>הזמנה אונליין</Link></footer>
  </article>;
}

function SpaContent({ itemId, details }: { itemId: string; details: SpaDetails }) {
  return <>
    <section className="section shell spa-about" id="spa-about">
      <div><span className="eyebrow">כל מה שחשוב לפני שמזמינים</span><h2>על המקום</h2>{details.about.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
      <aside>
        {details.address && <div><small>כתובת</small><strong>{details.address}</strong></div>}
        {details.suitableFor?.length && <div><small>מתאים עבור</small><strong>{details.suitableFor.join(" · ")}</strong></div>}
      </aside>
    </section>
    {details.packages?.length ? <section className="section section-tint" id="spa-packages"><div className="shell"><div className="section-head"><div><span className="eyebrow">בוחרים לפי החוויה</span><h2>חבילות הספא</h2><p>רואים מראש מה כלול, למי החבילה מתאימה וכמה זמן כדאי להקדיש לביקור.</p></div></div><div className="spa-packages-grid">{details.packages.map((pack) => <SpaPackageCard key={pack.id} itemId={itemId} pack={pack} />)}</div><p className="spa-price-note">המחירים המוצגים הם מחירי התחלה. הזמינות והמחיר הסופי נקבעים לפי התאריך, ההרכב והאפשרויות שנבחרו.</p></div></section> : <section className="section section-tint" id="spa-packages"><div className="shell depth-final-cta"><div><span className="eyebrow">הזמנה מלאה באתר</span><h2>בוחרים תאריך וממשיכים להזמנה</h2><p>החבילות הזמינות והמחיר הסופי מוצגים בתהליך ההזמנה לפני אישור.</p></div><Link className="button primary" href={`/booking?world=spa&place=${encodeURIComponent(itemId)}`}>הזמנה אונליין</Link></div></section>}
    <section className="section shell spa-details-grid">
      {details.treatments?.length ? <div id="spa-treatments" className="spa-detail-panel"><span className="eyebrow">לבחירה במקום</span><h2>טיפולים</h2><div className="spa-treatment-list">{details.treatments.map((treatment) => <article key={treatment.name}><strong>{treatment.name}</strong>{treatment.durations?.length ? <span>{treatment.durations.join(" · ")}</span> : null}{treatment.priceNote ? <small>{treatment.priceNote}</small> : null}</article>)}</div></div> : null}
      <div id="spa-facilities" className="spa-detail-panel"><span className="eyebrow">בתוך המתחם</span><h2>מתקנים ושירותים</h2><ul className="spa-facility-list">{details.facilities.map((facility) => <li key={facility}>{facility}</li>)}</ul></div>
    </section>
    {(details.hours?.length || details.arrivalNotes?.length) ? <section className="section section-soft" id="spa-info"><div className="shell spa-visit-info"><div><span className="eyebrow">מתכננים את הביקור</span><h2>שעות ופרטים שימושיים</h2>{details.hours?.map((entry) => <p key={entry}>{entry}</p>)}</div>{details.arrivalNotes?.length ? <ul>{details.arrivalNotes.map((note) => <li key={note}>{note}</li>)}</ul> : null}</div></section> : null}
    {details.faq?.length ? <section className="section shell spa-faq"><div className="section-head"><div><span className="eyebrow">שאלות נפוצות</span><h2>כל מה שרציתם לדעת</h2></div></div><div>{details.faq.map((entry) => <details key={entry.question}><summary>{entry.question}</summary><p>{entry.answer}</p></details>)}</div></section> : null}
  </>;
}

const masuServiceLinks: Record<string, string> = {
  "home-massage": "https://masu.co.il/partners/?page=product&lang=he",
  "home-facial": "https://masu.co.il/partners/?page=skincare&lang=he",
  "office-wellness": "https://masu.co.il/your-office-massage/",
  "event-massage": "https://masu.co.il/your-pamper-party/",
};

function ProviderServiceCard({ itemId, providerName, phone, service, priceLabel, bookingMode }: { itemId: string; providerName: string; phone?: string; service: ProviderService; priceLabel: string; bookingMode: "full" | "whatsapp" }) {
  const requestHref = `/booking?world=providers&place=${encodeURIComponent(itemId)}&service=${encodeURIComponent(service.id)}`;
  const masuServiceHref = itemId === "masu-home-wellness" ? masuServiceLinks[service.id] : undefined;
  return <article className="provider-service-card">
    <span>{service.suitableFor}</span>
    <h3>{service.title}</h3>
    <p>{service.description}</p>
    <ul>{service.includes.map((entry) => <li key={entry}>{entry}</li>)}</ul>
    <strong className="provider-service-price">{priceLabel}</strong>
    {masuServiceHref
      ? <a
          className="button primary"
          href={masuServiceHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${service.title} באתר מאסו, נפתח בלשונית חדשה`}
        >בחירת השירות באתר מאסו</a>
      : bookingMode === "whatsapp"
        ? phone ? <WhatsAppLeadButton world="providers" placeId={itemId} placeName={providerName} businessPhone={phone} serviceName={service.title} buttonLabel="הזמנה בוואטסאפ" /> : null
        : <Link className="button primary" href={requestHref}>התחלת הזמנה</Link>}
  </article>;
}

function ProviderContent({ itemId, providerName, details, priceLabel }: { itemId: string; providerName: string; details: ProviderDetails; priceLabel: string }) {
  const [phoneVisible, setPhoneVisible] = useState(false);
  const bookingMode = details.bookingMode || "full";
  return <>
    <section className="section shell provider-about" id="provider-about">
      <div><span className="eyebrow">פרופיל שירות מלא</span><h2>מה אפשר להזמין</h2>{details.about.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
      <aside>
        <span>תחום</span><strong>{details.category}</strong>
        <span>מתאים עבור</span><strong>{details.occasions.slice(0, 3).join(" · ")}</strong>
        <span>דרך ההזמנה</span><strong>{bookingMode === "whatsapp" ? "הזמנה קצרה בוואטסאפ" : "תהליך הזמנה מלא באתר"}</strong>
        {details.phone ? <><span>שיחה ישירה</span>{phoneVisible
          ? <a className="provider-phone" dir="ltr" href={`tel:${details.phone.replace(/[^\d+]/g, "")}`}>{details.phone}</a>
          : <button className="provider-phone-reveal" type="button" onClick={() => setPhoneVisible(true)}>הצגת מספר</button>}</> : null}
      </aside>
    </section>
    <section className="section section-tint provider-services-section" id="provider-services"><div className="shell"><div className="section-head"><div><span className="eyebrow">בוחרים את השירות הנכון</span><h2>שירותים וחבילות להזמנה</h2><p>{bookingMode === "whatsapp" ? "בוחרים שירות, ממלאים פרטים ושומרים את הפנייה לפני המעבר לשיחה עם הספק." : "בוחרים שירות וממשיכים לעמוד הזמנה מלא ששומר את כל הפרטים במקום אחד."}</p></div></div><div className="provider-services-grid">{details.services.map((service) => <ProviderServiceCard key={service.id} itemId={itemId} providerName={providerName} phone={details.phone} service={service} priceLabel={priceLabel} bookingMode={bookingMode} />)}</div></div></section>
    <section className="section shell provider-occasions"><div><span className="eyebrow">מתאים לחגיגה שלכם</span><h2>סוגי אירועים</h2></div><div>{details.occasions.map((occasion) => <span key={occasion}>{occasion}</span>)}</div></section>
    <section className="section section-soft provider-process-section" id="provider-process"><div className="shell"><div className="section-head"><div><span className="eyebrow">פשוט, ברור וללא ניחושים</span><h2>איך מזמינים</h2></div></div><ol className="provider-process">{details.process.map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}</ol></div></section>
    <section className="section shell provider-practical" id="provider-info"><div><span className="eyebrow">לפני שסוגרים</span><h2>חשוב לדעת</h2></div><ul>{details.practicalNotes.map((note) => <li key={note}>{note}</li>)}</ul></section>
    <section className="section shell provider-faq" id="provider-faq"><div className="section-head"><div><span className="eyebrow">שאלות נפוצות</span><h2>תשובות לפני ההזמנה</h2></div></div><div>{details.faq.map((entry) => <details key={entry.question}><summary>{entry.question}</summary><p>{entry.answer}</p></details>)}</div></section>
    <section className="section provider-final-cta"><div className="shell"><div><span className="eyebrow">מוכנים להזמין?</span><h2>{bookingMode === "whatsapp" ? "שומרים את הפנייה וממשיכים ישירות לספק" : "ממשיכים להזמנה מלאה ומסודרת"}</h2><p>{bookingMode === "whatsapp" ? "רק לאחר שהפרטים נשמרים נפתחת שיחת הוואטסאפ עם מזהה הפנייה." : "התאריך, המקום, מספר המשתתפים והשירות המבוקש נשמרים יחד במערכת."}</p></div><div>{bookingMode === "whatsapp" && details.phone ? <WhatsAppLeadButton world="providers" placeId={itemId} placeName={providerName} businessPhone={details.phone} serviceName={details.services[0]?.title} buttonLabel="הזמנה בוואטסאפ" /> : <Link className="button primary" href={`/booking?world=providers&place=${encodeURIComponent(itemId)}`}>התחלת הזמנה</Link>}</div></div></section>
  </>;
}

function HourlyContent({ item, details }: { item: (typeof discoveryItems)[number]; details: HourlyDetails }) {
  const [phoneVisible, setPhoneVisible] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(details.rates[0]?.duration || "שעה");
  const selectedRate = details.rates.find((rate) => rate.duration === selectedDuration) || details.rates[0];
  const phoneHref = item.phone ? `tel:${item.phone.replace(/[^\d+]/g, "")}` : undefined;

  return <>
    <section className="section shell depth-about" id="hourly-about"><div><span className="eyebrow">כל המידע במקום אחד</span><h2>על המקום</h2>{details.about.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div><aside><small>איך מזמינים</small><strong>בוחרים משך ומחייגים למקום</strong><small>מתי ההזמנה סופית</small><strong>רק לאחר אישור בעל המקום</strong><a className="text-link" href="#hourly-options">לכל פרטי השהייה</a></aside></section>
    <section className="section section-tint hourly-direct-booking" id="hourly-options"><div className="shell"><div className="section-head"><div><span className="eyebrow">בלי טופס ובלי תשלום באתר</span><h2>בוחרים משך ומחייגים</h2><p>המחירים הם מחירי התחלה שנבדקו מול פרטי המקום. השעה והחדר הפנוי מאושרים בשיחה.</p></div></div><div className="hourly-rate-grid" role="list" aria-label="מחירים לפי משך שהייה">{details.rates.map((rate) => <button key={rate.duration} type="button" className={selectedDuration === rate.duration ? "selected" : ""} onClick={() => setSelectedDuration(rate.duration)} aria-pressed={selectedDuration === rate.duration}><span>{rate.duration}</span><strong>{rate.price}</strong></button>)}</div><div className="hourly-call-panel" id="hourly-contact"><div><span className="eyebrow">שיחה קצרה ודיסקרטית</span><h3>מה אומרים בשיחה?</h3><p>שלום, ראיתי את {item.name} באתר וי. רציתי לבדוק זמינות ל{selectedDuration}{selectedRate ? ` במחיר שמתחיל ב־${selectedRate.price}` : ""}.</p><ul><li>מאשרים שעה רצויה וחדר פנוי</li><li>בודקים כניסה עצמאית או תשלום ללא מפגש</li><li>מקבלים הנחיות הגעה ישירות מהמקום</li></ul></div><aside><small>נציג המקום</small><strong>{item.contactName || "מרכז ההזמנות"}</strong>{phoneHref ? phoneVisible ? <><a className="hourly-phone-number" dir="ltr" href={phoneHref}>{item.phone}</a><a className="button primary wide hourly-call-now" href={phoneHref}>חיוג עכשיו</a></> : <button className="button primary wide" type="button" onClick={() => setPhoneVisible(true)}>הצגת מספר וחיוג</button> : <span className="hourly-phone-missing">המספר יוצג לאחר אימות המקום</span>}<small>אין חיוב באתר. ההזמנה נסגרת ישירות מול המקום.</small></aside></div></div></section>
    <section className="section shell hourly-stay-notes"><div className="section-head"><div><span className="eyebrow">מתאימים את הביקור</span><h2>אפשרויות שהייה</h2></div></div><div className="depth-card-grid">{details.stayOptions.map((option) => <article key={option.title}><h3>{option.title}</h3><p>{option.description}</p><a className="text-link" href="#hourly-contact">לשיחה עם המקום</a></article>)}</div></section>
    <section className="section shell depth-columns"><div id="hourly-amenities"><span className="eyebrow">מה ידוע על המקום</span><h2>מתקנים ומאפיינים</h2><ul>{details.amenities.map((entry) => <li key={entry}>{entry}</li>)}</ul></div><div id="hourly-info"><span className="eyebrow">לפני שמגיעים</span><h2>פרטים שימושיים</h2><ul>{details.arrivalNotes.map((entry) => <li key={entry}>{entry}</li>)}</ul></div></section>
    <section className="section shell depth-faq" id="hourly-faq"><div className="section-head"><div><span className="eyebrow">תשובות ברורות</span><h2>שאלות נפוצות</h2></div></div>{details.faq.map((entry) => <details key={entry.question}><summary>{entry.question}</summary><p>{entry.answer}</p></details>)}</section>
    <section className="section depth-final-cta"><div className="shell"><div><span className="eyebrow">רוצים לסגור מקום?</span><h2>שיחה אחת ומקבלים תשובה</h2><p>מתאמים שעה, משך, מחיר והנחיות כניסה ישירות עם המקום.</p></div>{phoneHref ? <a className="button primary" href={phoneHref}>חיוג מהיר למקום</a> : <a className="button primary" href="#hourly-contact">לפרטי החיוג</a>}</div></section>
  </>;
}

function ActivityContent({ itemId, details }: { itemId: string; details: ActivityDetails }) {
  const onlineHref = `/booking?world=activities&place=${encodeURIComponent(itemId)}&offer=activity-order`;
  const phoneHref = details.booking?.phone ? `tel:${details.booking.phone.replace(/[^\d+]/g, "")}` : "";
  return <>
    <section className="section shell depth-about" id="activity-about"><div><span className="eyebrow">יוצאים עם תוכנית ברורה</span><h2>על החוויה</h2>{details.about.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div><aside>{details.facts.map((fact) => <div key={fact.label}><small>{fact.label}</small><strong>{fact.value}</strong></div>)}</aside></section>
    <section className="section section-tint" id="activity-highlights"><div className="shell"><div className="section-head"><div><span className="eyebrow">למה כדאי</span><h2>מה מחכה בדרך</h2></div></div><div className="depth-card-grid">{details.highlights.map((entry) => <article key={entry}><h3>{entry}</h3></article>)}</div></div></section>
    <section className="section shell depth-columns"><div id="activity-plan"><span className="eyebrow">שלב אחר שלב</span><h2>{details.kind === "matching" ? "כך מתאימים את החוויה" : "תוכנית מוצעת"}</h2><ol>{details.plan.map((entry, index) => <li key={entry}><span>{index + 1}</span><p>{entry}</p></li>)}</ol></div><div id="activity-preparation"><span className="eyebrow">יוצאים מוכנים</span><h2>מה חשוב להכין</h2><ul>{details.preparation.map((entry) => <li key={entry}>{entry}</li>)}</ul></div></section>
    {details.booking ? <section className="section section-soft activity-booking" id="activity-booking"><div className="shell activity-booking__inner"><div><span className="eyebrow">לפי אופן העבודה של הספק</span><h2>איך מזמינים את האטרקציה?</h2><p>{details.booking.note}</p></div><div className="activity-booking__actions">{details.booking.mode !== "phone" ? <Link className="button primary" href={onlineHref}>{details.booking.onlineLabel || "רכישה אונליין"}</Link> : phoneHref ? <a className="button secondary" href={phoneHref}>הזמנה בטלפון</a> : null}</div></div></section> : null}
    <section className="section shell depth-faq" id="activity-faq"><div className="section-head"><div><span className="eyebrow">לפני שיוצאים</span><h2>שאלות נפוצות</h2></div></div>{details.faq.map((entry) => <details key={entry.question}><summary>{entry.question}</summary><p>{entry.answer}</p></details>)}</section>
    <section className="section depth-final-cta"><div className="shell"><div><span className="eyebrow">משלבים את זה בחופשה</span><h2>{details.kind === "matching" ? "מזמינים חוויה שמתאימה להרכב שלכם" : "שומרים את התוכנית וממשיכים לבחור מקום אירוח"}</h2><p>{details.kind === "matching" ? "דרך ההזמנה נקבעת לפי הספק: רכישה באתר או הזמנה בטלפון רק כשאין מסלול מקוון." : "אפשר לחזור לחיפוש ולבחור מקום באזור שמתאים למסלול."}</p></div>{details.booking ? <div className="activity-booking__actions">{details.booking.mode !== "phone" ? <Link className="button primary" href={onlineHref}>{details.booking.onlineLabel || "רכישה אונליין"}</Link> : phoneHref ? <a className="button secondary" href={phoneHref}>הזמנה בטלפון</a> : null}</div> : <Link className="button primary" href={details.kind === "matching" ? `/booking?world=activities&place=${encodeURIComponent(itemId)}` : "/"}>{details.kind === "matching" ? "הזמנה אונליין" : "לחיפוש מקום אירוח"}</Link>}</div></section>
  </>;
}

export default function DiscoveryPlacePage({ initialId }: { initialId: string }) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const item = useMemo(() => discoveryItems.find((entry) => entry.id === initialId) || discoveryItems[0], [initialId]);
  const world = worlds.find((entry) => entry.id === item.world) || worlds[2];
  const related = discoveryItems
    .filter((entry) => entry.world === item.world && entry.id !== item.id)
    .sort((a, b) => Number(b.location === item.location) - Number(a.location === item.location)
      || Number(b.area === item.area) - Number(a.area === item.area))
    .slice(0, 6);
  const spaDetails = item.world === "spa" ? getSpaDetails(item.id) : undefined;
  const providerDetails = item.world === "providers" ? getProviderDetails(item.id) : undefined;
  const hourlyDetails = item.world === "hourly" ? getHourlyDetails(item) : undefined;
  const activityDetails = item.world === "activities" ? getActivityDetails(item) : undefined;
  const galleryImages = item.images?.length ? item.images : item.image ? [item.image] : [];
  const gallerySubject = { name: item.name, images: galleryImages };
  const sections = useMemo<DetailSectionLink[]>(() => {
    if (spaDetails) return [
      { href: "#spa-about", label: "על המקום" },
      { href: "#spa-packages", label: spaDetails.packages?.length ? "חבילות" : "הזמנה" },
      ...(spaDetails.treatments?.length ? [{ href: "#spa-treatments" as const, label: "טיפולים" }] : []),
      { href: "#spa-facilities", label: "מתקנים" },
      ...(spaDetails.hours?.length ? [{ href: "#spa-info" as const, label: "שעות ופרטים" }] : []),
      { href: "#location", label: "מפה" },
      { href: "#reviews", label: "חוות דעת" },
    ];
    if (providerDetails) return [
      { href: "#provider-about", label: "על הספק" }, { href: "#provider-services", label: "שירותים" },
      { href: "#provider-process", label: "איך מזמינים" }, { href: "#provider-info", label: "חשוב לדעת" },
      { href: "#provider-faq", label: "שאלות נפוצות" }, { href: "#reviews", label: "חוות דעת" },
    ];
    if (hourlyDetails) return [
      { href: "#hourly-about", label: "על המקום" }, { href: "#hourly-options", label: "אפשרויות שהייה" },
      { href: "#hourly-amenities", label: "מה במקום" }, { href: "#hourly-info", label: "לפני שמגיעים" },
      { href: "#hourly-faq", label: "שאלות נפוצות" }, { href: "#location", label: "מפה" }, { href: "#reviews", label: "חוות דעת" },
    ];
    return [
      { href: "#activity-about", label: "על החוויה" }, { href: "#activity-highlights", label: "מה מחכה בדרך" },
      { href: "#activity-plan", label: "תכנון מלא" }, { href: "#activity-preparation", label: "מה להכין" },
      ...(activityDetails?.booking ? [{ href: "#activity-booking" as const, label: "איך מזמינים" }] : []),
      { href: "#activity-faq", label: "שאלות נפוצות" }, { href: "#reviews", label: "חוות דעת" },
    ];
  }, [activityDetails, hourlyDetails, providerDetails, spaDetails]);
  const activityPhoneOnly = activityDetails?.booking?.mode === "phone";
  const phone = item.world === "hourly" ? item.phone : activityPhoneOnly ? activityDetails.booking?.phone : undefined;
  const onlineHref = item.id === "masu-home-wellness" || item.world === "hourly" || activityPhoneOnly ? undefined : item.world === "spa" && spaDetails?.packages?.length
    ? "#spa-packages"
    : `/booking?world=${item.world}&place=${encodeURIComponent(item.id)}`;
  const onlineLabel = item.world === "spa" ? "בחירת חבילת ספא" : item.world === "providers" ? "בחירת שירות" : "הזמנה אונליין";

  return <PageShell variant={item.world as WorldId}>
    <main id="main-content" className={`discovery-detail discovery-detail--${item.world}`}>
      <BreadcrumbTrail items={[{ name: "ראשי", path: "/" }, worldBreadcrumb(item.world), { name: item.name }]} />
      <section className="shell discovery-detail__hero">
        <div className="discovery-detail__copy"><span className="eyebrow">{world.label}</span><h1>{item.name}</h1><p className="discovery-detail__location"><PinIcon />{item.location}, {item.area}</p><p>{item.description}</p><div className="discovery-card__chips">{item.features.map((feature) => <span key={feature}>{feature}</span>)}</div><div className="discovery-detail__actions">{spaDetails ? <a className="button primary" href="#spa-packages">לבחירת חבילה</a> : providerDetails ? <a className="button primary" href="#provider-services">לבחירת שירות</a> : hourlyDetails ? <a className="button primary" href="#hourly-contact">הצגת מספר וחיוג</a> : activityDetails?.booking ? <a className="button primary" href="#activity-booking">איך מזמינים</a> : activityDetails ? <a className="button primary" href="#activity-plan">לתכנון המלא</a> : <Link className="button primary" href={world.href}>לכל האפשרויות</Link>}<FavoriteButton id={item.id} world={item.world} name={item.name} location={`${item.location}, ${item.area}`} image={item.image} href={`/discover/place/${item.id}`} meta={item.priceLabel || item.duration} compact={false} /><Link className="button secondary" href={world.href}>חזרה לרשימה</Link></div></div>
        <div className={`discovery-detail__media discovery-card__placeholder--${item.world}`}>{item.image ? <><button className="discovery-detail__gallery-media" type="button" onClick={() => setGalleryOpen(true)} aria-label={`פתיחת הגלריה של ${item.name}`}><img src={item.image} alt={item.imageLabel ? `תמונת אווירה לתחום ${item.features[0]}` : item.name} /></button>{item.imageLabel && <span className="image-context-label image-context-label--detail">{item.imageLabel}</span>}<button className="discovery-detail__gallery-launch" type="button" onClick={() => setGalleryOpen(true)}><span aria-hidden="true">▦</span>לגלריה <small>{galleryImages.length} {galleryImages.length === 1 ? "תמונה" : "תמונות"}</small></button></> : null}</div>
      </section>
      <DetailStickyDock name={item.name} location={`${item.location}, ${item.area}`} sections={sections} onlineHref={onlineHref} onlineLabel={onlineLabel} phone={phone} />
      {spaDetails ? <SpaContent itemId={item.id} details={spaDetails} /> : null}
      {providerDetails ? <ProviderContent itemId={item.id} providerName={item.name} details={providerDetails} priceLabel={item.priceLabel || "מחיר ייקבע לפני אישור"} /> : null}
      {hourlyDetails ? <HourlyContent item={item} details={hourlyDetails} /> : null}
      {activityDetails ? <ActivityContent itemId={item.id} details={activityDetails} /> : null}
      {(spaDetails || hourlyDetails) ? <section className={`section shell discovery-location discovery-location--${item.world}`} id="location"><div className="discovery-location__intro"><span className="eyebrow">מכירים את האזור לפני שמגיעים</span><h2>המקום על המפה</h2><p>{item.world === "spa" ? "בודקים את האזור, המרחקים והדרך הנוחה להגיע לחוויית הספא." : "רואים את אזור המקום ושומרים על פרטיות מלאה. פרטי ההגעה המדויקים נמסרים לאחר אישור."}</p></div><DiscoveryMap items={[item]} tone={item.world === "spa" ? "spa" : "hourly"} single autoLoad /></section> : null}
      {(item.world === "spa" || item.world === "hourly") && <div className="shell discovery-detail__accessibility"><ListingAccessibility slug={item.id} /></div>}
      {(item.world === "spa" || item.world === "hourly") && item.id !== "masu-home-wellness" ? <div className="section shell"><MasuExperience context={item.world === "spa" ? "spa" : "hourly"} /></div> : null}
      <div className="section shell"><GuestReviewStudio placeName={item.name} subjectId={item.id} rating={item.rating} /></div>
      <section className="section section-tint"><div className="shell"><div className="section-head"><div><span className="eyebrow">באותו עולם</span><h2>עוד אפשרויות שכדאי לראות</h2></div></div><div className="discovery-grid">{related.map((entry) => <DiscoveryCard key={entry.id} item={entry} />)}</div></div></section>
    </main>
    <GalleryExperience key={`${item.id}-${galleryOpen ? "open" : "closed"}`} property={gallerySubject} open={galleryOpen} onClose={() => setGalleryOpen(false)} />
  </PageShell>;
}
