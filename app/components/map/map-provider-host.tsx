"use client";

import { useCallback, useState } from "react";
import { useSiteLanguage } from "../../i18n/locale-provider";
import { MapProviderBoundary } from "../map-provider-boundary";
import { LeafletPlacesMap, preloadLeaflet, resetLeafletProvider } from "./leaflet-places-map";
import type { MapProviderDefinition, MapProviderProps } from "../../lib/map/map-provider-contract";

export const defaultMapProvider: MapProviderDefinition = {
  id: "leaflet", Component: LeafletPlacesMap, preload: preloadLeaflet, reset: resetLeafletProvider,
};

export function preloadDefaultMapProvider() { return defaultMapProvider.preload!(); }

/** The boundary must be outside the provider component. A boundary rendered
 * inside Leaflet cannot catch Leaflet's own render or hook failure. Keeping
 * this host provider-neutral also isolates a future replacement implementation. */
export function MapProviderHost({ provider = defaultMapProvider, ...props }: MapProviderProps & { provider?: MapProviderDefinition }) {
  const { language } = useSiteLanguage();
  const [epoch, setEpoch] = useState(0);
  const [resetFailure, setResetFailure] = useState<{ providerId: string; error: unknown } | null>(null);
  const retry = useCallback(() => {
    try {
      provider.reset?.();
      setResetFailure(null);
      setEpoch(value => value + 1);
    } catch (error) {
      // A provider-specific reset failure must preserve the fallback list too.
      setResetFailure({ providerId: provider.id, error });
    }
  }, [provider]);
  const Provider = provider.Component;
  return <MapProviderBoundary key={provider.id} places={props.places} tone={props.tone ?? "vacation"} language={language}
    providerError={resetFailure?.providerId === provider.id ? resetFailure.error : undefined} onRetry={retry} onClose={props.onClose}>
    <Provider key={`${provider.id}:${epoch}`} {...props} />
  </MapProviderBoundary>;
}
