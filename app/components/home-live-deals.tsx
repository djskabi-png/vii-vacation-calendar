"use client";

/* eslint-disable @next/next/no-img-element, react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePacedRailRender } from "./use-paced-rail-render";
import { useSectionActivation } from "./use-section-activation";
import { homeDealDates, homeDealPeriods, type HomeDeal, type HomeDealPeriod } from "../lib/vii-home-deals";
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
import { useDealClock } from "./use-deal-clock";
import { discoveryJson } from "../lib/discovery-client-cache.ts";
import { capHomeHolidayTabs } from "../lib/home-slider-contract.ts";
import {useDocumentSeed} from "./use-document-seed";
import {usePublicPromotionWeights} from "./use-public-promotion-weights";
import {orderDiscoveryItems} from "../lib/discovery-slider-order";
import {isHomeDealOnlineEligible} from "../lib/vacation-online-first";
import {matchesSearchLocation} from "../data/search-taxonomy";
import { canonicalVerifiedSliderItems } from "../lib/verified-slider-offers.ts";
import { permanentHomePeriodLandings } from "../lib/home-period-landings.ts";
import { HOME_OFFER_MAX_AGE_MS, homeOfferCheckedAt, isFreshHomeOffer, validHomeOfferResponse } from "../lib/home-offer-freshness.ts";
import { DISCOVERY_RECOVERY_BUDGET_MS, discoveryRecoveryDelay } from "../lib/discovery-recovery-policy.ts";
import { acceptedHomeDealsSeed } from "../lib/home-deals-seed.ts";
import { dealClockKey } from "../lib/deal-clock.ts";

export type HomeDealsInitialData = { cache?: { status: string; checkedAt?: string }; availabilityStatus?: "verified" | "refreshing"; locale?: string; guests?: number; clockKey?: string; renderedAt?: string; region?: string; expandedRegion?: boolean; regionalOrder?: number[]; period?: HomeDealPeriod; holiday?: HomeHoliday; dates: { from: string; till: string; nights: number }; deals: HomeDeal[]; display?: { periods: HomePeriodTab[]; defaultPeriod: HomeDealPeriod } };
type ResponseData = HomeDealsInitialData;

const selectionRecoveryBudgetMs = DISCOVERY_RECOVERY_BUDGET_MS;
// The origin already performs one bounded 3.2s join against the lease-owned
// refresh. Retrying the same discovery request in the browser doubled a cold
// tab transition to roughly eight seconds without adding fresh information.
// Keep one browser attempt slightly wider than the server join and let the
// existing recovery state own any later, visibly signalled retry.
const sliderRequestBudgetMs = 4_500;
const holidayPrimeRequests = new Map<string, Promise<ResponseData>>();
const periodPrimeRequests = new Map<string, Promise<ResponseData>>();

function homePeriodDealsUrl(period: HomeDealPeriod, language: string, clockKey: string, guests: number, regionLabel?: string) {
  return `/api/vii/home-deals?${new URLSearchParams({ period, locale: language, proof: "verified-offers-v1", clock: clockKey, ...(regionLabel ? { region: regionLabel } : {}), ...(guests !== 2 ? { guests: String(guests) } : {}) })}`;
}

function primeHomePeriodDeals(period: HomeDealPeriod, language: string, clockKey: string, guests: number, regionLabel?: string) {
  const url = homePeriodDealsUrl(period, language, clockKey, guests, regionLabel);
  const scope = `${clockKey}:verified-offers-v2`;
  const key = `${scope}:${url}`;
  const existing = periodPrimeRequests.get(key);
  if (existing) return existing;
  const request = discoveryJson<ResponseData>(url, scope, {
    headers: { Accept: "application/json" }, persist: true, freshMs: 5 * 60_000,
    staleMs: 60 * 60_000, timeoutMs: sliderRequestBudgetMs, totalTimeoutMs: sliderRequestBudgetMs, retries: 0,
    shouldCache: (value) => (value as ResponseData | null)?.availabilityStatus === "verified" && isFreshHomeOffer(value as ResponseData | null),
    validateResponse: validHomeOfferResponse,
  }).finally(() => periodPrimeRequests.delete(key));
  periodPrimeRequests.set(key, request);
  return request;
}

function pendingHomePeriodPrime(period: HomeDealPeriod, language: string, clockKey: string, guests: number, regionLabel?: string) {
  const url = homePeriodDealsUrl(period, language, clockKey, guests, regionLabel);
  return periodPrimeRequests.get(`${clockKey}:verified-offers-v2:${url}`);
}

function homeHolidayDealsUrl(holiday: HomeHoliday, clockKey: string) {
  return `/api/vii/home-holiday-deals?${new URLSearchParams({ id: String(holiday.id), proof: "verified-offers-v1", clock: clockKey, ...(holiday.exactStay ? { from: holiday.from, till: holiday.till } : {}) })}`;
}

function primeHomeHolidayDeals(holiday: HomeHoliday, clockKey: string) {
  const url = homeHolidayDealsUrl(holiday, clockKey);
  const scope = `${clockKey}:verified-offers-v2`;
  const key = `${scope}:${url}`;
  const existing = holidayPrimeRequests.get(key);
  if (existing) return existing;
  const request = discoveryJson<ResponseData>(url, scope, {
    headers: { Accept: "application/json" },
    persist: true,
    freshMs: 5 * 60_000,
    staleMs: 60 * 60_000,
    timeoutMs: sliderRequestBudgetMs,
    totalTimeoutMs: sliderRequestBudgetMs,
    retries: 0,
    shouldCache: (value) => (value as ResponseData | null)?.availabilityStatus === "verified" && isFreshHomeOffer(value as ResponseData | null),
    validateResponse: validHomeOfferResponse,
  }).finally(() => holidayPrimeRequests.delete(key));
  holidayPrimeRequests.set(key, request);
  return request;
}

function pendingHomeHolidayPrime(holiday: HomeHoliday, clockKey: string) {
  const url = homeHolidayDealsUrl(holiday, clockKey);
  return holidayPrimeRequests.get(`${clockKey}:verified-offers-v2:${url}`);
}

function waitForHolidayPrime(pending: Promise<ResponseData>, signal: AbortSignal) {
  if (signal.aborted) return Promise.reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
  return new Promise<ResponseData>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    pending.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

const copy = {
  he: { title: "נופש פנוי בתאריכים הקרובים", all: "לכל מקומות הנופש", loading: "בודקים זמינות ומחירים", empty: "לא נמצאו מקומות פנויים לתאריכים האלה", error: "לא הצלחנו לבדוק זמינות כרגע", retry: "לנסות שוב", total: "מחיר כולל", details: "לפרטי המקום", call: "חיוג למקום", whatsapp: "וואטסאפ", available: "פנוי לתאריכים שבחרתם", night: "לילה", nights: "לילות", bedrooms: "חדרי שינה", guests: "אורחים", reviews: "חוות דעת", dateTo: "עד", tabs: ["ברגע האחרון", "חמישי עד שבת", "שישי עד ראשון", "לילה בחמישי", "לילה בשישי"] },
  en: { title: "Available stays ahead", all: "All stays", loading: "Checking availability and prices", empty: "No available stays for these dates", error: "Availability could not be checked", retry: "Try again", total: "Total price", details: "Place details", call: "Call the property", whatsapp: "WhatsApp", available: "Available for your dates", night: "night", nights: "nights", bedrooms: "bedrooms", guests: "guests", reviews: "reviews", dateTo: "to", tabs: ["Last minute", "Thursday to Saturday", "Friday to Sunday", "Thursday night", "Friday night"] },
  ru: { title: "Свободное жилье на ближайшие даты", all: "Все варианты", loading: "Проверяем наличие и цены", empty: "На эти даты свободных мест нет", error: "Не удалось проверить наличие", retry: "Повторить", total: "Полная стоимость", details: "Подробнее", call: "Позвонить", whatsapp: "WhatsApp", available: "Свободно на выбранные даты", night: "ночь", nights: "ночи", bedrooms: "спальни", guests: "гостей", reviews: "отзывов", dateTo: "до", tabs: ["В последний момент", "Чт–Сб", "Пт–Вс", "Ночь в четверг", "Ночь в пятницу"] },
  fr: { title: "Séjours disponibles prochainement", all: "Tous les séjours", loading: "Vérification des disponibilités", empty: "Aucun séjour disponible à ces dates", error: "Disponibilité indisponible", retry: "Réessayer", total: "Prix total", details: "Voir le lieu", call: "Appeler le lieu", whatsapp: "WhatsApp", available: "Disponible à ces dates", night: "nuit", nights: "nuits", bedrooms: "chambres", guests: "voyageurs", reviews: "avis", dateTo: "au", tabs: ["Dernière minute", "Jeudi à samedi", "Vendredi à dimanche", "Nuit de jeudi", "Nuit de vendredi"] },
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
  const hasPrice = typeof deal.total === "number" && Number.isFinite(deal.total) && deal.total > 0 && deal.nights > 0;
  return {
    from: deal.from,
    till: deal.till,
    availability: "available",
    totalPrice: hasPrice ? deal.total! : undefined,
    nightlyPrice: hasPrice ? Math.round(deal.total! / deal.nights) : undefined,
    includedGuests: deal.priceGuests,
    quotedGuests: deal.priceGuests,
    priceBasisGuests: deal.priceBasisGuests,
    priceMode: "stay_total",
    // An accepted last-known snapshot remains valid discovery evidence while
    // the background refresh retries. Checkout still revalidates live.
    onlineBooking: hasPrice ? deal.onlineBooking : false,
    bookingSupported: Number.isSafeInteger(deal.roomID) && Number(deal.roomID) > 0,
    supplierRoomID: Number.isSafeInteger(deal.roomID) && Number(deal.roomID) > 0 ? deal.roomID : undefined,
    showSelectedDates: true,
  };
}

export function HomeLiveDeals({ mode = "near", region, guests = 2, fixedPeriod, sectionTitle, allLinkLabel, layout = "rail", deferUntilNearViewport = false, initialData, pendingSeed = false }: { mode?: "near" | "holidays"; region?: string; guests?: number; fixedPeriod?: HomeDealPeriod; sectionTitle?: string; allLinkLabel?: string; layout?: "rail" | "grid"; deferUntilNearViewport?: boolean; initialData?: HomeDealsInitialData | null; pendingSeed?: boolean }) {
  const clock = useDealClock();
  const documentSeed=useDocumentSeed();
  const promotionWeight=usePublicPromotionWeights("vacations");
  const scope = mode === "near" ? regionalAvailabilityRegion(region) : null;
  const regionLabel = scope?.label;
  const sectionId = scope ? `regional-vacation-${scope.key}` : mode === "holidays" ? "home-holiday-deals" : "home-live-deals";
  const activated = useSectionActivation(`${sectionId}-title`, deferUntilNearViewport, "900px 0px");
  const active = !pendingSeed && activated;
  const { language, translate } = useSiteLanguage();
  const [chosenPeriod, setPeriod] = useState<HomeDealPeriod>(fixedPeriod ?? initialData?.display?.defaultPeriod ?? "tomorrow");
  const period = fixedPeriod ?? chosenPeriod;
  const [periodTabs, setPeriodTabs] = useState<HomePeriodTab[]>(() => initialData?.display?.periods ?? homeDealPeriods.map((item, index) => ({ id: item.id, label: copy[language].tabs[index] })));
  const [seedEnabled, setSeedEnabled] = useState(true);
  const [dealRetry, setDealRetry] = useState(0);
  const [holidayListRetry, setHolidayListRetry] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [scopedData, setScopedData] = useState<{ key: string; value: ResponseData } | null>(null);
  const [holidays, setHolidays] = useState<HomeHoliday[]>([]);
  const [holidayId, setHolidayId] = useState<number | null>(null);
  const [holidayState, setHolidayState] = useState<"loading" | "ready" | "error">("loading");
  const track = useRef<HTMLDivElement>(null);
  const lastGoodData = useRef(new Map<string, ResponseData>());
  const automaticRetries = useRef(new Map<string, number>());
  const recoveryStartedAt = useRef(new Map<string, number>());
  const displaySettingsApplied = useRef(Boolean(initialData?.display));
  const text = copy[language];
  const title = sectionTitle || (scope ? regionalAvailabilityTitle("vacation", scope, language) : mode === "holidays" ? { he: "נופש פנוי בחגים", en: "Available stays for holidays", ru: "Отдых в праздники", fr: "Séjours disponibles pendant les fêtes" }[language] : text.title);
  const selectionKey = `${language}:${clock?.key || "loading"}:` + (mode === "holidays" ? `holiday:${holidayId ?? "loading"}` : `near:${regionLabel || "all"}:${period}:${guests}`);
  // A serialized render time keeps the server and first hydration identical.
  // Once the shared clock mounts, its current Israel-day/cutoff wins.
  const seedTime = clock?.now ?? new Date(initialData?.renderedAt || "");
  const seedDates = Number.isFinite(seedTime.getTime()) ? homeDealDates(period, seedTime) : null;
  const initialSeedUsable = seedEnabled && mode === "near" && seedDates !== null && acceptedHomeDealsSeed(initialData, { period, guests, locale: language, region: regionLabel, ...seedDates, clockKey: dealClockKey(seedTime), now: clock ? Date.now() : seedTime.getTime() });
  const data = scopedData?.key === selectionKey && isFreshHomeOffer(scopedData.value)
    ? scopedData.value
    : scopedData === null && initialSeedUsable ? initialData : null;
  function setData(value: ResponseData | null) { setScopedData(value ? { key: selectionKey, value } : null); }
  const selectedDates = mode === "holidays" ? data?.deals[0] ?? data?.dates : data?.dates;
  const searchDates = clock && selectedDates && eligibleDealDate(selectedDates.from, clock.now) ? selectedDates : undefined;
  const currentHoliday = holidays.find((item) => item.id === holidayId);
  const searchHref = mode === "holidays" && currentHoliday?.href
    ? currentHoliday.href
    : mode === "near" && !fixedPeriod && !regionLabel
      ? permanentHomePeriodLandings[period]
      : searchDates ? `/search?${new URLSearchParams({ from: searchDates.from, till: searchDates.till, guests: String(guests), ...(regionLabel ? { location: regionLabel } : {}) })}` : regionLabel ? `/search?${new URLSearchParams({ location: regionLabel, guests: String(guests) })}` : "/search";

  useEffect(() => {
    if (!clock || !active) return;
    if (mode !== "holidays") return;
    const controller = new AbortController();
    setHolidayState("loading");
    discoveryJson<{ holidays: HomeHoliday[] }>(`/api/vii/home-holidays?${new URLSearchParams({ locale: language, clock: clock.key })}`, clock.key, { signal: controller.signal, persist: true, timeoutMs: 4_000, retries: 1 })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(result.holidays)) throw new Error("invalid_result");
        // The API and CMS both cap the public rail, but a browser can still
        // hold a previously accepted pre-cap session snapshot. Enforce the
        // same invariant at the final rendering boundary as well.
        const visibleHolidays = capHomeHolidayTabs(result.holidays);
        setHolidays(visibleHolidays);
        setHolidayId(previous => visibleHolidays.some(item => item.id === previous) ? previous : visibleHolidays[0]?.id ?? null);
        setHolidayState("ready");
      })
      .catch(() => { if (!controller.signal.aborted) setHolidayState("error"); });
    return () => controller.abort();
  }, [active, language, mode, holidayListRetry, clock?.key]);

  useEffect(() => {
    if (!clock || !active) return;
    if (mode === "holidays" && (holidayState !== "ready" || holidayId === null)) return;
    const controller = new AbortController();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = recoveryStartedAt.current.get(selectionKey) ?? Date.now();
    recoveryStartedAt.current.set(selectionKey, startedAt);
    const remainingBudget = () => Math.max(0, selectionRecoveryBudgetMs - (Date.now() - startedAt));
    const acceptedCandidate = lastGoodData.current.get(selectionKey);
    const accepted = isFreshHomeOffer(acceptedCandidate) ? acceptedCandidate : initialSeedUsable ? initialData ?? undefined : undefined;
    if (!accepted) lastGoodData.current.delete(selectionKey);
    // Keep the last verified rail visible and inert while another tab is
    // loading. Clearing it here creates a blank/skeleton flash on every
    // holiday switch even when the replacement arrives milliseconds later.
    if (accepted) setData(accepted);
    setState(accepted ? "ready" : "loading");
    const selectedHoliday = holidays.find((item) => item.id === holidayId);
    const seededDates = mode === "near" ? homeDealDates(period, clock.now) : null;
    const canUseSeed = Boolean(seedEnabled && dealRetry === 0 && mode === "near" && acceptedHomeDealsSeed(initialData, { period, guests, locale: language, region: regionLabel, from: seededDates?.from || "", till: seededDates?.till || "", nights: seededDates?.nights, clockKey: clock.key }) && initialData?.cache?.status === "fresh" && Date.now() - (homeOfferCheckedAt(initialData) ?? 0) < 5 * 60_000);
    if (canUseSeed) {
      lastGoodData.current.set(selectionKey, initialData as ResponseData);
      setData(initialData as ResponseData);
      setState("ready");
      // Fresh seeds replace only the first fetch, never future revalidation.
      const revalidate = setTimeout(() => {
        recoveryStartedAt.current.delete(selectionKey);
        setDealRetry(value => value + 1);
      }, Math.max(1, 5 * 60_000 - (Date.now() - (homeOfferCheckedAt(initialData) ?? 0))));
      return () => { controller.abort(); clearTimeout(revalidate); };
    }
    const url = mode === "holidays"
      ? `/api/vii/home-holiday-deals?${new URLSearchParams({ id: String(holidayId), proof: "verified-offers-v1", clock: clock.key, ...(selectedHoliday?.exactStay ? { from: selectedHoliday.from, till: selectedHoliday.till } : {}) })}`
      : homePeriodDealsUrl(period, language, clock.key, guests, regionLabel);
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const armExpiry = (value: ResponseData | undefined) => {
      if (expiryTimer) clearTimeout(expiryTimer);
      const checkedAt = homeOfferCheckedAt(value);
      if (checkedAt === null || !isFreshHomeOffer(value)) return;
      expiryTimer = setTimeout(() => {
        lastGoodData.current.delete(selectionKey);
        setData(null);
        setState("loading");
        recoveryStartedAt.current.delete(selectionKey);
        setDealRetry((value) => value + 1);
      }, Math.max(1, checkedAt + HOME_OFFER_MAX_AGE_MS - Date.now()));
    };
    armExpiry(accepted);
    const recover = (refreshPending = true) => {
      const usable = isFreshHomeOffer(accepted);
      if (!usable) {
        lastGoodData.current.delete(selectionKey);
        if (!refreshPending) setData(null);
      }
      const attempts = automaticRetries.current.get(selectionKey) || 0;
      const delay = discoveryRecoveryDelay(attempts, remainingBudget());
      if (!refreshPending || delay === null) { setState(usable ? "ready" : "error"); return; }
      automaticRetries.current.set(selectionKey, attempts + 1);
      setState(usable ? "ready" : "loading");
      retryTimer = setTimeout(() => setDealRetry((value) => value + 1), delay);
    };
    if (!remainingBudget()) {
      recover(false);
      return () => { controller.abort(); if (expiryTimer) clearTimeout(expiryTimer); };
    }
    // One changed-cache retry can recover a transient read failure. Both
    // attempts and refreshing polls share the same selection deadline.
    const primedHoliday = mode === "holidays" && selectedHoliday ? pendingHomeHolidayPrime(selectedHoliday, clock.key) : undefined;
    const primedPeriod = mode === "near" ? pendingHomePeriodPrime(period, language, clock.key, guests, regionLabel) : undefined;
    const request = primedHoliday || primedPeriod
      ? waitForHolidayPrime((primedHoliday || primedPeriod)!, controller.signal)
      : discoveryJson<ResponseData>(url, `${clock.key}:verified-offers-v2`, { signal: controller.signal, headers: { Accept: "application/json" }, persist: true, freshMs: 5 * 60_000, staleMs: 60 * 60_000, timeoutMs: Math.min(4_500, remainingBudget()), totalTimeoutMs: Math.min(4_500, remainingBudget()), retries: 0,
        shouldCache: (value) => (value as ResponseData | null)?.availabilityStatus === "verified" && isFreshHomeOffer(value as ResponseData | null), validateResponse: validHomeOfferResponse });
    request
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(result.deals) || (mode === "near" && (!homeDealPeriods.some(item => item.id === result.period) || result.region !== regionLabel)) || (mode === "holidays" && result.holiday?.id !== holidayId)) throw new Error("invalid_result");
        if (mode === "near" && result.period !== period) throw new Error("invalid_period_result");
        if (mode === "near") {
          const expected = homeDealDates(period, clock.now);
          if (result.dates?.from !== expected.from || result.dates?.till !== expected.till || result.deals.some(deal => deal.from !== expected.from || deal.till !== expected.till)) throw new Error("invalid_dates_result");
        }
        if (mode === "near" && !fixedPeriod && result.display?.periods?.length) {
          setPeriodTabs(result.display.periods);
          if (!displaySettingsApplied.current) {
            displaySettingsApplied.current = true;
            if (result.display.defaultPeriod !== period) { setPeriod(result.display.defaultPeriod); return; }
          } else if (!result.display.periods.some((item) => item.id === period)) { setPeriod(result.display.defaultPeriod); return; }
        }
        if (result.availabilityStatus === "refreshing" && result.deals.length === 0) {
          recover();
          return;
        }
        if (!isFreshHomeOffer(result)) throw new Error("expired_result");
        automaticRetries.current.delete(selectionKey);
        recoveryStartedAt.current.delete(selectionKey);
        lastGoodData.current.set(selectionKey, result);
        setData(result);
        setState("ready");
        armExpiry(result);
      })
      .catch(() => { if (!controller.signal.aborted) recover(false); });
    return () => { controller.abort(); if (retryTimer) clearTimeout(retryTimer); if (expiryTimer) clearTimeout(expiryTimer); };
  }, [active, period, fixedPeriod, holidayId, holidayState, holidays, language, mode, dealRetry, regionLabel, guests, selectionKey, clock?.key]);

  useEffect(() => {
    if (!clock || !active || mode !== "near" || fixedPeriod || state !== "ready" || !data) return;
    const currentIndex = periodTabs.findIndex((item) => item.id === period);
    if (currentIndex < 0) return;
    const ordered = periodTabs
      .filter((item) => item.id !== period)
      .sort((a, b) => Math.abs(periodTabs.indexOf(a) - currentIndex) - Math.abs(periodTabs.indexOf(b) - currentIndex));
    let cancelled = false;
    const timer = setTimeout(async () => {
      for (const item of ordered) {
        if (cancelled) return;
        try { await primeHomePeriodDeals(item.id, language, clock.key, guests, regionLabel); } catch { /* The selected tab owns visible recovery. */ }
        if (cancelled) return;
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }, 120);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [active, clock?.key, data, fixedPeriod, guests, language, mode, period, periodTabs, regionLabel, state]);

  useEffect(() => {
    if (!clock || !active || mode !== "holidays" || holidayState !== "ready" || state !== "ready" || !data || holidayId === null) return;
    const currentIndex = holidays.findIndex((item) => item.id === holidayId);
    if (currentIndex < 0) return;
    // Warm the nearest choices first and keep concurrency at one. This makes
    // ordinary tab changes instant without recreating the origin spike that a
    // six-request burst caused during the prior incident.
    const ordered = holidays
      .filter((item) => item.id !== holidayId)
      .sort((a, b) => Math.abs(holidays.indexOf(a) - currentIndex) - Math.abs(holidays.indexOf(b) - currentIndex));
    let cancelled = false;
    const timer = setTimeout(async () => {
      for (const holiday of ordered) {
        if (cancelled) return;
        try { await primeHomeHolidayDeals(holiday, clock.key); } catch { /* A selected tab still owns visible retry/error UI. */ }
        if (cancelled) return;
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }, 120);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [active, clock?.key, data, holidayId, holidayState, holidays, mode, state]);

  function choose(value: HomeDealPeriod) {
    if (value === period) return;
    // A deliberate visitor choice always wins over a late homepage-settings
    // response from the initial tab. Without this boundary, the first API
    // completion could silently reset the selected tab to the CMS default.
    displaySettingsApplied.current = true;
    setSeedEnabled(false);
    setState("loading");
    setPeriod(value);
  }

  function chooseHoliday(value: number) {
    if (value === holidayId) return;
    setState("loading");
    setHolidayId(value);
  }

  const retainedData = data ?? (state === "loading" && scopedData && isFreshHomeOffer(scopedData.value) ? scopedData.value : null);
  const eligibleDeals = useMemo(() => retainedData?.deals?.filter(deal => !clock || eligibleDealDate(deal.from, clock.now)) || [], [retainedData?.deals, clock?.key]);
  // Preserve accepted identities and truth cohorts before weighted exposure.
  // Each independent search rotates equal-weight eligible venues; the
  // selected search remains stable through map/list and pagination changes.
  const displayedDeals = useMemo(() => orderDiscoveryItems(canonicalVerifiedSliderItems(eligibleDeals, deal => deal.siteID), {id:deal=>deal.siteID,seed:`${documentSeed}:vacation:${period}:${guests}`,online:deal=>isHomeDealOnlineEligible(deal),priority:deal=>scope&&!matchesSearchLocation({location:deal.city,area:deal.area},scope.label)?1:0,promotionWeight:deal=>promotionWeight(deal.siteID)}), [eligibleDeals,documentSeed,period,guests,scope?.label,promotionWeight]);
  const renderedCount = usePacedRailRender(selectionKey, displayedDeals.length, active, deferUntilNearViewport && layout === "rail");
  const displayState = mode === "holidays" && holidayState !== "ready" ? holidayState : scopedData && scopedData.key !== selectionKey ? "loading" : data && scopedData === null ? "ready" : state;
  const refreshing = displayState === "loading" && retainedData !== null;
  const allLabel = allLinkLabel || (mode === "holidays" && currentHoliday ? `${allPeriodCopy[language].holiday}${translate(currentHoliday.name)}` : mode === "near" ? allPeriodCopy[language][period] : text.all);
  const displayedDealCount = displayedDeals.length;
  const resultCountLabel = ({
    he: `${displayedDealCount} מקומות פנויים`,
    en: `${displayedDealCount} available stays`,
    ru: `${displayedDealCount} доступных вариантов`,
    fr: `${displayedDealCount} séjours disponibles`,
  } as const)[language];

  // Reserve every snap area at once. Appending RTL flex items while Safari is
  // settling a snap changes the rail's extent and can sweep through the list.
  // Only the expensive card content is paced; rail geometry stays unchanged.
  const renderedHolidayId = retainedData?.holiday?.id ?? currentHoliday?.id;
  const dealCards = useMemo(() => displayedDeals.map((deal, index) => {
            const href = `/business?${new URLSearchParams({ id: `vacation-${deal.siteID}`, from: deal.from, till: deal.till, guests: String(deal.priceGuests), ...(deal.roomID ? { roomID: String(deal.roomID) } : {}), source: mode === "holidays" ? "home-holidays" : "home-deals", period: mode === "holidays" ? String(renderedHolidayId ?? "") : period }).toString()}`;
            return <div className="home-live-deals__item" key={`${deal.siteID}-${deal.from}`}>
              {index < renderedCount ? <PropertyCard
                property={dealProperty(deal)}
                selectedStay={{ from: deal.from, till: deal.till, guests: deal.priceGuests }}
                liveAvailabilityState={{ status: "ready", quote: dealAvailability(deal) }}
                detailHref={href}
                priority={active && index < 2}
              /> : <div className="home-live-deals__deferred-card" aria-hidden="true"><div className="home-live-deals__loading-image" /><div className="home-live-deals__loading-lines"><span /><span /><span /></div></div>}
            </div>;
          }), [displayedDeals, renderedCount, mode, renderedHolidayId, period, active]);

  return <section inert={pendingSeed || undefined} aria-busy={pendingSeed || undefined} className={`section home-recommended home-live-deals ${sectionId}${fixedPeriod ? " last-minute-page-deals" : ""}${layout === "grid" ? " home-live-deals--grid" : ""}`} aria-labelledby={`${sectionId}-title`}>
    <div className="shell">
      <div className="section-head"><div><h2 id={`${sectionId}-title`}>{title}</h2></div><div>{layout === "grid" ? <span className="home-live-deals__count" aria-live="polite">{displayState === "ready" ? resultCountLabel : text.loading}</span> : <><Link href={localizedPath(searchHref, language)} prefetch={false} className="home-live-deals__all-link" suppressHydrationWarning>{allLabel}</Link><HomeSliderControls railId={`${sectionId}-rail`} label={title} itemSelector=".home-live-deals__item" disabled={displayState !== "ready" || !displayedDealCount} /></>}</div></div>
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
        }}><strong>{translate(item.name)}</strong></button>)}
      </div> : null}
      <div className={`home-live-deals__results${refreshing ? " is-refreshing" : ""}`} id={`${sectionId}-results`} role="tabpanel" aria-live="polite" aria-busy={displayState === "loading"}>
        {scope && displayState === "ready" && data?.expandedRegion && displayedDealCount > 0 ? <p className="regional-availability__expansion" data-no-translate>{regionalExpansionCopy[language]}</p> : null}
        {displayState === "loading" && !retainedData ? <div className="home-live-deals__loading" role="status" aria-label={text.loading}>
          <div className="home-live-deals__loading-head" aria-hidden="true">
            <div className="home-live-deals__loading-route"><span /><span /><span /><img src="/vii-logo.png" alt="" title="" data-image-role="decorative" /></div>
            <span>{text.loading}</span>
          </div>
          <div className="home-live-deals__loading-cards" aria-hidden="true">{[0, 1, 2].map((index) => <div className="home-live-deals__loading-card" key={index}><div className="home-live-deals__loading-image" /><div className="home-live-deals__loading-lines"><span /><span /><span /></div></div>)}</div>
        </div> : null}
        {displayState === "error" ? <div className={`home-live-deals__status${data ? " home-live-deals__status--overlay" : ""}`}><p>{text.error}</p><button type="button" onClick={() => {
          if (mode === "holidays" && holidayState === "error") setHolidayListRetry((value) => value + 1);
          else { automaticRetries.current.delete(selectionKey); recoveryStartedAt.current.delete(selectionKey); setDealRetry((value) => value + 1); }
        }}>{text.retry}</button></div> : null}
        {displayState === "ready" && (mode === "holidays" && !holidays.length || data?.deals.length === 0) ? <p className="home-live-deals__status">{text.empty}</p> : null}
        {/* A different search owns a new scroll container. Reusing a snapped
            rail lets the browser follow a retained card to its new index
            while React replaces/reorders the results. Never scroll the old
            search on a tab click; keep its momentum and snap anchor isolated. */}
        {retainedData?.deals.length ? <div key={selectionKey} id={`${sectionId}-rail`} className={`home-live-deals__track${layout === "grid" ? " home-live-deals__track--grid" : ""}`} ref={track} {...(layout === "rail" ? { "data-horizontal-rail": true } : {})} inert={refreshing || undefined} aria-hidden={refreshing || undefined}>
          {dealCards}
        </div> : null}
      </div>
    </div>
  </section>;
}
