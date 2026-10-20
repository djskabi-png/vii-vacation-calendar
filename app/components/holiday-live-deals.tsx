"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Heart, Users, UsersRound, CalendarDays } from "lucide-react";
import type { HomeHoliday } from "../lib/vii-home-holidays.ts";
import type { HomeDeal } from "../lib/vii-home-deals.ts";
import { availableHolidayParts, holidayAudiences, holidaySelection, holidayDealWindow, holidayDealSearchHref, type HolidaySelection } from "../lib/holiday-deal-selection.ts";
import { useSiteLanguage } from "../i18n/locale-provider";
import { localizedPath } from "../i18n/locale-routing";
import { dealAvailability, dealProperty } from "./home-live-deals.tsx";
import { PropertyCard } from "./property-card.tsx";
import { discoveryJson } from "../lib/discovery-client-cache.ts";
import { discoveryCacheCopy } from "../i18n/discovery-cache-copy.ts";
import { eligibleDealDate, firstDealDate } from "../lib/deal-clock";
import { useDealClock } from "./use-deal-clock";
import { isHomeDealOnlineEligible } from "../lib/vacation-online-first.ts";
import { managedVacationPriority } from "../lib/vacation-priority.ts";
import { orderDiscoveryItems } from "../lib/discovery-slider-order.ts";
import { useDocumentSeed } from "./use-document-seed.ts";

const copy = {
  he: { heading: "הדילים שמתאימים לכם", audience: "מי יוצא לחופשה?", family: "משפחה", couple: "זוג", group: "קבוצה גדולה", all: "כל החג", opening: "תחילת החג", middle: "אמצע החג", ending: "סוף החג", period: "מתי יוצאים?", guests: "אורחים", nights: "לילות", loading: "בודקים זמינות ומחיר להרכב שלכם", empty: "לא נמצאו דילים זמינים לבחירה הזאת", emptyHelp: "נסו חלק אחר בחג או שנו את התאריכים וההרכב בחיפוש.", error: "לא הצלחנו לבדוק זמינות כרגע", retry: "לנסות שוב", search: "שינוי תאריכים והרכב", reset: "חזרה לכל החג", count: "מקומות זמינים", basis: "המחירים מחושבים לפי", window: "השהייה עשויה להתחיל בכל תאריך בטווח הזה. התאריכים המדויקים מופיעים בכל דיל." },
  en: { heading: "Deals for your party", audience: "Who is travelling?", family: "Family", couple: "Couple", group: "Large group", all: "Whole holiday", opening: "Early holiday", middle: "Mid-holiday", ending: "Late holiday", period: "When are you going?", guests: "guests", nights: "nights", loading: "Checking availability and prices for your party", empty: "No available deals match this selection", emptyHelp: "Try another part of the holiday or adjust your dates and party in search.", error: "We could not check availability right now", retry: "Try again", search: "Change dates and party", reset: "Search the whole holiday", count: "available stays", basis: "Prices are calculated for", window: "A stay can start on any date within this window. Each deal shows its exact dates." },
  ru: { heading: "Предложения для вашей компании", audience: "С кем вы едете?", family: "Семья", couple: "Пара", group: "Большая группа", all: "Все праздники", opening: "Начало", middle: "Середина", ending: "Конец", period: "Когда поедете?", guests: "гостей", nights: "ночи", loading: "Проверяем наличие и цены для вашей компании", empty: "Для этого выбора нет свободных вариантов", emptyHelp: "Выберите другую часть праздников или измените даты и состав гостей в поиске.", error: "Сейчас не удалось проверить наличие", retry: "Повторить", search: "Изменить даты и состав", reset: "Искать на все праздники", count: "свободных вариантов", basis: "Цена рассчитана на", window: "Заезд возможен в любой день этого периода. Точные даты указаны в каждом предложении." },
  fr: { heading: "Des offres pour votre séjour", audience: "Avec qui partez-vous ?", family: "Famille", couple: "Couple", group: "Grand groupe", all: "Toutes les fêtes", opening: "Début", middle: "Milieu", ending: "Fin", period: "Quand partez-vous ?", guests: "personnes", nights: "nuits", loading: "Vérification des disponibilités et des prix pour votre groupe", empty: "Aucune offre disponible pour cette sélection", emptyHelp: "Essayez une autre période des fêtes ou modifiez les dates et le nombre de personnes.", error: "Impossible de vérifier les disponibilités pour le moment", retry: "Réessayer", search: "Modifier les dates et le groupe", reset: "Rechercher sur toutes les fêtes", count: "séjours disponibles", basis: "Prix calculés pour", window: "Le séjour peut commencer à toute date de cette période. Chaque offre indique ses dates exactes." },
} as const;
const icons = { family: Users, couple: Heart, group: UsersRound };
type Result = { key: string; status: "loading" | "ready" | "error"; deals: HomeDeal[]; stale?: boolean };

export function HolidayLiveDeals({ holiday, initialSelection }: { holiday: HomeHoliday; initialSelection: HolidaySelection }) {
  const clock = useDealClock();
  const { language } = useSiteLanguage();
  const documentSeed = useDocumentSeed();
  const text = copy[language];
  const [selection, setSelection] = useState(initialSelection);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<Result>({ key: "", status: "loading", deals: [] });
  const generation = useRef(0);
  const guests = holidayAudiences.find((item) => item.id === selection.audience)!.guests;
  const earliest = clock ? firstDealDate(clock.now) : holiday.from;
  const currentHoliday = holiday.from < earliest ? { ...holiday, from: earliest, nights: Math.min(2, Math.max(1, Math.round((Date.parse(`${holiday.till}T00:00:00Z`) - Date.parse(`${earliest}T00:00:00Z`)) / 86_400_000))) } : holiday;
  const visibleParts = availableHolidayParts(currentHoliday);
  const normalizedSelection = visibleParts.includes(selection.part) ? selection : { ...selection, part: "all" as const };
  const window = holidayDealWindow(currentHoliday, normalizedSelection.part);
  const key = `${holiday.id}:${normalizedSelection.audience}:${normalizedSelection.part}:${clock?.key || "loading"}`;
  const state = result.key === key ? result.status : "loading";
  const deals = state === "ready" && clock ? orderDiscoveryItems(result.deals.filter(deal => eligibleDealDate(deal.from, clock.now)), { id: deal => deal.siteID, seed: `${documentSeed}:holiday:${holiday.id}:${selection.part}`, online: deal => {
    if (result.stale) return false;
    return isHomeDealOnlineEligible(deal, false);
  }, priority: deal => managedVacationPriority((deal as HomeDeal & { curatedRank?: number }).curatedRank) }) : [];
  const searchHref = localizedPath(holidayDealSearchHref(currentHoliday, normalizedSelection), language);

  useEffect(() => {
    const restore = () => setSelection(holidaySelection(new URLSearchParams(globalThis.location.search), currentHoliday));
    globalThis.addEventListener("popstate", restore);
    return () => globalThis.removeEventListener("popstate", restore);
  }, []);

  useEffect(() => {
    const url = new URL(globalThis.location.href);
    const requestedPart = url.searchParams.get("part");
    if (selection.part !== normalizedSelection.part) setSelection(normalizedSelection);
    if (!requestedPart || requestedPart === normalizedSelection.part) return;
    url.searchParams.set("part", normalizedSelection.part);
    globalThis.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [normalizedSelection.part, selection.part]);

  useEffect(() => {
    if (!clock) return;
    const controller = new AbortController();
    const request = ++generation.current;
    setResult({ key, status: "loading", deals: [] });
    if (currentHoliday.from >= holiday.till) { setResult({ key, status: "ready", deals: [] }); return () => controller.abort(); }
    if (holiday.id <= 0) { setResult({ key, status: "error", deals: [] }); return () => controller.abort(); }
    const params = new URLSearchParams({ id: String(holiday.id), guests: String(guests), part: normalizedSelection.part });
    discoveryJson<{ holiday: HomeHoliday; deals: HomeDeal[]; cache?:{status:string} }>(`/api/vii/home-holiday-deals?${params}`, clock.key, { signal: controller.signal })
      .then((data) => {
        if (data.holiday?.id !== holiday.id || !Array.isArray(data.deals) || data.deals.some((deal) => deal.priceGuests !== guests || deal.from < window.from || deal.till > window.till || !Number.isFinite(deal.total) || deal.total <= 0)) throw new Error("invalid_deals");
        return data;
      })
      .then((data) => { if (!controller.signal.aborted && request === generation.current) setResult({ key, status: "ready", deals: data.deals, stale: data.cache?.status === "stale" }); })
      .catch(() => { if (!controller.signal.aborted && request === generation.current) setResult({ key, status: "error", deals: [] }); });
    return () => controller.abort();
  }, [key, retry, holiday.id, guests, normalizedSelection.part, window.from, window.till, clock?.key]);

  function choose(next: HolidaySelection) {
    if (next.audience === selection.audience && next.part === selection.part) return;
    setSelection(next);
    const url = new URL(globalThis.location.href);
    url.searchParams.set("audience", next.audience);
    url.searchParams.set("part", next.part);
    globalThis.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === "ArrowRight" ? (language === "he" ? -1 : 1) : event.key === "ArrowLeft" ? (language === "he" ? 1 : -1) : 0;
    if (!step && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? holidayAudiences.length - 1 : (index + step + holidayAudiences.length) % holidayAudiences.length;
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }

  const dates = new Intl.DateTimeFormat({ he: "he-IL", en: "en-GB", ru: "ru-RU", fr: "fr-FR" }[language], { day: "numeric", month: "short", timeZone: "UTC" });
  const formatDate = (value: string) => dates.format(new Date(`${value}T00:00:00Z`));
  return <section id="holiday-deals" className="holiday-deals section" aria-labelledby="holiday-live-title" data-audience={selection.audience} data-part={selection.part}>
    <div className="shell">
      <div className="holiday-audience-tabs" role="tablist" aria-label={text.audience}>{holidayAudiences.map((item, index) => {
        const Icon = icons[item.id];
        return <button type="button" role="tab" id={`holiday-tab-${item.id}`} aria-controls="holiday-deal-results" aria-selected={selection.audience === item.id} tabIndex={selection.audience === item.id ? 0 : -1} key={item.id} onClick={() => choose({ ...selection, audience: item.id })} onKeyDown={(event) => navigateTabs(event, index)}><Icon size={21} aria-hidden="true" /><span>{text[item.id]}</span><small>{item.guests} {text.guests}</small></button>;
      })}</div>
      <div className="holiday-periods" role="group" aria-label={text.period}><CalendarDays size={18} aria-hidden="true" />{visibleParts.map((part) => {
        return <button type="button" aria-pressed={normalizedSelection.part === part} key={part} onClick={() => choose({ ...normalizedSelection, part })}>{text[part]}</button>;
      })}</div>
      <div className="holiday-results-heading"><div><h2 id="holiday-live-title">{text.heading}</h2><p>{text.basis} <strong>{guests} {text.guests}</strong> · {window.nights} {text.nights} · <time dateTime={window.from}>{formatDate(window.from)}</time> / <time dateTime={window.till}>{formatDate(window.till)}</time></p></div><Link href={searchHref}>{text.search}</Link></div>
      {normalizedSelection.part === "all" ? <p className="holiday-window-note">{text.window}</p> : null}
      <div id="holiday-deal-results" className="holiday-deals__surface" role="tabpanel" tabIndex={0} aria-labelledby={`holiday-tab-${selection.audience}`} aria-busy={state === "loading"}>
        {state === "ready" && result.stale && deals.length > 0 ? <p data-no-translate>{discoveryCacheCopy[language]}</p> : null}
        {state === "loading" ? <div className="holiday-deals__loading" role="status"><span className="holiday-deals__spinner" aria-hidden="true" /><strong>{text.loading}</strong><small>{guests} {text.guests} · {formatDate(window.from)} / {formatDate(window.till)}</small></div> : null}
        {state === "error" ? <div className="holiday-deals__message" role="alert"><strong>{text.error}</strong><button type="button" onClick={() => holiday.id <= 0 ? globalThis.location.reload() : setRetry((value) => value + 1)}>{text.retry}</button><Link href={searchHref}>{text.search}</Link></div> : null}
        {state === "ready" && !deals.length ? <div className="holiday-deals__message"><strong>{text.empty}</strong><p>{text.emptyHelp}</p>{selection.part !== "all" ? <button type="button" onClick={() => choose({ ...selection, part: "all" })}>{text.reset}</button> : null}<Link href={searchHref}>{text.search}</Link></div> : null}
        {state === "ready" && deals.length ? <><p className="holiday-deals__count" role="status">{deals.length} {text.count}</p><div className="holiday-deals__grid">{deals.map((deal) => {
          const href = localizedPath(`/business?${new URLSearchParams({ id: `vacation-${deal.siteID}`, from: deal.from, till: deal.till, guests: String(deal.priceGuests), source: "home-holidays", period: String(holiday.id) }).toString()}`, language);
          return <div className="holiday-deals__item" key={`${key}-${deal.siteID}-${deal.from}`}><PropertyCard property={dealProperty(deal)} selectedStay={{ from: deal.from, till: deal.till, guests: deal.priceGuests }} liveAvailabilityState={{ status: "ready", quote: dealAvailability(deal, result.stale) }} detailHref={href} /></div>;
        })}</div></> : null}
      </div>
    </div>
  </section>;
}
