type PhoneRevealDetails = {
  placeId: string;
  placeName: string;
  world: string;
  placement: "property_card" | "discovery_card" | "event_card" | "event_detail" | "floating_detail";
};

type WhatsAppLeadDetails = {
  placeId: string;
  placeName: string;
  world: string;
  reference: string;
};

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function trackPhoneReveal(details: PhoneRevealDetails) {
  if (typeof window === "undefined") return;

  const eventDetails = {
    event: "vii_phone_reveal",
    place_id: details.placeId,
    place_name: details.placeName,
    world: details.world,
    placement: details.placement,
    page_path: `${window.location.pathname}${window.location.search}`,
  };

  window.dispatchEvent(new CustomEvent("vii:phone-reveal", { detail: eventDetails }));

  if (window.localStorage.getItem("vii-cookie-choice") === "all") {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(eventDetails);
  }
}

export function trackWhatsAppLeadSaved(details: WhatsAppLeadDetails) {
  if (typeof window === "undefined") return;

  const eventDetails = {
    event: "vii_whatsapp_lead_saved",
    place_id: details.placeId,
    place_name: details.placeName,
    world: details.world,
    lead_reference: details.reference,
    page_path: `${window.location.pathname}${window.location.search}`,
  };

  window.dispatchEvent(new CustomEvent("vii:whatsapp-lead-saved", { detail: eventDetails }));

  if (window.localStorage.getItem("vii-cookie-choice") === "all") {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(eventDetails);
  }
}

export function trackSearchSubmitted(details: { world: "vacation" | "events" | "spa" | "hourly"; location: string; hasDate: boolean }) {
  if (typeof window === "undefined" || window.localStorage.getItem("vii-cookie-choice") !== "all") return;
  const event = { eventId: crypto.randomUUID(), world: details.world, location: details.location.slice(0, 80), hasDate: details.hasDate };
  const body = new Blob([JSON.stringify(event)], { type: "application/json" });
  if (!navigator.sendBeacon?.("/api/analytics/search", body)) {
    void fetch("/api/analytics/search", { method: "POST", body, keepalive: true, credentials: "same-origin" }).catch(() => undefined);
  }
}
