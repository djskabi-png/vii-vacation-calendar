import { PUBLIC_CATALOG_NAVIGATION_HEADER, PUBLIC_CATALOG_NAVIGATION_VERSION, isCatalogNavigationHintCandidate } from '../../shared/public-catalog-navigation.ts';

/** Preserve fetch arguments verbatim unless a fresh public projection can
 * satisfy this exact regional navigation. Never annotate prefetch or refresh. */
export function catalogNavigationFetch(original: typeof fetch, origin: string, fresh: () => boolean): typeof fetch {
  return function(input, init) {
    try {
      const url = new URL(input instanceof Request ? input.url : String(input), origin);
      if (url.origin !== origin) return original(input, init);
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      headers.set(PUBLIC_CATALOG_NAVIGATION_HEADER, PUBLIC_CATALOG_NAVIGATION_VERSION);
      const request = new Request(url, { method: init?.method ?? (input instanceof Request ? input.method : 'GET'), headers });
      if (isCatalogNavigationHintCandidate(request) && fresh()) return original(input, { ...init, headers });
    } catch { /* Unsupported input retains native fetch behavior. */ }
    return original(input, init);
  };
}
