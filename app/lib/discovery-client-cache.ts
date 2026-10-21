// Navigation reuse is discovery-only. Final detail and booking checks never use it.
type DiscoveryRequestInit = RequestInit & {
  timeoutMs?: number;
  retries?: number;
  freshMs?: number;
  staleMs?: number;
  persist?: boolean;
};

type Entry = { value: unknown; freshUntil: number; staleUntil: number };
const entries = new Map<string, Entry>();
const storagePrefix = "vii-discovery-v2:";
const defaultTimeoutMs = 5_000;
const defaultFreshMs = 120_000;
const defaultStaleMs = 86_400_000;
let initialDocumentReady: Promise<void> | undefined;

/** Start discovery I/O immediately, but never commit a cached or network
 * result while React is still hydrating streamed HTML. Fast cache responses
 * used to win that race and replace rail text before its boundary hydrated. */
function waitForInitialDocument(): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") return Promise.resolve();
  if (initialDocumentReady) return initialDocumentReady;
  initialDocumentReady = new Promise((resolve) => {
    const afterLoad = () => requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });
  });
  return initialDocumentReady;
}

class DiscoveryResponseError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("discovery_unavailable");
    this.status = status;
  }
}

function clone<T>(value: unknown) {
  return structuredClone(value) as T;
}

function storageKey(key: string) {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${storagePrefix}${(hash >>> 0).toString(36)}`;
}

function readPersisted(key: string): Entry | undefined {
  if (typeof sessionStorage === "undefined") return undefined;
  try {
    const stored = sessionStorage.getItem(storageKey(key));
    if (!stored) return undefined;
    const parsed = JSON.parse(stored) as { key?: unknown; entry?: Partial<Entry> };
    const entry = parsed.entry;
    if (parsed.key !== key || !entry || !("value" in entry) || !Number.isFinite(entry.freshUntil)
      || !Number.isFinite(entry.staleUntil) || Number(entry.staleUntil) <= Date.now()) {
      sessionStorage.removeItem(storageKey(key));
      return undefined;
    }
    return { value: entry.value, freshUntil: Number(entry.freshUntil), staleUntil: Number(entry.staleUntil) };
  } catch { return undefined; }
}

function remember(key: string, entry: Entry, persist: boolean) {
  entries.delete(key);
  entries.set(key, entry);
  while (entries.size > 64) entries.delete(entries.keys().next().value!);
  if (!persist || typeof sessionStorage === "undefined") return;
  try {
    const encoded = JSON.stringify({ key, entry });
    if (encoded.length <= 350_000) sessionStorage.setItem(storageKey(key), encoded);
  } catch { /* A storage quota or privacy mode must not break discovery. */ }
}

function timeoutError() {
  return new DOMException("Discovery request timed out", "TimeoutError");
}

async function fetchWithDeadline(url: string, init: RequestInit, timeoutMs: number) {
  const callerSignal = init.signal;
  if (callerSignal?.aborted) throw callerSignal.reason ?? new DOMException("Aborted", "AbortError");
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(callerSignal?.reason ?? new DOMException("Aborted", "AbortError"));
  callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = timeoutError();
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([fetch(url, { ...init, signal: controller.signal }), deadline]);
  } finally {
    if (timer) clearTimeout(timer);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function discoveryJson<T>(url: string, scope: string, init: DiscoveryRequestInit = {}): Promise<T> {
  const {
    timeoutMs = defaultTimeoutMs,
    retries = 1,
    freshMs = defaultFreshMs,
    staleMs = defaultStaleMs,
    persist = false,
    ...requestInit
  } = init;
  const key = JSON.stringify([url, scope, requestInit.body ?? null]);
  const previous = entries.get(key) ?? (persist ? readPersisted(key) : undefined);
  if (previous) {
    entries.delete(key);
    entries.set(key, previous);
  }
  const method = (requestInit.method || "GET").toUpperCase();
  const allowedRetries = method === "GET" ? Math.max(0, Math.min(1, Math.trunc(retries))) : 0;
  const boundedTimeout = Math.max(10, Math.min(20_000, Math.trunc(timeoutMs)));
  const load = async () => {
    let failure: unknown;
    for (let attempt = 0; attempt <= allowedRetries; attempt += 1) {
      if (requestInit.signal?.aborted) throw requestInit.signal.reason ?? new DOMException("Aborted", "AbortError");
      try {
        // The second read-only attempt deliberately bypasses a possibly wedged
        // browser HTTP-cache path. POST/live transaction checks never retry.
        const response = await fetchWithDeadline(url, {
          ...requestInit,
          cache: attempt ? "reload" : requestInit.cache ?? (method === "GET" ? "default" : "no-store"),
        }, boundedTimeout);
        if (!response.ok) throw new DiscoveryResponseError(response.status);
        const value = await response.json();
        if (requestInit.signal?.aborted) throw requestInit.signal.reason ?? new DOMException("Aborted", "AbortError");
        const now = Date.now();
        remember(key, { value, freshUntil: now + Math.max(1, freshMs), staleUntil: now + Math.max(freshMs, staleMs) }, persist && method === "GET");
        return clone<T>(value);
      } catch (error) {
        if (requestInit.signal?.aborted) throw requestInit.signal.reason ?? new DOMException("Aborted", "AbortError");
        failure = error;
        if (error instanceof DiscoveryResponseError && error.status < 500) break;
      }
    }
    if (previous && previous.staleUntil > Date.now()) return clone<T>(previous.value);
    throw failure ?? new Error("discovery_unavailable");
  };
  const release = async <Value>(pending: Promise<Value> | Value) => {
    const result = await pending;
    await waitForInitialDocument();
    if (requestInit.signal?.aborted) throw requestInit.signal.reason ?? new DOMException("Aborted", "AbortError");
    return result;
  };
  if (requestInit.signal?.aborted) throw requestInit.signal.reason ?? new DOMException("Aborted", "AbortError");
  if (previous?.freshUntil && previous.freshUntil > Date.now()) return release(clone<T>(previous.value));
  if (previous?.staleUntil && previous.staleUntil > Date.now()) {
    void load().catch(() => {});
    return release(clone<T>(previous.value));
  }
  return release(load());
}
