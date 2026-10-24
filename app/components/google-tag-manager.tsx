"use client";

import { useEffect } from "react";

export const VII_GTM_CONTAINER_ID = "GTM-WG8VXDB";
const CONSENT_STORAGE_KEY = "vii-cookie-choice";
const CONSENT_EVENT = "vii-cookie-choice-changed";
const SCRIPT_ID = "vii-google-tag-manager";

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

function pushConsent(command: "default" | "update", granted: boolean) {
  window.dataLayer = window.dataLayer || [];
  const state = {
    analytics_storage: granted ? "granted" : "denied",
    ad_storage: granted ? "granted" : "denied",
    ad_user_data: granted ? "granted" : "denied",
    ad_personalization: granted ? "granted" : "denied",
    wait_for_update: command === "default" ? 500 : undefined,
  };
  const gtag = function (...args: unknown[]) {
    window.dataLayer?.push(args as unknown as Record<string, unknown>);
  };
  gtag("consent", command, state);
  window.dataLayer.push({ event: "vii_consent_update", ...state });
}

function loadContainer() {
  if (document.getElementById(SCRIPT_ID)) return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(VII_GTM_CONTAINER_ID)}`;
  document.head.appendChild(script);
}

export function GoogleTagManager({ enabled = true }: { enabled?: boolean }) {
  useEffect(() => {
    if (!enabled) return;

    pushConsent("default", false);

    const applyChoice = (choice: string | null) => {
      const granted = choice === "all";
      pushConsent("update", granted);
      if (granted) loadContainer();
    };

    applyChoice(window.localStorage.getItem(CONSENT_STORAGE_KEY));
    const onChoice = (event: Event) => applyChoice((event as CustomEvent<string>).detail);
    window.addEventListener(CONSENT_EVENT, onChoice);
    return () => window.removeEventListener(CONSENT_EVENT, onChoice);
  }, [enabled]);

  return null;
}
