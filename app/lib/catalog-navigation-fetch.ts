import { PUBLIC_CATALOG_NAVIGATION_HEADER, PUBLIC_CATALOG_NAVIGATION_VERSION, isCatalogNavigationHintCandidate } from '../../shared/public-catalog-navigation.ts';

export type ReleaseNavigationRecovery = {
  clientBuild: string;
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  replace(href: string): void;
  now?: () => number;
};

const releaseRecoveryCooldownMs = 60_000;

function requestHeaders(input: RequestInfo | URL, init?: RequestInit) {
  return new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit) {
  return (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
}

function isFlightRequest(url: URL, headers: Headers, response: Response) {
  return url.pathname.endsWith('.rsc')
    || headers.get('RSC') === '1'
    || /\btext\/x-component\b/i.test(headers.get('Accept') || '')
    || /\btext\/x-component\b/i.test(response.headers.get('Content-Type') || '');
}

function documentTarget(url: URL) {
  const target = new URL(url);
  if (target.pathname.endsWith('.rsc')) target.pathname = target.pathname.slice(0, -4) || '/';
  target.searchParams.delete('_rsc');
  return target.href;
}

/** Stop an old client from parsing a newer release's RSC payload. The full
 * document replacement is GET-only, same-origin and guarded once per release
 * pair, so an action is never replayed and a broken route cannot reload-loop. */
async function recoverReleaseMismatch(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  response: Response,
  origin: string,
  recovery: ReleaseNavigationRecovery | undefined,
  memory: { at: number },
) {
  if (!recovery?.clientBuild || recovery.clientBuild === 'local' || requestMethod(input, init) !== 'GET') return false;
  const url = new URL(input instanceof Request ? input.url : String(input), origin);
  if (url.origin !== origin) return false;
  const headers = requestHeaders(input, init);
  if (!isFlightRequest(url, headers, response)) return false;
  const serverBuild = response.headers.get('X-VII-App-Build') || response.headers.get('X-VII-Cache-Build') || '';
  if (!serverBuild || serverBuild === recovery.clientBuild) return false;
  const now = recovery.now?.() ?? Date.now();
  const target = documentTarget(url);
  const key = `vii-release-navigation:${recovery.clientBuild}:${serverBuild}:${new URL(target).pathname}`;
  try {
    const previous = Number(recovery.storage.getItem(key) || 0);
    if (Number.isFinite(previous) && now - previous < releaseRecoveryCooldownMs) return false;
    recovery.storage.setItem(key, String(now));
  } catch {
    if (now - memory.at < releaseRecoveryCooldownMs) return false;
    memory.at = now;
  }
  try { await response.body?.cancel(); } catch { /* The replacement owns the next document. */ }
  recovery.replace(target);
  return true;
}

/** Preserve fetch arguments verbatim unless a fresh public projection can
 * satisfy this exact regional navigation. Never annotate prefetch or refresh. */
export function catalogNavigationFetch(original: typeof fetch, origin: string, fresh: () => boolean, recovery?: ReleaseNavigationRecovery): typeof fetch {
  const releaseRecoveryMemory = { at: 0 };
  return async function(input, init) {
    let forwardedInit = init;
    try {
      const url = new URL(input instanceof Request ? input.url : String(input), origin);
      if (url.origin !== origin) return await original(input, init);
      const headers = requestHeaders(input, init);
      headers.set(PUBLIC_CATALOG_NAVIGATION_HEADER, PUBLIC_CATALOG_NAVIGATION_VERSION);
      const request = new Request(url, { method: requestMethod(input, init), headers });
      if (isCatalogNavigationHintCandidate(request) && fresh()) forwardedInit = { ...init, headers };
    } catch { /* Unsupported input retains native fetch behavior. */
      return await original(input, init);
    }
    const response = await original(input, forwardedInit);
    try {
      if (await recoverReleaseMismatch(input, init, response, origin, recovery, releaseRecoveryMemory)) {
        return await new Promise<Response>(() => { /* document replacement ends this flight */ });
      }
    } catch { /* A recovery diagnostic must never duplicate or block the original request. */ }
    return response;
  };
}
