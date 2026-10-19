"use client";

import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";
import { supplierContactNumber, supplierPhoneLink } from "../lib/supplier-contact";
import { WhatsAppLeadButton } from "./whatsapp-lead-button";
import { DirectPhoneLink } from "./direct-phone-link";

const copy: Record<SiteLanguage, { whatsapp: string }> = {
  he: { whatsapp: "פנייה בוואטסאפ" },
  en: { whatsapp: "WhatsApp enquiry" },
  ru: { whatsapp: "Запрос в WhatsApp" },
  fr: { whatsapp: "Demande par WhatsApp" },
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
  const contact = supplierPhoneLink(phone);
  const publicPhone = contact?.display;
  const callablePhone = contact?.href;
  const whatsappNumber = supplierContactNumber(whatsapp);
  const hasWhatsApp = Boolean(whatsappNumber && whatsappNumber.replace(/\D/g, "").length >= 7);
  if (!callablePhone && !hasWhatsApp) return null;

  return <div className="preview-card-contact-row">
    {callablePhone ? <DirectPhoneLink phone={publicPhone} placeName={placeName} className="stay-card__contact stay-card__contact--phone stay-card__contact--revealed" tracking={{ placeId, placeName, world, placement: world === "events" ? "event_card" : "discovery_card" }} /> : null}
    {hasWhatsApp ? <WhatsAppLeadButton world={world} placeId={placeId} placeName={placeName} businessPhone={whatsappNumber!} serviceName={serviceName} initialDate={initialDate} initialGuests={initialGuests} buttonLabel={labels.whatsapp} buttonClassName="stay-card__contact stay-card__contact--whatsapp" /> : null}
  </div>;
}

function PhoneIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16.4v3a2 2 0 0 1-2.2 2 19.7 19.7 0 0 1-8.6-3.1 19.3 19.3 0 0 1-6-6A19.7 19.7 0 0 1 1.1 3.7 2 2 0 0 1 3.1 1.5h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L7.1 9.5a16 16 0 0 0 7.4 7.4l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z" /></svg>;
}
