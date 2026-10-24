"use client";

import { createContext, useContext } from "react";
import type { SupplierCatalogWorld } from "./supplier-catalog-store.ts";

type Seed = { world: SupplierCatalogWorld; entries: unknown[]; complete: boolean };
const Context = createContext<Seed | null>(null);

export function PublishedCatalogSeed({ world, entries, complete = true, children }: Omit<Seed, "complete"> & { complete?: boolean; children: React.ReactNode }) {
  return <Context.Provider value={{ world, entries, complete }}>{children}</Context.Provider>;
}

export function usePublishedCatalogSeed(world: SupplierCatalogWorld) {
  const seed = useContext(Context);
  return seed?.world === world ? seed : null;
}
