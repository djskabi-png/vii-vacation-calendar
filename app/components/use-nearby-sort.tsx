"use client";
import { nearbySortCopy, nearbySortRegionalCopy } from "../i18n/nearby-sort-copy";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { proximityDistance, validProximityPoint, type ProximityPoint } from "../lib/proximity-sort";
import { useSiteLanguage } from "../i18n/locale-provider";

const storageKey = "vii-nearby-origin-v1";
const maxAge = 15 * 60_000;
let pending: Promise<ProximityPoint> | null = null;
let memoryOrigin: { point: ProximityPoint; at: number } | null = null;

function savedOrigin(): ProximityPoint | null {
  if (memoryOrigin && Date.now() - memoryOrigin.at < maxAge) return memoryOrigin.point;
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null");
    return validProximityPoint(saved?.point) && Number.isFinite(saved.at)
      && Date.now() >= saved.at && Date.now() - saved.at < maxAge ? saved.point : null;
  } catch { return null; }
}

/** Called only after a nearby choice; coordinates stay in this tab's session, never in URLs or analytics. */
export function requestNearbyOrigin(): Promise<ProximityPoint> {
  const saved = savedOrigin();
  if (saved) return Promise.resolve(saved);
  if (pending) return pending;
  pending = new Promise<ProximityPoint>((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("location_unavailable")); return; }
    let settled = false;
    const deadline = window.setTimeout(() => { settled = true; reject(new Error("location_timeout")); }, 8500);
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(deadline);
      const point = { lat: coords.latitude, lng: coords.longitude };
      if (!validProximityPoint(point)) { reject(new Error("location_unavailable")); return; }
      memoryOrigin = { point, at: Date.now() };
      try { sessionStorage.setItem(storageKey, JSON.stringify({ point, at: Date.now() })); } catch { /* Current selection still works without storage. */ }
      resolve(point);
    }, (error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(deadline);
      reject(error);
    }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
  }).finally(() => { pending = null; });
  return pending;
}

export function useNearbySort() {
  const params = useSearchParams();
  const active = params.get("sort") === "nearest";
  const [origin, setOrigin] = useState<ProximityPoint | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    setOrigin(null);
    setStatus("loading");
    requestNearbyOrigin().then(point => { if (alive) { setOrigin(point); setStatus("ready"); } })
      .catch(() => { if (alive) { setOrigin(null); setStatus("error"); } });
    return () => { alive = false; };
  }, [active, retry]);
  const distance = useCallback((item: unknown) => proximityDistance(origin, item), [origin]);
  return { active, origin, status, distance, retry: () => setRetry(value => value + 1) };
}

export function NearbySortStatus({ state, regionalOnly = false }: { state: ReturnType<typeof useNearbySort>; regionalOnly?: boolean }) {
  const { language } = useSiteLanguage();
  if (!state.active) return null;
  const copy = nearbySortCopy[language];
  const regional = nearbySortRegionalCopy[language];
  return <div className="shell nearby-sort-status" role="status" aria-busy={state.status === "loading"}>
    <p>{state.status === "ready" ? regionalOnly ? regional : copy.ready : state.status === "error" ? copy.error : copy.loading}</p>
    {state.status === "error" && <button type="button" className="button secondary" onClick={state.retry}>{copy.retry}</button>}
  </div>;
}
