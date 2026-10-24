"use client";

/* eslint-disable @next/next/no-img-element, react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { homeDealPeriods, type HomeDeal, type HomeDealPeriod } from "../lib/vii-home-deals";
import type { HomeHoliday } from "../lib/vii-home-holidays";
import type { Property } from "../data/site-data";
import { useSiteLanguage } from "../i18n/locale-provider";
import { localizedPath } from "../i18n/locale-routing";
import type { HomePeriodTab } from "../lib/home-display-settings";
import { HomeSliderControls } from "./home-slider-controls";
import { PropertyCard, type ResolvedAvailability } from "./property-card";
import { regionalAvailabilityRegion, regionalAvailabilityTitle } from "../lib/regional-availability";
import { regionalExpansionCopy } from "../i18n/regional-availability-copy";
import { eligibleDealDate } from "../lib/deal-clock";
import { isHomeDealOnlineEligible } from "../lib/vacation-online-first";
import { managedVacationPriority } from "../lib/vacation-priority.ts";
import { useDealClock } from "./use-deal-clock";
import { discoveryJson } from "../lib/discovery-client-cache.ts";
import { orderDiscoveryRail } from "../lib/discovery-slider-order.ts";
import { useDocumentSeed } from "./use-document-seed.ts";

type ResponseData = { cache?: { status: string }; availabilityStatus?: "verified" | "refreshing"; region?: string; expandedRegion?: boolean; regionalOrder?: number[]; period?: HomeDealPeriod; holiday?: HomeHoliday; dates: { from: string; till: string; nights: number }; deals: HomeDeal[]; display?: { periods: HomePeriodTab[]; defaultPeriod: HomeDealPeriod } };

const copy = {
  he: { title: "נופש פנוי בתאריכים הקרובים", all: "לכל מקומות הנופש", loading: "בודקים זמינות ומחירים", empty: "לא נמצאו מקומות פנויים לתאריכים האלה", error: "לא הצלחנו לבדוק זמינות כרגע", retry: "לנסות שוב", total: "מחיר כולל", details: "לפרטי המקום", call: "חיוג למקום", whatsapp: "וואטסאפ", available: "פנוי לתאריכים שבחרתם", forGuests: "עבור 2 אורחים", night: "לילה", nights: "לילות", bedrooms: "חדרי שינה", guests: "אורחים", reviews: "חוות דעת", dateTo: "עד", tabs: ["ברגע האחרון", "חמישי עד שבת", "שישי עד ראשון", "לילה בחמישי", "לילה בשישי"] },
  en: { title: "Available stays ahead", all: "All stays", loading: "Checking availability and prices", empty: "No available stays for these dates", error: "Availability could not be checked", retry: "Try again", total: "Total price", details: "Place details", call: "Call the property", whatsapp: "WhatsApp", available: "Available for your dates", forGuests: "for 2 guests", night: "night", nights: "nights", bedrooms: "bedrooms", guests: "guests", reviews: "reviews", dateTo: "to", tabs: ["Last minute", "Thursday to Saturday", "Friday to Sunday", "Thursday night", "Friday night"] },
  ru: { title: "Свободное жилье на ближайшие даты", all: "Все варианты", loading: "Проверяем наличие и цены", empty: "На эти даты свободных мест нет", error: "Не удалось проверить наличие", retry: "Повторить", total: "Полная стоимость", details: "Подробнее", call: "Позвонить", whatsapp: "WhatsApp", available: "Свободно на выбранные даты", forGuests: "для 2 гостей", night: "ночь", nights: "ночи", bedrooms: "спальни", guests: "гостей", reviews: "отзывов", dateTo: "до", tabs: ["В последний момент", "Чт–Сб", "Пт–Вс", "Ночь в четверг", "Ночь в пятницу"] },
  fr: { title: "Séjours disponibles prochainement", all: "Tous les séjours", loading: "Vérification des disponibilités", empty: "Aucun séjour disponible à ces dates", error: "Disponibilité indisponible", retry: "Réessayer", total: "Prix total", details: "Voir le lieu", call: "Appeler le lieu", whatsapp: "WhatsApp", available: "Disponible à ces dates", forGuests: "pour 2 voyageurs", night: "nuit", nights: "nuits", bedrooms: "chambres", guests: "voyageurs", reviews: "avis", dateTo: "au", tabs: ["Dernière minute", "Jeudi à samedi", "Vendredi à dimanche", "Nuit de jeudi", "Nuit de vendredi"] },
} as const;

const allPeriodCopy = {
  he: { tomorrow: "לכל מקומות הנופש ברגע האחרון", weekend: "לכל מקומות הנופש מחמישי עד שבת", "friday-weekend": "לכל מקומות הנופש משישי עד ראשון", thursday: "לכל מקומות הנופש ללילה בחמישי", friday: "לכל מקומות הנופש ללילה בשישי", holiday: "לכל מקומות הנופש ב" },
  en: { tomorrow: "All last-minute stays", weekend: "All Thursday-to-Saturday stays", "friday-weekend": "All Friday-to-Sunday stays", thursday: "All Thursday-night stays", friday: "All Friday-night stays", holiday: "All stays for " },
  ru: { tomorrow: "Все варианты в последний момент", weekend: "Все варианты с четверга по субботу", "friday-weekend": "Все варианты с пятницы по воскресенье", thursday: "Все варианты на ночь в четверг", friday: "Все варианты на ночь в пятницу", holiday: "Все варианты на " },
  fr: { tomorrow: "Tous les séjours de dernière minute", weekend: "Tous les séjours du jeudi au samedi", "friday-weekend": "Tous les séjours du vendredi au dimanche", thursday: "Tous les séjours du jeudi soir", friday: "Tous les séjours du vendredi soir", holiday: "Tous les séjours pour " },
} as const;

export function dealProperty(deal: HomeDeal): Property {
  const features = [
    deal.roomName,
    deal.bedrooms ? `${deal.bedrooms} חדרי שינה` : "",
    deal.maxGuests ? `עד ${deal.maxGuests} אורחים` : "",
  ].filter((value): value is string => Boolean(value));
  return {
    slug: `vacation-${deal.siteID}`,
    name: deal.name,
    location: deal.city || deal.area || "ישראל",
    area: deal.area || deal.city || "ישראל",
    type: deal.roomName || "מקום נופש",
    guests: deal.maxGuests || deal.priceGuests,
    bedrooms: deal.bedrooms,
    image: deal.image,
    images: deal.images || [],
    description: "",
    features,
    audiences: [],
    badges: [],
    scenario: "single",
    score: deal.score || undefined,
    reviews: deal.reviewCount || undefined,
    contact: { phone: deal.phone, whatsapp: deal.whatsapp },
  };
}

export function dealAvailability(deal: HomeDeal): ResolvedAvailability {
  return {
    from: deal.from,
    till: deal.till,
    availability: "available",
    totalPrice: deal.total,
    nightlyPrice: Math.round(deal.total / Math.max(1, deal.nights)),
    includedGuests: deal.priceGuests,
    priceMode: "stay_total",
    // An accepted last-known snapshot remains valid discovery evidence while
    // the background refresh retries. Checkout still revalidates live.
    onlineBooking: deal.onlineBooking,
    bookingSupported: Number.isSafeInteger(deal.roomID) && Number(deal.roomID) > 0,
    showSelectedDates: true,
  };
}

export function HomeLiveDeals({ mode = "near", region, guests = 2, fixedPeriod, sectionTitle, allLinkLabel }: { mode?: "near" | "holidays"; region?: string; guests?: number; fixedPeriod?: HomeDealPeriod; sectionTitle?: string; allLinkLabel?: string }) {
  const clock = useDealClock();
  const scope = mode === "near" ? regionalAvailabilityRegion(region) : null;
  const regionLabel = scope?.label;
  const { language, translate } = useSiteLanguage();
  const documentSeed = useDocumentSeed();
  const [period, setPeriod] = useState<HomeDealPeriod>(fixedPeriod ?? "tomorrow");
  const [periodTabs, setPeriodTabs] = useState<HomePeriodTab[]>(() => homeDealPeriods.map((item, index) => ({ id: item.id, label: copy[language].tabs[index] })));
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [data, setData] = useState<ResponseData | null>(null);
  const [holidays, setHolidays] = useState<HomeHoliday[]>([]);
  const [holidayId, setHolidayId] = useState<number | null>(null);
  const [holidayState, setHolidayState] = useState<"loading" | "ready" | "error">("loading");
  const track = useRef<HTMLDivElement>(null);
  const lastGoodData = useRef(new Map<string, ResponseData>());
  const automaticRetries = useRef(new Map<string, number>());
  const displaySettingsApplied = useRef(false);
  const text = copy[language];
  const title = sectionTitle || (scope ? regionalAvailabilityTitle("vacation", scope, language) : mode === "holidays" ? { he: "נופש פנוי בחגים", en: "Available stays for holidays", ru: "Отдых в праздники", fr: "Séjours disponibles pendant les fêtes" }[language] : text.title);
  const selectedDates = mode === "holidays" ? data?.deals[0] ?? data?.dates : data?.dates;
  const searchDates = clock && selectedDates && eligibleDealDate(selectedDates.from, clock.now) ? selectedDates : undefined;
  const currentHoliday = holidays.find((item) => item.id === holidayId);
  const selectionKey = mode === "holidays" ? `holiday:${holidayId ?? "loading"}` : `near:${regionLabel || "all"}:${period}:${guests}`;
  const searchHref = mode === "holidays" && currentHoliday?.href
    ? currentHoliday.href
    : mode === "near" && !fixedPeriod && !regionLabel && period === "tomorrow"
      ? "/last-minute"
      : searchDates ? `/search?${new URLSearchParams({ from: searchDates.from, till: searchDates.till, guests: String(guests), ...(regionLabel ? { location: regionLabel } : {}) })}` : regionLabel ? `/search?${new URLSearchParams({ location: regionLabel, guests: String(guests) })}` : "/search";

  useEffect(() => {
    if (!clock) return;
    if (mode !== "holidays") return;
    const controller = new AbortController();
    setHolidayState("loading");
    discoveryJson<{ holidays: HomeHoliday[] }>(`/api/vii/home-holidays?locale=${language}`, clock.key, { signal: controller.signal, persist: true, timeoutMs: 4_000, retries: 0 })
      .then((result) => {
        if (!Array.isArray(result.holidays)) throw new Error("invalid_result");
        setHolidays(result.holidays);
        setHolidayId(previous => result.holidays.some(item => item.id === previous) ? previous : result.holidays[0]?.id ?? null);
        setHolidayState("ready");
      })
      .catch((error) => { if (error?.name !== "AbortError") setHolidayState("error"); });
    return () => controller.abort();
  }, [language, mode, retry, clock?.key]);

  useEffect(() => {
    if (!clock) return;
    if (mode === "holidays" && (holidayState !== "ready" || holidayId === null)) return;
    const controller = new AbortController();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const accepted = lastGoodData.current.get(selectionKey);
    setData(accepted ?? null);
    setState(accepted ? "ready" : "loading");
    const selectedHoliday = holidays.find((item) => item.id === holidayId);
    const url = mode === "holidays"
      ? `/api/vii/home-holiday-deals?${new URLSearchParams({ id: String(holidayId), proof: "verified-offers-v1", ...(selectedHoliday?.exactStay ? { from: selectedHoliday.from, till: selectedHoliday.till } : {}) })}`
      : `/api/vii/home-deals?${new URLSearchParams({ period, locale: language, proof: "verified-offers-v1", ...(regionLabel ? { region: regionLabel } : {}), ...(guests !== 2 ? { guests: String(guests) } : {}) })}`;
    discoveryJson<ResponseData>(url, `${clock.key}:verified-offers-v1`, { signal: controller.signal, headers: { Accept: "application/json" }, persist: true, timeoutMs: 5_000, retries: 0,
      shouldCache: (value) => (value as ResponseData | null)?.availabilityStatus === "verified" })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(result.deals) || (mode === "near" && (!homeDealPeriods.some(item => item.id === result.period) || result.region !== regionLabel)) || (mode === "holidays" && result.holiday?.id !== holidayId)) throw new Error("invalid_result");
        if (mode === "near" && !fixedPeriod && result.display?.periods?.length) {
          setPeriodTabs(result.display.periods);
          if (!displaySettingsApplied.current) {
            displaySettingsApplied.current = true;
            if (result.display.defaultPeriod !== period) { setPeriod(result.display.defaultPeriod); return; }
          } else if (!result.display.periods.some((item) => item.id === period)) { setPeriod(result.display.defaultPeriod); return; }
        }
        if (result.availabilityStatus === "refreshing" && result.deals.length === 0) {
          const attempts = automaticRetries.current.get(selectionKey) || 0;
          if (attempts >= 1) setState(accepted ? "ready" : "error");
          else {
            automaticRetries.current.set(selectionKey, attempts + 1);
            retryTimer = setTimeout(() => setRetry((value) => value + 1), 1_500);
          }
          return;
        }
        automaticRetries.current.delete(selectionKey);
        lastGoodData.current.set(selectionKey, result);
        setData(result);
        setState("ready");
      })
      .catch((error) => { if (error?.name !== "AbortError") setState(accepted ? "ready" : "error"); });
    return () => { controller.abort(); if (retryTimer) clearTimeout(retryTimer); };
  }, [period, fixedPeriod, holidayId, holidayState, holidays, language, mode, retry, regionLabel, guests, selectionKey, clock?.key]);

  function choose(value: HomeDealPeriod) {
    if (value !== period) setState("loading");
    setPeriod(value);
    track.current?.scrollTo({ left: 0, behavior: "instant" });
  }

  function chooseHoliday(value: number) {
    if (value !== holidayId) setState("loading");
    setHolidayId(value);
    track.current?.scrollTo({ left: 0, behavior: "instant" });
  }

  const sectionId = scope ? `regional-vacation-${scope.key}` : mode === "holidays" ? "home-holiday-deals" : "home-live-deals";
  const eligibleDeals = clock ? (data?.deals || []).filter(deal => eligibleDealDate(deal.from, clock.now)) : [];
  const displayedDeals = orderDiscoveryRail(eligibleDeals, { id: deal => deal.siteID, seed: `${documentSeed}:home:${mode}:${mode === "holidays" ? holidayId : period}`, online: deal => isHomeDealOnlineEligible(deal), priority: deal => managedVacationPriority((deal as HomeDeal & { curatedRank?: number }).curatedRank) });
  const displayState = mode === "holidays" && holidayState !== "ready" ? holidayState : state;
  const refreshing = displayState === "loading" && data !== null;
  const allLabel = allLinkLabel || (mode === "holidays" && currentHoliday ? `${allPeriodCopy[language].holiday}${translate(currentHoliday.name)}` : mode === "near" ? allPeriodCopy[language][period] : text.all);
  const displayedDealCount = displayedDeals.length;

  return <section className={`section home-recommended home-live-deals ${sectionId}${fixedPeriod ? " last-minute-page-deals" : ""}`} aria-labelledby={`${sectionId}-title`}>
    <div className="shell">
      <div className="section-head"><div><h2 id={`${sectionId}-title`}>{title}</h2></div><div><Link href={localizedPath(searchHref, language)} prefetch={false} className="home-live-deals__all-link" suppressHydrationWarning>{allLabel}</Link><HomeSliderControls railId={`${sectionId}-rail`} label={title} itemSelector=".home-live-deals__item" disabled={displayState !== "ready" || !displayedDealCount} /></div></div>
      {!fixedPeriod ? <div className={`home-live-deals__tabs${mode === "near" ? " home-live-deals__tabs--near" : ""}`} role="tablist" aria-label={title}>
        {mode === "near" ? periodTabs.map((item, index) => <button key={item.id} type="button" role="tab" aria-controls={`${sectionId}-results`} aria-selected={period === item.id} tabIndex={period === item.id ? 0 : -1} onClick={() => choose(item.id)} onKeyDown={(event) => {
          const next = event.key === "Home" ? 0 : event.key === "End" ? periodTabs.length - 1 : event.key === "ArrowRight" ? (index + (language === "he" ? -1 : 1) + periodTabs.length) % periodTabs.length : event.key === "ArrowLeft" ? (index + (language === "he" ? 1 : -1) + periodTabs.length) % periodTabs.length : -1;
          if (next < 0) return;
          event.preventDefault();
          choose(periodTabs[next].id);
          event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
        }}>{item.label}</button>) : holidays.map((item, index) => <button key={item.id} type="button" role="tab" aria-controls={`${sectionId}-results`} aria-selected={holidayId === item.id} tabIndex={holidayId === item.id ? 0 : -1} onClick={() => chooseHoliday(item.id)} onKeyDown={(event) => {
          const next = event.key === "Home" ? 0 : event.key === "End" ? holidays.length - 1 : event.key === "ArrowRight" ? (index + (language === "he" ? -1 : 1) + holidays.length) % holidays.length : event.key === "ArrowLeft" ? (index + (language === "he" ? 1 : -1) + holidays.length) % holidays.length : -1;
          if (next < 0) return;
          event.preventDefault();
          chooseHoliday(holidays[next].id);
          event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
        }}><strong>{item.name}</strong></button>)}
      </div> : null}
      <div className={`home-live-deals__results${refreshing ? " is-refreshing" : ""}`} id={`${sectionId}-results`} role="tabpanel" aria-live="polite" aria-busy={displayState === "loading"}>
        {scope && displayState === "ready" && data?.expandedRegion && displayedDealCount > 0 ? <p className="regional-availability__expansion" data-no-translate>{regionalExpansionCopy[language]}</p> : null}
        {displayState === "loading" && !data ? <div className="home-live-deals__loading" role="status" aria-label={text.loading}>
          <div className="home-live-deals__loading-head" aria-hidden="true">
            <div className="home-live-deals__loading-route"><span /><span /><span /><img src="/vii-logo.png" alt="" title="" data-image-role="decorative" /></div>
            <span>{text.loading}</span>
          </div>
          <div className="home-live-deals__loading-cards" aria-hidden="true">{[0, 1, 2].map((index) => <div className="home-live-deals__loading-card" key={index}><div className="home-live-deals__loading-image" /><div className="home-live-deals__loading-lines"><span /><span /><span /></div></div>)}</div>
        </div> : null}
        {displayState === "error" ? <div className={`home-live-deals__status${data ? " home-live-deals__status--overlay" : ""}`}><p>{text.error}</p><button type="button" onClick={() => { automaticRetries.current.delete(selectionKey); setRetry((value) => value + 1); }}>{text.retry}</button></div> : null}
        {displayState === "ready" && (mode === "holidays" && !holidays.length || data?.deals.length === 0) ? <p className="home-live-deals__status">{text.empty}</p> : null}
        {data?.deals.length ? <div id={`${sectionId}-rail`} className="home-live-deals__track" ref={track} data-horizontal-rail inert={refreshing || undefined} aria-hidden={refreshing || undefined}>
          {displayedDeals.map((deal) => {
            const href = `/business?${new URLSearchParams({ id: `vacation-${deal.siteID}`, from: deal.from, till: deal.till, guests: String(deal.priceGuests), ...(deal.roomID ? { roomID: String(deal.roomID) } : {}), source: mode === "holidays" ? "home-holidays" : "home-deals", period: mode === "holidays" ? String(currentHoliday?.id ?? "") : period }).toString()}`;
            return <div className="home-live-deals__item" key={`${deal.siteID}-${deal.from}`}>
              <PropertyCard
                property={dealProperty(deal)}
                selectedStay={{ from: deal.from, till: deal.till, guests: deal.priceGuests }}
                liveAvailabilityState={{ status: "ready", quote: dealAvailability(deal) }}
                detailHref={href}
              />
            </div>;
          })}
        </div> : null}
      </div>
    </div>
  </section>;
}
