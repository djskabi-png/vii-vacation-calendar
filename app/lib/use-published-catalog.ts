"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import type { SupplierCatalogWorld } from "./supplier-catalog-store.ts";
import { usePublishedCatalogSeed } from "./published-catalog-seed";
import { discoveryJson } from "./discovery-client-cache.ts";
import { fetchPublishedSearchCatalog } from "./published-catalog-client-cache.ts";

export function usePublishedCatalog<T>(world: SupplierCatalogWorld, map: (value: unknown) => T, view?: "cards") {
  const seedState = usePublishedCatalogSeed(world);
  const seed = seedState?.entries ?? null;
  const seedComplete = seedState?.complete ?? false;
  const [items, setItems] = useState<T[]>(() => (seed || []).map(map));
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(seed === null || !seedComplete);
  const seededAt = useRef(Date.now());
  const hasAcceptedContent = useRef(seed !== null);
  useEffect(() => {
    const controller = new AbortController();
    let fetching = false;
    async function load() {
      if (fetching) return;
      fetching = true;
      seededAt.current = Date.now();
      if (seed === null) setLoading(true);
      let committed = false;
      try {
        const searchView = view === "cards" ? "&view=cards" : world === "vacations" || world === "events" ? "&view=search" : "";
        const url = `/api/catalog?world=${world}${searchView}`;
        const body = view === "cards"
          ? await discoveryJson<{ entries?: Array<{ summary: unknown }> }>(url, world, { signal: controller.signal,
            timeoutMs: 10_000, retries: 0, persist: false, shouldCache: () => false })
          : world === "vacations" || world === "events"
            ? await fetchPublishedSearchCatalog(world, controller.signal)
            : await (async () => {
              const response = await fetch(url, { signal: controller.signal });
              if (!response.ok) throw new Error("catalog_unavailable");
              return response.json() as Promise<{ entries?: Array<{ summary: unknown }> }>;
            })();
        if (!Array.isArray(body.entries)) throw new Error("catalog_unavailable");
        const nextItems = body.entries.map((entry) => map(entry.summary));
        if (controller.signal.aborted) return;
        startTransition(() => {
          if (controller.signal.aborted) return;
          committed = true;
          setItems(nextItems);
          hasAcceptedContent.current = true;
          setError(false);
          setLoading(false);
        });
        seededAt.current = Date.now();
      } catch {
        if (controller.signal.aborted) return;
        // A catalog refresh is advisory discovery work. Keep the accepted
        // server seed or last successful catalog visible when the network is
        // briefly unavailable instead of replacing a useful result page with
        // an empty screen. Transactional availability is still checked by
        // the dedicated live endpoints.
        if (!hasAcceptedContent.current) setItems([]);
        setError(!hasAcceptedContent.current);
      } finally {
        fetching = false;
        if (!controller.signal.aborted && !committed) setLoading(false);
      }
    }
    let idleHandle: number | undefined;
    let timerHandle: ReturnType<typeof globalThis.setTimeout> | undefined;
    if (seed === null || !seedComplete) void load();
    else if ("requestIdleCallback" in window) idleHandle = window.requestIdleCallback(() => void load(), { timeout: 2_500 });
    else timerHandle = globalThis.setTimeout(() => void load(), 1_000);
    const refreshOnReturn = () => {
      if (document.visibilityState === "visible" && Date.now() - seededAt.current >= 5 * 60_000) void load();
    };
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => {
      controller.abort();
      if (idleHandle !== undefined && "cancelIdleCallback" in window) window.cancelIdleCallback(idleHandle);
      if (timerHandle !== undefined) globalThis.clearTimeout(timerHandle);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, [world, map, seed, seedComplete, view]);
  return { items, error, loading };
}
