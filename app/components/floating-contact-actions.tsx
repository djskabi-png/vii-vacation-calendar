"use client";

import { useEffect, useState } from "react";
import { WhatsAppLeadButton } from "./whatsapp-lead-button";
import { DirectPhoneLink } from "./direct-phone-link";

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
    {callable ? <DirectPhoneLink phone={phone} placeName={placeName} tracking={{ placeId, placeName, world, placement: "floating_detail" }} /> : null}
    {whatsapp ? <WhatsAppLeadButton world={world} placeId={placeId} placeName={placeName} businessPhone={whatsapp} serviceName={serviceName} initialDate={from} initialTill={till} initialGuests={guests} buttonClassName="floating-contact-actions__whatsapp" /> : null}
  </div>;
}
