"use client";

import { useEffect, useState } from "react";
import type { Property } from "../data/site-data";
import type { ResolvedAvailability, SelectedStay } from "./property-card";
import { legacyAvailabilitySourceFor } from "../lib/legacy-availability-sources";

type LegacyAvailabilityResponse = {
  success: true;
  from: string;
  till: string;
  availability: "available" | "unavailable";
  availableUnits: number;
  totalUnits: number;
  totalPrice: number;
  nightlyPrice: number;
  includedGuests: number;
  units: Array<{
    index: number;
    availability: "available" | "unavailable";
    availableCount: number;
    totalPrice: number;
    nightlyPrice: number;
    maxGuests: number;
  }>;
};

export type LegacyAvailabilityState = {
  quote: ResolvedAvailability | null;
  status: "idle" | "loading" | "ready" | "error";
};

function toResolvedAvailability(result: LegacyAvailabilityResponse, from: string, till: string): ResolvedAvailability {
  return {
    from,
    till,
    availability: result.availability,
    nightlyPrice: result.nightlyPrice > 0 ? result.nightlyPrice : undefined,
    includedGuests: result.includedGuests,
    showSelectedDates: true,
    units: (Array.isArray(result.units) ? result.units : []).map((unit) => ({
      index: unit.index,
      availability: unit.availability,
      availableCount: unit.availableCount,
      totalPrice: unit.totalPrice > 0 ? unit.totalPrice : undefined,
      nightlyPrice: unit.nightlyPrice > 0 ? unit.nightlyPrice : undefined,
      maxGuests: unit.maxGuests,
    })),
  };
}

export function useLegacyAvailability(property: Property | null, selectedStay: SelectedStay | null) {
  const [resolved, setResolved] = useState<{ key: string; quote: ResolvedAvailability } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const slug = property?.slug || "";
  const enabled = Boolean(legacyAvailabilitySourceFor(slug));
  const from = selectedStay?.from || "";
  const till = selectedStay?.till || "";
  const guests = Math.max(1, selectedStay?.guests || 2);
  const requestKey = `${slug}|${from}|${till}|${guests}`;

  useEffect(() => {
    if (!enabled || !from || !till) return;
    setFailedKey(null);
    const controller = new AbortController();
    const params = new URLSearchParams({ place: slug, from, till, guests: String(guests) });
    fetch(`/api/legacy-availability?${params.toString()}`, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() as Promise<LegacyAvailabilityResponse> : null)
      .then((result) => {
        if (!result?.success || result.from !== from || result.till !== till) {
          if (!controller.signal.aborted) setFailedKey(requestKey);
          return;
        }
        setResolved({
          key: requestKey,
          quote: toResolvedAvailability(result, from, till),
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailedKey(requestKey);
      });
    return () => controller.abort();
  }, [enabled, from, guests, requestKey, slug, till]);

  if (!enabled || !from || !till) return { quote: null, status: "idle" } satisfies LegacyAvailabilityState;
  if (resolved?.key === requestKey) return { quote: resolved.quote, status: "ready" } satisfies LegacyAvailabilityState;
  if (failedKey === requestKey) return { quote: null, status: "error" } satisfies LegacyAvailabilityState;
  return { quote: null, status: "loading" } satisfies LegacyAvailabilityState;
}

/**
 * Search needs a single source of truth for live quotes. Fetching each mapped
 * listing here lets results re-order as verified answers arrive, rather than
 * presenting a static card price as if it were a date-specific quote.
 */
export function useLegacyAvailabilityBatch(properties: Property[], selectedStay: SelectedStay | null) {
  const sourceSlugs = properties
    .map((property) => property.slug)
    .filter((slug) => Boolean(legacyAvailabilitySourceFor(slug)))
    .sort();
  const from = selectedStay?.from || "";
  const till = selectedStay?.till || "";
  const guests = Math.max(1, selectedStay?.guests || 2);
  const requestKey = `${sourceSlugs.join(",")}|${from}|${till}|${guests}`;
  const [state, setState] = useState<{ key: string; values: Record<string, LegacyAvailabilityState> } | null>(null);

  useEffect(() => {
    if (!sourceSlugs.length || !from || !till) {
      setState(null);
      return;
    }
    const controller = new AbortController();
    const loading = Object.fromEntries(sourceSlugs.map((slug) => [slug, { quote: null, status: "loading" } satisfies LegacyAvailabilityState]));
    setState({ key: requestKey, values: loading });
    Promise.all(sourceSlugs.map(async (slug) => {
      const params = new URLSearchParams({ place: slug, from, till, guests: String(guests) });
      try {
        const response = await fetch(`/api/legacy-availability?${params.toString()}`, { cache: "no-store", credentials: "same-origin", headers: { Accept: "application/json" }, signal: controller.signal });
        const result = response.ok ? await response.json() as LegacyAvailabilityResponse : null;
        if (!result?.success || result.from !== from || result.till !== till) return [slug, { quote: null, status: "error" } satisfies LegacyAvailabilityState] as const;
        return [slug, { quote: toResolvedAvailability(result, from, till), status: "ready" } satisfies LegacyAvailabilityState] as const;
      } catch {
        return [slug, { quote: null, status: "error" } satisfies LegacyAvailabilityState] as const;
      }
    })).then((entries) => {
      if (!controller.signal.aborted) setState({ key: requestKey, values: Object.fromEntries(entries) });
    });
    return () => controller.abort();
  }, [from, guests, requestKey, sourceSlugs.join(","), till]);

  if (!sourceSlugs.length || !from || !till) return {} as Record<string, LegacyAvailabilityState>;
  if (state?.key === requestKey) return state.values;
  return Object.fromEntries(sourceSlugs.map((slug) => [slug, { quote: null, status: "loading" } satisfies LegacyAvailabilityState]));
}

/**
 * Flexible searches deliberately query the preferred weekend first, then the
 * smallest allowed deviations. A property stops querying as soon as it has a
 * verified available price, so results can be ordered around a real bookable
 * stay without manufacturing a date or a quote.
 */
export function useLegacyFlexibleAvailabilityBatch(properties: Property[], candidates: SelectedStay[]) {
  const sourceSlugs = properties
    .map((property) => property.slug)
    .filter((slug) => Boolean(legacyAvailabilitySourceFor(slug)))
    .sort();
  const candidateKey = candidates.map((candidate) => `${candidate.from}|${candidate.till}|${candidate.guests || 2}`).join(",");
  const requestKey = `${sourceSlugs.join(",")}|${candidateKey}`;
  const [state, setState] = useState<{ key: string; values: Record<string, LegacyAvailabilityState> } | null>(null);

  useEffect(() => {
    const requestCandidates = candidateKey.split(",").map((value) => {
      const [from, till, guests] = value.split("|");
      return { from, till, guests: Math.max(1, Number(guests) || 2) } satisfies SelectedStay;
    }).filter((candidate) => candidate.from && candidate.till);
    if (!sourceSlugs.length || !requestCandidates.length) {
      setState(null);
      return;
    }
    const controller = new AbortController();
    const loading = Object.fromEntries(sourceSlugs.map((slug) => [slug, { quote: null, status: "loading" } satisfies LegacyAvailabilityState]));
    setState({ key: requestKey, values: loading });

    async function quoteFor(slug: string, candidate: SelectedStay) {
      const from = candidate.from;
      const till = candidate.till;
      const guests = Math.max(1, candidate.guests || 2);
      const params = new URLSearchParams({ place: slug, from, till, guests: String(guests) });
      const response = await fetch(`/api/legacy-availability?${params.toString()}`, { cache: "no-store", credentials: "same-origin", headers: { Accept: "application/json" }, signal: controller.signal });
      const result = response.ok ? await response.json() as LegacyAvailabilityResponse : null;
      if (!result?.success || result.from !== from || result.till !== till) return null;
      return toResolvedAvailability(result, from, till);
    }

    void Promise.all(sourceSlugs.map(async (slug) => {
      let firstKnown: ResolvedAvailability | null = null;
      let firstAvailable: ResolvedAvailability | null = null;
      for (const candidate of requestCandidates) {
        try {
          const quote = await quoteFor(slug, candidate);
          if (!quote) continue;
          if (!firstKnown) firstKnown = quote;
          if (quote.availability === "available" && !firstAvailable) firstAvailable = quote;
          if (quote.availability === "available" && typeof quote.nightlyPrice === "number" && quote.nightlyPrice > 0) {
            return [slug, { quote, status: "ready" } satisfies LegacyAvailabilityState] as const;
          }
        } catch {
          if (controller.signal.aborted) return [slug, { quote: null, status: "error" } satisfies LegacyAvailabilityState] as const;
        }
      }
      if (firstAvailable) return [slug, { quote: firstAvailable, status: "ready" } satisfies LegacyAvailabilityState] as const;
      if (firstKnown) return [slug, { quote: firstKnown, status: "ready" } satisfies LegacyAvailabilityState] as const;
      return [slug, { quote: null, status: "error" } satisfies LegacyAvailabilityState] as const;
    })).then((entries) => {
      if (controller.signal.aborted) return;
      setState((current) => {
        if (current?.key !== requestKey) return current;
        return { key: requestKey, values: { ...current.values, ...Object.fromEntries(entries) } };
      });
    });
    return () => controller.abort();
  }, [candidateKey, requestKey, sourceSlugs.join(",")]);

  if (!sourceSlugs.length || !candidates.length) return {} as Record<string, LegacyAvailabilityState>;
  if (state?.key === requestKey) return state.values;
  return Object.fromEntries(sourceSlugs.map((slug) => [slug, { quote: null, status: "loading" } satisfies LegacyAvailabilityState]));
}
