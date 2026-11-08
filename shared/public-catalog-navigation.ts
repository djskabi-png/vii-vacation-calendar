/** An optional progressive navigation hint, never a new public cache variant. */
export const PUBLIC_CATALOG_NAVIGATION_HEADER = 'X-VII-Catalog-Navigation';
export const PUBLIC_CATALOG_NAVIGATION_VERSION = 'search-v1';

const regionalPath = /^(?:\/(?:en|ru|fr))?\/vacations\/(?:north|kinneret|western-galilee|haifa-carmel|center|tel-aviv|tel-aviv-area|jerusalem|dead-sea|south-negev|eilat)\.rsc$/;

export function hasCatalogNavigationHint(headers: Headers): boolean {
  return headers.get(PUBLIC_CATALOG_NAVIGATION_HEADER) === PUBLIC_CATALOG_NAVIGATION_VERSION
    && (headers.get('rsc') === '1' || (headers.get('accept') || '').includes('text/x-component'))
    && !headers.has('authorization') && !headers.has('next-action') && !headers.has('x-server-action')
    && !headers.has('next-router-prefetch') && !headers.has('next-router-segment-prefetch')
    && !headers.has('purpose') && !headers.has('sec-purpose')
    && ['', 'navigation'].includes(headers.get('x-vinext-rsc-render-mode') || '');
}

/** Cookie/query eligibility belongs to each delivery layer's existing policy. */
export function isCatalogNavigationHintCandidate(request: Request): boolean {
  if (request.method !== 'GET' || !hasCatalogNavigationHint(request.headers)) return false;
  const url = new URL(request.url);
  if (!regionalPath.test(url.pathname)) return false;
  const origin = request.headers.get('origin');
  return !origin || origin === url.origin;
}
