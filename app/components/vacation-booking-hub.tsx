"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Property, StayOption } from "../data/site-data";
import type { ResolvedAvailability } from "./property-card";
import { CalendarIcon } from "../site-header";
import { WhatsAppLeadButton } from "./whatsapp-lead-button";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";
import { legacyAvailabilitySourceFor } from "../lib/legacy-availability-sources";

type VacationBookingHubProps = {
  property: Property;
  dates: string;
  from: string;
  till: string;
  guests: number;
  selectedPrice: string;
  availability: ResolvedAvailability | null;
  bookingHref: string;
  ownerWhatsapp?: string;
  phoneHref?: string;
  illustrative?: boolean;
  onOpenCalendar: () => void;
  onGuestsChange: (guests: number) => void;
};

type BookingState = "choose-dates" | "available-price" | "price-only" | "available-no-price" | "no-data" | "unavailable" | "unavailable-alternatives" | "unavailable-price" | "too-many-guests";

function countNights(from: string, till: string) {
  const arrival = Date.parse(`${from}T00:00:00Z`);
  const departure = Date.parse(`${till}T00:00:00Z`);
  if (!Number.isFinite(arrival) || !Number.isFinite(departure) || departure <= arrival) return 0;
  return Math.round((departure - arrival) / 86_400_000);
}

function bookingUnits(property: Property): StayOption[] {
  if (property.roomOptions?.length) return property.roomOptions;
  return [{ name: property.name, quantity: property.scenario === "multi" ? Math.max(1, property.units || 1) : 1, guests: property.guests, bedrooms: property.bedrooms || 1, image: property.image, features: property.features }];
}

const languageLocales: Record<SiteLanguage, string> = {
  he: "he-IL",
  en: "en-GB",
  ru: "ru-RU",
  fr: "fr-FR",
};

function localizedShortDate(value: string, language: SiteLanguage) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(languageLocales[language], { day: "numeric", month: "short" }).format(date);
}

function localizedDateRange(from: string, till: string, fallback: string, language: SiteLanguage) {
  if (!from || !till) return fallback;
  const separator: Record<SiteLanguage, string> = { he: " עד ", en: " to ", ru: " – ", fr: " au " };
  return `${localizedShortDate(from, language)}${separator[language]}${localizedShortDate(till, language)}`;
}

function bookingState(hasDates: boolean, guests: number, property: Property, availability: ResolvedAvailability | null, nightlyPrice: number): BookingState {
  if (!hasDates) return "choose-dates";
  if (guests > property.guests) return "too-many-guests";
  if (!availability) return "no-data";
  if (availability.availability === "available") return nightlyPrice > 0 ? "available-price" : "available-no-price";
  if (availability.availability === "unavailable") {
    if (availability.alternatives?.length) return "unavailable-alternatives";
    return nightlyPrice > 0 ? "unavailable-price" : "unavailable";
  }
  return nightlyPrice > 0 ? "price-only" : "no-data";
}

function stateCopy(state: BookingState) {
  if (state === "choose-dates") return { title: "בדיקת תאריך", text: "בחרו תאריכים כדי לראות זמינות ומחיר" };
  if (state === "available-price") return { title: "פנוי ויש מחיר", text: "אפשר להמשיך עכשיו להזמנה מהירה" };
  if (state === "available-no-price") return { title: "פנוי, המחיר דורש אישור", text: "פונים למקום לקבלת מחיר מדויק" };
  if (state === "price-only") return { title: "יש מחיר, הזמינות טרם אושרה", text: "נבדוק מול המקום לפני הזמנה" };
  if (state === "no-data") return { title: "אין עדיין מידע לזמן הזה", text: "אפשר לשלוח בקשת זמינות מסודרת" };
  if (state === "unavailable-alternatives") return { title: "לא פנוי, נמצאו תאריכים חלופיים", text: "אפשר לבחור חלופה או לשנות תאריכים" };
  if (state === "unavailable-price") return { title: "לא פנוי בתאריכים שבחרתם", text: "אפשר לבחור תאריך אחר" };
  if (state === "too-many-guests") return { title: "ההרכב גדול מתפוסת המקום", text: "עדכנו את כמות האורחים כדי להמשיך" };
  return { title: "לא פנוי בתאריכים שבחרתם", text: "בחרו תאריך אחר ובדקו שוב" };
}

function bedroomsCopy(bedrooms: number) {
  return bedrooms === 1 ? "חדר שינה אחד" : `${bedrooms} חדרי שינה`;
}

function unitBookingHref(baseHref: string, index: number, nightlyPrice?: number) {
  const [pathname, query = ""] = baseHref.split("?");
  const params = new URLSearchParams(query);
  params.set("unitIndex", String(index + 1));
  if (nightlyPrice && nightlyPrice > 0) params.set("price", String(nightlyPrice));
  return `${pathname}?${params.toString()}`;
}

export function VacationBookingHub({ property, dates, from, till, guests, selectedPrice, availability, bookingHref, ownerWhatsapp, phoneHref, illustrative = false, onOpenCalendar, onGuestsChange }: VacationBookingHubProps) {
  const { language, translate } = useSiteLanguage();
  const [dialogOpen, setDialogOpen] = useState(false);
  const launchRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const units = bookingUnits(property);
  const nights = countNights(from, till);
  const hasDates = Boolean(from && till && nights > 0);
  const suppliedPrice = Number(selectedPrice) > 0 ? Number(selectedPrice) : 0;
  const rawNightlyPrice = availability?.nightlyPrice || (illustrative || property.demoOperations?.fictional ? suppliedPrice : 0);
  const nightlyPrice = rawNightlyPrice;
  const state = bookingState(hasDates, guests, property, availability, nightlyPrice);
  const minimumStayNotMet = Boolean(hasDates && availability?.minimumNights && nights < availability.minimumNights);
  const summary = minimumStayNotMet
    ? { title: `נדרשים לפחות ${availability?.minimumNights} לילות`, text: "הוסיפו לילה כדי לבדוק את ההזמנה" }
    : stateCopy(state);
  const quickBooking = state === "available-price";
  const unavailable = state === "unavailable" || state === "unavailable-price" || state === "unavailable-alternatives" || state === "too-many-guests";
  const totalPrice = nightlyPrice > 0 && nights > 0 ? nightlyPrice * nights : 0;
  const displayDates = localizedDateRange(from, till, dates, language);
  const numberLocale = languageLocales[language];
  const unitPriceCopy = {
    he: { night: " ליחידה", stay: " ליחידה אחת" },
    en: { night: " per unit", stay: " for one unit" },
    ru: { night: " за единицу", stay: " за одну единицу" },
    fr: { night: " par unité", stay: " pour une unité" },
  }[language];
  const unitAvailability = units.map((room, index) => ({
    room,
    index,
    quote: availability?.units?.find((unit) => unit.index === index),
  }));
  const availableUnitCount = unitAvailability.filter(({ quote }) => quote?.availability === "available").length;
  // A legacy quote describes sellable units only when the property model and the
  // source response have the same unit catalog. Never mix a live whole-property
  // quote with older editorial room prices, because that creates two prices for
  // what appears to be the same booking.
  const usesLiveLegacyAvailability = Boolean(legacyAvailabilitySourceFor(property.slug));
  const hasUnitAvailability = property.scenario === "multi"
    && Boolean(availability?.units?.length)
    && (!usesLiveLegacyAvailability || availability!.units!.length === units.length);
  const unitCopy = {
    he: { available: "פנויה בתאריכים שבחרתם", unavailable: "לא פנויה בתאריכים שבחרתם", confirm: "הזמינות תאושר מול המקום", confirmPrice: "המחיר דורש אישור", otherDate: "אפשר לבדוק תאריך אחר", quick: "הזמנה מהירה של", checkOther: "בדיקת תאריך אחר", check: "בדיקת זמינות", checkDates: "בדיקת תאריכים ל", choose: "בחרו יחידה פנויה מהרשימה", availableCount: (count: number, total: number) => `${count} מתוך ${total} יחידות פנויות`, perNight: "ללילה", totalStay: "לכל השהייה" },
    en: { available: "Available for your selected dates", unavailable: "Unavailable for your selected dates", confirm: "Availability will be confirmed with the property", confirmPrice: "Price needs confirmation", otherDate: "You can check another date", quick: "Quick book", checkOther: "Check another date", check: "Check availability for", checkDates: "Check dates for", choose: "Choose an available unit from the list", availableCount: (count: number, total: number) => `${count} of ${total} units available`, perNight: "per night", totalStay: "for the entire stay" },
    ru: { available: "Доступна на выбранные даты", unavailable: "Недоступна на выбранные даты", confirm: "Доступность подтвердит объект", confirmPrice: "Цена требует подтверждения", otherDate: "Можно проверить другую дату", quick: "Быстро забронировать", checkOther: "Проверить другую дату", check: "Проверить доступность", checkDates: "Проверить даты для", choose: "Выберите доступный вариант из списка", availableCount: (count: number, total: number) => `Доступно ${count} из ${total}`, perNight: "за ночь", totalStay: "за всё проживание" },
    fr: { available: "Disponible aux dates choisies", unavailable: "Indisponible aux dates choisies", confirm: "La disponibilité sera confirmée par l’établissement", confirmPrice: "Prix à confirmer", otherDate: "Vous pouvez vérifier une autre date", quick: "Réservation rapide", checkOther: "Vérifier une autre date", check: "Vérifier la disponibilité de", checkDates: "Vérifier les dates pour", choose: "Choisissez une unité disponible dans la liste", availableCount: (count: number, total: number) => `${count} unité(s) disponible(s) sur ${total}`, perNight: "par nuit", totalStay: "pour tout le séjour" },
  }[language];

  useEffect(() => {
    if (!dialogOpen) return;
    const launcher = launchRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus({ preventScroll: true });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialogOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      launcher?.focus();
    };
  }, [dialogOpen]);

  const openCalendar = () => {
    setDialogOpen(false);
    onOpenCalendar();
  };

  return <section id="booking-summary" className={`vacation-booking-hub vacation-booking-hub--${state}`} aria-labelledby="vacation-booking-title">
    <h2 id="vacation-booking-title" className="sr-only">בדיקת תאריכים והזמנה</h2>

    <div className="vacation-booking-hub__launcher-row">
    <button ref={launchRef} type="button" className="vacation-booking-hub__launcher" onClick={() => setDialogOpen(true)} aria-haspopup="dialog">
      <span className="vacation-booking-hub__launcher-icon"><CalendarIcon /></span>
      <span className="vacation-booking-hub__launcher-copy">
        <small>{hasDates ? "התאריכים שבחרתם" : "תאריכים ואורחים"}</small>
        <strong>{hasDates ? displayDates : "בדיקת זמינות"}</strong>
      </span>
      <span className="vacation-booking-hub__launcher-meta">
        <small>{guests} אורחים</small>
        {nightlyPrice > 0 ? <b>{nightlyPrice.toLocaleString(numberLocale)} ₪ ללילה{property.scenario === "multi" ? unitPriceCopy.night : ""}</b> : hasDates ? <b>{hasUnitAvailability ? unitCopy.availableCount(availableUnitCount, units.length) : summary.title}</b> : null}
      </span>
      <span className="vacation-booking-hub__launcher-action">{hasDates ? "שינוי" : "בחירה"}</span>
    </button>
    {quickBooking ? <Link className="button primary vacation-booking-hub__quick-book" href={bookingHref}>הזמנה מהירה</Link> : null}
    </div>

    {dialogOpen ? <div className="vacation-booking-dialog-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialogOpen(false); }}>
      <section ref={dialogRef} tabIndex={-1} className="vacation-booking-dialog" role="dialog" aria-modal="true" aria-labelledby="vacation-booking-dialog-title" aria-describedby="vacation-booking-dialog-description">
        <header className="vacation-booking-dialog__header">
          <div>
            <small>{property.name}</small>
            <h2 id="vacation-booking-dialog-title">בדיקת תאריכים והזמנה</h2>
            <p id="vacation-booking-dialog-description">תאריך, אורחים ויחידה במקום אחד.</p>
          </div>
          <button type="button" className="vacation-booking-dialog__close" onClick={() => setDialogOpen(false)} aria-label="סגירת פרטי ההזמנה">×</button>
        </header>

        <div className="vacation-booking-dialog__body">
          <div className="vacation-booking-dialog__selection" aria-label="פרטי השהייה">
            <button type="button" className="vacation-booking-dialog__date" onClick={openCalendar} aria-label={`בחירת תאריכי שהייה, ${displayDates}`}>
              <CalendarIcon />
              <span><small>תאריכי השהייה</small><strong>{displayDates}</strong></span>
              <b>עריכה</b>
            </button>
            <div className="vacation-booking-dialog__guests" role="group" aria-label="כמות אורחים">
              <span><small>כמות אורחים</small><strong aria-live="polite">{guests} אורחים</strong></span>
              <div>
                <button type="button" onClick={() => onGuestsChange(Math.max(1, guests - 1))} disabled={guests <= 1} aria-label="הפחתת אורח">−</button>
                <button type="button" onClick={() => onGuestsChange(Math.min(property.guests, guests + 1))} disabled={guests >= property.guests} aria-label="הוספת אורח">+</button>
              </div>
            </div>
          </div>

          <div className={`vacation-booking-dialog__status vacation-booking-dialog__status--${unavailable ? "unavailable" : quickBooking || state === "available-no-price" ? "available" : "confirm"}`} role="status" aria-live="polite">
            <span aria-hidden="true"></span>
            <div><strong>{summary.title}</strong><small>{summary.text}</small></div>
            {nightlyPrice > 0 ? <b>{totalPrice ? `${totalPrice.toLocaleString(numberLocale)} ₪` : `${nightlyPrice.toLocaleString(numberLocale)} ₪`}</b> : null}
          </div>

          {availability?.alternatives?.length ? <div className="vacation-booking-dialog__alternatives"><strong>תאריכים חלופיים</strong><div>{availability.alternatives.map((alternative) => <button type="button" key={`${alternative.from}-${alternative.till}`} onClick={openCalendar}><span>{localizedDateRange(alternative.from, alternative.till, "", language)}</span><b>{alternative.nightlyPrice.toLocaleString(numberLocale)} ₪</b></button>)}</div></div> : null}

          {hasUnitAvailability ? <div className="vacation-booking-dialog__units">
            <div className="vacation-booking-dialog__units-heading">
              <div><small>{property.scenario === "single" ? "המקום כולו" : `${units.length} סוגי יחידות`}</small><h3>{property.scenario === "single" ? property.name : "יחידות אירוח לבחירה"}</h3></div>
              <span>{property.scenario === "single" ? `עד ${property.guests} אורחים` : "הפרטים המלאים לפי צורך"}</span>
            </div>
            <div className="vacation-booking-dialog__unit-list">
              {unitAvailability.map(({ room, index, quote }) => {
                const isAvailable = quote?.availability === "available";
                const isUnavailable = quote?.availability === "unavailable";
                const unitNightlyPrice = quote?.nightlyPrice;
                const unitTotalPrice = quote?.totalPrice || (unitNightlyPrice && nights > 0 ? unitNightlyPrice * nights : 0);
                return <article className={`vacation-booking-dialog__unit${isAvailable ? " is-available" : isUnavailable ? " is-unavailable" : ""}`} key={room.name}>
                  <img className="vacation-booking-dialog__unit-image" src={room.image} alt="" loading="lazy" />
                  <div className="vacation-booking-dialog__unit-content">
                    <div className="vacation-booking-dialog__unit-main">
                      <span className="vacation-booking-dialog__unit-mark" aria-hidden="true"></span>
                      <div><h4>{room.name}</h4><p>עד {room.guests} אורחים · {bedroomsCopy(room.bedrooms)}{room.area ? ` · ${room.area} מ״ר` : ""}</p></div>
                      {property.scenario === "multi" && room.quantity > 1 ? <b>{`${room.quantity} יחידות`}</b> : null}
                    </div>
                    {hasDates ? <div className="vacation-booking-dialog__unit-availability" role="status">
                      <div>
                        <strong>{isAvailable ? unitCopy.available : isUnavailable ? unitCopy.unavailable : unitCopy.confirm}</strong>
                        {unitNightlyPrice ? <small>{unitNightlyPrice.toLocaleString(numberLocale)} ₪ {unitCopy.perNight}{unitTotalPrice ? ` · ${unitTotalPrice.toLocaleString(numberLocale)} ₪ ${unitCopy.totalStay}` : ""}</small> : <small>{isAvailable ? unitCopy.confirmPrice : unitCopy.otherDate}</small>}
                      </div>
                    {isAvailable && unitNightlyPrice ? <Link className="button primary vacation-booking-dialog__unit-action" href={unitBookingHref(bookingHref, index, unitNightlyPrice)}>{unitCopy.quick} {translate(room.name)}</Link>
                        : isUnavailable ? <button className="button secondary vacation-booking-dialog__unit-action" type="button" onClick={openCalendar}>{unitCopy.checkOther}</button>
                          : ownerWhatsapp ? <WhatsAppLeadButton world="vacation" placeId={property.slug} placeName={property.name} businessPhone={ownerWhatsapp} serviceName={`${unitCopy.check} ${translate(room.name)}`} initialDate={from} initialGuests={guests} buttonLabel={`${unitCopy.check} ${translate(room.name)}`} buttonClassName="button secondary vacation-booking-dialog__unit-action" /> : null}
                    </div> : <button className="button secondary vacation-booking-dialog__unit-action vacation-booking-dialog__unit-action--dates" type="button" onClick={openCalendar}>{unitCopy.checkDates} {translate(room.name)}</button>}
                    {room.features.length ? <details><summary>מה כלול</summary><p>{room.features.slice(0, 5).join(" · ")}</p></details> : null}
                  </div>
                </article>;
              })}
            </div>
          </div> : null}
        </div>

        <footer className="vacation-booking-dialog__footer">
          {nightlyPrice > 0 || illustrative ? <div className="vacation-booking-dialog__footer-copy">
            {nightlyPrice > 0 ? <><strong>{nightlyPrice.toLocaleString(numberLocale)} ₪ ללילה{property.scenario === "multi" ? unitPriceCopy.night : ""}</strong>{totalPrice ? <small>{totalPrice.toLocaleString(numberLocale)} ₪ לכל {nights} הלילות{property.scenario === "multi" ? unitPriceCopy.stay : ""}</small> : null}</> : null}
            {illustrative ? <em>המחשה בלבד, ללא חיוב</em> : null}
          </div> : null}
          <div className="vacation-booking-dialog__footer-actions">
            {quickBooking && !hasUnitAvailability ? <Link className="button primary" href={bookingHref}>הזמנה מהירה</Link>
              : hasUnitAvailability && availableUnitCount > 0 ? <span className="vacation-booking-dialog__unit-guidance">{unitCopy.choose}</span>
              : unavailable || !hasDates ? <button className="button primary" type="button" onClick={openCalendar}>{hasDates ? "שינוי תאריכים" : "בחירת תאריכים"}</button>
                : ownerWhatsapp ? <WhatsAppLeadButton world="vacation" placeId={property.slug} placeName={property.name} businessPhone={ownerWhatsapp} serviceName="בקשת זמינות" initialDate={from} initialGuests={guests} buttonLabel="בדיקת זמינות" buttonClassName="button primary vacation-booking-dialog__whatsapp" />
                  : phoneHref ? <a className="button primary" href={phoneHref}>חיוג למקום</a> : null}
            {hasDates && !unavailable ? <button className="vacation-booking-dialog__change-date" type="button" onClick={openCalendar}>שינוי תאריכים</button> : null}
          </div>
        </footer>
      </section>
    </div> : null}
  </section>;
}
