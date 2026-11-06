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

/** Keep an approved landing URL when the visitor only changes presentation.
 * Semantic filter changes must continue through the canonical search builder. */
export function managedPresentationHref(landingPath: string | undefined, currentSearch: string, updates: Record<string, string | null>) {
  if (!landingPath || Object.keys(updates).some(key => key !== "sort")) return null;
  const params = managedSearchParams(currentSearch);
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === "recommended") params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  return query ? `${landingPath}?${query}` : landingPath;
}
