"use client";

import { useEffect, useState } from "react";
import { WhatsAppLeadButton } from "./whatsapp-lead-button";
import { DirectPhoneLink } from "./direct-phone-link";
import { ShoppingBag } from "lucide-react";

type Props = {
  world: "vacation" | "events" | "hourly" | "providers" | "spa" | "activities";
  placeId: string;
  placeName: string;
  phone?: string;
  whatsapp?: string;
  serviceName?: string;
  from?: string;
  till?: string;
  guests?: number;
  onlineHref?: string;
  onlineLabel?: string;
};

export function FloatingContactActions({ world, placeId, placeName, phone, whatsapp, serviceName, from, till, guests, onlineHref, onlineLabel = "הזמנה אונליין" }: Props) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // Keep the dock available once the equivalent inline action leaves view.
    // Do not treat a sticky booking card as a blocker: on desktop it can stay
    // visible for the whole page and used to suppress the dock permanently.
    const targets = [...document.querySelectorAll<HTMLElement>(".property-title__actions--contact, .discovery-detail__actions, #event-booking, #booking, #booking-summary, #hourly-contact, .provider-final-cta, .depth-final-cta")];
    const intersections = new Set<Element>();
    const update = () => {
      const blocked = intersections.size > 0;
      setVisible(!blocked);
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.isIntersecting ? intersections.add(entry.target) : intersections.delete(entry.target));
      update();
    }, { rootMargin: "0px 0px 80px 0px" });
    targets.forEach((target) => observer.observe(target));
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => { observer.disconnect(); window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);
  const callable = phone?.replace(/[^\d+]/g, "");
  if ((!callable && !whatsapp && !onlineHref) || !visible) return null;

  return <div className="floating-contact-actions" role="group" aria-label={`יצירת קשר עם ${placeName}`}>
    {callable ? <DirectPhoneLink phone={phone} placeName={placeName} tracking={{ placeId, placeName, world, placement: "floating_detail" }} /> : null}
    {whatsapp ? <WhatsAppLeadButton world={world} placeId={placeId} placeName={placeName} businessPhone={whatsapp} serviceName={serviceName} initialDate={from} initialTill={till} initialGuests={guests} buttonClassName="floating-contact-actions__whatsapp" /> : null}
    {onlineHref ? <a className="floating-contact-actions__online" href={onlineHref}><ShoppingBag aria-hidden="true" />{onlineLabel}</a> : null}
  </div>;
}
