import { readCatalogBootstrap, projectPublicSearchCatalogEntries } from "./public-catalog-read.ts";
import type { D1Database } from "../../types/cloudflare-runtime";
import { publicVacationSearchProperties } from "./public-vacation-search.ts";
import { publicEventSearchPlaces } from "./public-event-search.ts";
import type { EventPlace, Property } from "../data/site-data.ts";
import { publicCatalogEntryAllowed } from "./public-catalog-policy.ts";

export type PublicSearchCatalogWorld = "vacations" | "events";

export type PublicSearchCatalogSnapshot = {
  world: PublicSearchCatalogWorld;
  source: "runtime";
  fetchedAt: string | null;
  entries: Array<{ supplierId: number; summary: unknown }>;
};

/**
 * Read the same complete accepted generation used by SSR and apply the same
 * publication/editorial projection. This is deliberately a read-only,
 * uncached adapter: availability and booking remain outside this catalog
 * snapshot and the caller retains its existing bundled fallback.
 */
export async function readPublicSearchCatalogSnapshot(
  db: D1Database,
  world: PublicSearchCatalogWorld,
): Promise<PublicSearchCatalogSnapshot | null> {
  try {
    const bootstrap = await readCatalogBootstrap(db, world);
    const state = bootstrap.state;
    const accepted = bootstrap.summaries;
    if (!state?.activeRunId || !accepted || accepted.activeRunId !== state.activeRunId) return null;
    if (!Array.isArray(accepted.entries) || accepted.entries.length !== state.activeCount) return null;
    const ids = new Set<number>();
    for (const entry of accepted.entries) {
      if (!Number.isSafeInteger(entry.supplierId) || entry.supplierId < 1 || ids.has(entry.supplierId)) return null;
      ids.add(entry.supplierId);
    }

    // The accepted generation can contain quarantined supplier rows. They
    // remain part of the completeness proof above, but must be filtered before
    // projection so source IDs stay paired with the projected summaries.
    const visible = accepted.entries.filter((entry) => publicCatalogEntryAllowed(entry.summary));
    const raw = visible.map((entry) => entry.summary);
    const projected = await projectPublicSearchCatalogEntries(world, raw, await bootstrap.overlays);
    const searchProjected = world === "events"
      ? publicEventSearchPlaces(projected as EventPlace[], 1)
      : publicVacationSearchProperties(projected as Property[]);
    if (searchProjected.length !== visible.length) return null;

    return {
      world,
      source: "runtime",
      fetchedAt: accepted.acceptedAt ?? state.acceptedAt ?? null,
      entries: visible.map((entry, index) => ({ supplierId: entry.supplierId, summary: searchProjected[index] })),
    };
  } catch {
    // A partial or malformed accepted generation must fall through to the
    // route's established immutable bundled fallback, never become an empty
    // successful search response.
    return null;
  }
}
