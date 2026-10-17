"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { EventPlace } from "../data/site-data";
import { eventOfferHref } from "../lib/event-place-href";
import { useViiLiveSearch } from "./use-vii-live-search";
import { EventRail } from "./event-rail";
import { dailyRotationCompare } from "../lib/daily-rotation";
import { PlacePreviewCard } from "./place-preview-card";
import { ModernSelect } from "./modern-select";
import { useSiteLanguage } from "../i18n/locale-provider";
import { eventSlotCopy } from "../i18n/event-slot-copy";
import type { EventSlot } from "../lib/vii-live-search";
import { eventDealDate, eventDealPresets } from "../lib/event-deal-dates";
import { eventDealPlaceLabels } from "../lib/event-deal-labels";
import { useManagedGeography } from "./use-managed-geography";
import { homeEventPhotography } from "../lib/home-preview-content";
import { matchesSearchLocation } from "../data/search-taxonomy";
import { regionalAvailabilityRegion, regionalAvailabilityTitle } from "../lib/regional-availability";
import { eventSearchHref } from "../data/world-search-landings";

const copy = {
  he: { title: "מקומות פנויים לאירועים", all: "לכל המקומות הפנויים", tabs: ["ברגע האחרון", "פנוי לחמישי", "פנוי לשישי"], date: "תאריך אחר", guests: "משתתפים", loading: "בודקים זמינות ומחירים...", error: "לא הצלחנו לבדוק זמינות כרגע", retry: "לנסות שוב", empty: "לא נמצאו הצעות פנויות לבחירה הזו. נסו תאריך או כמות משתתפים אחרים.", available: "פנוי", price: "מחיר לאירוע", forGuests: "עבור", capacity: "עד", people: "משתתפים", details: "לפרטי המקום" },
  en: { title: "Available event venues", all: "All available venues", tabs: ["Last minute", "Available Thursday", "Available Friday"], date: "Another date", guests: "Guests", loading: "Checking availability and prices...", error: "We could not check availability right now", retry: "Try again", empty: "No available offers for this selection. Try another date or guest count.", available: "Available", price: "Event total", forGuests: "for", capacity: "Up to", people: "guests", details: "Venue details" },
  ru: { title: "Свободные площадки для мероприятий", all: "Все свободные площадки", tabs: ["Ближайшие даты", "В четверг", "В пятницу"], date: "Другая дата", guests: "Гости", loading: "Проверяем наличие и цены...", error: "Сейчас не удалось проверить наличие", retry: "Повторить", empty: "Свободных предложений нет. Выберите другую дату или количество гостей.", available: "Свободно", price: "Цена мероприятия", forGuests: "для", capacity: "До", people: "гостей", details: "Подробнее о площадке" },
  fr: { title: "Lieux disponibles pour vos événements", all: "Tous les lieux disponibles", tabs: ["Dernière minute", "Jeudi", "Vendredi"], date: "Autre date", guests: "Participants", loading: "Vérification des disponibilités et des prix...", error: "La disponibilité ne peut pas être vérifiée pour le moment", retry: "Réessayer", empty: "Aucune offre disponible. Essayez une autre date ou un autre nombre de participants.", available: "Disponible", price: "Prix de l’événement", forGuests: "pour", capacity: "Jusqu’à", people: "participants", details: "Voir le lieu" },
};

export function EventLastMinute({ places, sectionId = "event-last-minute", region, initialGuests = 20 }: { places: EventPlace[]; sectionId?: string; region?: string; initialGuests?: number }) {
  const { language, translate } = useSiteLanguage();
  const geography = useManagedGeography(language !== "he");
  const text = copy[language];
  const scope = regionalAvailabilityRegion(region);
  const title = scope ? regionalAvailabilityTitle("events", scope, language) : text.title;
  const slots = eventSlotCopy[language];
  const [date, setDate] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>("lastminute");
  const [guests, setGuests] = useState(initialGuests > 0 ? initialGuests : 20);
  const [slot, setSlot] = useState<EventSlot | undefined>();
  const [retry, setRetry] = useState(0);
  useEffect(() => { setDate(eventDealDate(1)); setInitialized(true); }, []);
  const search = useViiLiveSearch("events", date, date, guests, undefined, undefined, slot, retry, true, scope?.label);
  const candidates = (search.places || places).flatMap((place) => {
    if (scope && !matchesSearchLocation(place, scope.label)) return [];
    const match = /^event-(\d+)$/.exec(place.slug);
    const offer = match ? search.results[Number(match[1])] : null;
    if (offer?.available !== true || !offer.total || !offer.from || !offer.slot) return [];
    return [{ place, offer }];
  }).sort((a, b) => a.offer.total! - b.offer.total!
    || dailyRotationCompare(a.place.slug, b.place.slug, `${sectionId}-${date}`)).slice(0, 12);
  const searchPath = eventSearchHref(scope?.label);
  const params = new URLSearchParams({ from: date || "", to: date || "", guests: String(guests), ...(slot ? { slot } : {}), ...(scope && searchPath === "/events/search" ? { location: scope.label } : {}) });
  const busy = search.status === "loading" || !initialized;

  return <section className="section shell event-discovery-section event-deals" aria-labelledby={`${sectionId}-title`}>
    <div className="section-head"><h2 id={`${sectionId}-title`}>{title}</h2><Link href={`${searchPath}?${params}`}>{text.all}</Link></div>
    <div className="event-last-minute-controls">
      <div className="event-last-minute-tabs" role="group" aria-label={text.title}>{eventDealPresets().map((preset, index) => <button type="button" key={preset.id} className={selectedPreset === preset.id ? "active" : ""} aria-pressed={selectedPreset === preset.id} onClick={() => { setDate(preset.date); setSelectedPreset(preset.id); }}>{text.tabs[index]}</button>)}</div>
      <label>{text.date}<input type="date" value={date || ""} min={eventDealDate(0)} max={eventDealDate(62)} onChange={(event) => { setDate(event.target.value || null); setSelectedPreset(null); }} /></label>
      <ModernSelect label={text.guests} value={String(guests)} onChange={(value) => setGuests(Number(value))} options={[...new Set([guests, 20, 30, 50, 100, 200])].sort((a,b) => a-b).map((count) => ({ value: String(count), label: `${count} ${text.people}` }))} />
      <ModernSelect label={slots.label} value={slot || "both"} onChange={(value) => setSlot(value === "both" ? undefined : value as EventSlot)} options={[{ value: "both", label: slots.both }, { value: "morning", label: slots.morning }, { value: "evening", label: slots.evening }]} />
    </div>
    <div aria-busy={busy} aria-live="polite">
      {busy ? <div className="event-deals__loading" role="status"><p>{text.loading}</p><div className="home-live-deals__loading-cards" aria-hidden="true">{[0, 1, 2].map((index) => <div className="home-live-deals__loading-card" key={index}><div className="home-live-deals__loading-image" /><div className="home-live-deals__loading-lines"><span /><span /><span /></div></div>)}</div></div> : null}
      {search.status === "error" ? <div className="event-rail-status" role="alert"><p>{text.error}</p><button type="button" className="button secondary" onClick={() => setRetry((value) => value + 1)}>{text.retry}</button></div> : null}
      {search.status === "ready" && !candidates.length ? <p className="event-rail-status">{text.empty}</p> : null}
      {initialized && search.status === "idle" ? <p className="event-rail-status">{translate("בחרו תאריך")}</p> : null}
      {candidates.length ? <EventRail key={`${date}-${guests}-${slot || "both"}`} title={title}>{candidates.map(({ place, offer }) => {
        place = homeEventPhotography(place);
        const labels = eventDealPlaceLabels(place, language, translate, geography);
        const href = eventOfferHref(place, new URLSearchParams({ from: offer.from!, guests: String(guests), slot: offer.slot!, ...(offer.roomID ? { roomID: String(offer.roomID) } : {}) }));
        return <PlacePreviewCard className="event-rail-card event-deals__card" key={place.slug} name={labels.name} image={place.image} images={place.images} href={href} newTab><span className="event-rail-card__body"><small>{labels.location} · {labels.type}</small><strong>{labels.name}</strong><span>{text.capacity} {place.guests} {text.people}</span><span className="event-deals__availability">{text.available} · {new Intl.DateTimeFormat(language === "he" ? "he-IL" : language, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${offer.from}T12:00:00Z`))} · {slots[offer.slot!]}</span><span>{text.forGuests} {guests} {text.people}</span><b>{offer.total!.toLocaleString(language === "he" ? "he-IL" : language)} ₪ <small>{text.price}</small></b><span className="button primary">{text.details}</span></span></PlacePreviewCard>;
      })}</EventRail> : null}
    </div>
  </section>;
}
