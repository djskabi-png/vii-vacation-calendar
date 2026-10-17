"use client";

import { useEffect, useState } from "react";
import type { EventSlot, LiveSearchResult, LiveSearchRoom, LiveSearchWorld } from "../lib/vii-live-search";
import type { EventDealPlace } from "../lib/event-deal-labels";

export type LiveSearchState = {
  status: "idle" | "loading" | "ready" | "error";
  results: Record<number, LiveSearchResult>;
  checkedAt: string | null;
  places?: EventDealPlace[];
};

const idle: LiveSearchState = { status: "idle", results: {}, checkedAt: null };

export function useViiLiveSearch(world: LiveSearchWorld, from: string | null, till: string | null, guests: number, hours?: number, rooms?: LiveSearchRoom[], slot?: EventSlot, retry = 0, includePlaces = false, region?: string) {
  const roomKey = rooms?.map((room) => `${room.adults}-${room.children || 0}`).join(",") || "";
  const key = from && till ? `${world}|${from}|${till}|${guests}|${world === "events" ? slot || "both" : hours || ""}|${roomKey}|${retry}|${includePlaces}|${region || ""}` : "";
  const [value, setValue] = useState<{ key: string; state: LiveSearchState } | null>(null);

  useEffect(() => {
    if (!key || !from || !till) return;
    const controller = new AbortController();
    fetch("/api/vii/live-search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ world, from, till, guests, ...(world === "events" && slot ? { slot } : {}), ...(world === "events" && includePlaces ? { includePlaces: true, ...(region ? { region } : {}) } : {}), ...(world === "vacations" && rooms?.length ? { rooms } : {}) }),
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error("supplier_unavailable");
      return response.json() as Promise<{ region?: string; checkedAt: string | null; results: LiveSearchResult[]; places?: EventDealPlace[] }>;
    }).then((result) => {
      if (!Array.isArray(result.results) || (includePlaces && result.region !== region)) throw new Error("invalid_result");
      if (!controller.signal.aborted) setValue({ key, state: {
        status: "ready",
        results: Object.fromEntries(result.results.map((item) => [item.siteID, item])),
        checkedAt: result.checkedAt,
        ...(includePlaces ? { places: Array.isArray(result.places) ? result.places : [] } : {}),
      } });
    }).catch(() => {
      if (!controller.signal.aborted) setValue({ key, state: { status: "error", results: {}, checkedAt: null } });
    });
    return () => controller.abort();
  }, [key, world, from, till, guests, hours, rooms, slot, includePlaces, region]);

  if (!key) return idle;
  return value?.key === key ? value.state : { ...idle, status: "loading" as const };
}
