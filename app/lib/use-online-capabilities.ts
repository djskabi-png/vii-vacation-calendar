"use client";
import { useEffect, useState } from "react";
import { validOnlineCapabilities, type OnlineCapabilityMap } from "./online-booking-capability";

// Only the server calls the supplier. Remounts share successful discovery evidence.
let lastGood: OnlineCapabilityMap = {};
let flight: Promise<OnlineCapabilityMap> | null = null;
let fetchedAt = 0;
const storageKey = "vii:vacation-online-capabilities:v1";
const freshMs = 30 * 60_000;
const maximumAgeMs = 30 * 24 * 60 * 60_000;

function restore() {
  if (typeof window === "undefined" || Object.keys(lastGood).length) return lastGood;
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) || "null") as { savedAt?: unknown; capabilities?: unknown } | null;
    if (!stored || typeof stored.savedAt !== "number" || Date.now() - stored.savedAt > maximumAgeMs || !validOnlineCapabilities(stored.capabilities)) return lastGood;
    lastGood = stored.capabilities;
    fetchedAt = stored.savedAt;
  } catch { /* Corrupt browser cache is ignored; the server cache remains authoritative. */ }
  return lastGood;
}

function persist(capabilities: OnlineCapabilityMap) {
  try { window.localStorage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), capabilities })); } catch { /* Storage is optional. */ }
}

function load() {
  restore();
  if (Object.keys(lastGood).length && Date.now() - fetchedAt < freshMs) return Promise.resolve(lastGood);
  if (flight) return flight;
  flight = fetch("/api/vii/online-capabilities", { signal: AbortSignal.timeout(16_000) })
    .then(async response => {
      if (!response.ok) throw new Error("unavailable");
      const body = await response.json();
      if (!validOnlineCapabilities(body.capabilities)) throw new Error("invalid");
      lastGood = body.capabilities; fetchedAt = Date.now(); persist(lastGood); return lastGood;
    }).finally(() => { flight = null; });
  return flight;
}
export function useOnlineCapabilities(enabled: boolean, retry = 0) {
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; capabilities: OnlineCapabilityMap }>({ status: "loading", capabilities: lastGood });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const cached = restore();
    if (Object.keys(cached).length) setState({ status: "ready", capabilities: cached });
    void load().then(capabilities => { if (active) setState({ status: "ready", capabilities }); })
      .catch(() => { if (active) setState(Object.keys(lastGood).length ? { status: "ready", capabilities: lastGood } : { status: "error", capabilities: {} }); });
    return () => { active = false; };
  }, [enabled, retry]);
  return state;
}
