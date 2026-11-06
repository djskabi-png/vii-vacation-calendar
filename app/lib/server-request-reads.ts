import { AsyncLocalStorage } from "node:async_hooks";

const requestReads = new AsyncLocalStorage<Map<string,Promise<unknown>>>();
const maximumReads = 32;

/** The Worker creates one store per incoming request. No TTL, global data
 * cache, cookie-derived key, or failed promise survives into another request. */
export function withServerRequestReads<T>(work: () => T): T {
  return requestReads.run(new Map(),work);
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
