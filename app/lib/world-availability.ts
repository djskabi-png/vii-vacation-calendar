import { requiredRuntimeDatabase } from "./runtime-database.ts";
import { forgetServerRequestRead, readOnceInServerRequest } from "./server-request-reads.ts";

export const controllableWorlds = ["vacation", "events", "corporate", "spa", "hourly", "providers", "trails", "attractions", "gift-card"] as const;
export type ControllableWorld = typeof controllableWorlds[number];
export type WorldAvailability = Record<ControllableWorld, boolean>;

export const defaultWorldAvailability = Object.fromEntries(controllableWorlds.map((id) => [id, true])) as WorldAvailability;

let initialized: Promise<Awaited<ReturnType<typeof requiredRuntimeDatabase>>> | null = null;
let cached: { until: number; value: WorldAvailability } | null = null;
const publicReadTimeoutMs = 350;
const publicCacheTtlMs = 60_000;

async function runtimeDatabase() {
  return requiredRuntimeDatabase("world_availability_unavailable");
}

async function database() {
  const db = await runtimeDatabase();
  if (!initialized) initialized = (async () => {
    await db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS vii_world_availability (
      world TEXT PRIMARY KEY NOT NULL, enabled INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL, updated_by TEXT NOT NULL
      )`),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_vii_world_availability_enabled ON vii_world_availability(enabled)"),
    ]);
    return db;
  })();
  return initialized;
}

export async function readWorldAvailability(): Promise<WorldAvailability> {
  if (cached && cached.until > Date.now()) return { ...cached.value };
  return { ...await readOnceInServerRequest("world-availability", async () => {
    // The layout and the home page both ask for this state. Deduplicate only
    // within the current request; the isolate cache remains
    // the cross-request fast path and setter invalidation remains authoritative.
    if (cached && cached.until > Date.now()) return { ...cached.value };
    try {
      let deadline: ReturnType<typeof setTimeout> | undefined;
      const rows = await Promise.race([
        (await runtimeDatabase()).prepare("SELECT world, enabled FROM vii_world_availability").all<{ world: string; enabled: number }>(),
        new Promise<null>(resolve => { deadline = setTimeout(() => resolve(null), publicReadTimeoutMs); }),
      ]).finally(() => { if (deadline) clearTimeout(deadline); });
      if (!rows) return { ...defaultWorldAvailability };
      const state = { ...defaultWorldAvailability };
      for (const row of rows.results) if (controllableWorlds.includes(row.world as ControllableWorld)) state[row.world as ControllableWorld] = row.enabled === 1;
      cached = { until: Date.now() + publicCacheTtlMs, value: state };
      return { ...state };
    } catch {
      return { ...defaultWorldAvailability };
    }
  }) };
}

export async function setWorldAvailability(world: ControllableWorld, enabled: boolean, actor: string) {
  const db = await database();
  await db.prepare(`INSERT INTO vii_world_availability (world, enabled, updated_at, updated_by) VALUES (?, ?, ?, ?)
    ON CONFLICT(world) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
    .bind(world, enabled ? 1 : 0, new Date().toISOString(), actor.slice(0, 200)).run();
  cached = null;
  forgetServerRequestRead("world-availability");
  return readWorldAvailability();
}

export function worldForPath(pathname: string): ControllableWorld | null {
  const path = pathname.replace(/^\/(en|fr|ru)(?=\/|$)/, "") || "/";
  if (path === "/" || path.startsWith("/search")) return "vacation";
  if (path.startsWith("/events")) return "events";
  if (path.startsWith("/corporate")) return "corporate";
  if (path.startsWith("/spas") || path.startsWith("/spa")) return "spa";
  if (path.startsWith("/hourly")) return "hourly";
  if (path.startsWith("/providers")) return "providers";
  if (path.startsWith("/trails")) return "trails";
  if (path.startsWith("/attractions")) return "attractions";
  if (path.startsWith("/gift-card")) return "gift-card";
  return null;
}
