"use client";

/* eslint-disable @next/next/no-img-element, react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { homeDealPeriods, type HomeDeal, type HomeDealPeriod } from "../lib/vii-home-deals";
import type { HomeHoliday } from "../lib/vii-home-holidays";
import { useSiteLanguage } from "../i18n/locale-provider";
import { FavoriteButton } from "./favorite-button";

type ResponseData = { period?: HomeDealPeriod; holiday?: HomeHoliday; dates: { from: string; till: string; nights: number }; deals: HomeDeal[] };

const copy = {
  he: { title: "נופש פנוי בתאריכים הקרובים", all: "לכל מקומות הנופש", loading: "בודקים זמינות ומחירים", empty: "לא נמצאו מקומות פנויים לתאריכים האלה", error: "לא הצלחנו לבדוק זמינות כרגע", retry: "לנסות שוב", total: "מחיר כולל", details: "לפרטי המקום", night: "לילה", nights: "לילות", reviews: "חוות דעת", tabs: ["ברגע האחרון", "חמישי עד שבת", "שישי עד ראשון", "לילה בחמישי", "לילה בשישי"] },
  en: { title: "Available stays ahead", all: "All stays", loading: "Checking availability and prices", empty: "No available stays for these dates", error: "Availability could not be checked", retry: "Try again", total: "Total price", details: "Place details", night: "night", nights: "nights", reviews: "reviews", tabs: ["Last minute", "Thursday to Saturday", "Friday to Sunday", "Thursday night", "Friday night"] },
  ru: { title: "Свободное жилье на ближайшие даты", all: "Все варианты", loading: "Проверяем наличие и цены", empty: "На эти даты свободных мест нет", error: "Не удалось проверить наличие", retry: "Повторить", total: "Полная стоимость", details: "Подробнее", night: "ночь", nights: "ночи", reviews: "отзывов", tabs: ["В последний момент", "Чт–Сб", "Пт–Вс", "Ночь в четверг", "Ночь в пятницу"] },
  fr: { title: "Séjours disponibles prochainement", all: "Tous les séjours", loading: "Vérification des disponibilités", empty: "Aucun séjour disponible à ces dates", error: "Disponibilité indisponible", retry: "Réessayer", total: "Prix total", details: "Voir le lieu", night: "nuit", nights: "nuits", reviews: "avis", tabs: ["Dernière minute", "Jeudi à samedi", "Vendredi à dimanche", "Nuit de jeudi", "Nuit de vendredi"] },
} as const;

function dateLabel(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00Z`));
}

export function HomeLiveDeals({ mode = "near" }: { mode?: "near" | "holidays" }) {
  const { language } = useSiteLanguage();
  const [period, setPeriod] = useState<HomeDealPeriod>("tomorrow");
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [data, setData] = useState<ResponseData | null>(null);
  const [holidays, setHolidays] = useState<HomeHoliday[]>([]);
  const [holidayId, setHolidayId] = useState<number | null>(null);
  const [holidayState, setHolidayState] = useState<"loading" | "ready" | "error">("loading");
  const track = useRef<HTMLDivElement>(null);
  const text = copy[language];
  const title = mode === "holidays" ? { he: "נופש פנוי בחגים", en: "Available stays for holidays", ru: "Отдых в праздники", fr: "Séjours disponibles pendant les fêtes" }[language] : text.title;
  const locale = { he: "he-IL", en: "en-GB", ru: "ru-RU", fr: "fr-FR" }[language];
  const searchHref = data ? `/search?${new URLSearchParams({ from: data.dates.from, till: data.dates.till, guests: "2" })}` : "/search";

  useEffect(() => {
    if (mode !== "holidays") return;
    const controller = new AbortController();
    setHolidayState("loading");
    fetch("/api/vii/home-holidays", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error("supplier_unavailable"); return response.json() as Promise<{ holidays: HomeHoliday[] }>; })
      .then((result) => {
        if (!Array.isArray(result.holidays)) throw new Error("invalid_result");
        setHolidays(result.holidays);
        setHolidayId(result.holidays[0]?.id ?? null);
        setHolidayState("ready");
      })
      .catch((error) => { if (error?.name !== "AbortError") setHolidayState("error"); });
    return () => controller.abort();
  }, [mode, retry]);

  useEffect(() => {
    if (mode === "holidays" && (holidayState !== "ready" || holidayId === null)) return;
    const controller = new AbortController();
    setState("loading");
    setData(null);
    const url = mode === "holidays" ? `/api/vii/home-holiday-deals?id=${holidayId}` : `/api/vii/home-deals?period=${period}`;
    fetch(url, { signal: controller.signal, cache: "no-store", headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("supplier_unavailable");
        return response.json() as Promise<ResponseData>;
      })
      .then((result) => {
        if (!Array.isArray(result.deals) || (mode === "near" && result.period !== period) || (mode === "holidays" && result.holiday?.id !== holidayId)) throw new Error("invalid_result");
        setData(result);
        setState("ready");
      })
      .catch((error) => { if (error?.name !== "AbortError") setState("error"); });
    return () => controller.abort();
  }, [period, holidayId, holidayState, mode, retry]);

  function choose(value: HomeDealPeriod) {
    setPeriod(value);
    track.current?.scrollTo({ left: 0, behavior: "instant" });
  }

  function chooseHoliday(value: number) {
    setHolidayId(value);
    track.current?.scrollTo({ left: 0, behavior: "instant" });
  }

  function scroll(direction: -1 | 1) {
    const node = track.current;
    if (!node) return;
    const card = node.querySelector<HTMLElement>(".home-live-deals__card");
    const step = (card?.getBoundingClientRect().width || node.clientWidth) + 16;
    node.scrollBy({ left: direction * step * (getComputedStyle(node).direction === "rtl" ? -1 : 1), behavior: "smooth" });
  }

  const sectionId = mode === "holidays" ? "home-holiday-deals" : "home-live-deals";
  const currentHoliday = holidays.find((item) => item.id === holidayId);
  const displayState = mode === "holidays" && holidayState !== "ready" ? holidayState : state;
  return <section className={`section home-recommended home-live-deals ${sectionId}`} aria-labelledby={`${sectionId}-title`}>
    <div className="shell">
      <div className="section-head"><div><h2 id={`${sectionId}-title`}>{title}</h2></div><div><Link href={searchHref}>{text.all}</Link><div className="home-slider__controls" aria-label={title}><button type="button" onClick={() => scroll(-1)} aria-label={language === "he" ? "הקודם" : "Previous"} disabled={displayState !== "ready" || !data?.deals.length}>‹</button><button type="button" onClick={() => scroll(1)} aria-label={language === "he" ? "הבא" : "Next"} disabled={displayState !== "ready" || !data?.deals.length}>›</button></div></div></div>
      <div className="home-live-deals__tabs" role="tablist" aria-label={title}>
        {mode === "near" ? homeDealPeriods.map((item, index) => <button key={item.id} type="button" role="tab" aria-controls={`${sectionId}-results`} aria-selected={period === item.id} tabIndex={period === item.id ? 0 : -1} onClick={() => choose(item.id)} onKeyDown={(event) => {
          const next = event.key === "Home" ? 0 : event.key === "End" ? homeDealPeriods.length - 1 : event.key === "ArrowRight" ? (index + (language === "he" ? -1 : 1) + homeDealPeriods.length) % homeDealPeriods.length : event.key === "ArrowLeft" ? (index + (language === "he" ? 1 : -1) + homeDealPeriods.length) % homeDealPeriods.length : -1;
          if (next < 0) return;
          event.preventDefault();
          choose(homeDealPeriods[next].id);
          event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
        }}>{text.tabs[index]}</button>) : holidays.map((item, index) => <button key={item.id} type="button" role="tab" aria-controls={`${sectionId}-results`} aria-selected={holidayId === item.id} tabIndex={holidayId === item.id ? 0 : -1} onClick={() => chooseHoliday(item.id)} onKeyDown={(event) => {
          const next = event.key === "Home" ? 0 : event.key === "End" ? holidays.length - 1 : event.key === "ArrowRight" ? (index + (language === "he" ? -1 : 1) + holidays.length) % holidays.length : event.key === "ArrowLeft" ? (index + (language === "he" ? 1 : -1) + holidays.length) % holidays.length : -1;
          if (next < 0) return;
          event.preventDefault();
          chooseHoliday(holidays[next].id);
          event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
        }}>{item.name} · {dateLabel(item.from, locale)}</button>)}
      </div>
      <div className="home-live-deals__results" id={`${sectionId}-results`} role="tabpanel" aria-live="polite" aria-busy={displayState === "loading"}>
        {displayState === "loading" ? <p className="home-live-deals__status">{text.loading}</p> : null}
        {displayState === "error" ? <div className="home-live-deals__status"><p>{text.error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>{text.retry}</button></div> : null}
        {displayState === "ready" && (mode === "holidays" && !holidays.length || data?.deals.length === 0) ? <p className="home-live-deals__status">{text.empty}</p> : null}
        {displayState === "ready" && data?.deals.length ? <div className="home-live-deals__track" ref={track} data-horizontal-rail>
          {data.deals.map((deal) => {
            const href = `/business?${new URLSearchParams({ id: `vacation-${deal.siteID}`, from: deal.from, till: deal.till, guests: "2", source: mode === "holidays" ? "home-holidays" : "home-deals", period: mode === "holidays" ? String(currentHoliday?.id ?? "") : period }).toString()}`;
            const placeLocation = [deal.city, deal.area].filter(Boolean).join(" · ");
            return <article className="home-live-deals__card" key={`${deal.siteID}-${deal.from}`}>
              <Link className="home-live-deals__card-link" href={href}>
                <img src={deal.image} alt={deal.name} loading="lazy" decoding="async" />
                <div className="home-live-deals__card-body">
                  <h3>{deal.name}</h3>
                  {placeLocation ? <p className="home-live-deals__location">{placeLocation}</p> : null}
                  {deal.score !== null && deal.reviewCount > 0 ? <p className="home-live-deals__rating"><span aria-hidden="true">★</span> {deal.score.toLocaleString(locale)} <span>({deal.reviewCount.toLocaleString(locale)} {text.reviews})</span></p> : null}
                  <p>{dateLabel(deal.from, locale)} – {dateLabel(deal.till, locale)} · {deal.nights} {deal.nights === 1 ? text.night : text.nights}</p>
                  <div className="home-live-deals__price"><span>{text.total}</span><strong>₪{deal.total.toLocaleString(locale)}</strong></div>
                  <b>{text.details}</b>
                </div>
              </Link>
              <FavoriteButton id={`vacation-${deal.siteID}`} world="vacation" name={deal.name} location={placeLocation} image={deal.image} href={href} className="home-live-deals__favorite" />
            </article>;
          })}
        </div> : null}
      </div>
    </div>
  </section>;
}
