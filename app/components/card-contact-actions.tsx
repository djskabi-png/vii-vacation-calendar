"use client";

import { useState } from "react";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";
import { trackPhoneReveal } from "../lib/analytics";
import { supplierContactNumber } from "../lib/supplier-contact";
import { WhatsAppLeadButton } from "./whatsapp-lead-button";

const copy: Record<SiteLanguage, { reveal: string; call: string; whatsapp: string }> = {
  he: { reveal: "הצגת מספר", call: "לחיוג", whatsapp: "פנייה בוואטסאפ" },
  en: { reveal: "Show number", call: "Call now", whatsapp: "WhatsApp enquiry" },
  ru: { reveal: "Показать номер", call: "Позвонить", whatsapp: "Запрос в WhatsApp" },
  fr: { reveal: "Afficher le numéro", call: "Appeler", whatsapp: "Demande par WhatsApp" },
};
export type CardContactActionsProps = {
  world: "events" | "hourly";
  placeId: string;
  placeName: string;
  phone?: string;
  whatsapp?: string;
  serviceName?: string;
  initialDate?: string;
  initialGuests?: number;
};

export function CardContactActions({ world, placeId, placeName, phone, whatsapp, serviceName, initialDate, initialGuests }: CardContactActionsProps) {
  const { language } = useSiteLanguage();
  const labels = copy[language];
  const [phoneVisible, setPhoneVisible] = useState(false);
  const publicPhone = supplierContactNumber(phone);
  const callablePhone = publicPhone && publicPhone.replace(/\D/g, "").length >= 7 ? publicPhone.replace(/[^\d+]/g, "") : undefined;
  const whatsappNumber = supplierContactNumber(whatsapp);
  const hasWhatsApp = Boolean(whatsappNumber && whatsappNumber.replace(/\D/g, "").length >= 7);
  if (!callablePhone && !hasWhatsApp) return null;

  return <div className="preview-card-contact-row">
    {callablePhone ? phoneVisible
      ? <a className="stay-card__contact stay-card__contact--phone stay-card__contact--revealed" href={`tel:${callablePhone}`} aria-label={`${labels.call}: ${placeName}`}><PhoneIcon /><bdi dir="ltr">{publicPhone}</bdi></a>
      : <button className="stay-card__contact stay-card__contact--phone" type="button" aria-expanded={phoneVisible} onClick={() => { setPhoneVisible(true); trackPhoneReveal({ placeId, placeName, world, placement: world === "events" ? "event_card" : "discovery_card" }); }}><PhoneIcon /><span>{labels.reveal}</span></button>
      : null}
    {hasWhatsApp ? <WhatsAppLeadButton world={world} placeId={placeId} placeName={placeName} businessPhone={whatsappNumber!} serviceName={serviceName} initialDate={initialDate} initialGuests={initialGuests} buttonLabel={labels.whatsapp} buttonClassName="stay-card__contact stay-card__contact--whatsapp" /> : null}
  </div>;
}

function PhoneIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16.4v3a2 2 0 0 1-2.2 2 19.7 19.7 0 0 1-8.6-3.1 19.3 19.3 0 0 1-6-6A19.7 19.7 0 0 1 1.1 3.7 2 2 0 0 1 3.1 1.5h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L7.1 9.5a16 16 0 0 0 7.4 7.4l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z" /></svg>;
}
