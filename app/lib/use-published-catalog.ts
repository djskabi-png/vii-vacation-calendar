"use client";

import { useEffect, useState } from "react";
import type { SupplierCatalogWorld } from "./supplier-catalog-store.ts";
import { usePublishedCatalogSeed } from "./published-catalog-seed";

export function usePublishedCatalog<T>(world: SupplierCatalogWorld, map: (value: unknown) => T) {
  const seed = usePublishedCatalogSeed(world);
  const [items, setItems] = useState<T[]>(() => seed.map(map));
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/catalog?world=${world}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("catalog_unavailable");
        const body = await response.json() as { entries?: Array<{ summary: unknown }> };
        if (!Array.isArray(body.entries)) throw new Error("catalog_unavailable");
        setItems(body.entries.map((entry) => map(entry.summary)));
        setError(false);
      } catch {
        if (controller.signal.aborted) return;
        setItems([]);
        setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [world, map]);
  return { items, error, loading };
}
