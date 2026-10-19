"use client";

import { useCallback, useEffect, useState } from "react";
import type { ResolvedAvailability } from "./property-card";
import type { VacationSearchRoom } from "../lib/vacation-party";

type Quote = { status: "available" | "unavailable" | "unverified"; total?: number; nights?: number; roomIDs?: number[]; onlineBooking?: boolean; minimumNights?: number; reason?: string | null };

export function useViiStayQuote(siteID: number | null, from: string, till: string, guests: number, rooms?: VacationSearchRoom[]) {
  const [result, setResult] = useState<{ key: string; quote: ResolvedAvailability | null; status: "ready" | "error"; roomIDs: number[]; onlineBooking: boolean } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const roomKey = JSON.stringify(rooms ?? [{ adults: guests }]);
  const key = `${siteID}|${from}|${till}|${guests}|${roomKey}|${retryCount}`;
  const retry = useCallback(() => setRetryCount((value) => value + 1), []);

  useEffect(() => {
    if (!siteID || !from || !till) return;
    const controller = new AbortController();
    fetch("/api/vii/stay-quote", {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: controller.signal,
      body: JSON.stringify({ siteID, from, till, guests, ...(rooms ? { rooms } : {}) }),
    }).then(async (response) => {
      if (!response.ok) throw new Error("supplier_unavailable");
      return response.json() as Promise<Quote>;
    }).then((value) => {
      if (controller.signal.aborted) return;
      const expectedNights = Math.round((Date.parse(`${till}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
      if (!["available", "unavailable", "unverified"].includes(value.status) || value.status === "available" &&
        (typeof value.total !== "number" || !Number.isFinite(value.total) || value.total <= 0 || value.nights !== expectedNights || !Array.isArray(value.roomIDs) || value.roomIDs.length !== 1 || !Number.isSafeInteger(value.roomIDs[0]) || value.roomIDs[0] < 1)) throw Error("invalid_quote");
      const nightlyPrice = value.status === "available" && value.total && value.nights ? value.total / value.nights : undefined;
      setResult({ key, status: "ready", roomIDs: value.status === "available" ? value.roomIDs || [] : [], onlineBooking: value.onlineBooking === true, quote: value.status === "available" || value.status === "unavailable" ? {
        from, till, availability: value.status === "available" ? "available" : "unavailable",
        totalPrice: value.status === "available" ? value.total : undefined, priceMode: "nightly_average",
        minimumNights: value.minimumNights, unavailableReason: value.reason || undefined,
        showSelectedDates: true, ...(nightlyPrice ? { nightlyPrice } : {}),
      } : null });
    }).catch(() => { if (!controller.signal.aborted) setResult({ key, status: "error", quote: null, roomIDs: [], onlineBooking: false }); });
    return () => controller.abort();
  }, [siteID, from, till, guests, key]);

  return { quote: result?.key === key ? result.quote : null,
    roomIDs: result?.key === key ? result.roomIDs : [],
    onlineBooking: result?.key === key ? result.onlineBooking : false,
    status: !siteID || !from || !till ? "idle" as const : result?.key === key ? result.status : "loading" as const,
    retry };
}
