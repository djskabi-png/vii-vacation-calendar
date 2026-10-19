"use client";

import { Phone } from "lucide-react";
import { useSiteLanguage } from "../i18n/locale-provider";
import { supplierPhoneLink } from "../lib/supplier-contact";
import { trackPhoneClick, type PhoneClickDetails } from "../lib/analytics";

const callLabel = { he: "חיוג אל", en: "Call", fr: "Appeler", ru: "Позвонить" };

export function DirectPhoneLink({ phone, placeName, className = "", tracking }: {
  phone?: string;
  placeName: string;
  className?: string;
  tracking?: PhoneClickDetails;
}) {
  const { language } = useSiteLanguage();
  const contact = supplierPhoneLink(phone);
  if (!contact) return null;
  return <a className={`direct-phone-link ${className}`} href={contact.href} data-phone-long={contact.display.length > 14 ? "true" : undefined} aria-label={`${callLabel[language]} ${placeName}, ${contact.display}`} onClick={() => { if (tracking) trackPhoneClick(tracking); }}>
    <Phone aria-hidden="true" /><bdi dir="ltr" data-no-translate>{contact.display}</bdi>
  </a>;
}
