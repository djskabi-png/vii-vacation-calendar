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

export function useLegacyAvailability(property: Property, selectedStay: SelectedStay | null) {
  const [resolved, setResolved] = useState<{ key: string; quote: ResolvedAvailability } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const slug = property.slug;
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
          quote: {
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
          },
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
