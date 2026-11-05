import type { WorldId } from "../data/world-data";

export const WORLD_SURFACE_IDS = ["vacation", "events", "corporate", "spa", "hourly", "activities", "providers"] as const satisfies readonly WorldId[];

export function worldSurfaceAttributes(world: WorldId) {
  return {
    "data-world": world,
    "data-world-surface": world,
    className: world === "spa" ? "site-page site-page--spa" : "site-page",
  } as const;
}

export function hasWorldSurfaceBoundary(attributes: Record<string, string>, world: WorldId) {
  return attributes["data-world"] === world && attributes["data-world-surface"] === world;
}
