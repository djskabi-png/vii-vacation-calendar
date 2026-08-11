"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { Listing } from "../data/site-data";
import type { DiscoveryItem } from "../data/world-data";

const loadingMap = () => <div className="map-deferred-loading" role="status">טוענים את המפה</div>;

export const DeferredListingMap = dynamic(
  () => import("./listing-map").then((module) => module.ListingMap),
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
}>;

export const DeferredDiscoveryMap = dynamic(
  () => import("./listing-map").then((module) => module.DiscoveryMap),
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
