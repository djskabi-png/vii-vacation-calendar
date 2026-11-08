import type { Property } from '../data/site-data.ts';
import { publicCachePolicy, readPublicCache, storePublicCache } from '../../worker/public-response-cache.ts';
import { readBoundedCacheBody } from '../../worker/public-cache-work.ts';
import { readPublicSearchCatalogSnapshot, type PublicSearchCatalogSnapshot } from './public-search-catalog-snapshot.ts';
import { publicCatalogSummaries } from './public-catalog-read.ts';
import { publicVacationSearchProperties } from './public-vacation-search.ts';
import { cloudflareDatabaseForEnv } from './runtime-database.ts';
import { readOnceInServerRequest, serverRequestContext, type ServerRequestContext } from './server-request-reads.ts';

declare const __VII_CACHE_BUILD_ID__: string;
type CacheEnvironment = NonNullable<Parameters<typeof readPublicCache>[1]>;
const pending = new WeakMap<CacheEnvironment, Map<string, Promise<PublicSearchCatalogSnapshot | null>>>();
const apiUrl = 'https://vii.spaplus.co/api/catalog?world=vacations&view=search';
// Regional documents have at most180s of cache lifetime. Reuse only the first
// minute of the existing300s API snapshot, leaving a60s safety margin. A new
// document can never extend an older source snapshot beyond its hard expiry.
export const PUBLIC_SEARCH_REUSE_MIN_REMAINING_MS = 240_000;

function vacationSnapshot(value: unknown): value is PublicSearchCatalogSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as PublicSearchCatalogSnapshot;
  if (snapshot.world !== 'vacations' || snapshot.source !== 'runtime' || !Array.isArray(snapshot.entries)) return false;
  const ids = new Set<number>();
  return snapshot.entries.every(entry => {
    if (!entry || !Number.isSafeInteger(entry.supplierId) || entry.supplierId <= 0 || ids.has(entry.supplierId)) return false;
    ids.add(entry.supplierId);
    const summary = entry.summary as Partial<Property> | null;
    return summary && typeof summary === 'object' && !Array.isArray(summary)
      && summary.slug === `vacation-${entry.supplierId}` && typeof summary.name === 'string'
      && typeof summary.location === 'string' && typeof summary.area === 'string'
      && Array.isArray(summary.features) && Array.isArray(summary.images) && Array.isArray(summary.searchFilterIds);
  });
}

/** Reuse the EXISTING anonymous API cache, not another catalog or TTL. The
 * caller supplies the canonical fresh D1 snapshot on a cache miss. */
export async function reusePublicVacationSearch(options: {
  build: string;
  env: CacheEnvironment;
  context?: ServerRequestContext;
  readFresh: () => Promise<PublicSearchCatalogSnapshot | null>;
}): Promise<Property[] | null> {
  const request = new Request(apiUrl, { headers: { Accept: 'application/json' } });
  const policy = await publicCachePolicy(request, new URL(request.url), options.build);
  if (!policy) return null;
  try {
    // Do not promote an unvalidated R2 body in the background. In particular,
    // an older promotion must not race a newly checked source snapshot.
    const cached = await readPublicCache(policy, options.env);
    if (cached) {
      const until = Number(cached.headers.get('X-VII-Cache-Until'));
      if (until - Date.now() >= PUBLIC_SEARCH_REUSE_MIN_REMAINING_MS) {
        const bytes = await readBoundedCacheBody(cached.body, 2 * 1024 * 1024, 500);
        if (bytes && until - Date.now() >= PUBLIC_SEARCH_REUSE_MIN_REMAINING_MS) {
          const snapshot: unknown = JSON.parse(new TextDecoder().decode(bytes));
          if (vacationSnapshot(snapshot)) return snapshot.entries.map(entry => entry.summary as Property);
        }
      } else void cached.body?.cancel().catch(() => undefined);
    }
  } catch { /* An optional cache never replaces the canonical read below. */ }
  let operations = pending.get(options.env);
  if (!operations) { operations = new Map(); pending.set(options.env, operations); }
  let operation = operations.get(policy.key);
  if (!operation) {
    operation = Promise.resolve().then(async () => {
      const value = await options.readFresh();
      if (!vacationSnapshot(value)) return null;
      if (options.context) storePublicCache(Response.json(value, { headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300',
        'X-VII-Data-Origin': 'cloudflare-d1', 'X-VII-Degraded': 'false',
      } }), policy, options.env, options.context);
      return value;
    });
    operations.set(policy.key, operation);
    const owned = operation;
    void owned.finally(() => { if (operations.get(policy.key) === owned) operations.delete(policy.key); }).catch(() => undefined);
  }
  const fresh = await operation;
  return fresh ? fresh.entries.map(entry => entry.summary as Property) : null;
}

/** Only the regional search DTO uses this cache. Detail pages, gallery
 * readers, booking/availability and other catalog consumers keep their data. */
export function publicRegionalVacationSearch(): Promise<Property[]> {
  return readOnceInServerRequest('public-regional-vacation-search', async () => {
    try {
      const runtimeName = 'cloudflare:workers';
      const runtime = await import(/* @vite-ignore */ runtimeName);
      const db = cloudflareDatabaseForEnv(runtime.env ?? {});
      const build = typeof __VII_CACHE_BUILD_ID__ === 'string' ? __VII_CACHE_BUILD_ID__ : 'local';
      if (db && runtime.env?.UPLOADS && build !== 'local') {
        const items = await reusePublicVacationSearch({ build, env: runtime.env,
          context: serverRequestContext(), readFresh: () => readPublicSearchCatalogSnapshot(db, 'vacations') });
        if (items !== null) return items;
      }
    } catch { /* Preserve the established accepted-generation fallback. */ }
    return publicVacationSearchProperties(await publicCatalogSummaries<Property>('vacations'));
  });
}
