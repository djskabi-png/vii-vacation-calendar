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
  useEffect(() => {
    const controller = new AbortController();
    let fetching = false;
    async function load() {
      if (fetching) return;
      fetching = true;
      seededAt.current = Date.now();
      if (seed === null) setLoading(true);
      try {
        const response = await fetch(`/api/catalog?world=${world}${world === "vacations" ? "&view=search" : ""}`, { signal: controller.signal });
        if (!response.ok) throw new Error("catalog_unavailable");
        const body = await response.json() as { entries?: Array<{ summary: unknown }> };
        if (!Array.isArray(body.entries)) throw new Error("catalog_unavailable");
        setItems(body.entries.map((entry) => map(entry.summary)));
        setError(false);
        seededAt.current = Date.now();
      } catch {
        if (controller.signal.aborted) return;
        setItems([]);
        setError(true);
      } finally {
        fetching = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    if (seed === null) void load();
    const refreshOnReturn = () => {
      if (document.visibilityState === "visible" && Date.now() - seededAt.current >= 5 * 60_000) void load();
    };
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => { controller.abort(); document.removeEventListener("visibilitychange", refreshOnReturn); };
  }, [world, map, seed]);
  return { items, error, loading };
}
