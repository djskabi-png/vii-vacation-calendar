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
    // Yield to the actual booking/contact area and footer instead of covering
    // their fields, prices or primary actions on a small viewport.
    const targets = [...document.querySelectorAll<HTMLElement>("#event-booking, #booking, #booking-summary, #hourly-options, #hourly-contact, #reviews, .property-booking, .site-footer")];
    const intersections = new Set<Element>();
    const update = () => setVisible(window.scrollY > 450 && intersections.size === 0);
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.isIntersecting ? intersections.add(entry.target) : intersections.delete(entry.target));
      update();
    }, { rootMargin: "0px 0px 80px 0px" });
    targets.forEach((target) => observer.observe(target));
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => { observer.disconnect(); window.removeEventListener("scroll", update); };
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
