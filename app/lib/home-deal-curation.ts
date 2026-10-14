import type { D1Database } from "../../types/cloudflare-runtime";
import { readPublishedItems, type EditorialContent } from "./content-studio.ts";
import type { HomeDeal, HomeDealPeriod } from "./vii-home-deals.ts";

export type HomeDealPlacement = HomeDealPeriod | "holidays";

const placements = new Set<HomeDealPlacement>(["tomorrow", "weekend", "friday-weekend", "thursday", "friday", "holidays"]);

function positiveRank(value: string | undefined) {
  const rank = Number(value);
  return Number.isSafeInteger(rank) && rank > 0 && rank <= 999 ? rank : 500;
}

function selectedPlacements(content: EditorialContent) {
  return new Set(content.attributes.homeDealPlacements?.split(",").map((value) => value.trim()).filter((value): value is HomeDealPlacement => placements.has(value as HomeDealPlacement)) || []);
}

export function applyHomeDealCuration(deals: readonly HomeDeal[], items: readonly { key: string; content: EditorialContent }[], placement: HomeDealPlacement) {
  const entries: Array<[number, EditorialContent]> = [];
  for (const item of items) {
    const siteID = Number(item.key);
    if (Number.isSafeInteger(siteID) && siteID > 0) entries.push([siteID, item.content]);
  }
  const editorial = new Map<number, EditorialContent>(entries);
  return deals.flatMap((deal) => {
    const content = editorial.get(deal.siteID);
    if (!content || content.attributes.homeDealHidden === "true") return content?.attributes.homeDealHidden === "true" ? [] : [{ ...deal }];
    return selectedPlacements(content).has(placement)
      ? [{ ...deal, curatedRank: positiveRank(content.attributes.homeDealOrder) }]
      : [{ ...deal }];
  });
}

export async function curateHomeDeals(db: D1Database, deals: readonly HomeDeal[], placement: HomeDealPlacement) {
  return applyHomeDealCuration(deals, await readPublishedItems(db, "vacation", "he"), placement);
}
