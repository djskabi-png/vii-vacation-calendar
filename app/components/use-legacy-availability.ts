"use client";

import { useEffect, useState } from "react";
import type { Property } from "../data/site-data";
import type { ResolvedAvailability, SelectedStay } from "./property-card";

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
  }>;
};

export function useLegacyAvailability(property: Property, selectedStay: SelectedStay | null) {
  const [resolved, setResolved] = useState<{ key: string; quote: ResolvedAvailability } | null>(null);
  const slug = property.slug;
  const enabled = slug === "hilat-hanof" && Boolean(property.inventorySource);
  const from = selectedStay?.from || "";
  const till = selectedStay?.till || "";
  const requestKey = `${slug}|${from}|${till}`;

  useEffect(() => {
    if (!enabled || !from || !till) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ place: slug, from, till });
    fetch(`/hilat-calendar-data?${params.toString()}`, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() as Promise<LegacyAvailabilityResponse> : null)
      .then((result) => {
        if (!result?.success || result.from !== from || result.till !== till) return;
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
            })),
          },
        });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [enabled, from, requestKey, slug, till]);

  return resolved?.key === requestKey ? resolved.quote : null;
}
