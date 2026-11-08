import { AsyncLocalStorage } from "node:async_hooks";

const requestReads = new AsyncLocalStorage<Map<string,Promise<unknown>>>();
const maximumReads = 32;
export type ServerRequestContext = { waitUntil(work: Promise<unknown>): void };
const requestContexts = new WeakMap<Map<string, Promise<unknown>>, ServerRequestContext>();

/** The Worker creates one store per incoming request. No TTL, global data
 * cache, cookie-derived key, or failed promise survives into another request. */
export function withServerRequestReads<T>(work: () => T, context?: ServerRequestContext): T {
  const reads = new Map<string, Promise<unknown>>();
  if (context) requestContexts.set(reads, context);
  return requestReads.run(reads,work);
}

export function serverRequestContext(): ServerRequestContext | undefined {
  const reads = requestReads.getStore();
  return reads ? requestContexts.get(reads) : undefined;
}

export function readOnceInServerRequest<T>(key: string, load: () => Promise<T>): Promise<T> {
  const store=requestReads.getStore();
  if(!store || !key || key.length>512)return Promise.resolve().then(load);
  const existing=store.get(key);
  if(existing)return existing as Promise<T>;
  if(store.size>=maximumReads)return Promise.resolve().then(load);
  const value=Promise.resolve().then(load);
  store.set(key,value);
  return value;
}

/** Forget one request-local read after an intentional same-request mutation. */
export function forgetServerRequestRead(key: string): void {
  const store = requestReads.getStore();
  if (store && key) store.delete(key);
}
