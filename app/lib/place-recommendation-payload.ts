import type { DiscoveryItem } from "../data/world-data";
import type { SearchDepthInventoryPlace } from "./search-depth-model";
import { nearbyRecommendations } from "./nearby-recommendations.ts";
import { activityRegion, activityType } from "./activity-discovery-taxonomy.ts";

/** Keep every search facet, but send full card/media data only for rendered recommendations. */
export function placeRecommendationPayload(item: DiscoveryItem, items: DiscoveryItem[]) {
  const worldItems = items.filter((entry) => entry.world === item.world);
  const relatedItems = nearbyRecommendations(worldItems.filter((entry) => Boolean(entry.image?.trim() || entry.images?.some((image) => image?.trim()))), item,
    { key: (entry) => entry.id, exclude: item.id }).items;
  const searchInventory: SearchDepthInventoryPlace[] = [item, ...worldItems].map((entry) => ({
    location: entry.location, area: item.world === "activities" ? activityRegion(entry) || "" : entry.area,
    type: item.world === "activities" ? activityType(entry) || undefined : undefined,
    serviceAreas: entry.serviceAreas,
  }));
  return { relatedItems, searchInventory };
}
