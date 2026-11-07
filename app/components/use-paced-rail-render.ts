"use client";

import { useEffect, useState } from "react";
import { schedulePacedRailRender } from "../lib/paced-rail-render.ts";

/** Keep the first useful row and one advance buffer card in SSR. Retain every item and progressively mount
 * the rest only when the section is active, instead of hydrating twenty cards
 * in one startup task. Standalone grids retain their existing full rendering. */
export function usePacedRailRender(key: string, total: number, active: boolean, enabled: boolean) {
  const [windowed, setWindowed] = useState({ key, count: 4 });
  const count = !enabled ? total : Math.min(total, windowed.key === key ? windowed.count : 4);
  useEffect(() => {
    if (!enabled || !active || count >= total) return;
    return schedulePacedRailRender({
      initial: count, total,
      onCount: next => setWindowed({ key, count: next }),
      requestFrame: callback => window.requestAnimationFrame(callback),
      cancelFrame: id => window.cancelAnimationFrame(id),
      ...(typeof window.requestIdleCallback === "function" ? {
        requestIdle: (callback: () => void) => window.requestIdleCallback(callback, { timeout: 160 }),
        cancelIdle: (id: number) => window.cancelIdleCallback(id),
      } : {}),
    });
  }, [key, total, active, enabled, count]);
  return count;
}
