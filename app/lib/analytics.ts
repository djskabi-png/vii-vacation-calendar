type PhoneRevealDetails = {
  placeId: string;
  placeName: string;
  world: string;
  placement: "property_card" | "discovery_card";
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
