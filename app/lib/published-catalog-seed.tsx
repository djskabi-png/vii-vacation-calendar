"use client";

import { createContext, useContext } from "react";
import type { SupplierCatalogWorld } from "./supplier-catalog-store.ts";

type Seed = { world: SupplierCatalogWorld; entries: unknown[] };
const Context = createContext<Seed | null>(null);

export function PublishedCatalogSeed({ world, entries, children }: Seed & { children: React.ReactNode }) {
  return <Context.Provider value={{ world, entries }}>{children}</Context.Provider>;
}

export function usePublishedCatalogSeed(world: SupplierCatalogWorld) {
  const seed = useContext(Context);
  return seed?.world === world ? seed.entries : [];
}
