"use client";

import { BadgeCheck } from "lucide-react";
import { useSiteLanguage } from "../i18n/locale-provider";

export const onlineBookingBadgeCopy = {
  he: { label: "ניתן להזמין אונליין", hint: "המחיר והזמינות נבדקים שוב לפני אישור ההזמנה." },
  en: { label: "Book online", hint: "Price and availability are checked again before your booking is confirmed." },
  fr: { label: "Réservation en ligne", hint: "Le prix et la disponibilité sont revérifiés avant la confirmation de la réservation." },
  ru: { label: "Онлайн-бронирование", hint: "Цена и наличие повторно проверяются перед подтверждением бронирования." },
} as const;

export function OnlineBookingBadge({ eligible, className = "" }: { eligible: boolean; className?: string }) {
  const { language } = useSiteLanguage();
  if (!eligible) return null;
  const copy = onlineBookingBadgeCopy[language];
  return <span className={`online-booking-badge${className ? ` ${className}` : ""}`} title={copy.hint} role="status">
    <BadgeCheck aria-hidden="true" /><span>{copy.label}</span><span className="sr-only">. {copy.hint}</span>
  </span>;
}
