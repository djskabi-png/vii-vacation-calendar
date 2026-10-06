"use client";

import { useEffect, useState } from "react";
import type { LiveSearchResult, LiveSearchWorld } from "../lib/vii-live-search";

export type LiveSearchState = {
  status: "idle" | "loading" | "ready" | "error";
  results: Record<number, LiveSearchResult>;
  checkedAt: string | null;
};

const idle: LiveSearchState = { status: "idle", results: {}, checkedAt: null };

export function useViiLiveSearch(world: LiveSearchWorld, from: string | null, till: string | null, guests: number, hours?: number) {
  const key = from && till ? `${world}|${from}|${till}|${guests}|${hours || ""}` : "";
  const [value, setValue] = useState<{ key: string; state: LiveSearchState } | null>(null);

  useEffect(() => {
    if (!key || !from || !till) return;
    const controller = new AbortController();
    fetch("/api/vii/live-search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ world, from, till, guests, ...(world === "events" ? { hours } : {}) }),
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error("supplier_unavailable");
      return response.json() as Promise<{ checkedAt: string | null; results: LiveSearchResult[] }>;
    }).then((result) => {
      if (!controller.signal.aborted) setValue({ key, state: {
        status: "ready",
        results: Object.fromEntries(result.results.map((item) => [item.siteID, item])),
        checkedAt: result.checkedAt,
      } });
    }).catch(() => {
      if (!controller.signal.aborted) setValue({ key, state: { status: "error", results: {}, checkedAt: null } });
    });
    return () => controller.abort();
  }, [key, world, from, till, guests, hours]);

  if (!key) return idle;
  return value?.key === key ? value.state : { ...idle, status: "loading" as const };
}
