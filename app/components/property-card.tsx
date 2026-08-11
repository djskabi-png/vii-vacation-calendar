"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRef, useState, type MouseEvent } from "react";
import type { ListingAvailability, ListingDateQuote, Property } from "../data/site-data";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";
import { PinIcon } from "../site-header";
import { trackPhoneReveal } from "../lib/analytics";
import { FavoriteButton } from "./favorite-button";
import { WhatsAppLeadButton } from "./whatsapp-lead-button";

function PhoneIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16.4v3a2 2 0 0 1-2.2 2 19.7 19.7 0 0 1-8.6-3.1 19.3 19.3 0 0 1-6-6A19.7 19.7 0 0 1 1.1 3.7 2 2 0 0 1 3.1 1.5h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L7.1 9.5a16 16 0 0 0 7.4 7.4l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z" /></svg>;
}

const cardCopy: Record<SiteLanguage, { call: string; whatsapp: string; reviews: string; outOfTen: string; details: string; datePrice: string; from: string; night: string; to: string; inquirePrice: string; includedGuests: (count: number) => string; availability: Record<ListingAvailability, string> }> = {
  he: { call: "טלפון", whatsapp: "פנייה בוואטסאפ", reviews: "חוות דעת", outOfTen: "מתוך 10", details: "לפרטים וזמינות", datePrice: "מחיר לפי תאריך", from: "החל מ־", night: "ללילה", to: "עד", inquirePrice: "פנה למתחם לבירור מחיר", includedGuests: (count) => `המחיר כולל עד ${count} אורחים`, availability: { available: "פנוי בתאריכים שנבחרו", unavailable: "לא פנוי בתאריכים שנבחרו", unknown: "זמינות: לא עודכן" } },
  en: { call: "Call", whatsapp: "WhatsApp enquiry", reviews: "reviews", outOfTen: "out of 10", details: "Details and availability", datePrice: "Price for selected dates", from: "From ", night: "per night", to: "to", inquirePrice: "Contact the property for a price", includedGuests: (count) => `Price includes up to ${count} guests`, availability: { available: "Available for the selected dates", unavailable: "Unavailable for the selected dates", unknown: "Availability not updated" } },
  ru: { call: "Позвонить", whatsapp: "Запрос в WhatsApp", reviews: "отзывов", outOfTen: "из 10", details: "Подробнее и наличие", datePrice: "Цена на выбранные даты", from: "От ", night: "за ночь", to: "по", inquirePrice: "Уточните цену у объекта", includedGuests: (count) => `Цена включает до ${count} гостей`, availability: { available: "Свободно на выбранные даты", unavailable: "Нет мест на выбранные даты", unknown: "Наличие не обновлено" } },
  fr: { call: "Appeler", whatsapp: "Demande par WhatsApp", reviews: "avis", outOfTen: "sur 10", details: "Détails et disponibilités", datePrice: "Prix selon les dates", from: "À partir de ", night: "par nuit", to: "au", inquirePrice: "Contactez l'établissement pour connaître le prix", includedGuests: (count) => `Prix valable jusqu'à ${count} personnes`, availability: { available: "Disponible aux dates choisies", unavailable: "Indisponible aux dates choisies", unknown: "Disponibilité non mise à jour" } },
};

const phoneCopy: Record<SiteLanguage, { reveal: string; call: string }> = {
  he: { reveal: "הצגת מספר", call: "לחיוג" },
  en: { reveal: "Show number", call: "Call now" },
  ru: { reveal: "Показать номер", call: "Позвонить" },
  fr: { reveal: "Afficher le numéro", call: "Appeler" },
};

type SelectedStay = { from: string; till: string };

function localizedDate(value: string, language: SiteLanguage) {
  const locales: Record<SiteLanguage, string> = { he: "he-IL", en: "en-GB", ru: "ru-RU", fr: "fr-FR" };
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locales[language], { day: "numeric", month: "numeric" }).format(date);
}

function quoteForStay(property: Property, selectedStay: SelectedStay | null): ListingDateQuote | null {
  if (!selectedStay) return null;
  return property.dateQuotes?.find((quote) => quote.from === selectedStay.from && quote.till === selectedStay.till) || {
    ...selectedStay,
    availability: "unknown",
  };
}

export function PropertyCard({ property, selectedStay = null, promotional = false, detailHref }: { property: Property; selectedStay?: SelectedStay | null; promotional?: boolean; detailHref?: string }) {
  const { language } = useSiteLanguage();
  const copy = cardCopy[language];
  const galleryImages = [property.image, ...property.images].filter((src, index, all) => src && all.indexOf(src) === index).slice(0, 10);
  const [imageIndex, setImageIndex] = useState(0);
  const [phoneVisible, setPhoneVisible] = useState(false);
  const touchStart = useRef<number | null>(null);
  const didSwipe = useRef(false);
  const swipeResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phone = property.contact?.phone?.replace(/[^\d+]/g, "");
  const whatsapp = property.contact?.whatsapp;
  const selectedQuote = quoteForStay(property, selectedStay);
  const hasQuotedPrice = Boolean(selectedQuote?.nightlyPrice && selectedQuote?.includedGuests);
  const cardMode = promotional ? "promotional" : selectedQuote ? "dated" : "result";
  const propertyHref = detailHref || `/business?id=${property.slug}`;

  function moveImage(event: MouseEvent<HTMLButtonElement>, direction: -1 | 1) {
    event.preventDefault();
    event.stopPropagation();
    setImageIndex((current) => (current + direction + galleryImages.length) % galleryImages.length);
  }

  return (
    <article className={`stay-card stay-card--${cardMode}`}>
      <div className="stay-card__media" onTouchStart={(event) => { if (swipeResetTimer.current) clearTimeout(swipeResetTimer.current); didSwipe.current = false; touchStart.current = event.changedTouches[0].clientX; }} onTouchEnd={(event) => { if (touchStart.current === null || galleryImages.length < 2) return; const distance = event.changedTouches[0].clientX - touchStart.current; if (Math.abs(distance) > 45) { didSwipe.current = true; swipeResetTimer.current = setTimeout(() => { didSwipe.current = false; swipeResetTimer.current = null; }, 500); setImageIndex((current) => (current + (distance > 0 ? -1 : 1) + galleryImages.length) % galleryImages.length); } touchStart.current = null; }}>
        <Link href={propertyHref} aria-label={`פרטים על ${property.name}`} onClick={(event) => { if (!didSwipe.current) return; event.preventDefault(); event.stopPropagation(); didSwipe.current = false; if (swipeResetTimer.current) clearTimeout(swipeResetTimer.current); swipeResetTimer.current = null; }}>
          <img key={galleryImages[imageIndex]} src={galleryImages[imageIndex]} alt={`${property.name}, תמונה ${imageIndex + 1} מתוך ${galleryImages.length}`} loading="lazy" decoding="async" />
        </Link>
        {galleryImages.length > 1 ? <><button className="stay-card__gallery-arrow stay-card__gallery-arrow--previous" type="button" aria-label={`התמונה הקודמת של ${property.name}`} onClick={(event) => moveImage(event, -1)}><span aria-hidden="true">‹</span></button><button className="stay-card__gallery-arrow stay-card__gallery-arrow--next" type="button" aria-label={`התמונה הבאה של ${property.name}`} onClick={(event) => moveImage(event, 1)}><span aria-hidden="true">›</span></button><div className="stay-card__gallery-dots" aria-label={`בחירת תמונה של ${property.name}`}>{galleryImages.slice(0, 5).map((src, index) => { const active = imageIndex === index || index === 4 && imageIndex >= 4; return <button key={src} className={active ? "active" : ""} type="button" aria-label={`הצגת תמונה ${index + 1} של ${property.name}`} aria-current={active ? "true" : undefined} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setImageIndex(index); }} />; })}</div><span className="stay-card__gallery-count" aria-live="polite">{imageIndex + 1}/{galleryImages.length}</span></> : null}
        <FavoriteButton className="heart-button" id={property.slug} world="vacation" name={property.name} location={`${property.location}, ${property.area}`} image={property.image} href={propertyHref} meta={`${property.type} · עד ${property.guests} אורחים`} />
        <div className="stay-card__badges">{property.badges.slice(0, 2).map((badge) => <span key={badge}>{badge}</span>)}</div>
      </div>
      <div className="stay-card__body">
        <div className="stay-card__title">
          <div>
            <h3><Link href={propertyHref}>{property.name}</Link></h3>
            <p><PinIcon />{property.location}, {property.area}</p>
          </div>
          {property.score && property.reviews ? <span className="stay-card__rating" aria-label={`${property.score} ${copy.outOfTen}, ${property.reviews} ${copy.reviews}`}><b aria-hidden="true">★</b><strong>{property.score}</strong><small>({property.reviews})</small></span> : null}
        </div>
        <p className="stay-card__meta">{property.type}{property.units && property.units > 1 ? `, ${property.units} יחידות` : ", מקום אירוח שלם"} · עד {property.guests} אורחים</p>
        <div className="feature-chips">{property.features.slice(0, 3).map((feature) => <span key={feature}>{feature}</span>)}</div>
        {!promotional && selectedQuote ? <div className="stay-card__date-status" aria-live="polite">
          <div className="stay-card__selected-dates"><span>{localizedDate(selectedQuote.from, language)}</span><small>{copy.to}</small><span>{localizedDate(selectedQuote.till, language)}</span></div>
          <strong className={`stay-card__availability stay-card__availability--${selectedQuote.availability}`}>{copy.availability[selectedQuote.availability]}</strong>
        </div> : null}
        <div className={`stay-card__footer stay-card__footer--${cardMode}`}>
          {!promotional ? <div className="stay-card__commercial-summary">
            {selectedQuote ? <span className={`stay-card__price stay-card__price--selected ${hasQuotedPrice ? "stay-card__price--known" : ""}`}>{hasQuotedPrice ? <><b><bdi dir="ltr">{selectedQuote.nightlyPrice?.toLocaleString()} ₪</bdi></b><small>{copy.night}</small><em>{copy.includedGuests(selectedQuote.includedGuests || 0)}</em></> : <strong>{copy.inquirePrice}</strong>}</span> : <span className={`stay-card__price ${property.price ? "stay-card__price--known" : ""}`}>{property.price ? <><small>{copy.from}</small><b><bdi dir="ltr">{property.price.toLocaleString()} ₪</bdi></b><small>{copy.night}</small></> : copy.datePrice}</span>}
          </div> : null}
          <div className="stay-card__actions">
            <Link className="stay-card__details-link" href={propertyHref}>{copy.details}</Link>
            {!promotional && phone ? phoneVisible
              ? <a className="stay-card__contact stay-card__contact--phone stay-card__contact--revealed" href={`tel:${phone}`} aria-label={`${phoneCopy[language].call}: ${property.name}`}><PhoneIcon /><bdi>{property.contact?.phone}</bdi></a>
              : <button className="stay-card__contact stay-card__contact--phone" type="button" aria-expanded={phoneVisible} onClick={() => { setPhoneVisible(true); trackPhoneReveal({ placeId: property.slug, placeName: property.name, world: "vacation", placement: "property_card" }); }}><PhoneIcon /><span>{phoneCopy[language].reveal}</span></button>
            : null}
            {!promotional && whatsapp ? <WhatsAppLeadButton world="vacation" placeId={property.slug} placeName={property.name} businessPhone={whatsapp} serviceName={property.type} initialDate={selectedStay?.from} buttonLabel={copy.whatsapp} buttonClassName="stay-card__contact stay-card__contact--whatsapp" /> : null}
          </div>
        </div>
      </div>
    </article>
  );
}
