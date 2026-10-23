"use client";

import { createContext, useContext } from "react";
import type { ControllableWorld, WorldAvailability } from "../lib/world-availability";

const Context = createContext<WorldAvailability | null>(null);

export function WorldAvailabilityProvider({ initial, children }: { initial: WorldAvailability; children: React.ReactNode }) {
  return <Context.Provider value={initial}>{children}</Context.Provider>;
}

export function useWorldAvailability() {
  const state = useContext(Context);
  return {
    state,
    enabled: (world: string) => state ? state[world as ControllableWorld] !== false : true,
  };
}
