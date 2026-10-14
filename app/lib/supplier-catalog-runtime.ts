import sergey from "../data/sergey-public-catalog.json" with { type: "json" };
import sergeyDetails from "../data/sergey-place-details.json" with { type: "json" };
import hourly from "../data/sergey-hourly-catalog.json" with { type: "json" };
import spa from "../data/spaplus-catalog.json" with { type: "json" };
import type { D1Database } from "../../types/cloudflare-runtime";
import { createSergeyPublicCatalogClient } from "./sergey-public-catalog-client.ts";
import { createSergeyRoomsCatalogClient } from "./sergey-rooms-catalog-client.ts";
import { createSpaPlusCatalogClient } from "./spaplus-catalog-client.ts";
import { runSupplierCatalogSync } from "./supplier-catalog-sync.ts";
import { validateSpaEditorialCandidate } from "./spa-editorial-policy.ts";
import type { SupplierCatalogEntry, SupplierCatalogWorld } from "./supplier-catalog-store.ts";

export const catalogWorlds: SupplierCatalogWorld[] = ["vacations", "events", "rooms", "spa"];

export function isCatalogWorld(value: unknown): value is SupplierCatalogWorld {
  return typeof value === "string" && catalogWorlds.includes(value as SupplierCatalogWorld);
}

export function bundledCatalogBaseline(world: SupplierCatalogWorld): SupplierCatalogEntry[] {
  if (world === "spa") return spa.sites.map((summary) => ({ supplierId: summary.id, summary }));
  if (world === "rooms") return hourly.places.map((summary) => ({ supplierId: summary.supplierId, summary }));
  return sergey.places.filter((summary) => summary.world === world).map((summary) => ({
    supplierId: summary.supplierId,
    summary,
    detail: (sergeyDetails.details as Record<string, unknown>)[`${world === "vacations" ? "vacation" : "event"}-${summary.supplierId}`] || null,
  }));
}

async function secret(name: "SERGEY_VII_API_TOKEN" | "SPAPLUS_VII_API_KEY") {
  try {
    const runtime = await import("cloudflare:workers");
    const value = (runtime.env as unknown as Record<string, string | undefined>)[name];
    if (value) return value;
  } catch { /* Local tests have no Cloudflare bindings. */ }
  return process.env[name] || "";
}

export async function syncSupplierCatalogWorld(db: D1Database, world: SupplierCatalogWorld,
  source: "manual" | "scheduled" | "retry", options?: { fetchImpl?: typeof fetch; now?: () => Date; runId?: string }) {
  const apiKey = await secret(world === "spa" ? "SPAPLUS_VII_API_KEY" : "SERGEY_VII_API_TOKEN");
  const client = world === "spa"
    ? createSpaPlusCatalogClient({ apiKey, fetchImpl: options?.fetchImpl })
    : world === "rooms"
      ? createSergeyRoomsCatalogClient({ apiKey, fetchImpl: options?.fetchImpl })
      : createSergeyPublicCatalogClient({ apiKey, fetchImpl: options?.fetchImpl });
  return runSupplierCatalogSync(db, {
    id: options?.runId || crypto.randomUUID(), world, source,
    baseline: bundledCatalogBaseline(world),
    validateCandidate: world === "spa" ? validateSpaEditorialCandidate : undefined,
    fetchCandidate: () => world === "vacations" || world === "events"
      ? (client as ReturnType<typeof createSergeyPublicCatalogClient>).fetchCandidate(world)
      : (client as ReturnType<typeof createSpaPlusCatalogClient> | ReturnType<typeof createSergeyRoomsCatalogClient>).fetchCandidate(),
    now: options?.now,
  });
}
