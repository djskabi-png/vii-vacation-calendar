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

const businessSession = () => { const key = "vii-business-session"; let id = sessionStorage.getItem(key); if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(key, id); } return id; };
export function trackBusinessEvent(name: "impression" | "page_view" | "phone_reveal" | "whatsapp_lead" | "booking_request", details: { placeId: string; placeName: string; world: string }) {
  if (typeof window === "undefined" || window.localStorage.getItem("vii-cookie-choice") !== "all") return;
  const event = { eventId: crypto.randomUUID(), name, ...details, pagePath: `${window.location.pathname}${window.location.search}`, sessionId: businessSession() };
  void fetch("/api/analytics/business", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(event), keepalive: true, credentials: "same-origin" }).catch(() => undefined);
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
    trackBusinessEvent("phone_reveal", details);
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
    trackBusinessEvent("whatsapp_lead", details);
  }
}

let adminSearchCaptureCheck: Promise<boolean> | null = null;

async function searchCapturePrivacy() {
  if (window.localStorage.getItem("vii-cookie-choice") === "all") {
    return { consentState: "granted" as const, adminTestOnly: false };
  }
  adminSearchCaptureCheck ||= fetch("/api/analytics/search", {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  }).then((response) => response.status === 204).catch(() => false);
  return await adminSearchCaptureCheck
    ? { consentState: "denied_or_unset" as const, adminTestOnly: true }
    : null;
}

async function captureSearchEvent(event: Record<string, unknown>) {
  const privacy = await searchCapturePrivacy();
  if (!privacy) return;
  await fetch("/api/analytics/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...event, ...privacy }),
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => undefined);
}

export function trackSearchSubmitted(details: { world: "vacation" | "events" | "spa" | "hourly"; location: string; hasDate: boolean }) {
  if (typeof window === "undefined") return;
  void captureSearchEvent({ eventId: crypto.randomUUID(), world: details.world, location: details.location.slice(0, 80), hasDate: details.hasDate });
}

const trackedSearchResults = new Set<string>();

export function trackSearchResults(details: {
  world: "vacation" | "events" | "spa" | "hourly";
  location: string;
  hasDate: boolean;
  resultCount: number;
  filters: Record<string, string | number | boolean>;
}) {
  if (typeof window === "undefined") return;
  const pagePath = `${window.location.pathname}${window.location.search}`;
  const signature = JSON.stringify({ pagePath, resultCount: details.resultCount, filters: details.filters, consent: window.localStorage.getItem("vii-cookie-choice") });
  if (trackedSearchResults.has(signature)) return;
  trackedSearchResults.add(signature);
  const key = "vii-search-session";
  let sessionId = window.sessionStorage.getItem(key);
  if (!sessionId) { sessionId = crypto.randomUUID(); window.sessionStorage.setItem(key, sessionId); }
  const event = { eventId: crypto.randomUUID(), sessionId, pagePath, ...details };
  void captureSearchEvent(event);
}
