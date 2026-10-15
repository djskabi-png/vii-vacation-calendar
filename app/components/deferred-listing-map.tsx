"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { Listing } from "../data/site-data";
import type { DiscoveryItem } from "../data/world-data";
import type { Trail } from "../data/trail-data";

const MAP_ASSET_RECOVERY_KEY = "vii:map-asset-recovery";
const MAP_ASSET_RECOVERY_WINDOW_MS = 60_000;

function isStaleDynamicImport(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(message);
}

const loadListingMap = () => import("./listing-map")
  .then((module) => {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(MAP_ASSET_RECOVERY_KEY);
    return module;
  })
  .catch((error: unknown) => {
    if (typeof window !== "undefined" && isStaleDynamicImport(error)) {
      const lastRecovery = Number(window.sessionStorage.getItem(MAP_ASSET_RECOVERY_KEY) || 0);
      if (!Number.isFinite(lastRecovery) || Date.now() - lastRecovery > MAP_ASSET_RECOVERY_WINDOW_MS) {
        window.sessionStorage.setItem(MAP_ASSET_RECOVERY_KEY, String(Date.now()));
        window.location.reload();
        return new Promise<never>(() => undefined);
      }
    }
    throw error;
  });

export const preloadListingMap = () => {
  void loadListingMap().then((module) => module.preloadLeaflet());
};

const loadingMap = () => <div className="map-deferred-loading" role="status" aria-live="polite">
  <span className="map-deferred-loading__orbit" aria-hidden="true"><i /><i /><i /></span>
  <strong>טוענים את המפה</strong>
</div>;

export const DeferredListingMap = dynamic(
  () => loadListingMap().then((module) => module.ListingMap),
  { ssr: false, loading: loadingMap },
) as ComponentType<{
  listings: Listing[];
  initialListings?: Listing[];
  mode?: "vacation" | "events";
  single?: boolean;
  autoLoad?: boolean;
  detailQuery?: string;
  onClose?: () => void;
  onVisibleCountChange?: (count: number) => void;
  onVisiblePlaceIdsChange?: (ids: string[]) => void;
  activePlaceId?: string | null;
  onActivePlaceChange?: (id: string | null) => void;
}>;

export const DeferredDiscoveryMap = dynamic(
  () => loadListingMap().then((module) => module.DiscoveryMap),
  { ssr: false, loading: loadingMap },
) as ComponentType<{
  items: DiscoveryItem[];
  initialItems?: DiscoveryItem[];
  tone: "spa" | "hourly" | "activities";
  single?: boolean;
  autoLoad?: boolean;
  onClose?: () => void;
  onVisibleCountChange?: (count: number) => void;
  onVisiblePlaceIdsChange?: (ids: string[]) => void;
  activePlaceId?: string | null;
  onActivePlaceChange?: (id: string | null) => void;
}>;

export const DeferredTrailMap = dynamic(
  () => loadListingMap().then((module) => module.TrailMap),
  { ssr: false, loading: loadingMap },
) as ComponentType<{
  trails: Trail[];
  autoLoad?: boolean;
  onClose?: () => void;
}>;
