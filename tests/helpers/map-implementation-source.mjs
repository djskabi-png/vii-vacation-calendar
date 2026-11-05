import { readFileSync } from "node:fs";

// Static family contracts inspect all real owners after the provider split.
// Runtime wrapper and renderer harnesses still execute their actual modules.
export function readMapImplementation() {
  return ["../../app/components/map/leaflet-places-map.tsx", "../../app/components/listing-map.tsx", "../../app/lib/map/map-place.ts"]
    .map(path => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
}
