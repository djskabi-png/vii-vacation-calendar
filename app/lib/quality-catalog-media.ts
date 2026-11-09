import { storedGalleryContentType, validGalleryFilename } from './gallery-media-identity.ts';

export type MediaCatalogWorld = 'vacations' | 'events' | 'rooms' | 'spa';
type Check = { catalogMediaWorld?: MediaCatalogWorld; route: string; timeoutMs: number };
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const sources = (value: unknown): string[] => Array.isArray(value) ? value.filter((src): src is string => typeof src === 'string' && Boolean(src.trim())) : [];

export function rotatingMediaSample(ids: readonly number[], slot: number) {
  const sorted = [...ids].sort((a, b) => a - b);
  const count = Math.min(3, sorted.length);
  return Array.from({ length: count }, (_, i) => sorted[(slot * 3 + i) % sorted.length]);
}

function permittedMedia(src: string, origin: string, world: MediaCatalogWorld) {
  let url: URL;
  try { url = new URL(src, origin); } catch { return null; }
  if (url.username || url.password || url.search || url.hash) return null;
  const sameOrigin = url.origin === new URL(origin).origin && url.pathname.startsWith('/api/vii/media/');
  const officialSpa = world === 'spa' && url.protocol === 'https:' && url.hostname === 'www.spaplus.co.il' && url.port === '' && url.pathname.startsWith('/gallery/');
  if (!sameOrigin && !officialSpa) return null;
  try { return validGalleryFilename(decodeURIComponent(url.pathname.slice(url.pathname.lastIndexOf('/') + 1))) ? url : null; } catch { return null; }
}

/** Bounded read-only sampling. Success certifies this sample, not the entire catalog. */
export async function executeCatalogMediaCheck(check: Check, origin: string, fetcher: typeof fetch, signal?: AbortSignal) {
  const started = Date.now();
  const url = new URL(check.route, origin).href;
  const controller = new AbortController();
  const deadline = AbortSignal.any([controller.signal, AbortSignal.timeout(check.timeoutMs), ...(signal ? [signal] : [])]);
  const observations: string[] = [];
  const fail = (observed: string) => ({ status: 'failed' as const, statusCode: null, durationMs: Date.now() - started, observed, url });
  const request = (target: string | URL, init: RequestInit = {}) => {
    deadline.throwIfAborted();
    return fetcher(String(target), { ...init, redirect: 'manual', headers: { accept: init.method === 'HEAD' ? 'image/avif,image/webp,image/png,image/jpeg' : 'application/json', 'user-agent': 'VII-Quality-Monitor/2.0' }, signal: deadline });
  };
  const json = async (response: Response) => {
    if (!response.ok || !/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) throw Error('invalid_json_response:' + response.status);
    return await response.json() as unknown;
  };
  try {
    const world = check.catalogMediaWorld;
    if (!world || check.route !== '/api/catalog?world=' + world) return fail('catalog:contract_mismatch');
    const payload = await json(await request(url));
    if (!record(payload) || !Array.isArray(payload.entries) || !payload.entries.length) return fail('catalog:empty');
    if (payload.entries.some(entry => !record(entry) || !Number.isSafeInteger(entry.supplierId) || Number(entry.supplierId) < 1)) return fail('catalog:invalid_id');
    const ids = payload.entries.map(entry => Number(entry.supplierId));
    if (new Set(ids).size !== ids.length) return fail('catalog:duplicate_id');
    const slot = Math.floor(started / (6 * 60 * 60 * 1000));
    const sample = rotatingMediaSample(ids, slot);
    let cursor = 0, mediaCount = 0;
    async function worker() {
      while (cursor < sample.length) {
        const id = sample[cursor++];
        const body = await json(await request(new URL('/api/catalog?world=' + world + '&id=' + id, origin)));
        if (!record(body) || !record(body.entry) || body.entry.supplierId !== id) { observations.push(id + ':detail:identity_or_shape'); continue; }
        // The hourly and Spa Plus adapters keep their place fields in summary;
        // their detail slot is intentionally null. VII vacation/event units
        // have a separate, required supplier detail object.
        const detail = record(body.entry.detail) ? body.entry.detail : (world === 'rooms' || world === 'spa') && record(body.entry.summary) ? body.entry.summary : null;
        if (!detail) { observations.push(id + ':detail:identity_or_shape'); continue; }
        // Spa Plus exposes its authoritative gallery under `summary.gallery`,
        // while the other catalog worlds use `images`. Keep the worlds
        // separate, but do not report a false no-media failure for a valid
        // spa gallery simply because it uses the provider's field name.
        const general = sources(detail.images).length ? sources(detail.images) : world === 'spa' ? sources(detail.gallery) : [];
        const rooms = Array.isArray(detail.rooms) ? detail.rooms.filter(record) : [];
        const unitImages = rooms.flatMap(room => sources(room.images));
        if ((!general.length && !unitImages.length) || (rooms.length > 0 && !unitImages.length)) { observations.push(id + ':no_media' + (rooms.length ? ':units' : '')); continue; }
        const candidates = [...new Set([general[slot % general.length], unitImages[slot % unitImages.length]].filter((src): src is string => Boolean(src)))];
        for (const src of candidates) {
          const mediaUrl = permittedMedia(src, origin, world!);
          if (!mediaUrl) { observations.push(id + ':media:untrusted_url'); continue; }
          const response = await request(mediaUrl, { method: 'HEAD' });
          mediaCount++;
          const length = response.headers.get('content-length');
          if (!response.ok || !storedGalleryContentType(response.headers.get('content-type')) || (length !== null && (!/^\d+$/.test(length) || Number(length) <= 0))) observations.push(id + ':media:' + response.status + ':invalid_or_missing_image');
        }
      }
    }
    // The quality runner already executes three checks concurrently. Keep
    // subrequests sequential so the new probes cannot multiply that budget.
    await worker();
    return observations.length ? fail(observations.join('; ').slice(0, 500)) : { status: 'passed' as const, statusCode: 200, durationMs: Date.now() - started, observed: `catalog:${world}; rotating_sample:${sample.length}; media_checked:${mediaCount}; not_full_catalog`, url };
  } catch (error) {
    controller.abort();
    return fail(error instanceof Error ? error.message.slice(0, 500) : 'catalog_media_failure');
  }
}
