"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { EventPlace } from "../data/site-data";
import { eventOfferHref, eventPlaceHref } from "../lib/event-place-href";
import { useViiLiveSearch } from "./use-vii-live-search";
import { EventRail } from "./event-rail";
import { PlacePreviewCard } from "./place-preview-card";
import { useSiteLanguage } from "../i18n/locale-provider";
import { localizedPath } from "../i18n/locale-routing";
import { eventSlotCopy } from "../i18n/event-slot-copy";
import { eventDealDate, eventDealPresets } from "../lib/event-deal-dates";
import { eventDealPlaceLabels } from "../lib/event-deal-labels";
import { useManagedGeography } from "./use-managed-geography";
import { homeEventPhotography } from "../lib/home-preview-content";
import { matchesSearchLocation } from "../data/search-taxonomy";
import { regionalAvailabilityRegion } from "../lib/regional-availability";
import { regionalExpansionCopy } from "../i18n/regional-availability-copy";
import { normalizeDealDate } from "../lib/deal-clock";
import { useDealClock } from "./use-deal-clock";
import { orderDiscoveryRail } from "../lib/discovery-slider-order";
import { useDocumentSeed } from "./use-document-seed";
import { useStartingPrices } from "../lib/use-starting-prices";
import { supplierStartingPrice } from "../lib/supplier-starting-price";
import { CatalogStartingPrice } from "./catalog-starting-price";
import { uniqueEventVenueItems, eventDealPagePath, type EventDealPresetId } from "../lib/event-discovery-contract.ts";
import { ModernSelect } from "./modern-select";

const copy = {
  he: { title: "מקומות לאירועים בתאריכים הקרובים", all: "לכל המקומות לאירועים", tabs: ["ברגע האחרון", "פנוי לחמישי", "פנוי לשישי"], loading: "בודקים זמינות ומחירים...", error: "לא הצלחנו לרענן זמינות כרגע", retry: "לנסות שוב", empty: "אין כרגע הצעה מאומתת לתאריך הזה.", fallbackTitle: "מקומות נוספים שכדאי לבדוק", fallbackStatus: "הזמינות לתאריך הזה עדיין לא אומתה. אפשר לפנות ישירות למקום.", available: "פנוי", price: "מחיר לאירוע", forGuests: "עבור", capacity: "עד", people: "משתתפים", today: "פנוי להיום", tomorrow: "פנוי למחר", thursday: "פנוי לחמישי", friday: "פנוי לשישי" },
  en: { title: "Event venues for upcoming dates", all: "All event venues", tabs: ["Last minute", "Available Thursday", "Available Friday"], loading: "Checking availability and prices...", error: "We could not refresh availability right now", retry: "Try again", empty: "There is no verified offer for this date yet.", fallbackTitle: "More venues worth checking", fallbackStatus: "Availability for this date is not verified yet. Contact the venue directly.", available: "Available", price: "Event total", forGuests: "for", capacity: "Up to", people: "guests", today: "Available today", tomorrow: "Available tomorrow", thursday: "Available Thursday", friday: "Available Friday" },
  ru: { title: "Площадки для мероприятий на ближайшие даты", all: "Все площадки", tabs: ["Ближайшие даты", "В четверг", "В пятницу"], loading: "Проверяем наличие и цены...", error: "Сейчас не удалось обновить наличие", retry: "Повторить", empty: "Подтверждённых предложений на эту дату пока нет.", fallbackTitle: "Другие площадки для проверки", fallbackStatus: "Наличие на эту дату ещё не подтверждено. Свяжитесь с площадкой напрямую.", available: "Свободно", price: "Цена мероприятия", forGuests: "для", capacity: "До", people: "гостей", today: "Свободно сегодня", tomorrow: "Свободно завтра", thursday: "Свободно в четверг", friday: "Свободно в пятницу" },
  fr: { title: "Lieux événementiels pour les prochaines dates", all: "Tous les lieux événementiels", tabs: ["Dernière minute", "Jeudi", "Vendredi"], loading: "Vérification des disponibilités et des prix...", error: "La disponibilité ne peut pas être actualisée pour le moment", retry: "Réessayer", empty: "Aucune offre vérifiée pour cette date.", fallbackTitle: "Autres lieux à vérifier", fallbackStatus: "La disponibilité à cette date n’est pas encore vérifiée. Contactez directement le lieu.", available: "Disponible", price: "Prix de l’événement", forGuests: "pour", capacity: "Jusqu’à", people: "participants", today: "Disponible aujourd’hui", tomorrow: "Disponible demain", thursday: "Disponible jeudi", friday: "Disponible vendredi" },
};

export function EventLastMinute({ places, sectionId = "event-last-minute", region, initialGuests = 20, fixedPreset, sectionTitle, layout = "rail" }: { places: EventPlace[]; sectionId?: string; region?: string; initialGuests?: number; fixedPreset?: EventDealPresetId; sectionTitle?: string; layout?: "rail" | "grid" }) {
  const { language, translate } = useSiteLanguage();
  const clock = useDealClock();
  const documentSeed = useDocumentSeed();
  const geography = useManagedGeography(language !== "he");
  const text = copy[language];
  const scope = regionalAvailabilityRegion(region);
  const title = sectionTitle || (!scope ? text.title : language === "he" ? `${text.title} ב${scope.label}`
    : language === "en" ? `${text.title} in ${scope.en}`
    : language === "ru" ? `${text.title} в ${scope.ru}`
    : `${text.title} : ${scope.fr}`);
  const slots = eventSlotCopy[language];
  const [chosenDate, setDate] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(fixedPreset || "lastminute");
  const [guests, setGuests] = useState(initialGuests > 0 ? initialGuests : 20);
  const [guestDraft, setGuestDraft] = useState(String(guests));
  const [selectedSlot, setSelectedSlot] = useState<"morning" | "evening" | undefined>();
  const [slotDraft, setSlotDraft] = useState("both");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const preset = eventDealPresets().find((item) => item.id === (fixedPreset || "lastminute"));
      setDate(preset?.date || eventDealDate(1));
      setInitialized(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fixedPreset]);
  const presets = clock ? eventDealPresets(clock.now) : [];
  const date = clock && chosenDate ? (presets.find(preset => preset.id === selectedPreset)?.date || normalizeDealDate(chosenDate, clock.now)) : null;
  const search = useViiLiveSearch("events", date, date, guests, undefined, undefined, selectedSlot, retry, true, scope?.label);
  const startingPrices = useStartingPrices("events", true);
  const availablePlaces = search.places || places;
  const placeBySupplierId = new Map(availablePlaces.flatMap((place) => {
    const match = /^event-(\d+)$/.exec(place.slug);
    return match ? [[Number(match[1]), place] as const] : [];
  }));
  const supplierOrder = search.resultOrder.length
    ? search.resultOrder
    : availablePlaces.flatMap((place) => {
      const match = /^event-(\d+)$/.exec(place.slug);
      return match ? [Number(match[1])] : [];
    });
  const candidates = uniqueEventVenueItems(supplierOrder.flatMap((siteID) => {
    const place = placeBySupplierId.get(siteID);
    if (!place) return [];
    if (scope && !search.expandedRegion && !matchesSearchLocation(place, scope.label)) return [];
    const offer = search.results[siteID];
    if (offer?.available !== true || !offer.from || !offer.slot) return [];
    return [{ place, offer }];
  }), item => item.place.slug);
  const confirmed = new Set(candidates.map(({ place }) => place.slug));
  const additionalPlaces = orderDiscoveryRail(places.flatMap((place) => {
    if (!place.image || confirmed.has(place.slug)) return [];
    if (scope && !matchesSearchLocation(place, scope.label)) return [];
    return [homeEventPhotography(place)];
  }), {
    id: place => place.slug,
    seed: `${documentSeed}:${sectionId}:${date}:more`,
    // Without a selected date, an accepted supplier advertising floor is the
    // useful commercial fact. Keep those cards first instead of letting the
    // daily rotation make the restored starting-price field look missing.
    priority: place => supplierStartingPrice(startingPrices[place.slug] ?? place) ? 0 : 1,
  }).slice(0, Math.max(0, 20 - candidates.length));
  const pagePath = eventDealPagePath((selectedPreset || "lastminute") as EventDealPresetId);
  const searchPath = scope ? `${pagePath}?${new URLSearchParams({ region: scope.label })}` : pagePath;
  const allLabel = ({ he: ["לכל אירועי הרגע האחרון", "לכל המקומות הפנויים לחמישי", "לכל המקומות הפנויים לשישי"], en: ["All last-minute event venues", "All Thursday venues", "All Friday venues"], ru: ["Все площадки в последний момент", "Все площадки в четверг", "Все площадки в пятницу"], fr: ["Tous les lieux de dernière minute", "Tous les lieux du jeudi", "Tous les lieux du vendredi"] } as const)[language][selectedPreset === "thursday" ? 1 : selectedPreset === "friday" ? 2 : 0];
  const applyLabel = ({ he: "בדיקת זמינות להרכב", en: "Check this party", ru: "Проверить состав", fr: "Vérifier ce groupe" } as const)[language];
  const staleLabel = ({ he: "הזמינות מוצגת מהבדיקה האחרונה. לפני סגירה יש לאמת אותה מול המקום.", en: "Showing the last checked availability. Confirm it with the venue before booking.", ru: "Показана последняя проверенная доступность. Подтвердите её у площадки.", fr: "Disponibilités de la dernière vérification. Confirmez-les auprès du lieu avant de réserver." } as const)[language];
  const busy = search.status === "loading" || !initialized;
  // Browse cards are useful only as a clearly labelled fallback. They must
  // never sit beside verified offers or inherit a selected-date availability
  // label when the live supplier check failed or returned no verified offer.
  const showBrowseFallback = Boolean(!busy && !candidates.length && additionalPlaces.length && (search.status === "ready" || search.status === "error"));
  const visibleAdditionalPlaces = showBrowseFallback ? additionalPlaces : [];

  function choosePreset(id: string, presetDate: string) {
    setDate(presetDate);
    setSelectedPreset(id);
  }

  return <section className={`section shell event-discovery-section event-deals${layout === "grid" ? " event-deals--grid" : ""}`} aria-labelledby={`${sectionId}-title`}>
    <div className="section-head"><h2 id={`${sectionId}-title`}>{title}</h2>{layout === "rail" ? <Link href={localizedPath(searchPath, language)}>{allLabel}</Link> : null}</div>
    {!fixedPreset ? <div className="home-live-deals__tabs event-last-minute-tabs" role="tablist" aria-label={text.title}>
      {presets.map((preset, index) => <button type="button" role="tab" aria-controls={`${sectionId}-results`} aria-selected={selectedPreset === preset.id} tabIndex={selectedPreset === preset.id ? 0 : -1} key={preset.id} onClick={() => choosePreset(preset.id, preset.date)} onKeyDown={(event) => {
        const next = event.key === "Home" ? 0 : event.key === "End" ? presets.length - 1 : event.key === "ArrowRight" ? (index + (language === "he" ? -1 : 1) + presets.length) % presets.length : event.key === "ArrowLeft" ? (index + (language === "he" ? 1 : -1) + presets.length) % presets.length : -1;
        if (next < 0) return;
        event.preventDefault();
        choosePreset(presets[next].id, presets[next].date);
        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
      }}>{text.tabs[index]}</button>)}
    </div> : null}
    {layout === "grid" ? <form className="event-deals__filters" onSubmit={event => { event.preventDefault(); const value = Number(guestDraft); if (Number.isSafeInteger(value) && value >= 1 && value <= 1000) { setGuests(value); setSelectedSlot(slotDraft === "morning" || slotDraft === "evening" ? slotDraft : undefined); } }}>
      <label>{text.people}<input type="number" min="1" max="1000" required value={guestDraft} onChange={event => setGuestDraft(event.target.value)} /></label>
      <ModernSelect label={slots.label} value={slotDraft} onChange={setSlotDraft} options={[{value:"both",label:slots.both},{value:"morning",label:slots.morning},{value:"evening",label:slots.evening}]} />
      <button className="button primary" type="submit">{applyLabel}</button>
    </form> : null}
    <div id={`${sectionId}-results`} role="tabpanel" aria-busy={busy} aria-live="polite">
      {layout === "grid" && search.status === "ready" ? <p className="event-deals__summary"><bdi>{candidates.length}</bdi> {({he:"מקומות עם זמינות שנבדקה",en:"venues with checked availability",ru:"площадок с проверенной доступностью",fr:"lieux avec disponibilité vérifiée"} as const)[language]}</p> : null}
      {search.stale && candidates.length > 0 ? <p className="regional-availability__expansion">{staleLabel}</p> : null}
      {scope && search.status === "ready" && search.expandedRegion && candidates.length > 0 ? <p className="regional-availability__expansion" data-no-translate>{regionalExpansionCopy[language]}</p> : null}
      {busy && !visibleAdditionalPlaces.length ? <div className="event-deals__loading" role="status"><p>{text.loading}</p><div className="home-live-deals__loading-cards" aria-hidden="true">{[0, 1, 2].map((index) => <div className="home-live-deals__loading-card" key={index}><div className="home-live-deals__loading-image" /><div className="home-live-deals__loading-lines"><span /><span /><span /></div></div>)}</div></div> : null}
      {search.status === "error" ? <div className={`event-rail-status${showBrowseFallback ? " event-rail-status--with-fallback" : ""}`} role={showBrowseFallback ? "status" : "alert"}><p>{showBrowseFallback ? text.fallbackStatus : text.error}</p><button type="button" className="button secondary" onClick={() => setRetry((value) => value + 1)}>{text.retry}</button></div> : null}
      {search.status === "ready" && !candidates.length && !visibleAdditionalPlaces.length ? <p className="event-rail-status">{text.empty}</p> : null}
      {initialized && search.status === "idle" ? <p className="event-rail-status">{translate("בחרו תאריך")}</p> : null}
      {showBrowseFallback ? <h3 className="event-deals__fallback-title">{text.fallbackTitle}</h3> : null}
      {candidates.length || visibleAdditionalPlaces.length ? <EventRail key={`${date}-${guests}`} title={showBrowseFallback ? text.fallbackTitle : title}>{candidates.map(({ place, offer }, index) => {
        place = homeEventPhotography(place);
        const labels = eventDealPlaceLabels(place, language, translate, geography);
        const href = eventOfferHref(place, new URLSearchParams({ from: offer.from!, guests: String(guests), slot: offer.slot!, ...(offer.roomID ? { roomID: String(offer.roomID) } : {}) }));
        return <PlacePreviewCard className="event-rail-card event-deals__card" contact={{ placeId: place.slug, phone: place.contact?.phone, whatsapp: place.contact?.whatsapp, serviceName: place.type, initialDate: offer.from || undefined, initialGuests: guests }} key={place.slug} name={labels.name} image={place.image} images={place.images} href={href} priority={index < 2}><span className="event-rail-card__body" data-event-site-id={offer.siteID} data-event-date={offer.from} data-event-slot={offer.slot} data-event-priced={offer.total !== null}><small>{labels.location} · {labels.type}</small><strong>{labels.name}</strong><span>{text.capacity} {place.guests} {text.people}</span><span className="event-deals__availability">{text.available} · {new Intl.DateTimeFormat(language === "he" ? "he-IL" : language, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${offer.from}T12:00:00Z`))} · {slots[offer.slot!]}</span><span>{text.forGuests} {guests} {text.people}</span>{offer.total !== null ? <b><bdi dir="ltr">₪&nbsp;{offer.total.toLocaleString(language === "he" ? "he-IL" : language)}</bdi> <small>{text.price}</small></b> : <small>{({he:"למחיר ולפרטים פונים ישירות למקום",en:"Contact the venue for a price",ru:"Уточните цену у площадки",fr:"Contactez le lieu pour le tarif"} as const)[language]}</small>}</span></PlacePreviewCard>;
      })}{visibleAdditionalPlaces.map((place) => {
        const labels = eventDealPlaceLabels(place, language, translate, geography);
        const startingPrice = supplierStartingPrice(startingPrices[place.slug] || place);
        return <PlacePreviewCard className="event-rail-card event-deals__card event-deals__card--browse" contact={{ placeId: place.slug, phone: place.contact?.phone, whatsapp: place.contact?.whatsapp, serviceName: place.type }} key={place.slug} name={labels.name} image={place.image} images={place.images} href={localizedPath(eventPlaceHref(place), language)}><span className="event-rail-card__body"><small>{labels.location} · {labels.type}</small><strong>{labels.name}</strong><span>{text.capacity} {place.guests} {text.people}</span>{startingPrice ? <CatalogStartingPrice amount={startingPrice} /> : null}<span className="event-deals__check">{text.fallbackStatus}</span></span></PlacePreviewCard>;
      })}</EventRail> : null}
    </div>
  </section>;
}
