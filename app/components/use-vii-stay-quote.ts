"use client";

import { useCallback, useEffect, useState } from "react";
import type { ResolvedAvailability } from "./property-card";

type Quote = { status: "available" | "unavailable" | "unverified"; total?: number; nights?: number; roomIDs?: number[] };

export function useViiStayQuote(siteID: number | null, from: string, till: string, guests: number) {
  const [result, setResult] = useState<{ key: string; quote: ResolvedAvailability | null; status: "ready" | "error"; roomIDs: number[] } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const key = `${siteID}|${from}|${till}|${guests}|${retryCount}`;
  const retry = useCallback(() => setRetryCount((value) => value + 1), []);

  useEffect(() => {
    if (!siteID || !from || !till) return;
    const controller = new AbortController();
    fetch("/api/vii/stay-quote", {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: controller.signal,
      body: JSON.stringify({ siteID, from, till, guests }),
    }).then(async (response) => {
      if (!response.ok) throw new Error("supplier_unavailable");
      return response.json() as Promise<Quote>;
    }).then((value) => {
      const nightlyPrice = value.status === "available" && value.total && value.nights ? value.total / value.nights : undefined;
      setResult({ key, status: "ready", roomIDs: value.status === "available" ? value.roomIDs || [] : [], quote: value.status === "available" || value.status === "unavailable" ? {
        from, till, availability: value.status === "available" ? "available" : "unavailable",
        showSelectedDates: true, ...(nightlyPrice ? { nightlyPrice } : {}),
      } : null });
    }).catch(() => { if (!controller.signal.aborted) setResult({ key, status: "error", quote: null, roomIDs: [] }); });
    return () => controller.abort();
  }, [siteID, from, till, guests, key]);

  return { quote: result?.key === key ? result.quote : null,
    roomIDs: result?.key === key ? result.roomIDs : [],
    status: !siteID || !from || !till ? "idle" as const : result?.key === key ? result.status : "loading" as const,
    retry };
}
