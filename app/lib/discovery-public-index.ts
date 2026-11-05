import type { D1Database } from '../../types/cloudflare-runtime';
import { acceptedSergeySummaries } from './accepted-bundled-catalog.ts';
import { publicCatalogEntryAllowed } from './public-catalog-policy.ts';

type World = 'vacations' | 'events';
export type DiscoveryPublicPlace = { supplierId: number; name: string; location?: string; area?: string; lat?: number; lng?: number };
type Row = { activeRunId: string | null; activeCount: number | null; supplierId: number | null; name: string | null; location: string | null; area: string | null; lat: number | null; lng: number | null };

function project(values: readonly unknown[]) {
  const places = values.filter(publicCatalogEntryAllowed).map(value => {
    const row=value as DiscoveryPublicPlace;
    return {supplierId:row.supplierId,name:row.name,...(row.location ? {location:row.location}:{}),...(row.area ? {area:row.area}:{}),
      ...(Number.isFinite(row.lat) ? {lat:row.lat}:{}),...(Number.isFinite(row.lng) ? {lng:row.lng}:{})};
  });
  return { places, publishedIds:new Set(places.map(place=>place.supplierId)) as ReadonlySet<number> };
}

/** Publication and region checks do not require gallery arrays, descriptions,
 * editorial bodies or private detail_json. One joined read pins the generation
 * and its complete inventory together, without a selected-card count limit. */
export async function publicDiscoveryCatalogIndex(world: World, db: D1Database | null) {
  const fallback=()=>project(acceptedSergeySummaries(world));
  if (!db) return fallback();
  let rows: Row[];
  try {
    rows=(await db.prepare(`SELECT s.active_run_id AS activeRunId,s.active_count AS activeCount,
      e.supplier_id AS supplierId,
      COALESCE(json_extract(e.summary_json,'$.name'),json_extract(e.summary_json,'$.title')) AS name,
      json_extract(e.summary_json,'$.location') AS location,json_extract(e.summary_json,'$.area') AS area,
      json_extract(e.summary_json,'$.lat') AS lat,json_extract(e.summary_json,'$.lng') AS lng
      FROM supplier_catalog_state s LEFT JOIN supplier_catalog_entries e
        ON e.run_id=s.active_run_id AND e.world=s.world
      WHERE s.world=? ORDER BY e.supplier_id`).bind(world).all<Row>()).results;
  } catch { return fallback(); }
  if (!rows[0]?.activeRunId) return fallback();
  const actual=rows.filter(row=>row.supplierId!==null);
  if (actual.length!==rows[0].activeCount) throw new Error('catalog_active_generation_incomplete');
  const ids=actual.map(row=>row.supplierId);
  if (ids.some(id=>!Number.isSafeInteger(id) || Number(id)<1) || new Set(ids).size!==ids.length) {
    throw new Error('catalog_active_generation_invalid_identity');
  }
  return project(actual);
}
