"use client";

import { useEffect, useState } from "react";
import { validStartingPriceMap, type StartingPriceMap, type StartingPriceWorld } from "./supplier-starting-price";

export function useStartingPrices(world: StartingPriceWorld, enabled: boolean): StartingPriceMap {
  const [prices, setPrices] = useState<StartingPriceMap>({});
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/vii/starting-prices?world=${world}`, { signal: controller.signal });
        if (!response.ok) { if (!controller.signal.aborted) setPrices({}); return; }
        const body = await response.json();
        if (!controller.signal.aborted) setPrices(body.world === world && validStartingPriceMap(world, body.prices) ? body.prices : {});
      } catch { if (!controller.signal.aborted) setPrices({}); /* Catalog results remain usable. */ }
    }
    void load();
    return () => controller.abort();
  }, [world, enabled]);
  return enabled ? prices : {};
}
