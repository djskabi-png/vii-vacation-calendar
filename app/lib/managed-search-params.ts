/** Canonical page intent participates in every state restore and URL update.
 * Explicit visitor query values override the initial semantic defaults. */
export function managedSearchParams(query: string, initial?: Record<string, string | number | boolean>) {
  const params = new URLSearchParams();
  for (const [key,value] of Object.entries(initial || {})) if (value !== false && value != null) params.set(key,value === true ? "1" : String(value));
  for (const [key,value] of new URLSearchParams(query)) params.set(key,value);
  // Pool has one visible toggle. Avoid retaining a second hidden feature that
  // would silently re-enable the filter when the visitor removes that toggle.
  const features = (params.get("features") || "").split(",").filter(Boolean);
  if (features.includes("pool")) {
    if (!params.has("pool")) params.set("pool","1");
    const extra = features.filter(id => id !== "pool");
    if (extra.length) params.set("features",extra.join(",")); else params.delete("features");
  }
  return params;
}
