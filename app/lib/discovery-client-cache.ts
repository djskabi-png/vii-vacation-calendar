// Navigation reuse is discovery-only. Final detail and booking checks never use it.
const entries = new Map<string, { value: unknown; expires: number }>();
export async function discoveryJson<T>(url: string, scope: string, init: RequestInit = {}): Promise<T> {
  const key = JSON.stringify([url, scope, init.body ?? null]);
  const previous = entries.get(key);
  if (previous && previous.expires > Date.now()) return structuredClone(previous.value) as T;
  const response = await fetch(url, { ...init, cache: "no-store" });
  if (!response.ok) throw new Error("discovery_unavailable");
  const value = await response.json();
  if (init.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  entries.delete(key);
  entries.set(key, { value, expires: Date.now() + 120_000 });
  while (entries.size > 64) entries.delete(entries.keys().next().value!);
  return structuredClone(value) as T;
}
