"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRef, useState, type MouseEvent } from "react";
import type { ListingAvailability, ListingDateQuote, Property } from "../data/site-data";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";
import { PinIcon } from "../site-header";
import { FavoriteButton } from "./favorite-button";

function PhoneIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.7 3.5 9 3a1.6 1.6 0 0 1 1.8 1l1 3a1.6 1.6 0 0 1-.5 1.7L9.7 10a14 14 0 0 0 4.3 4.3l1.3-1.6a1.6 1.6 0 0 1 1.7-.5l3 1a1.6 1.6 0 0 1 1 1.8l-.5 2.3a3 3 0 0 1-3 2.4A15.5 15.5 0 0 1 4.3 6.5a3 3 0 0 1 2.4-3Z" /></svg>;
}

function WhatsAppIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.7a8 8 0 0 1-11.8 7l-4.2 1.1 1.1-4.1A8 8 0 1 1 20 11.7Z" /><path d="M8.6 7.8c.2-.4.4-.4.7-.4h.4c.2 0 .4.1.5.4l.8 1.8c.1.3.1.5-.1.7l-.6.8c-.2.2-.1.4 0 .6.6 1 1.5 1.8 2.5 2.4.3.2.5.2.7-.1l.8-1c.2-.3.5-.3.8-.2l1.8.9c.3.1.4.3.4.5 0 .5-.2 1.4-.8 1.9-.7.6-1.6.8-2.6.5-1-.3-2.3-.8-4-2.3-1.4-1.2-2.4-2.8-2.7-3.8-.3-1-.1-2 .4-2.7Z" /></svg>;
}

const cardCopy: Record<SiteLanguage, { call: string; whatsapp: string; reviews: string; outOfTen: string; details: string; datePrice: string; from: string; night: string; to: string; inquirePrice: string; includedGuests: (count: number) => string; availability: Record<ListingAvailability, string> }> = {
  he: { call: "טלפון", whatsapp: "WhatsApp", reviews: "חוות דעת", outOfTen: "מתוך 10", details: "לפרטים וזמינות", datePrice: "מחיר לפי תאריך", from: "החל מ־", night: "ללילה", to: "עד", inquirePrice: "פנה למתחם לבירור מחיר", includedGuests: (count) => `המחיר כולל עד ${count} אורחים`, availability: { available: "פנוי בתאריכים שנבחרו", unavailable: "לא פנוי בתאריכים שנבחרו", unknown: "זמינות: לא עודכן" } },
  en: { call: "Call", whatsapp: "WhatsApp", reviews: "reviews", outOfTen: "out of 10", details: "Details and availability", datePrice: "Price for selected dates", from: "From ", night: "per night", to: "to", inquirePrice: "Contact the property for a price", includedGuests: (count) => `Price includes up to ${count} guests`, availability: { available: "Available for the selected dates", unavailable: "Unavailable for the selected dates", unknown: "Availability not updated" } },
  ru: { call: "Позвонить", whatsapp: "WhatsApp", reviews: "отзывов", outOfTen: "из 10", details: "Подробнее и наличие", datePrice: "Цена на выбранные даты", from: "От ", night: "за ночь", to: "по", inquirePrice: "Уточните цену у объекта", includedGuests: (count) => `Цена включает до ${count} гостей`, availability: { available: "Свободно на выбранные даты", unavailable: "Нет мест на выбранные даты", unknown: "Наличие не обновлено" } },
  fr: { call: "Appeler", whatsapp: "WhatsApp", reviews: "avis", outOfTen: "sur 10", details: "Détails et disponibilités", datePrice: "Prix selon les dates", from: "À partir de ", night: "par nuit", to: "au", inquirePrice: "Contactez l'établissement pour connaître le prix", includedGuests: (count) => `Prix valable jusqu'à ${count} personnes`, availability: { available: "Disponible aux dates choisies", unavailable: "Indisponible aux dates choisies", unknown: "Disponibilité non mise à jour" } },
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

export function PropertyCard({ property, selectedStay = null }: { property: Property; selectedStay?: SelectedStay | null }) {
  const { language } = useSiteLanguage();
  const copy = cardCopy[language];
  const galleryImages = [property.image, ...property.images].filter((src, index, all) => src && all.indexOf(src) === index).slice(0, 10);
  const [imageIndex, setImageIndex] = useState(0);
  const touchStart = useRef<number | null>(null);
  const didSwipe = useRef(false);
  const swipeResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phone = property.contact?.phone?.replace(/[^\d+]/g, "");
  const whatsapp = property.contact?.whatsapp?.replace(/\D/g, "");
  const selectedQuote = quoteForStay(property, selectedStay);
  const hasQuotedPrice = Boolean(selectedQuote?.nightlyPrice && selectedQuote?.includedGuests);

  function moveImage(event: MouseEvent<HTMLButtonElement>, direction: -1 | 1) {
    event.preventDefault();
    event.stopPropagation();
    setImageIndex((current) => (current + direction + galleryImages.length) % galleryImages.length);
  }

  return (
    <article className="stay-card">
      <div className="stay-card__media" onTouchStart={(event) => { if (swipeResetTimer.current) clearTimeout(swipeResetTimer.current); didSwipe.current = false; touchStart.current = event.changedTouches[0].clientX; }} onTouchEnd={(event) => { if (touchStart.current === null || galleryImages.length < 2) return; const distance = event.changedTouches[0].clientX - touchStart.current; if (Math.abs(distance) > 45) { didSwipe.current = true; swipeResetTimer.current = setTimeout(() => { didSwipe.current = false; swipeResetTimer.current = null; }, 500); setImageIndex((current) => (current + (distance > 0 ? -1 : 1) + galleryImages.length) % galleryImages.length); } touchStart.current = null; }}>
        <Link href={`/business?id=${property.slug}`} aria-label={`פרטים על ${property.name}`} onClick={(event) => { if (!didSwipe.current) return; event.preventDefault(); event.stopPropagation(); didSwipe.current = false; if (swipeResetTimer.current) clearTimeout(swipeResetTimer.current); swipeResetTimer.current = null; }}>
          <img key={galleryImages[imageIndex]} src={galleryImages[imageIndex]} alt={`${property.name}, תמונה ${imageIndex + 1} מתוך ${galleryImages.length}`} loading="lazy" decoding="async" />
        </Link>
        {galleryImages.length > 1 ? <><button className="stay-card__gallery-arrow stay-card__gallery-arrow--previous" type="button" aria-label={`התמונה הקודמת של ${property.name}`} onClick={(event) => moveImage(event, -1)}><span aria-hidden="true">‹</span></button><button className="stay-card__gallery-arrow stay-card__gallery-arrow--next" type="button" aria-label={`התמונה הבאה של ${property.name}`} onClick={(event) => moveImage(event, 1)}><span aria-hidden="true">›</span></button><div className="stay-card__gallery-dots" aria-label={`בחירת תמונה של ${property.name}`}>{galleryImages.slice(0, 5).map((src, index) => { const active = imageIndex === index || index === 4 && imageIndex >= 4; return <button key={src} className={active ? "active" : ""} type="button" aria-label={`הצגת תמונה ${index + 1} של ${property.name}`} aria-current={active ? "true" : undefined} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setImageIndex(index); }} />; })}</div><span className="stay-card__gallery-count" aria-live="polite">{imageIndex + 1}/{galleryImages.length}</span></> : null}
        <FavoriteButton className="heart-button" id={property.slug} world="vacation" name={property.name} location={`${property.location}, ${property.area}`} image={property.image} href={`/business?id=${property.slug}`} meta={`${property.type} · עד ${property.guests} אורחים`} />
        <div className="stay-card__badges">{property.badges.slice(0, 2).map((badge) => <span key={badge}>{badge}</span>)}</div>
      </div>
      <div className="stay-card__body">
        <div className="stay-card__title">
          <div>
            <h3><Link href={`/business?id=${property.slug}`}>{property.name}</Link></h3>
            <p><PinIcon />{property.location}, {property.area}</p>
          </div>
          {property.score && property.reviews ? <span className="stay-card__rating" aria-label={`${property.score} ${copy.outOfTen}, ${property.reviews} ${copy.reviews}`}><b aria-hidden="true">★</b><strong>{property.score}</strong><small>({property.reviews})</small></span> : null}
        </div>
        <p className="stay-card__meta">{property.type}{property.units && property.units > 1 ? `, ${property.units} יחידות` : ", מקום אירוח שלם"} · עד {property.guests} אורחים</p>
        <div className="feature-chips">{property.features.slice(0, 3).map((feature) => <span key={feature}>{feature}</span>)}</div>
        {selectedQuote ? <div className="stay-card__date-status" aria-live="polite">
          <div className="stay-card__selected-dates"><span>{localizedDate(selectedQuote.from, language)}</span><small>{copy.to}</small><span>{localizedDate(selectedQuote.till, language)}</span></div>
          <strong className={`stay-card__availability stay-card__availability--${selectedQuote.availability}`}>{copy.availability[selectedQuote.availability]}</strong>
        </div> : null}
        <div className="stay-card__footer">
          {selectedQuote ? <span className={`stay-card__price stay-card__price--selected ${hasQuotedPrice ? "stay-card__price--known" : ""}`}>{hasQuotedPrice ? <><b><bdi>{selectedQuote.nightlyPrice?.toLocaleString()}</bdi> ₪</b><small>{copy.night}</small><em>{copy.includedGuests(selectedQuote.includedGuests || 0)}</em></> : <strong>{copy.inquirePrice}</strong>}</span> : <span className={`stay-card__price ${property.price ? "stay-card__price--known" : ""}`}>{property.price ? <><small>{copy.from}</small><b><bdi>{property.price.toLocaleString()}</bdi> ₪</b><small>{copy.night}</small></> : copy.datePrice}</span>}
          <div className="stay-card__actions">
            {phone ? <a className="stay-card__contact" href={`tel:${phone}`} aria-label={`${copy.call}: ${property.name}`}><PhoneIcon /><span>{copy.call}</span></a> : null}
            {whatsapp ? <a className="stay-card__contact stay-card__contact--whatsapp" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" aria-label={`${copy.whatsapp}: ${property.name}`}><WhatsAppIcon /><span>{copy.whatsapp}</span></a> : null}
            <Link className="stay-card__details-link" href={`/business?id=${property.slug}`}>{copy.details}</Link>
          </div>
        </div>
      </div>
    </article>
  );
}
