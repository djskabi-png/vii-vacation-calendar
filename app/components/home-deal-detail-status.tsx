"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { homeDealPeriods, type HomeDeal, type HomeDealPeriod } from "../lib/vii-home-deals";
import { useSiteLanguage } from "../i18n/locale-provider";

type ResponseData = { period?: HomeDealPeriod; holiday?: { id: number }; dates: { from: string; till: string }; deals: HomeDeal[] };

export function HomeDealDetailStatus({ siteID, period, source, from, till, guests }: { siteID: number; period?: string; source: "home-deals" | "home-holidays"; from?: string; till?: string; guests: number }) {
  const { language } = useSiteLanguage();
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<"loading" | "available" | "unavailable" | "error">("loading");
  const [total, setTotal] = useState(0);
  const validPeriod = source === "home-holidays" ? /^\d+$/.test(period || "") : homeDealPeriods.some((item) => item.id === period);

  useEffect(() => {
    if (!validPeriod || !from || !till || guests !== 2) return;
    const controller = new AbortController();
    setState("loading");
    setTotal(0);
    fetch(source === "home-holidays" ? `/api/vii/home-holiday-deals?${new URLSearchParams({ id: period || "", from, till })}` : `/api/vii/home-deals?period=${period}`, { cache: "no-store", signal: controller.signal, headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("supplier_unavailable");
        return response.json() as Promise<ResponseData>;
      })
      .then((result) => {
        if ((source === "home-holidays" ? result.holiday?.id !== Number(period) : result.period !== period) || !Array.isArray(result.deals)) throw new Error("invalid_result");
        const deal = result.dates.from === from && result.dates.till === till
          ? result.deals.find((item) => item.siteID === siteID && item.from === from && item.till === till)
          : undefined;
        if (deal && Number.isFinite(deal.total) && deal.total > 0) {
          setTotal(deal.total);
          setState("available");
        } else setState("unavailable");
      })
      .catch((error) => { if (error?.name !== "AbortError") setState("error"); });
    return () => controller.abort();
  }, [from, guests, period, retry, siteID, source, till, validPeriod]);

  if (!validPeriod || !from || !till || guests !== 2) return null;
  const copy = {
    he: { title: "הדיל שבחרתם", loading: "בודקים שוב את המחיר והזמינות", available: `ה־API מחזיר כעת ₪${total.toLocaleString("he-IL")} לכל השהייה שבחרתם, לשני מבוגרים. המחיר וההזמנה יאושרו מול המקום.`, unavailable: "הדיל אינו זמין עוד בתאריכים שנבחרו. אפשר לבדוק תאריך אחר או לפנות למקום.", error: "לא הצלחנו לאמת את הדיל כרגע. אין להסתמך על המחיר שהופיע קודם.", retry: "בדיקה חוזרת" },
    en: { title: "Your selected deal", loading: "Rechecking price and availability", available: `The API currently returns ₪${total.toLocaleString("en-GB")} for your entire stay, for two adults. The property must confirm the final price and booking.`, unavailable: "This deal is no longer available for the selected dates. Try other dates or contact the property.", error: "We could not verify this deal now. Do not rely on the earlier price.", retry: "Check again" },
    ru: { title: "Выбранное предложение", loading: "Повторно проверяем цену и наличие", available: `API сейчас возвращает ₪${total.toLocaleString("ru-RU")} за всё проживание для двух взрослых. Окончательную цену и бронирование подтвердит объект.`, unavailable: "Предложение больше недоступно на эти даты. Выберите другие даты или свяжитесь с объектом.", error: "Сейчас не удалось подтвердить предложение. Не полагайтесь на прежнюю цену.", retry: "Проверить снова" },
    fr: { title: "Votre offre", loading: "Nouvelle vérification du prix et de la disponibilité", available: `L'API indique actuellement ₪${total.toLocaleString("fr-FR")} pour tout le séjour de deux adultes. Le lieu doit confirmer le prix final et la réservation.`, unavailable: "Cette offre n'est plus disponible pour ces dates. Choisissez d'autres dates ou contactez le lieu.", error: "Impossible de vérifier cette offre maintenant. Ne vous fiez pas au prix précédent.", retry: "Vérifier à nouveau" },
  }[language];

  return <section className="home-deal-detail-status" aria-live="polite" aria-busy={state === "loading"}>
    <strong>{copy.title}</strong>
    <p>{copy[state]}</p>
    {state === "error" ? <button type="button" onClick={() => { setState("loading"); setRetry((value) => value + 1); }}>{copy.retry}</button> : null}
  </section>;
}
