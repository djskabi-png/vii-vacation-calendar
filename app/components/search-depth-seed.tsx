"use client";

import { createContext, useContext, type ReactNode } from "react";

export type SearchDepthTrailPreview = {
  slug: string;
  name: string;
  mainArea: string;
  region: string;
  areaTags: string[];
  image: string;
  meta: string;
};

export type SearchDepthProviderPreview = {
  id: string;
  name: string;
  location: string;
  area: string;
  serviceAreas: string[];
  image: string;
  meta: string;
};

type SearchDepthSeedValue = {
  trails: SearchDepthTrailPreview[];
  providers: SearchDepthProviderPreview[];
};

const SearchDepthSeedContext = createContext<SearchDepthSeedValue>({ trails: [], providers: [] });

export function SearchDepthSeed({ value, children }: { value: SearchDepthSeedValue; children: ReactNode }) {
  return <SearchDepthSeedContext.Provider value={value}>{children}</SearchDepthSeedContext.Provider>;
}

export function useSearchDepthSeed() {
  return useContext(SearchDepthSeedContext);
}
