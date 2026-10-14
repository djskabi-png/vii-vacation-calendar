"use client";

/* eslint-disable @next/next/no-img-element, react-hooks/set-state-in-effect */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { homeDealPeriods, type HomeDeal, type HomeDealPeriod } from "../lib/vii-home-deals";
import type { HomeHoliday } from "../lib/vii-home-holidays";
import { useSiteLanguage } from "../i18n/locale-provider";
import { FavoriteButton } from "./favorite-button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { rotateWithinTiers } from "../lib/daily-rotation";
import type { HomePeriodTab } from "../lib/home-display-settings";

type ResponseData = { period?: HomeDealPeriod; holiday?: HomeHoliday; dates: { from: string; till: string; nights: number }; deals: HomeDeal[]; display?: { periods: HomePeriodTab[]; defaultPeriod: HomeDealPeriod } };

const copy = {
  he: { title: "נופש פנוי בתאריכים הקרובים", all: "לכל מקומות הנופש", loading: "בודקים זמינות ומחירים", empty: "לא נמצאו מקומות פנויים לתאריכים האלה", error: "לא הצלחנו לבדוק זמינות כרגע", retry: "לנסות שוב", total: "מחיר כולל", details: "לפרטי המקום", call: "חיוג למקום", available: "פנוי לתאריכים שבחרתם", forGuests: "עבור 2 אורחים", night: "לילה", nights: "לילות", bedrooms: "חדרי שינה", guests: "אורחים", reviews: "חוות דעת", dateTo: "עד", tabs: ["ברגע האחרון", "חמישי עד שבת", "שישי עד ראשון", "לילה בחמישי", "לילה בשישי"] },
  en: { title: "Available stays ahead", all: "All stays", loading: "Checking availability and prices", empty: "No available stays for these dates", error: "Availability could not be checked", retry: "Try again", total: "Total price", details: "Place details", call: "Call the property", available: "Available for your dates", forGuests: "for 2 guests", night: "night", nights: "nights", bedrooms: "bedrooms", guests: "guests", reviews: "reviews", dateTo: "to", tabs: ["Last minute", "Thursday to Saturday", "Friday to Sunday", "Thursday night", "Friday night"] },
  ru: { title: "Свободное жилье на ближайшие даты", all: "Все варианты", loading: "Проверяем наличие и цены", empty: "На эти даты свободных мест нет", error: "Не удалось проверить наличие", retry: "Повторить", total: "Полная стоимость", details: "Подробнее", call: "Позвонить", available: "Свободно на выбранные даты", forGuests: "для 2 гостей", night: "ночь", nights: "ночи", bedrooms: "спальни", guests: "гостей", reviews: "отзывов", dateTo: "до", tabs: ["В последний момент", "Чт–Сб", "Пт–Вс", "Ночь в четверг", "Ночь в пятницу"] },
  fr: { title: "Séjours disponibles prochainement", all: "Tous les séjours", loading: "Vérification des disponibilités", empty: "Aucun séjour disponible à ces dates", error: "Disponibilité indisponible", retry: "Réessayer", total: "Prix total", details: "Voir le lieu", call: "Appeler le lieu", available: "Disponible à ces dates", forGuests: "pour 2 voyageurs", night: "nuit", nights: "nuits", bedrooms: "chambres", guests: "voyageurs", reviews: "avis", dateTo: "au", tabs: ["Dernière minute", "Jeudi à samedi", "Vendredi à dimanche", "Nuit de jeudi", "Nuit de vendredi"] },
} as const;

const allPeriodCopy = {
  he: { tomorrow: "לכל מקומות הנופש ברגע האחרון", weekend: "לכל מקומות הנופש מחמישי עד שבת", "friday-weekend": "לכל מקומות הנופש משישי עד ראשון", thursday: "לכל מקומות הנופש ללילה בחמישי", friday: "לכל מקומות הנופש ללילה בשישי", holiday: "לכל מקומות הנופש ב" },
  en: { tomorrow: "All last-minute stays", weekend: "All Thursday-to-Saturday stays", "friday-weekend": "All Friday-to-Sunday stays", thursday: "All Thursday-night stays", friday: "All Friday-night stays", holiday: "All stays for " },
  ru: { tomorrow: "Все варианты в последний момент", weekend: "Все варианты с четверга по субботу", "friday-weekend": "Все варианты с пятницы по воскресенье", thursday: "Все варианты на ночь в четверг", friday: "Все варианты на ночь в пятницу", holiday: "Все варианты на " },
  fr: { tomorrow: "Tous les séjours de dernière minute", weekend: "Tous les séjours du jeudi au samedi", "friday-weekend": "Tous les séjours du vendredi au dimanche", thursday: "Tous les séjours du jeudi soir", friday: "Tous les séjours du vendredi soir", holiday: "Tous les séjours pour " },
} as const;

function dateLabel(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00Z`));
}

export function HomeLiveDeals({ mode = "near" }: { mode?: "near" | "holidays" }) {
  const { language } = useSiteLanguage();
  const [period, setPeriod] = useState<HomeDealPeriod>("tomorrow");
  const [periodTabs, setPeriodTabs] = useState<HomePeriodTab[]>(() => homeDealPeriods.map((item, index) => ({ id: item.id, label: copy[language].tabs[index] })));
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [data, setData] = useState<ResponseData | null>(null);
  const [holidays, setHolidays] = useState<HomeHoliday[]>([]);
  const [holidayId, setHolidayId] = useState<number | null>(null);
  const [holidayState, setHolidayState] = useState<"loading" | "ready" | "error">("loading");
  const [railState, setRailState] = useState({ previous: false, next: false });
  const track = useRef<HTMLDivElement>(null);
  const displaySettingsApplied = useRef(false);
  const text = copy[language];
  const title = mode === "holidays" ? { he: "נופש פנוי בחגים", en: "Available stays for holidays", ru: "Отдых в праздники", fr: "Séjours disponibles pendant les fêtes" }[language] : text.title;
  const locale = { he: "he-IL", en: "en-GB", ru: "ru-RU", fr: "fr-FR" }[language];
  const searchDates = mode === "holidays" ? data?.deals[0] ?? data?.dates : data?.dates;
  const searchHref = searchDates ? `/search?${new URLSearchParams({ from: searchDates.from, till: searchDates.till, guests: "2" })}` : "/search";

  useEffect(() => {
    if (mode !== "holidays") return;
    const controller = new AbortController();
    setHolidayState("loading");
    fetch(`/api/vii/home-holidays?locale=${language}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error("supplier_unavailable"); return response.json() as Promise<{ holidays: HomeHoliday[] }>; })
      .then((result) => {
        if (!Array.isArray(result.holidays)) throw new Error("invalid_result");
        setHolidays(result.holidays);
        setHolidayId(result.holidays[0]?.id ?? null);
        setHolidayState("ready");
      })
      .catch((error) => { if (error?.name !== "AbortError") setHolidayState("error"); });
    return () => controller.abort();
  }, [language, mode, retry]);

  useEffect(() => {
    if (mode === "holidays" && (holidayState !== "ready" || holidayId === null)) return;
    const controller = new AbortController();
    setState("loading");
    setData(null);
    const selectedHoliday = holidays.find((item) => item.id === holidayId);
    const url = mode === "holidays"
      ? `/api/vii/home-holiday-deals?${new URLSearchParams({ id: String(holidayId), ...(selectedHoliday ? { from: selectedHoliday.from, till: selectedHoliday.till } : {}) })}`
      : `/api/vii/home-deals?${new URLSearchParams({ period, locale: language })}`;
    fetch(url, { signal: controller.signal, cache: "no-store", headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("supplier_unavailable");
        return response.json() as Promise<ResponseData>;
      })
      .then((result) => {
        if (!Array.isArray(result.deals) || (mode === "near" && result.period !== period) || (mode === "holidays" && result.holiday?.id !== holidayId)) throw new Error("invalid_result");
        if (mode === "near" && result.display?.periods?.length) {
          setPeriodTabs(result.display.periods);
          if (!displaySettingsApplied.current) {
            displaySettingsApplied.current = true;
            if (result.display.defaultPeriod !== period) { setPeriod(result.display.defaultPeriod); return; }
          } else if (!result.display.periods.some((item) => item.id === period)) { setPeriod(result.display.defaultPeriod); return; }
        }
        setData(result);
        setState("ready");
      })
      .catch((error) => { if (error?.name !== "AbortError") setState("error"); });
    return () => controller.abort();
  }, [period, holidayId, holidayState, holidays, language, mode, retry]);

  function choose(value: HomeDealPeriod) {
    setPeriod(value);
    setRailState({ previous: false, next: false });
    track.current?.scrollTo({ left: 0, behavior: "instant" });
  }

  function chooseHoliday(value: number) {
    setHolidayId(value);
    setRailState({ previous: false, next: false });
    track.current?.scrollTo({ left: 0, behavior: "instant" });
  }

  const updateRailState = useCallback(() => {
    const node = track.current;
    const cards = node?.querySelectorAll<HTMLElement>(".home-live-deals__card");
    if (!node || !cards?.length) { setRailState({ previous: false, next: false }); return; }
    const bounds = node.getBoundingClientRect();
    const first = cards[0].getBoundingClientRect();
    const last = cards[cards.length - 1].getBoundingClientRect();
    const rtl = getComputedStyle(node).direction === "rtl";
    const nextState = rtl
      ? { previous: first.right > bounds.right + 2, next: last.left < bounds.left - 2 }
      : { previous: first.left < bounds.left - 2, next: last.right > bounds.right + 2 };
    setRailState((current) => current.previous === nextState.previous && current.next === nextState.next ? current : nextState);
  }, []);

  function scroll(direction: -1 | 1) {
    const node = track.current;
    if (!node) return;
    const card = node.querySelector<HTMLElement>(".home-live-deals__card");
    const step = (card?.getBoundingClientRect().width || node.clientWidth) + 16;
    node.scrollBy({ left: direction * step * (getComputedStyle(node).direction === "rtl" ? -1 : 1), behavior: "smooth" });
  }

  const sectionId = mode === "holidays" ? "home-holiday-deals" : "home-live-deals";
  const currentHoliday = holidays.find((item) => item.id === holidayId);
  const curatedDeals = data?.deals.filter((deal) => deal.curatedRank !== undefined).sort((a, b) => (a.curatedRank || 500) - (b.curatedRank || 500) || a.siteID - b.siteID) || [];
  const displayedDeals = data?.deals ? [...curatedDeals, ...rotateWithinTiers(data.deals.filter((deal) => deal.curatedRank === undefined),
    (deal) => Math.floor(deal.total / 500), (deal) => deal.siteID,
    `home-deals:${mode}:${mode === "holidays" ? holidayId : period}`)] : [];
  const displayState = mode === "holidays" && holidayState !== "ready" ? holidayState : state;
  const previousLabel = { he: "הקודם", en: "Previous", ru: "Назад", fr: "Précédent" }[language];
  const nextLabel = { he: "הבא", en: "Next", ru: "Далее", fr: "Suivant" }[language];
  const PreviousIcon = language === "he" ? ChevronRight : ChevronLeft;
  const NextIcon = language === "he" ? ChevronLeft : ChevronRight;
  const allLabel = mode === "holidays" && currentHoliday ? `${allPeriodCopy[language].holiday}${currentHoliday.name}` : mode === "near" ? allPeriodCopy[language][period] : text.all;
  const displayedDealCount = displayedDeals.length;

  useEffect(() => {
    const node = track.current;
    if (displayState !== "ready" || !node || !displayedDealCount) { setRailState({ previous: false, next: false }); return; }
    const frame = window.requestAnimationFrame(updateRailState);
    node.addEventListener("scroll", updateRailState, { passive: true });
    const observer = new ResizeObserver(updateRailState); observer.observe(node);
    return () => { window.cancelAnimationFrame(frame); node.removeEventListener("scroll", updateRailState); observer.disconnect(); };
  }, [data, displayState, displayedDealCount, period, holidayId, updateRailState]);

  return <section className={`section home-recommended home-live-deals ${sectionId}`} aria-labelledby={`${sectionId}-title`}>
    <div className="shell">
      <div className="section-head"><div><h2 id={`${sectionId}-title`}>{title}</h2></div><div><Link href={searchHref} prefetch={false} className="home-live-deals__all-link">{allLabel}</Link><div className="home-slider__controls" role="group" aria-label={title}><button type="button" onClick={() => scroll(-1)} aria-label={`${previousLabel}, ${title}`} title={previousLabel} disabled={displayState !== "ready" || !railState.previous}><PreviousIcon aria-hidden="true" /></button><button type="button" onClick={() => scroll(1)} aria-label={`${nextLabel}, ${title}`} title={nextLabel} disabled={displayState !== "ready" || !railState.next}><NextIcon aria-hidden="true" /></button></div></div></div>
      <div className={`home-live-deals__tabs${mode === "near" ? " home-live-deals__tabs--near" : ""}`} role="tablist" aria-label={title}>
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
        }}><strong>{item.name}</strong><small>{dateLabel(item.from, locale)} {text.dateTo} {dateLabel(item.till, locale)}</small></button>)}
      </div>
      <div className="home-live-deals__results" id={`${sectionId}-results`} role="tabpanel" aria-live="polite" aria-busy={displayState === "loading"}>
        {displayState === "loading" ? <div className="home-live-deals__loading" role="status" aria-label={text.loading}>
          <div className="home-live-deals__loading-head" aria-hidden="true">
            <div className="home-live-deals__loading-route"><span /><span /><span /><img src="/vii-logo.png" alt="" /></div>
            <span>{text.loading}</span>
          </div>
          <div className="home-live-deals__loading-cards" aria-hidden="true">{[0, 1, 2].map((index) => <div className="home-live-deals__loading-card" key={index}><div className="home-live-deals__loading-image" /><div className="home-live-deals__loading-lines"><span /><span /><span /></div></div>)}</div>
        </div> : null}
        {displayState === "error" ? <div className="home-live-deals__status"><p>{text.error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>{text.retry}</button></div> : null}
        {displayState === "ready" && (mode === "holidays" && !holidays.length || data?.deals.length === 0) ? <p className="home-live-deals__status">{text.empty}</p> : null}
        {displayState === "ready" && data?.deals.length ? <div className="home-live-deals__track" ref={track} data-horizontal-rail>
          {displayedDeals.map((deal) => {
            const href = `/business?${new URLSearchParams({ id: `vacation-${deal.siteID}`, from: deal.from, till: deal.till, guests: "2", source: mode === "holidays" ? "home-holidays" : "home-deals", period: mode === "holidays" ? String(currentHoliday?.id ?? "") : period }).toString()}`;
            const placeLocation = [deal.city, deal.area].filter(Boolean).join(" · ");
            const tel = deal.phone ? `tel:${deal.phone.replace(/[^+\d]/g, "")}` : "";
            return <article className="home-live-deals__card" key={`${deal.siteID}-${deal.from}`}>
              <Link className="home-live-deals__card-link" href={href}>
                <img src={deal.image} alt={deal.name} loading="lazy" decoding="async" />
                <div className="home-live-deals__card-body">
                  <h3>{deal.name}</h3>
                  {placeLocation ? <p className="home-live-deals__location">{placeLocation}</p> : null}
                  {deal.score !== null && deal.reviewCount > 0 ? <p className="home-live-deals__rating"><span aria-hidden="true">★</span> {deal.score.toLocaleString(locale)} <span>({deal.reviewCount.toLocaleString(locale)} {text.reviews})</span></p> : null}
                  <div className="home-live-deals__facts" aria-label={text.available}><span className="home-live-deals__available">{text.available}</span>{deal.roomName ? <span>{deal.roomName}</span> : null}{deal.bedrooms ? <span>{deal.bedrooms} {text.bedrooms}</span> : null}{deal.maxGuests ? <span>{text.guests} {deal.maxGuests}</span> : null}</div>
                  <p>{dateLabel(deal.from, locale)} – {dateLabel(deal.till, locale)} · {deal.nights === 1 ? `${text.night} 1` : `${deal.nights} ${text.nights}`}</p>
                  <div className="home-live-deals__price"><span>{text.total}<small>{text.forGuests}</small></span><strong>₪{deal.total.toLocaleString(locale)}</strong></div>
                </div>
              </Link>
              <div className="home-live-deals__actions"><Link href={href}>{text.details}</Link>{tel ? <a href={tel} aria-label={`${text.call}: ${deal.name}`}>{text.call}</a> : null}</div>
              <FavoriteButton id={`vacation-${deal.siteID}`} world="vacation" name={deal.name} location={placeLocation} image={deal.image} href={href} className="home-live-deals__favorite" />
            </article>;
          })}
        </div> : null}
      </div>
    </div>
  </section>;
}
