import { discoveryJson } from './discovery-client-cache.ts';

type CatalogEntry = { entries: Array<{ summary: unknown }> };
const pending = new Map<string, Promise<CatalogEntry>>();

function valid(value: unknown): value is CatalogEntry {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as CatalogEntry).entries)
    && (value as CatalogEntry).entries.every(entry => entry && typeof entry === 'object' && entry.summary && typeof entry.summary === 'object'));
}

/** Only the two public search projections share reads. Gallery card requests,
 * other world projections and live transaction endpoints retain their policy.
 * The shared operation has its own body-inclusive deadline. A departing view
 * detaches its subscriber without cancelling another view's catalog request. */
export function fetchPublishedSearchCatalog(world: 'vacations' | 'events', signal?: AbortSignal): Promise<CatalogEntry> {
  if (world !== 'vacations' && world !== 'events') return Promise.reject(new Error('invalid_catalog_world'));
  if (signal?.aborted) return Promise.reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
  const url = `/api/catalog?world=${world}&view=search`;
  let operation = pending.get(url);
  if (!operation) {
    operation = discoveryJson<CatalogEntry>(url, 'published-catalog-search-v1', {
      freshMs: 60_000, staleMs: 270_000, staleWhileRevalidate: false,
      timeoutMs: 10_000, totalTimeoutMs: 10_000, retries: 0, persist: false,
      validateResponse: valid,
    });
    pending.set(url, operation);
    const owned = operation;
    void owned.finally(() => { if (pending.get(url) === owned) pending.delete(url); }).catch(() => undefined);
  }
  if (!signal) return operation;
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(signal.reason ?? new DOMException('Aborted', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    operation.then(value => { signal.removeEventListener('abort', abort); if (!signal.aborted) resolve(value); }, error => { signal.removeEventListener('abort', abort); if (!signal.aborted) reject(error); });
  });
}
