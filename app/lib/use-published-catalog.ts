"use client";

import { useEffect, useRef, useState } from "react";
import type { SupplierCatalogWorld } from "./supplier-catalog-store.ts";
import { usePublishedCatalogSeed } from "./published-catalog-seed";

export function usePublishedCatalog<T>(world: SupplierCatalogWorld, map: (value: unknown) => T) {
  const seed = usePublishedCatalogSeed(world);
  const [items, setItems] = useState<T[]>(() => (seed || []).map(map));
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(seed === null);
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
      try {
        const searchView = world === "vacations" || world === "events" ? "&view=search" : "";
        const response = await fetch(`/api/catalog?world=${world}${searchView}`, { signal: controller.signal });
        if (!response.ok) throw new Error("catalog_unavailable");
        const body = await response.json() as { entries?: Array<{ summary: unknown }> };
        if (!Array.isArray(body.entries)) throw new Error("catalog_unavailable");
        setItems(body.entries.map((entry) => map(entry.summary)));
        hasAcceptedContent.current = true;
        setError(false);
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
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    let idleHandle: number | undefined;
    let timerHandle: number | undefined;
    if (seed === null) void load();
    else if ("requestIdleCallback" in window) idleHandle = window.requestIdleCallback(() => void load(), { timeout: 2_500 });
    else timerHandle = window.setTimeout(() => void load(), 1_000);
    const refreshOnReturn = () => {
      if (document.visibilityState === "visible" && Date.now() - seededAt.current >= 5 * 60_000) void load();
    };
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => {
      controller.abort();
      if (idleHandle !== undefined && "cancelIdleCallback" in window) window.cancelIdleCallback(idleHandle);
      if (timerHandle !== undefined) window.clearTimeout(timerHandle);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, [world, map, seed]);
  return { items, error, loading };
}
