"use client";
import { nearbyRecommendations } from "../../lib/nearby-recommendations";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { ListingMap } from "../../components/listing-map";
import { PageShell } from "../../components/page-shell";
import { DiscoveryCard } from "../../components/discovery-card";
import { PlacePreviewCard } from "../../components/place-preview-card";
import { ListingAccessibility } from "../../components/listing-accessibility";
import { eventPlaceHref, eventPlaces } from "../../data/site-data";
import { providerProfiles } from "../../data/world-data";
import { MasuExperience } from "../../components/masu-experience";
import { CalendarIcon, PinIcon } from "../../site-header";
import { GalleryExperience } from "../../components/gallery-experience";
import { useGalleryDeepLink } from "../../components/use-gallery-deep-link";
import { GuestReviewStudio } from "../../components/guest-review-studio";
import { BreadcrumbTrail } from "../../components/breadcrumb-trail";
import { DetailStickyDock, type DetailSectionLink } from "../../components/detail-sticky-dock";
import { ModernSelect } from "../../components/modern-select";
import { FavoriteButton } from "../../components/favorite-button";
import { WhatsAppLeadButton } from "../../components/whatsapp-lead-button";
import { ShareButton } from "../../components/share-dialog";
import { ViewedItemTracker } from "../../components/viewed-item-tracker";
import { PropertyGallery } from "../../components/property-gallery";
import { FloatingContactActions } from "../../components/floating-contact-actions";
import { SearchAfterResults } from "../../components/search-after-results";
import type { SupplierPlaceDetail } from "../../data/supplier-place-detail";
import { useSearchParams } from "next/navigation";
import { useViiLiveSearch } from "../../components/use-vii-live-search";
import { eventSlotCopy } from "../../i18n/event-slot-copy";
import type { EventSlot } from "../../lib/vii-live-search";
import { trackPhoneReveal } from "../../lib/analytics";
import { useSiteLanguage } from "../../i18n/locale-provider";
import { latinBusinessAlias, localizedBusinessList, localizedBusinessText } from "../../i18n/localized-business-content";

function PhoneIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.7 3.5 9 3a1.6 1.6 0 0 1 1.8 1l1 3a1.6 1.6 0 0 1-.5 1.7L9.7 10a14 14 0 0 0 4.3 4.3l1.3-1.6a1.6 1.6 0 0 1 1.7-.5l3 1a1.6 1.6 0 0 1 1 1.8l-.5 2.3a3 3 0 0 1-3 2.4A15.5 15.5 0 0 1 4.3 6.5a3 3 0 0 1 2.4-3Z" /></svg>;
}

export default function EventPlacePage({ initialSlug, initialPlace, relatedPlaces, supplierDetail }: { initialSlug: string; initialPlace?: (typeof eventPlaces)[number]; relatedPlaces?: typeof eventPlaces; supplierDetail?: SupplierPlaceDetail }) {
  const { language, translate } = useSiteLanguage();
  const searchParams = useSearchParams();
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get("from") || "") ? searchParams.get("from") || "" : "";
  const selectedGuests = /^\d+$/.test(searchParams.get("guests") || "") ? searchParams.get("guests") || "" : "";
  const selectedSlot = searchParams.get("slot") === "morning" ? "morning" : searchParams.get("slot") === "evening" ? "evening" : undefined;
  const [eventDate, setEventDate] = useState(selectedDate);
  const [eventGuests, setEventGuests] = useState(selectedGuests);
  const [eventSlot, setEventSlot] = useState<EventSlot | undefined>(selectedSlot);
  const slotCopy = eventSlotCopy[language];
  const supplierSearch = useViiLiveSearch("events", eventDate && Number(eventGuests) > 0 ? eventDate : null, eventDate && Number(eventGuests) > 0 ? eventDate : null, Number(eventGuests), undefined, undefined, eventSlot);
  const supplierResult = /^event-\d+$/.test(initialSlug) ? supplierSearch.results[Number(initialSlug.slice(6))] : undefined;
  const eventQuoteCopy = {
    he: { loading: "בודקים זמינות ומחיר מול מערכת האירועים", error: "לא הצלחנו לבדוק כעת מול מערכת האירועים", noPrice: "אין מחיר מאומת לתאריך ולהרכב שבחרתם", unavailable: "אין זמינות מאומתת לתאריך ולהרכב שבחרתם", inquiry: "הזמינות והמחיר יאושרו מול המקום", available: (start: string, total: number) => `פנוי החל מ־${start} · ${total.toLocaleString("he-IL")} ₪ לאירוע` },
    en: { loading: "Checking availability and price with the event system", error: "We could not check the event system right now", noPrice: "No verified price is available for the selected date and party", unavailable: "No verified availability for the selected date and party", inquiry: "The venue will confirm availability and price", available: (start: string, total: number) => `Available from ${start} · ₪${total.toLocaleString("en-GB")} for the event` },
    ru: { loading: "Проверяем наличие и цену в системе мероприятий", error: "Сейчас не удалось проверить систему мероприятий", noPrice: "Для выбранной даты и состава нет подтверждённой цены", unavailable: "Для выбранной даты и состава нет подтверждённой доступности", inquiry: "Площадка подтвердит наличие и цену", available: (start: string, total: number) => `Доступно с ${start} · ₪${total.toLocaleString("ru-RU")} за мероприятие` },
    fr: { loading: "Vérification de la disponibilité et du prix", error: "La vérification est momentanément indisponible", noPrice: "Aucun prix vérifié pour la date et le groupe choisis", unavailable: "Aucune disponibilité vérifiée pour la date et le groupe choisis", inquiry: "Le lieu confirmera la disponibilité et le prix", available: (start: string, total: number) => `Disponible à partir de ${start} · ${total.toLocaleString("fr-FR")} ₪ pour l’événement` },
  }[language];
  const eventQuote = supplierSearch.status === "loading" ? eventQuoteCopy.loading
    : supplierSearch.status === "error" ? eventQuoteCopy.error
    : supplierResult?.available === true && supplierResult.total && supplierResult.start
      ? `${eventQuoteCopy.available(supplierResult.start, supplierResult.total)} · ${supplierResult.slot ? slotCopy[supplierResult.slot] : ""}`
      : supplierResult?.reason === "no_prices" ? eventQuoteCopy.noPrice
      : supplierResult?.reason === "no_availability" || supplierResult?.available === false ? eventQuoteCopy.unavailable
      : eventQuoteCopy.inquiry;
  const { galleryOpen, galleryStart, galleryTab, openGallery, closeGallery, updateGallerySelection } = useGalleryDeepLink();
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [reference, setReference] = useState("");
  const [submissionId, setSubmissionId] = useState("");
  const [phoneRevealed, setPhoneRevealed] = useState(false);
  const place = useMemo(() => {
    const base = initialPlace || eventPlaces.find((item) => item.slug === initialSlug) || eventPlaces[0];
    return supplierDetail ? { ...base, name: supplierDetail.name || base.name, image: supplierDetail.images[0] || base.image,
      images: supplierDetail.images, location: supplierDetail.location || base.location, area: supplierDetail.area || base.area,
      lat: supplierDetail.lat ?? base.lat, lng: supplierDetail.lng ?? base.lng, guests: supplierDetail.guests || base.guests,
      units: supplierDetail.units || base.units, contact: { ...base.contact, ...(supplierDetail.phone ? { phone: supplierDetail.phone } : {}), whatsapp: supplierDetail.whatsapp },
      description: supplierDetail.summary || base.description,
      features: [...new Set([...(supplierDetail.highlights || []), ...base.features, ...supplierDetail.rooms.flatMap((room) => room.features)])] } : base;
  }, [initialPlace, initialSlug, supplierDetail]);
  const eventContentCopy = {
    he: { name: "מתחם אירועים מאומת", location: "ישראל", description: (name: string, location: string) => `${name} הוא מתחם אירועים ב${location}. כאן תוכלו לראות תמונות, מתקנים, קיבולת ודרכי יצירת קשר.`, unit: "מתחם אירוח", policy: "הערות ותנאים נוספים מאושרים ישירות מול המקום." },
    en: { name: "Verified event venue", location: "Israel", description: (name: string, location: string) => `${name} is a verified event venue in ${location}. Explore its photos, amenities, capacity and contact options.`, unit: "Event space", policy: "Additional notes and terms are confirmed directly with the venue." },
    ru: { name: "Проверенная площадка", location: "Израиль", description: (name: string, location: string) => `${name} — проверенная площадка для мероприятий в регионе ${location}. Здесь доступны фотографии, удобства, вместимость и способы связи.`, unit: "Площадка", policy: "Дополнительные примечания и условия подтверждаются непосредственно площадкой." },
    fr: { name: "Lieu événementiel vérifié", location: "Israël", description: (name: string, location: string) => `${name} est un lieu événementiel vérifié situé en ${location}. Consultez les photos, les équipements, la capacité et les moyens de contact.`, unit: "Espace événementiel", policy: "Les remarques et conditions complémentaires sont confirmées directement avec le lieu." },
  }[language];
  const safeEventText = (value: string | undefined | null, fallback: string) => localizedBusinessText(value, language, translate, fallback);
  const localizedPlaceName = safeEventText(place.name, latinBusinessAlias(place.name) || eventContentCopy.name);
  const localizedArea = safeEventText(place.area, eventContentCopy.location);
  const localizedLocation = safeEventText(place.location, localizedArea);
  const localizedDescription = safeEventText(place.description, eventContentCopy.description(localizedPlaceName, localizedLocation));
  const ownerWhatsapp = place.contact?.whatsapp;
  const ownerPhone = place.contact?.phone;
  const phoneHref = ownerPhone ? `tel:${ownerPhone.replace(/[^\d+]/g, "")}` : undefined;
  const sectionLinks = useMemo<DetailSectionLink[]>(() => [
    ...(place.description ? [{ href: "#event-about" as const, label: translate("על המקום") }] : []),
    ...(place.features.length ? [{ href: "#event-features" as const, label: translate("מתקנים") }] : []),
    { href: "#accessibility", label: translate("נגישות") },
    { href: "#event-map", label: translate("מיקום") },
    { href: "#reviews", label: translate("חוות דעת") },
    { href: "#event-booking", label: translate("הזמנה") },
  ], [place.description, place.features.length, translate]);
  const eventProviders = useMemo(() => {
    const masu = providerProfiles.find((item) => item.id === "masu-home-wellness");
    const otherProviders = providerProfiles.filter((item) => item.id !== "masu-home-wellness");
    const start = place.slug.length % otherProviders.length;
    return [masu, ...otherProviders.slice(start), ...otherProviders.slice(0, start)].filter((item): item is (typeof providerProfiles)[number] => Boolean(item)).slice(0, 3);
  }, [place.slug]);

  async function submitInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitState === "submitting" || submitState === "success") return;
    setSubmitState("submitting");
    const form = event.currentTarget;
    const values = new FormData(form);
    const id = submissionId || crypto.randomUUID();
    if (!submissionId) setSubmissionId(id);
    try {
      const response = await fetch("/api/leads/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: id,
          purpose: "booking",
          world: "events",
          name: values.get("name"),
          phone: values.get("phone"),
          organization: place.name,
          location: `${place.location}, ${place.area}`,
          message: `בקשת התאמה ל${place.name}. תאריך: ${values.get("date")}. משתתפים: ${values.get("guests")}. מועד: ${eventSlot ? eventSlotCopy.he[eventSlot] : eventSlotCopy.he.both}. סוג אירוע: ${values.get("eventType")}.`,
          honey: values.get("company_site"),
          privacyAccepted: values.get("privacy") === "on",
          sourcePage: window.location.href,
        }),
      });
      const result = await response.json() as { success?: boolean; reference?: string };
      if (!response.ok || !result.success) throw new Error("submission failed");
      setReference(result.reference || "");
      setSubmitState("success");
    } catch {
      setSubmitState("error");
    }
  }

  return (
    <PageShell variant="events">
      <ViewedItemTracker id={place.slug} world="events" name={place.name} location={`${place.location}, ${place.area}`} image={place.image} href={eventPlaceHref(place)} meta={`${place.type} · עד ${place.guests} אורחים ביחידה הגדולה`} />
      <main id="main-content" className="event-place-page">
        <BreadcrumbTrail items={[{ name: "ראשי", path: "/" }, { name: "אירועים", path: "/events" }, { name: "מקומות לאירועים", path: "/events/search" }, { name: localizedPlaceName }]} />
        <section className="shell property-title event-title"><div><span className="eyebrow">{safeEventText(place.type, eventContentCopy.name)}</span><h1>{localizedPlaceName}</h1><p><PinIcon />{localizedLocation}, {localizedArea}</p></div><div className="property-title__side"><div className="property-title__actions property-title__actions--contact"><FavoriteButton compact={false} id={place.slug} world="events" name={place.name} location={`${place.location}, ${place.area}`} image={place.image} href={eventPlaceHref(place)} meta={`${place.type} · עד ${place.guests} אורחים ביחידה הגדולה`} />{phoneHref ? phoneRevealed ? <a className="property-phone-action property-phone-action--revealed" href={phoneHref} aria-label={`${translate("חיוג אל")} ${localizedPlaceName}, ${ownerPhone}`}><PhoneIcon /><span dir="ltr">{ownerPhone}</span></a> : <button className="property-phone-action" type="button" onClick={() => { setPhoneRevealed(true); trackPhoneReveal({ placeId: place.slug, placeName: place.name, world: "events", placement: "event_detail" }); }} aria-expanded="false"><PhoneIcon /><span>{translate("הצגת מספר")}</span></button> : null}<ShareButton title={place.name} kind="event" />{ownerWhatsapp ? <WhatsAppLeadButton world="events" placeId={place.slug} placeName={place.name} businessPhone={ownerWhatsapp} serviceName={place.type} buttonClassName="property-whatsapp-action" /> : null}</div><a className="button primary" href="#event-booking">{translate("בדיקת אירוע")}</a></div></section>
        <PropertyGallery className="shell" images={place.images} name={localizedPlaceName} onOpen={(index) => openGallery("all", index)} />

        <DetailStickyDock name={localizedPlaceName} location={`${localizedLocation}, ${localizedArea}`} sections={sectionLinks} onlineHref="#event-booking" onlineLabel="בדיקת תאריך לאירוע" />

        <div className="shell event-place-layout">
          <div>
            {place.description ? <section id="event-about"><span className="eyebrow">{translate("כל מה שחשוב לדעת")}</span><h2>{translate("על המקום")}</h2><p>{localizedDescription}</p></section> : null}
            {place.features.length ? <section id="event-features"><h2>{translate("מתקנים ואפשרויות")}</h2><div className="feature-list">{localizedBusinessList(place.features, language, translate).map((feature) => <span key={feature}>✓ {feature}</span>)}</div></section> : null}
            {supplierDetail?.rooms.length ? <section className="supplier-rooms"><h2>מתחמים לפי נתוני המקום</h2><div>{supplierDetail.rooms.map((room, index) => { const features = localizedBusinessList(room.features, language, translate); return <article key={`${room.name}-${index}`}><h3>{safeEventText(room.name, `${eventContentCopy.unit} ${index + 1}`)}</h3><p>{room.quantity} {room.quantity === 1 ? "מתחם" : "מתחמים"} · עד {room.guests} משתתפים ביחידה</p>{features.length ? <div className="feature-list">{features.map((feature) => <span key={feature}>✓ {feature}</span>)}</div> : null}</article>; })}</div></section> : null}
            <ListingAccessibility slug={place.slug} />
            <section id="event-map" className="location-card"><div><span className="eyebrow">המיקום</span><h2>{localizedLocation}</h2><p>{localizedArea}</p>{typeof place.lat === "number" && typeof place.lng === "number" ? <span className="location-card__inline-note">מגדילים, מקטינים ומזיזים את המפה כאן בעמוד.</span> : <span className="location-card__inline-note">המיקום המדויק טרם נמסר על ידי המקום.</span>}</div>{typeof place.lat === "number" && typeof place.lng === "number" ? <ListingMap listings={[place]} mode="events" single autoLoad /> : null}</section>
            <section className="policies-section"><h2>חשוב לדעת</h2><div><article><b>קיבולת</b><p>עד {place.guests} אורחים ביחידה הגדולה לפי נתוני הספק. קיבולת האירוע כולו תיבדק מול המקום.</p></article><article><b>זמינות</b><p>הזמינות הסופית נבדקת מול צוות המקום לאחר שליחת הבקשה.</p></article><article><b>מחיר</b><p>המחיר תלוי בתאריך, במספר המשתתפים ובאופי האירוע.</p></article><article><b>בקשת התאמה</b><p>הטופס מועבר למערכת הלידים עם פרטי המקום והאירוע שבחרתם.</p></article>{supplierDetail?.policy.remarks ? <article><b>הערות המקום</b><p>{safeEventText(supplierDetail.policy.remarks, eventContentCopy.policy)}</p></article> : null}</div></section>
            <GuestReviewStudio placeName={localizedPlaceName} subjectId={place.slug} rating={supplierDetail?.reviewScore ?? place.score} reviewCount={supplierDetail?.reviewCount ?? place.reviews} supplierReviews={supplierDetail?.reviews} />
          </div>

          <aside id="event-booking" className="booking-card event-inquiry"><CalendarIcon /><span className="eyebrow">בדיקת אירוע</span><h2>שולחים בקשה למקום</h2>{submitState === "success" ? <div className="inquiry-success" role="status"><b>הבקשה נקלטה</b><p>הפרטים נשמרו במערכת. האירוע אינו מאושר עד לבדיקת זמינות ומחיר.</p>{reference ? <strong dir="ltr">{reference}</strong> : null}</div> : <form onSubmit={submitInquiry}><label>תאריך מבוקש<input name="date" type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} required /></label><label>כמות משתתפים<input name="guests" type="number" min="1" value={eventGuests} onChange={(event) => setEventGuests(event.target.value)} placeholder="הקלידו כמות" required /></label><ModernSelect label={slotCopy.label} value={eventSlot || "both"} onChange={(value) => setEventSlot(value === "both" ? undefined : value as EventSlot)} options={[{ value: "both", label: slotCopy.both }, { value: "morning", label: slotCopy.morning }, { value: "evening", label: slotCopy.evening }]} /><p role="status" aria-live="polite">{eventDate && Number(eventGuests) > 0 ? eventQuote : "בחרו תאריך וכמות משתתפים לבדיקה"}</p>{place.eventTypes.length ? <ModernSelect name="eventType" label="סוג האירוע" defaultValue={place.eventTypes[0]} options={place.eventTypes.map((item) => ({ value: item, label: item }))} /> : null}<label>שם מלא<input name="name" type="text" autoComplete="name" minLength={2} required /></label><label>טלפון<input name="phone" type="tel" inputMode="tel" autoComplete="tel" minLength={7} required /></label><label className="form-honey" aria-hidden="true">אתר החברה<input name="company_site" tabIndex={-1} autoComplete="off" /></label><label className="consent legal-consent"><input name="privacy" type="checkbox" required /><span>קראתי והסכמתי ל<Link href="/legal/terms">תקנון האתר</Link> ול<Link href="/legal/privacy">מדיניות הפרטיות</Link>, ואני מאשר או מאשרת טיפול בפרטים לצורך הבקשה.</span></label><button className="button primary wide" type="submit" disabled={submitState === "submitting"}>{submitState === "submitting" ? "שולחים..." : "שליחת בקשה"}</button>{submitState === "error" ? <p className="form-error" role="alert">השליחה לא הושלמה. הפרטים נשארו בטופס ואפשר לנסות שוב.</p> : null}<small>זו בקשת בירור בלבד. אין חיוב או אישור הזמנה.</small></form>}</aside>
        </div>

        <section className="section property-complements">
          <div className="shell">
            <div className="section-head"><div><span className="eyebrow">מרכיבים את כל האירוע</span><h2>ספקים שיכולים להשלים את החגיגה</h2></div><Link href="/providers">לכל הספקים</Link></div>
            <p className="property-complements__note">הפרטים מבוססים על מידע ציבורי. ספק שלא אומת כשותף פעיל מסומן כך בעמוד שלו, והזמינות מאושרת לפני הזמנה.</p>
            <div className="discovery-grid discovery-grid--compact">{eventProviders.map((item) => <DiscoveryCard key={item.id} item={item} />)}</div>
          </div>
        </section>

        <div className="section shell"><MasuExperience context="event" /></div>

        <section className="section section-tint"><div className="shell"><div className="section-head"><h2>מקומות נוספים לאירוע</h2></div><div className="event-more-grid">{nearbyRecommendations(relatedPlaces || eventPlaces, place, { key: (entry) => entry.slug, exclude: place.slug, limit: 3 }).items.map((item) => { const name = safeEventText(item.name, latinBusinessAlias(item.name) || eventContentCopy.name); const location = safeEventText(item.location, safeEventText(item.area, eventContentCopy.location)); return <PlacePreviewCard className="event-related-card" key={item.slug} name={name} image={item.image} images={item.images} href={eventPlaceHref(item)}><div><b>{name}</b><span>{location} · עד {item.guests} אורחים ביחידה הגדולה</span></div></PlacePreviewCard>; })}</div></div></section>
        <FloatingContactActions world="events" placeId={place.slug} placeName={place.name} phone={ownerPhone} whatsapp={ownerWhatsapp} serviceName={place.type} from={eventDate} guests={Number(eventGuests) || undefined} />
        <SearchAfterResults world="events" discoveryOnly location={place.location} inventory={[place, ...(relatedPlaces || [])].map(entry => ({ location: entry.location, area: entry.area, type: entry.type, eventTypes: entry.eventTypes }))} />
      </main>

      <GalleryExperience key={`${place.slug}-${galleryOpen ? `${galleryTab}-${galleryStart}` : "closed"}`} property={place} open={galleryOpen} initialIndex={galleryStart} initialTab={galleryTab} onSelectionChange={updateGallerySelection} onClose={closeGallery} />
    </PageShell>
  );
}
