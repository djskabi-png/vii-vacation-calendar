"use client";

import { useEffect, useState } from "react";
import type { EventSlot, LiveSearchResult, LiveSearchRoom, LiveSearchWorld } from "../lib/vii-live-search";
import type { EventDealPlace } from "../lib/event-deal-labels";
import { discoveryJson } from "../lib/discovery-client-cache.ts";

export type LiveSearchState = {
  status: "idle" | "loading" | "ready" | "error";
  results: Record<number, LiveSearchResult>;
  checkedAt: string | null;
  places?: EventDealPlace[];
  expandedRegion?: boolean;
  regionalOrder?: number[];
  stale?: boolean;
};

const idle: LiveSearchState = { status: "idle", results: {}, checkedAt: null };

export function useViiLiveSearch(world: LiveSearchWorld, from: string | null, till: string | null, guests: number, hours?: number, rooms?: LiveSearchRoom[], slot?: EventSlot, retry = 0, includePlaces = false, region?: string, datedDiscovery = false) {
  const roomKey = rooms?.map((room) => `${room.adults}-${room.children || 0}-${room.infants || 0}`).join(",") || "";
  const key = from && till ? `${world}|${from}|${till}|${guests}|${world === "events" ? slot || "both" : hours || ""}|${roomKey}|${retry}|${includePlaces}|${region || ""}|${datedDiscovery}` : "";
  const [value, setValue] = useState<{ key: string; state: LiveSearchState } | null>(null);

  useEffect(() => {
    if (!key || !from || !till) return;
    const controller = new AbortController();
    const init = {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ world, from, till, guests, ...(datedDiscovery ? { discoverySearch: true } : {}), ...(world === "events" && slot ? { slot } : {}), ...(world === "events" && includePlaces ? { includePlaces: true, ...(region ? { region } : {}) } : {}), ...(world === "vacations" && rooms?.length ? { rooms } : {}) }),
      cache: "no-store" as const,
      signal: controller.signal,
    };
    const request = includePlaces && world === "events"
      ? discoveryJson("/api/vii/live-search", `${from}:${till}`, init)
      : fetch("/api/vii/live-search", init).then(async (response) => {
      if (!response.ok) throw new Error("supplier_unavailable");
      return response.json();
    });
    (request as Promise<{ cache?:{status:string}; region?: string; expandedRegion?: boolean; regionalOrder?: number[]; checkedAt: string | null; results: LiveSearchResult[]; places?: EventDealPlace[] }>).then((result) => {
      if (!Array.isArray(result.results) || (includePlaces && result.region !== region)) throw new Error("invalid_result");
      if (!controller.signal.aborted) setValue({ key, state: {
        status: "ready",
        results: Object.fromEntries(result.results.map((item) => [item.siteID, item])),
        checkedAt: result.checkedAt,
        ...(result.cache ? { stale: result.cache.status === "stale" } : {}),
        ...(includePlaces ? { places: Array.isArray(result.places) ? result.places : [] } : {}),
        ...(includePlaces && region ? { expandedRegion: result.expandedRegion === true, regionalOrder: Array.isArray(result.regionalOrder) ? result.regionalOrder : [] } : {}),
      } });
    }).catch(() => {
      if (!controller.signal.aborted) setValue({ key, state: { status: "error", results: {}, checkedAt: null } });
    });
    return () => controller.abort();
  }, [key, world, from, till, guests, hours, rooms, slot, includePlaces, region, datedDiscovery]);

  if (!key) return idle;
  return value?.key === key ? value.state : { ...idle, status: "loading" as const };
}
