"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { DiscoveryItem } from "../data/world-data";
import { usePublishedCatalog } from "../lib/use-published-catalog";

const Context = createContext<DiscoveryItem[] | null>(null);
const card = (value: unknown) => value as DiscoveryItem;

export function SpaCatalogProvider({ children }: { children: ReactNode }) {
  const { items } = usePublishedCatalog("spa", card, "cards");
  return <Context.Provider value={items}>{children}</Context.Provider>;
}
export function useSpaCatalogItems() { return useContext(Context); }
export function SpaCatalogCount({ fallback }: { fallback: number }) {
  const items = useSpaCatalogItems();
  return <>{items === null ? fallback : items.length}</>;
}
