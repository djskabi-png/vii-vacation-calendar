"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ResolvedAvailability } from "./property-card";
import type { VacationSearchRoom } from "../lib/vacation-party";

type UnitResult = { roomID: number; status: "available" | "unavailable" | "unverified"; total?: number; nights?: number; onlineBooking?: boolean; minimumNights?: number; reason?: string | null };
export type UnitQuote = { quote: ResolvedAvailability | null; status: "ready" | "error"; onlineBooking: boolean };

export function useViiUnitQuotes(siteID: number | null, from: string, till: string, guests: number, rooms: VacationSearchRoom[], roomIDs: number[]) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; quotes: Record<number, UnitQuote> } | null>(null);
  const roomKey = useMemo(() => [...new Set(roomIDs)].sort((a, b) => a - b).join(","), [roomIDs]);
  const partyKey = JSON.stringify(rooms);
  const key = `${siteID}|${from}|${till}|${guests}|${partyKey}|${roomKey}|${attempt}`;
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!siteID || !from || !till || !roomKey) return;
    const requested = roomKey.split(",").map(Number);
    const controller = new AbortController();
    fetch("/api/vii/stay-unit-quotes", {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: controller.signal,
      body: JSON.stringify({ siteID, from, till, guests, rooms, roomIDs: requested }),
    }).then(async (response) => {
      if (!response.ok) throw Error("supplier_unavailable");
      return response.json() as Promise<{ units?: UnitResult[] }>;
    }).then((value) => {
      if (controller.signal.aborted || !Array.isArray(value.units) || value.units.length !== requested.length) return;
      const expectedNights = Math.round((Date.parse(`${till}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
      const quotes: Record<number, UnitQuote> = {};
      for (const unit of value.units) {
        if (!requested.includes(unit.roomID) || quotes[unit.roomID] || !["available", "unavailable", "unverified"].includes(unit.status)) throw Error("invalid_unit_quote");
        if (unit.status === "available" && (typeof unit.total !== "number" || unit.total <= 0 || unit.nights !== expectedNights)) throw Error("invalid_unit_quote");
        const nightlyPrice = unit.status === "available" ? unit.total! / unit.nights! : undefined;
        quotes[unit.roomID] = {
          status: unit.status === "unverified" ? "error" : "ready",
          onlineBooking: unit.onlineBooking === true,
          quote: unit.status === "unverified" ? null : {
            from, till, availability: unit.status,
            ...(unit.status === "available" ? { totalPrice: unit.total, nightlyPrice, priceMode: "nightly_average" as const } : {}),
            minimumNights: unit.minimumNights, unavailableReason: unit.reason || undefined, showSelectedDates: true,
          },
        };
      }
      if (Object.keys(quotes).length !== requested.length) throw Error("missing_unit_quote");
      setResult({ key, quotes });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ key, quotes: Object.fromEntries(requested.map((roomID) => [roomID, { quote: null, status: "error", onlineBooking: false }])) });
    });
    return () => controller.abort();
  }, [siteID, from, till, guests, rooms, partyKey, roomKey, key]);

  return {
    quotes: result?.key === key ? result.quotes : {},
    status: !siteID || !from || !till || !roomKey ? "idle" as const : result?.key === key ? "ready" as const : "loading" as const,
    retry,
  };
}
