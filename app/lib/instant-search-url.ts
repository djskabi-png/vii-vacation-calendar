import { managedSearchParams } from "./managed-search-params.ts";

const booleanSearchKeys = new Set(["pool", "spa", "whole", "accessible", "online"]);

/**
 * Updates filters that are already computed from the in-memory catalog without
 * navigating to and rendering another route. The current pathname is retained
 * so a landing page keeps its approved content while the explicit query values
 * override its semantic defaults and remain shareable/reload-safe.
 */
export function instantSearchHref(
  pathname: string,
  currentSearch: string,
  initial: Record<string, string | number | boolean> | undefined,
  updates: Record<string, string | null>,
) {
  const params = managedSearchParams(currentSearch, initial);
  const explicitParams = new URLSearchParams(currentSearch);
  params.delete("dates");

  for (const [key, value] of Object.entries(updates)) {
    if (value !== null) {
      params.set(key, value);
      continue;
    }

    const implicitBooleanDefault = booleanSearchKeys.has(key) && !explicitParams.has(key) && params.get(key) === "1";
    if (implicitBooleanDefault || initial && Object.prototype.hasOwnProperty.call(initial, key)) {
      // An absent query cannot remove an initial landing-page default. Keep an
      // explicit neutral override so reload and browser history reproduce the
      // visible state instead of silently re-enabling the filter.
      params.set(key, booleanSearchKeys.has(key) ? "0" : "");
    } else {
      params.delete(key);
    }
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
