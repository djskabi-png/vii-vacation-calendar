"use client";

import { useEffect, useState } from "react";
import type { EventSlot, LiveSearchResult, LiveSearchRoom, LiveSearchWorld } from "../lib/vii-live-search";
import type { EventDealPlace } from "../lib/event-deal-labels";
import { discoveryJson } from "../lib/discovery-client-cache.ts";
import { EVENT_DISCOVERY_VERSION, EVENT_DISCOVERY_MAX_AGE_MS, eventDiscoveryResponseMatches } from "../lib/event-discovery-contract.ts";
import { holidayForRequestedStay } from "../lib/holiday-deal-selection.ts";

export type LiveSearchState = {
  status: "idle" | "loading" | "ready" | "error";
  results: Record<number, LiveSearchResult>;
  resultOrder: number[];
  checkedAt: string | null;
  places?: EventDealPlace[];
  expandedRegion?: boolean;
  regionalOrder?: number[];
  stale?: boolean;
  snapshotCheckedAt?: string;
};

export type HolidayLiveSearchState = LiveSearchState & {
  holidayId: number | null;
  holidayName?: string;
  matched: boolean;
  stayPlan?: { minNights: number; maxNights: number };
};

const idle: LiveSearchState = { status: "idle", results: {}, resultOrder: [], checkedAt: null };

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
      body: JSON.stringify({ world, from, till, guests, ...(datedDiscovery ? { discoverySearch: true } : {}), ...(world === "events" && slot ? { slot } : {}), ...(world === "events" && includePlaces ? { includePlaces: true, discoveryVersion: EVENT_DISCOVERY_VERSION, ...(region ? { region } : {}) } : {}), ...(world === "vacations" && rooms?.length ? { rooms } : {}) }),
      cache: "no-store" as const,
      // A cold event-discovery snapshot may perform one server-side,
      // lease-protected recovery. Give that bounded recovery enough time while
      // keeping transactional detail and booking checks on the shorter default.
      ...(world === "events" && includePlaces ? { timeoutMs: 12_000, freshMs: 60_000, staleMs: EVENT_DISCOVERY_MAX_AGE_MS } : {}),
      shouldCache: (value: unknown) => !includePlaces || eventDiscoveryResponseMatches(value, from, guests, region),
      signal: controller.signal,
    };
    // Party composition is part of availability identity. Without roomKey,
    // simultaneous whole-villa and multi-unit checks could share the wrong
    // in-flight or cached response.
    const request = discoveryJson("/api/vii/live-search", `${world}:${from}:${till}:${includePlaces ? "places" : "results"}:${roomKey}`, init);
    (request as Promise<{ discoveryVersion?: number; scope?: {date:string;guests:number}; cache?:{status:string;checkedAt?:string}; region?: string; expandedRegion?: boolean; regionalOrder?: number[]; checkedAt: string | null; results: LiveSearchResult[]; places?: EventDealPlace[] }>).then((result) => {
      if (!Array.isArray(result.results) || (includePlaces && result.region !== region)) throw new Error("invalid_result");
      if (includePlaces && !eventDiscoveryResponseMatches(result, from, guests, region)) throw new Error("expired_event_snapshot");
      if (!controller.signal.aborted) setValue({ key, state: {
        status: "ready",
        results: Object.fromEntries(result.results.map((item) => [item.siteID, item])),
        resultOrder: result.results.map((item) => item.siteID),
        checkedAt: result.checkedAt,
        ...(result.cache ? { stale: result.cache.status === "stale", snapshotCheckedAt: result.cache.checkedAt } : {}),
        ...(includePlaces ? { places: Array.isArray(result.places) ? result.places : [] } : {}),
        ...(includePlaces && region ? { expandedRegion: result.expandedRegion === true, regionalOrder: Array.isArray(result.regionalOrder) ? result.regionalOrder : [] } : {}),
      } });
    }).catch(() => {
      if (!controller.signal.aborted) setValue(previous => previous?.key === key && previous.state.status === "ready"
        && (!includePlaces || Date.now() - Date.parse(previous.state.snapshotCheckedAt || "") <= EVENT_DISCOVERY_MAX_AGE_MS)
        ? { key, state: { ...previous.state, stale: true } }
        : { key, state: { status: "error", results: {}, resultOrder: [], checkedAt: null } });
    });
    return () => controller.abort();
  }, [key, world, from, till, guests, hours, rooms, slot, includePlaces, region, datedDiscovery]);

  if (!key) return idle;
  return value?.key === key ? value.state : { ...idle, status: "loading" as const };
}

export function useViiFlexibleLiveSearch(candidates: Array<{ from: string; till: string }>, guests: number, rooms?: LiveSearchRoom[], retry = 0) {
  const candidateKey = candidates.map((candidate) => `${candidate.from}|${candidate.till}`).join(",");
  const roomKey = rooms?.map((room) => `${room.adults}-${room.children || 0}-${room.infants || 0}`).join(",") || "";
  const key = candidateKey ? `vacations-flexible|${candidateKey}|${guests}|${roomKey}|${retry}` : "";
  const [value, setValue] = useState<{ key: string; state: LiveSearchState } | null>(null);

  useEffect(() => {
    if (!key || !candidates.length) return;
    const controller = new AbortController();
    const first = candidates[0];
    const lastTill = candidates.reduce((latest, candidate) => candidate.till > latest ? candidate.till : latest, first.till);
    const init = {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ world: "vacations", from: first.from, till: lastTill, guests, rooms, candidates, discoverySearch: true }),
      cache: "no-store" as const,
      signal: controller.signal,
    };
    const request = discoveryJson("/api/vii/live-search", `vacations-flexible:${candidateKey}:${roomKey}`, init);
    (request as Promise<{ cache?: { status: string }; checkedAt: string | null; results: LiveSearchResult[] }>).then((result) => {
      if (!Array.isArray(result.results)) throw new Error("invalid_result");
      if (!controller.signal.aborted) setValue({ key, state: {
        status: "ready",
        results: Object.fromEntries(result.results.map((item) => [item.siteID, item])),
        resultOrder: result.results.map((item) => item.siteID),
        checkedAt: result.checkedAt,
        ...(result.cache ? { stale: result.cache.status === "stale" } : {}),
      } });
    }).catch(() => {
      if (!controller.signal.aborted) setValue({ key, state: { status: "error", results: {}, resultOrder: [], checkedAt: null } });
    });
    return () => controller.abort();
  }, [candidateKey, candidates, guests, key, roomKey]);

  if (!key) return idle;
  return value?.key === key ? value.state : { ...idle, status: "loading" as const };
}

export function useViiHolidayLiveSearch(
  id: number | null,
  guests: number,
  part = "all",
  retry = 0,
  candidate?: { from: string; till: string } | null,
) {
  const candidateKey = candidate ? `${candidate.from}|${candidate.till}` : "";
  const key = id || candidateKey ? `vacations-holiday|${id || `match:${candidateKey}`}|${guests}|${part}|${retry}` : "";
  const [value, setValue] = useState<{ key: string; state: HolidayLiveSearchState } | null>(null);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const resolveHoliday = id ? Promise.resolve({ id, name: undefined as string | undefined }) : discoveryJson(
      "/api/vii/home-holidays?all=1",
      "holiday-search-match",
      { signal: controller.signal, freshMs: 15 * 60_000, staleMs: 24 * 60 * 60_000 },
    ).then((payload: unknown) => {
      const response = payload as { holidays?: Array<{ id: number; name: string; from: string; till: string }> };
      const match = candidate ? holidayForRequestedStay(response.holidays ?? [], candidate) : null;
      return match ? { id: match.id, name: match.name } : null;
    });
    resolveHoliday.then((holiday) => {
      if (!holiday) {
        if (!controller.signal.aborted) setValue({ key, state: { ...idle, status: "ready", holidayId: null, matched: false } });
        return null;
      }
      const params = new URLSearchParams({ id: String(holiday.id), guests: String(guests), part, proof: "verified-offers-v1" });
      return discoveryJson(`/api/vii/home-holiday-deals?${params}`, key, { signal: controller.signal, cache: "no-store" as const })
        .then((payload: unknown) => ({ payload, holiday }));
    })
      .then((payload: unknown) => {
        if (!payload) return;
        const { payload: responsePayload, holiday } = payload as { payload: unknown; holiday: { id: number; name?: string } };
        const response = responsePayload as { availabilityStatus?: string; checkedAt?: string | null; stayPlan?: { minNights: number; maxNights: number }; deals?: Array<{ siteID: number; from: string; till: string; total: number | null; nights: number; priceGuests: number; onlineBooking?: boolean; roomID?: number }> };
        if (response.availabilityStatus !== "verified" || !Array.isArray(response.deals)) throw new Error("holiday_not_ready");
        const results: LiveSearchResult[] = response.deals.map((deal) => ({ siteID: deal.siteID, available: true,
          onlineBooking: deal.onlineBooking === true, total: deal.total, from: deal.from, till: deal.till, start: null, reason: null,
          roomCount: 1, priceGuests: deal.priceGuests, priceMode: deal.nights > 1 ? "nightly_average" : "stay_total",
          ...(deal.roomID ? { roomID: deal.roomID } : {}) }));
        if (!controller.signal.aborted) setValue({ key, state: { status: "ready", results: Object.fromEntries(results.map((item) => [item.siteID, item])), resultOrder: results.map((item) => item.siteID), checkedAt: response.checkedAt ?? null,
          holidayId: holiday.id, holidayName: holiday.name, matched: true, ...(response.stayPlan ? { stayPlan: response.stayPlan } : {}) } });
      })
      .catch(() => { if (!controller.signal.aborted) setValue({ key, state: { ...idle, status: id ? "error" : "ready", holidayId: id, matched: Boolean(id) } }); });
    return () => controller.abort();
  }, [candidate?.from, candidate?.till, guests, id, key, part]);

  if (!key) return { ...idle, holidayId: null, matched: false } satisfies HolidayLiveSearchState;
  return value?.key === key ? value.state : { ...idle, status: "loading" as const, holidayId: id, matched: Boolean(id) } satisfies HolidayLiveSearchState;
}
