"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { homeDealPeriods } from "../lib/vii-home-deals";
import { useSiteLanguage } from "../i18n/locale-provider";

type ResponseData = { status: "available" | "unavailable" | "unverified"; total?: number; onlineBooking?: boolean };

export function HomeDealDetailStatus({ siteID, period, source, from, till, guests }: { siteID: number; period?: string; source: "home-deals" | "home-holidays"; from?: string; till?: string; guests: number }) {
  const { language } = useSiteLanguage();
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<"loading" | "available" | "unavailable" | "unverified" | "error">("loading");
  const [total, setTotal] = useState(0);
  const validPeriod = source === "home-holidays" ? /^\d+$/.test(period || "") : homeDealPeriods.some((item) => item.id === period);

  useEffect(() => {
    if (!validPeriod || !from || !till || guests !== 2) return;
    const controller = new AbortController();
    setState("loading");
    setTotal(0);
    fetch(`/api/vii/confirm-home-deal?${new URLSearchParams({ source, period: period || "", siteID: String(siteID), from, till })}`, { cache: "no-store", signal: controller.signal, headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("supplier_unavailable");
        return response.json() as Promise<ResponseData>;
      })
      .then((result) => {
        if (result.status === "available" && Number.isFinite(result.total) && (result.total || 0) > 0) {
          setTotal(result.total || 0);
          setState("available");
        } else if (result.status === "unavailable" || result.status === "unverified") setState(result.status);
        else throw new Error("invalid_result");
      })
      .catch((error) => { if (error?.name !== "AbortError") setState("error"); });
    return () => controller.abort();
  }, [from, guests, period, retry, siteID, source, till, validPeriod]);

  if (!validPeriod || !from || !till || guests !== 2) return null;
  const copy = {
    he: { title: "הדיל שבחרתם", loading: "בודקים שוב את המחיר והזמינות", available: `בדיקת הזמינות מאשרת כעת ₪${total.toLocaleString("he-IL")} לכל השהייה לשני מבוגרים. הבדיקה אינה שומרת חדר; המחיר וההזמנה יאושרו בשלב הבא.`, unavailable: "הדיל אינו זמין עוד בתאריכים שנבחרו. אפשר לבדוק תאריך אחר או לפנות למקום.", unverified: "הספק לא אישר מחיר וזמינות סופיים לדיל זה. אין להסתמך על המחיר שהופיע קודם.", error: "לא הצלחנו לאמת את הדיל כרגע. אין להסתמך על המחיר שהופיע קודם.", retry: "בדיקה חוזרת" },
    en: { title: "Your selected deal", loading: "Rechecking price and availability", available: `The availability check currently confirms ₪${total.toLocaleString("en-GB")} for the stay for two adults. No room is held; price and booking must be confirmed at the next step.`, unavailable: "This deal is no longer available for the selected dates. Try other dates or contact the property.", unverified: "The supplier did not confirm the final price and availability. Do not rely on the earlier price.", error: "We could not verify this deal now. Do not rely on the earlier price.", retry: "Check again" },
    ru: { title: "Выбранное предложение", loading: "Повторно проверяем цену и наличие", available: `Проверка наличия подтверждает ₪${total.toLocaleString("ru-RU")} за проживание двух взрослых. Номер не удерживается; цену и бронь нужно подтвердить далее.`, unavailable: "Предложение больше недоступно на эти даты. Выберите другие даты или свяжитесь с объектом.", unverified: "Поставщик не подтвердил итоговую цену и наличие. Не полагайтесь на прежнюю цену.", error: "Сейчас не удалось подтвердить предложение. Не полагайтесь на прежнюю цену.", retry: "Проверить снова" },
    fr: { title: "Votre offre", loading: "Nouvelle vérification du prix et de la disponibilité", available: `La vérification confirme actuellement ₪${total.toLocaleString("fr-FR")} pour le séjour de deux adultes. Aucune chambre n'est réservée ; le prix et la réservation restent à confirmer.`, unavailable: "Cette offre n'est plus disponible pour ces dates. Choisissez d'autres dates ou contactez le lieu.", unverified: "Le fournisseur n'a pas confirmé le prix final et la disponibilité. Ne vous fiez pas au prix précédent.", error: "Impossible de vérifier cette offre maintenant. Ne vous fiez pas au prix précédent.", retry: "Vérifier à nouveau" },
  }[language];

  return <section className="home-deal-detail-status" aria-live="polite" aria-busy={state === "loading"}>
    <strong>{copy.title}</strong>
    <p>{copy[state]}</p>
    {state === "error" || state === "unverified" ? <button type="button" onClick={() => { setState("loading"); setRetry((value) => value + 1); }}>{copy.retry}</button> : null}
  </section>;
}
