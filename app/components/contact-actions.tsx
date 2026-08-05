"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import type { ListingContact } from "../data/site-data";

function whatsappNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("0") ? `972${digits.slice(1)}` : digits;
}

export function ContactActions({ contact, placeName }: { contact?: ListingContact; placeName: string }) {
  const [phoneVisible, setPhoneVisible] = useState(false);

  if (!contact?.phone && !contact?.whatsapp) return null;

  const message = encodeURIComponent(`שלום, אשמח לקבל פרטים על ${placeName} דרך אתר VII`);
  const whatsappHref = contact.whatsapp ? `https://wa.me/${whatsappNumber(contact.whatsapp)}?text=${message}` : "";
  const phoneHref = contact.phone ? `tel:${contact.phone.replace(/[^\d+]/g, "")}` : "";

  return (
    <div className="listing-contact-actions" aria-label={`יצירת קשר עם ${placeName}`}>
      {contact.phone && !phoneVisible ? <button className="contact-phone" type="button" aria-expanded="false" onClick={() => setPhoneVisible(true)}>
        <i><img src="/media/3624d1f1144b0a1a.svg" alt="" aria-hidden="true" /></i>
        <span>הצג מספר</span>
      </button> : null}
      {contact.phone && phoneVisible ? <a className="contact-phone contact-phone--visible" href={phoneHref} aria-label={`חיוג אל ${placeName}, ${contact.phone}`}>
        <i><img src="/media/3624d1f1144b0a1a.svg" alt="" aria-hidden="true" /></i>
        <bdi dir="ltr">{contact.phone}</bdi>
      </a> : null}
      {contact.whatsapp ? <a className="contact-whatsapp" href={whatsappHref} target="_blank" rel="noreferrer" aria-label={`שליחת הודעת וואטסאפ אל ${placeName}`}>
        <img src="/media/a37d0f6e3cbddbff.svg" alt="" aria-hidden="true" />
        <span>וואטסאפ</span>
      </a> : null}
    </div>
  );
}
