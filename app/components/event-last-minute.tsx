"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { EventPlace } from "../data/site-data";
import { eventOfferHref } from "../lib/event-place-href";
import { useViiLiveSearch } from "./use-vii-live-search";
import { EventRail } from "./event-rail";
import { dailyRotationCompare } from "../lib/daily-rotation";
import { PlacePreviewCard } from "./place-preview-card";
import { useSiteLanguage } from "../i18n/locale-provider";
import { localizedPath } from "../i18n/locale-routing";
import { eventSlotCopy } from "../i18n/event-slot-copy";
import { eventDealDate, eventDealPresets } from "../lib/event-deal-dates";
import { eventDealPlaceLabels } from "../lib/event-deal-labels";
import { useManagedGeography } from "./use-managed-geography";
import { homeEventPhotography } from "../lib/home-preview-content";
import { matchesSearchLocation } from "../data/search-taxonomy";
import { regionalAvailabilityRegion, regionalAvailabilityTitle } from "../lib/regional-availability";
import { eventSearchHref } from "../data/world-search-landings";
import { regionalExpansionCopy } from "../i18n/regional-availability-copy";
import { discoveryCacheCopy } from "../i18n/discovery-cache-copy.ts";
import { normalizeDealDate } from "../lib/deal-clock";
import { useDealClock } from "./use-deal-clock";
import { orderDiscoveryRail } from "../lib/discovery-slider-order";
import { useDocumentSeed } from "./use-document-seed";

const copy = {
  he: { title: "מקומות פנויים לאירועים", all: "לכל המקומות הפנויים", tabs: ["ברגע האחרון", "פנוי לחמישי", "פנוי לשישי"], loading: "בודקים זמינות ומחירים...", error: "לא הצלחנו לבדוק זמינות כרגע", retry: "לנסות שוב", empty: "לא נמצאו הצעות פנויות לבחירה הזו. נסו תאריך או כמות משתתפים אחרים.", available: "פנוי", price: "מחיר לאירוע", forGuests: "עבור", capacity: "עד", people: "משתתפים", details: "לפרטי המקום" },
  en: { title: "Available event venues", all: "All available venues", tabs: ["Last minute", "Available Thursday", "Available Friday"], loading: "Checking availability and prices...", error: "We could not check availability right now", retry: "Try again", empty: "No available offers for this selection. Try another date or guest count.", available: "Available", price: "Event total", forGuests: "for", capacity: "Up to", people: "guests", details: "Venue details" },
  ru: { title: "Свободные площадки для мероприятий", all: "Все свободные площадки", tabs: ["Ближайшие даты", "В четверг", "В пятницу"], loading: "Проверяем наличие и цены...", error: "Сейчас не удалось проверить наличие", retry: "Повторить", empty: "Свободных предложений нет. Выберите другую дату или количество гостей.", available: "Свободно", price: "Цена мероприятия", forGuests: "для", capacity: "До", people: "гостей", details: "Подробнее о площадке" },
  fr: { title: "Lieux disponibles pour vos événements", all: "Tous les lieux disponibles", tabs: ["Dernière minute", "Jeudi", "Vendredi"], loading: "Vérification des disponibilités et des prix...", error: "La disponibilité ne peut pas être vérifiée pour le moment", retry: "Réessayer", empty: "Aucune offre disponible. Essayez une autre date ou un autre nombre de participants.", available: "Disponible", price: "Prix de l’événement", forGuests: "pour", capacity: "Jusqu’à", people: "participants", details: "Voir le lieu" },
};

export function EventLastMinute({ places, sectionId = "event-last-minute", region, initialGuests = 20 }: { places: EventPlace[]; sectionId?: string; region?: string; initialGuests?: number }) {
  const { language, translate } = useSiteLanguage();
  const clock = useDealClock();
  const documentSeed = useDocumentSeed();
  const geography = useManagedGeography(language !== "he");
  const text = copy[language];
  const scope = regionalAvailabilityRegion(region);
  const title = scope ? regionalAvailabilityTitle("events", scope, language) : text.title;
  const slots = eventSlotCopy[language];
  const [chosenDate, setDate] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>("lastminute");
  const guests = initialGuests > 0 ? initialGuests : 20;
  const [retry, setRetry] = useState(0);
  useEffect(() => { setDate(eventDealDate(1)); setInitialized(true); }, []);
  const presets = clock ? eventDealPresets(clock.now) : [];
  const date = clock && chosenDate ? (presets.find(preset => preset.id === selectedPreset)?.date || normalizeDealDate(chosenDate, clock.now)) : null;
  const search = useViiLiveSearch("events", date, date, guests, undefined, undefined, undefined, retry, true, scope?.label);
  const candidates = orderDiscoveryRail((search.places || places).flatMap((place) => {
    if (scope && !search.expandedRegion && !matchesSearchLocation(place, scope.label)) return [];
    const match = /^event-(\d+)$/.exec(place.slug);
    const offer = match ? search.results[Number(match[1])] : null;
    if (offer?.available !== true || !offer.total || !offer.from || !offer.slot) return [];
    return [{ place, offer }];
  }), { id: item => item.place.slug, seed: `${documentSeed}:${sectionId}:${date}`, priority: item => scope && search.regionalOrder?.length ? Math.max(0, search.regionalOrder.indexOf(item.offer.siteID)) : undefined });
  const searchPath = eventSearchHref(scope?.label);
  const params = new URLSearchParams({ from: date || "", to: date || "", guests: String(guests), ...(scope && searchPath === "/events/search" ? { location: scope.label } : {}) });
  const busy = search.status === "loading" || !initialized;

  function choosePreset(id: string, presetDate: string) {
    setDate(presetDate);
    setSelectedPreset(id);
  }

  return <section className="section shell event-discovery-section event-deals" aria-labelledby={`${sectionId}-title`}>
    <div className="section-head"><h2 id={`${sectionId}-title`}>{title}</h2><Link href={localizedPath(`${searchPath}?${params}`, language)}>{text.all}</Link></div>
    <div className="home-live-deals__tabs event-last-minute-tabs" role="tablist" aria-label={text.title}>
      {presets.map((preset, index) => <button type="button" role="tab" aria-controls={`${sectionId}-results`} aria-selected={selectedPreset === preset.id} tabIndex={selectedPreset === preset.id ? 0 : -1} key={preset.id} onClick={() => choosePreset(preset.id, preset.date)} onKeyDown={(event) => {
        const next = event.key === "Home" ? 0 : event.key === "End" ? presets.length - 1 : event.key === "ArrowRight" ? (index + (language === "he" ? -1 : 1) + presets.length) % presets.length : event.key === "ArrowLeft" ? (index + (language === "he" ? 1 : -1) + presets.length) % presets.length : -1;
        if (next < 0) return;
        event.preventDefault();
        choosePreset(presets[next].id, presets[next].date);
        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
      }}>{text.tabs[index]}</button>)}
    </div>
    <div id={`${sectionId}-results`} role="tabpanel" aria-busy={busy} aria-live="polite">
      {search.status === "ready" && search.stale && candidates.length > 0 ? <p className="regional-availability__expansion" data-no-translate>{discoveryCacheCopy[language]}</p> : null}
      {scope && search.status === "ready" && search.expandedRegion && candidates.length > 0 ? <p className="regional-availability__expansion" data-no-translate>{regionalExpansionCopy[language]}</p> : null}
      {busy ? <div className="event-deals__loading" role="status"><p>{text.loading}</p><div className="home-live-deals__loading-cards" aria-hidden="true">{[0, 1, 2].map((index) => <div className="home-live-deals__loading-card" key={index}><div className="home-live-deals__loading-image" /><div className="home-live-deals__loading-lines"><span /><span /><span /></div></div>)}</div></div> : null}
      {search.status === "error" ? <div className="event-rail-status" role="alert"><p>{text.error}</p><button type="button" className="button secondary" onClick={() => setRetry((value) => value + 1)}>{text.retry}</button></div> : null}
      {search.status === "ready" && !candidates.length ? <p className="event-rail-status">{text.empty}</p> : null}
      {initialized && search.status === "idle" ? <p className="event-rail-status">{translate("בחרו תאריך")}</p> : null}
      {candidates.length ? <EventRail key={`${date}-${guests}`} title={title}>{candidates.map(({ place, offer }) => {
        place = homeEventPhotography(place);
        const labels = eventDealPlaceLabels(place, language, translate, geography);
        const href = eventOfferHref(place, new URLSearchParams({ from: offer.from!, guests: String(guests), slot: offer.slot!, ...(offer.roomID ? { roomID: String(offer.roomID) } : {}) }));
        return <PlacePreviewCard className="event-rail-card event-deals__card" contact={{ placeId: place.slug, phone: place.contact?.phone, whatsapp: place.contact?.whatsapp, serviceName: place.type, initialDate: offer.from || undefined, initialGuests: guests }} key={place.slug} name={labels.name} image={place.image} images={place.images} href={href} newTab><span className="event-rail-card__body"><small>{labels.location} · {labels.type}</small><strong>{labels.name}</strong><span>{text.capacity} {place.guests} {text.people}</span><span className="event-deals__availability">{text.available} · {new Intl.DateTimeFormat(language === "he" ? "he-IL" : language, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${offer.from}T12:00:00Z`))} · {slots[offer.slot!]}</span><span>{text.forGuests} {guests} {text.people}</span><b>{offer.total!.toLocaleString(language === "he" ? "he-IL" : language)} ₪ <small>{text.price}</small></b><span className="button primary">{text.details}</span></span></PlacePreviewCard>;
      })}</EventRail> : null}
    </div>
  </section>;
}
