import type { MapPlace, MapTone } from "./map-place";
import type { ComponentType } from "react";

export type MapProviderProps = {
  places: MapPlace[];
  initialPlaceIds?: string[];
  tone?: MapTone;
  single?: boolean;
  autoLoad?: boolean;
  onClose?: () => void;
  onVisibleCountChange?: (count: number) => void;
  onVisiblePlaceIdsChange?: (ids: string[]) => void;
  activePlaceId?: string | null;
  onActivePlaceChange?: (id: string | null) => void;
  regional?: boolean;
  resultKind?: "places" | "trails";
};

/** Provider implementations receive normalized presentation data only. */
export type MapProviderDefinition = {
  id: string;
  Component: ComponentType<MapProviderProps>;
  preload?: () => Promise<unknown> | null;
  reset?: () => void;
};
