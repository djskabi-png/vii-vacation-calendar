import type { D1Database } from "../../types/cloudflare-runtime";
import type { EditorialContent } from "./content-studio.ts";
import type { HomeDeal, HomeDealPeriod } from "./vii-home-deals.ts";

export type HomeDealPlacement = HomeDealPeriod | "holidays";

const placements = new Set<HomeDealPlacement>(["tomorrow", "weekend", "friday-weekend", "thursday", "friday", "holidays"]);

function positiveRank(value: string | undefined) {
  const rank = Number(value);
  return Number.isSafeInteger(rank) && rank > 0 && rank <= 999 ? rank : 500;
}

function selectedPlacements(content: Pick<EditorialContent, "attributes">) {
  return new Set(content.attributes.homeDealPlacements?.split(",").map((value) => value.trim()).filter((value): value is HomeDealPlacement => placements.has(value as HomeDealPlacement)) || []);
}

export function applyHomeDealCuration(deals: readonly HomeDeal[], items: readonly { key: string; content: Pick<EditorialContent, "attributes"> }[], placement: HomeDealPlacement) {
  const entries: Array<[number, Pick<EditorialContent, "attributes">]> = [];
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
  if (!deals.length) return [];
  // This consumer needs only three Hebrew placement attributes. Preserve the
  // same published/scheduled version selection without transferring every
  // property's editorial body, links, gallery attributes and SEO copy.
  const rows = await db.prepare(`SELECT i.entity_key AS entityKey,
    json_extract(v.content_json, '$.attributes.homeDealHidden') AS hidden,
    json_extract(v.content_json, '$.attributes.homeDealPlacements') AS placements,
    json_extract(v.content_json, '$.attributes.homeDealOrder') AS rank
    FROM vii_content_items i JOIN vii_content_versions v
      ON v.item_id = i.id AND v.version = CASE
        WHEN i.status = 'scheduled' AND i.scheduled_at <= ? THEN i.version ELSE i.published_version END
    WHERE i.content_type = 'vacation' AND i.locale = 'he' AND i.status <> 'archived'
    ORDER BY i.entity_key`).bind(new Date().toISOString()).all<{
      entityKey: string; hidden: string | null; placements: string | null; rank: string | null;
    }>();
  return applyHomeDealCuration(deals, rows.results.map(row => ({ key: row.entityKey, content: { attributes: {
    homeDealHidden: row.hidden ?? "", homeDealPlacements: row.placements ?? "", homeDealOrder: row.rank ?? "",
  } } })), placement);
}
