import { buildSergeyAmenityIndex, sergeyAmenityGroups } from "./sergey-amenities.ts";
import { legacyPlaceFeatureGroups } from "../data/legacy-place-feature-groups.ts";
import { cachedAmenityTaxonomy, cachedBusinessAmenities, cachedSharedAmenityList } from "./business-amenities-cache.ts";
import { runtimeCatalogDatabase } from "./published-supplier-ids.ts";
import { readSupplierCatalogState } from "./supplier-catalog-store.ts";
import type { D1Database } from "../../types/cloudflare-runtime";

export type LiveBusinessAmenityGroup = { title: string; items: string[] };
export type LiveBusinessAmenities = {
  groups: LiveBusinessAmenityGroup[];
  source: "biz-shared-amenities" | "migrated-vii-place-amenities";
};

export function resolvedBusinessFeatureGroups(
  liveGroups: LiveBusinessAmenityGroup[] | null,
  acceptedGroups: LiveBusinessAmenityGroup[] | undefined,
): LiveBusinessAmenityGroup[] {
  const usableLiveGroups = liveGroups?.filter((group) => group.items.length) || [];
  return usableLiveGroups.length ? usableLiveGroups : acceptedGroups?.filter((group) => group.items.length) || [];
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function positiveId(value: unknown) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
}

export async function fetchLiveBusinessAmenities({ supplierId, token, fetchImpl = fetch, sourceRevision, now = Date.now, database }: {
  supplierId: number;
  token: string;
  fetchImpl?: typeof fetch;
  sourceRevision?: string;
  now?: () => number;
  database?: D1Database | null;
}): Promise<LiveBusinessAmenities> {
  if (!Number.isSafeInteger(supplierId) || supplierId <= 0 || !token) throw new Error("invalid_amenity_request");
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  const db = database === undefined ? (fetchImpl === fetch ? await runtimeCatalogDatabase() : null) : database;
  const state = db ? await readSupplierCatalogState(db, "vacations") : null;
  const revision = state?.activeRunId || sourceRevision || "unknown";
  let acceptedDetailAuthoritative = false;
  if (db) {
    if (!state?.activeRunId) throw new Error("catalog_membership_unavailable");
    // Pin a single indexed membership read to the same generation used in the
    // cache key. A read error must never resurrect a withdrawn place's facts.
    const published = await db.prepare(`SELECT supplier_id,
      json_extract(detail_json, '$._viiCatalog.checkedAt') AS checkedAt,
      json_extract(detail_json, '$._viiCatalog.attemptedAt') AS attemptedAt FROM supplier_catalog_entries
      WHERE run_id = ? AND world = ? AND supplier_id = ? LIMIT 1`)
      .bind(state.activeRunId, "vacations", supplierId).first<{ supplier_id: number; checkedAt?:string; attemptedAt?:string }>();
    if (!published) return { groups: [], source: "biz-shared-amenities" };
    const checked=typeof published.checkedAt==='string'?Date.parse(published.checkedAt):NaN;
    const attempted=typeof published.attemptedAt==='string'?Date.parse(published.attemptedAt):NaN;
    // A searchable ID index is not proof of complete shared-place groups.
    // Only the full-detail contract may retire the verified migrated groups.
    acceptedDetailAuthoritative=Number.isFinite(checked)&&checked>0&&checked<=now()&&Number.isFinite(attempted)&&attempted>=checked&&attempted<=now();
  }
  const cached = await cachedBusinessAmenities({ supplierId, token, sourceRevision: revision, db, fetchImpl, now, load: async () => {
    const detailResponse = await fetchImpl(`https://bizonline.co.il/api/ai/vii/vacations/${supplierId}`, { headers, cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!detailResponse.ok) throw new Error("supplier_amenities_unavailable");
    const detail = record(await detailResponse.json());
    if (detail.id !== supplierId) throw new Error("invalid_supplier_place");
    if (detail.active === false) return { groups: [], source: "biz-shared-amenities" };
    if (detail.active !== true) throw new Error("invalid_supplier_place");
    const taxonomy = await cachedAmenityTaxonomy({ token, db, fetchImpl, now, sourceRevision: revision });
    const index = buildSergeyAmenityIndex(taxonomy.value);
    const detailGroups = sergeyAmenityGroups(detail.shared_amenities, index);
    if (detailGroups.length) return { groups: detailGroups, source: "biz-shared-amenities" };

  // Biz may publish the shared place taxonomy in the list contract before the
  // detail contract catches up. The list still carries official amenity IDs;
  // use it only when the detail contract has no usable shared groups. Room
  // amenities are deliberately never used here.
    const list = await cachedSharedAmenityList({ token, db, fetchImpl, now, sourceRevision: revision });
    const listGroups = sergeyAmenityGroups(list.value[String(supplierId)], index);
    if (listGroups.length) return { groups: listGroups, source: "biz-shared-amenities" };
    const migratedGroups = acceptedDetailAuthoritative ? [] : legacyPlaceFeatureGroups(`vacation-${supplierId}`) || [];
    if (migratedGroups.length) return { groups: migratedGroups, source: "migrated-vii-place-amenities" };
    return { groups: [], source: "biz-shared-amenities" };
  }});
  return cached.value;
}
