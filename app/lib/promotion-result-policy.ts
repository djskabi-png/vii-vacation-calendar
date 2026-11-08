import type { PublicPromotionWorld, PublicPromotionWeight } from "./public-promotion-policy.ts";
import { promotionSupplierId } from "./public-promotion-policy.ts";

export type PromotionResult = PublicPromotionWeight;

export function matchingPromotions<T extends { id: string | number }>(items: readonly T[], world: PublicPromotionWorld, promotions: readonly PromotionResult[], isInScope: (item: T) => boolean) {
  const map = new Map(promotions.filter(item => item.world === world && item.featured).map(item => [item.supplierId, item]));
  return items.filter(item => isInScope(item) && map.has(promotionSupplierId(item.id)));
}

export function turboOrder<T>(items: readonly T[], world: PublicPromotionWorld, promotions: readonly PromotionResult[], enabled: boolean, getId: (item: T) => string | number, getTier: (item: T) => number = () => 0) {
  if (!enabled) return [...items];
  const map = new Map(promotions.filter(item => item.world === world).map(item => [item.supplierId, item]));
  return items.map((item, index) => ({ item, index, tier: getTier(item), turbo: map.get(promotionSupplierId(getId(item)))?.turboEligible === true }))
    .sort((a, b) => a.tier - b.tier || Number(b.turbo) - Number(a.turbo) || a.index - b.index).map(entry => entry.item);
}
