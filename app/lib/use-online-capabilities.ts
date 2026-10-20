"use client";
import { useEffect, useState } from "react";
import { validOnlineCapabilities, type OnlineCapabilityMap } from "./online-booking-capability";

// Only the server calls the supplier. Remounts share successful discovery evidence.
let lastGood: OnlineCapabilityMap = {};
let flight: Promise<OnlineCapabilityMap> | null = null;
let fetchedAt = 0;
function load() {
  if (Date.now() - fetchedAt < 60 * 60_000) return Promise.resolve(lastGood);
  if (flight) return flight;
  flight = fetch("/api/vii/online-capabilities", { signal: AbortSignal.timeout(16_000) })
    .then(async response => {
      if (!response.ok) throw new Error("unavailable");
      const body = await response.json();
      if (!validOnlineCapabilities(body.capabilities)) throw new Error("invalid");
      lastGood = body.capabilities; fetchedAt = Date.now(); return lastGood;
    }).finally(() => { flight = null; });
  return flight;
}
export function useOnlineCapabilities(enabled: boolean, retry = 0) {
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; capabilities: OnlineCapabilityMap }>({ status: "loading", capabilities: lastGood });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void load().then(capabilities => { if (active) setState({ status: "ready", capabilities }); })
      .catch(() => { if (active) setState(current => ({ ...current, status: "error" })); });
    return () => { active = false; };
  }, [enabled, retry]);
  return state;
}
