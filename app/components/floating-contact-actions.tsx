"use client";

import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { trackPhoneReveal } from "../lib/analytics";
import { WhatsAppLeadButton } from "./whatsapp-lead-button";

type Props = {
  world: "vacation" | "events" | "hourly";
  placeId: string;
  placeName: string;
  phone?: string;
  whatsapp?: string;
  serviceName?: string;
  from?: string;
  till?: string;
  guests?: number;
};

export function FloatingContactActions({ world, placeId, placeName, phone, whatsapp, serviceName, from, till, guests }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => setVisible(window.scrollY > 450);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  const callable = phone?.replace(/[^\d+]/g, "");
  if ((!callable && !whatsapp) || !visible) return null;

  return <div className="floating-contact-actions" role="group" aria-label={`יצירת קשר עם ${placeName}`}>
    {callable ? revealed
      ? <a href={`tel:${callable}`} aria-label={`חיוג אל ${placeName}, ${phone}`}><Phone aria-hidden="true" /><span dir="ltr">{phone}</span></a>
      : <button type="button" onClick={() => { setRevealed(true); trackPhoneReveal({ placeId, placeName, world, placement: "floating_detail" }); }}><Phone aria-hidden="true" /><span>הצגת מספר</span></button>
      : null}
    {whatsapp ? <WhatsAppLeadButton world={world} placeId={placeId} placeName={placeName} businessPhone={whatsapp} serviceName={serviceName} initialDate={from} initialTill={till} initialGuests={guests} buttonClassName="floating-contact-actions__whatsapp" /> : null}
  </div>;
}
