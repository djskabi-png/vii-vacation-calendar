"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ControllableWorld, WorldAvailability } from "../lib/world-availability";

const Context = createContext<WorldAvailability | null>(null);

export function WorldAvailabilityProvider({ initial, children }: { initial: WorldAvailability; children: React.ReactNode }) {
  const [state, setState] = useState(initial);
  const refresh = useCallback(async () => {
    const response = await fetch("/api/content/world-availability", { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) return;
    const next = (await response.json() as { worlds?: WorldAvailability }).worlds;
    if (next) setState(next);
  }, []);
  useEffect(() => {
    const update = (event: Event) => {
      const next = (event as CustomEvent<WorldAvailability>).detail;
      if (next) setState(next);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === "vii-world-availability") void refresh();
    };
    const focus = () => void refresh();
    window.addEventListener("vii-world-availability", update);
    window.addEventListener("storage", storage);
    window.addEventListener("focus", focus);
    void refresh();
    return () => {
      window.removeEventListener("vii-world-availability", update);
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", focus);
    };
  }, [refresh]);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}

export function useWorldAvailability() {
  const state = useContext(Context);
  return {
    state,
    enabled: (world: string) => state ? state[world as ControllableWorld] !== false : true,
  };
}
