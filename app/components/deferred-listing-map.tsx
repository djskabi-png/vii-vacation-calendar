"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { Listing } from "../data/site-data";
import type { DiscoveryItem } from "../data/world-data";
import type { Trail } from "../data/trail-data";

const loadListingMap = () => import("./listing-map");

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
}>;

export const DeferredTrailMap = dynamic(
  () => loadListingMap().then((module) => module.TrailMap),
  { ssr: false, loading: loadingMap },
) as ComponentType<{
  trails: Trail[];
  autoLoad?: boolean;
  onClose?: () => void;
}>;
