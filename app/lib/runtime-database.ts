import type { D1Database } from "../../types/cloudflare-runtime";
import { databaseForRuntimeEnv, d1FallbackForRuntimeEnv } from "./aws-database.ts";

export async function runtimeDatabase(): Promise<D1Database | undefined> {
  const runtimeName = "cloudflare:workers";
  const runtime = await import(/* @vite-ignore */ runtimeName);
  return databaseForRuntimeEnv((runtime.env ?? {}) as unknown as {
    DB?: D1Database;
    VII_AWS_DB_ENDPOINT?: string;
    VII_AWS_DB_TOKEN?: string;
    VII_AWS_DB_MODE?: string;
  });
}

export type ReportingDatabase = {
  database: D1Database;
  origin: "aws-aurora" | "cloudflare-d1";
  degraded: boolean;
};

const PUBLIC_CATALOG_AURORA_REPROBE_MS = 5 * 60 * 1000;
let publicCatalogAuroraOpenUntil = 0;
let publicCatalogAuroraProbe: Promise<ReportingDatabase> | null = null;

type RuntimeDatabaseEnvironment = {
  DB?: D1Database;
  VII_AWS_DB_ENDPOINT?: string;
  VII_AWS_DB_TOKEN?: string;
  VII_AWS_DB_MODE?: string;
};

/**
 * Reporting and derived caches may keep serving from the bound D1 replica when
 * the Aurora bridge is unavailable. This helper must not be used for bookings,
 * grants, supplier publication or any other canonical write path: falling back
 * there would create two writable sources of truth.
 */
export async function reportingDatabaseForEnv(env: RuntimeDatabaseEnvironment): Promise<ReportingDatabase> {
  const database = databaseForRuntimeEnv(env);
  if (!database) throw new Error("reporting_database_unavailable");
  const fallback = d1FallbackForRuntimeEnv(env);
  if (database === fallback) return { database, origin: "cloudflare-d1", degraded: false };
  try {
    await database.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    return { database, origin: "aws-aurora", degraded: false };
  } catch (error) {
    if (!fallback || fallback === database) throw error;
    console.error("reporting_database_using_d1_fallback", {
      reason: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    });
    return { database: fallback, origin: "cloudflare-d1", degraded: true };
  }
}

export async function reportingDatabase(): Promise<ReportingDatabase> {
  const runtimeName = "cloudflare:workers";
  const runtime = await import(/* @vite-ignore */ runtimeName);
  return reportingDatabaseForEnv((runtime.env ?? {}) as unknown as RuntimeDatabaseEnvironment);
}

/**
 * Public catalog reads are allowed to use the bound D1 replica when Aurora is
 * unavailable. Unlike reportingDatabase(), this path has a short circuit
 * breaker: a failed bridge must not add two remote retries to every public
 * search, slider and place-page request. One request probes Aurora again after
 * the cooldown; the remaining requests keep serving the accepted D1 catalog.
 *
 * This helper is read-only by contract. Supplier publication, bookings,
 * grants and every canonical write continue to use runtimeDatabase() and stay
 * fail-closed when Aurora is configured as primary.
 */
export async function publicCatalogDatabaseForEnv(env: RuntimeDatabaseEnvironment,
  now = Date.now()): Promise<ReportingDatabase> {
  const database = databaseForRuntimeEnv(env);
  if (!database) throw new Error("public_catalog_database_unavailable");
  const fallback = d1FallbackForRuntimeEnv(env);
  if (database === fallback) return { database, origin: "cloudflare-d1", degraded: false };
  if (fallback && publicCatalogAuroraOpenUntil > now) {
    return { database: fallback, origin: "cloudflare-d1", degraded: true };
  }
  if (!publicCatalogAuroraProbe) {
    publicCatalogAuroraProbe = (async () => {
      try {
        await database.prepare("SELECT 1 AS ok").first<{ ok: number }>();
        publicCatalogAuroraOpenUntil = 0;
        return { database, origin: "aws-aurora" as const, degraded: false };
      } catch (error) {
        if (!fallback || fallback === database) throw error;
        publicCatalogAuroraOpenUntil = now + PUBLIC_CATALOG_AURORA_REPROBE_MS;
        console.error("public_catalog_database_using_d1_fallback", {
          reason: error instanceof Error ? error.message.slice(0, 160) : "unknown",
          reprobeAfterMs: PUBLIC_CATALOG_AURORA_REPROBE_MS,
        });
        return { database: fallback, origin: "cloudflare-d1" as const, degraded: true };
      } finally {
        publicCatalogAuroraProbe = null;
      }
    })();
  }
  return publicCatalogAuroraProbe;
}

export async function publicCatalogDatabase(): Promise<ReportingDatabase> {
  const runtimeName = "cloudflare:workers";
  const runtime = await import(/* @vite-ignore */ runtimeName);
  return publicCatalogDatabaseForEnv((runtime.env ?? {}) as unknown as RuntimeDatabaseEnvironment);
}

export function resetPublicCatalogDatabaseCircuitForTests() {
  publicCatalogAuroraOpenUntil = 0;
  publicCatalogAuroraProbe = null;
}

/**
 * Small derived administration features such as Professor quota and question
 * history live in the bound D1 database. They must not depend on the Aurora
 * bridge: a reporting outage must not erase the answer UI, consume an
 * uncertain quota write or prevent a verified read from being returned.
 */
export async function runtimeD1Database(): Promise<D1Database> {
  const runtimeName = "cloudflare:workers";
  const runtime = await import(/* @vite-ignore */ runtimeName);
  const env = (runtime.env ?? {}) as unknown as RuntimeDatabaseEnvironment;
  const database = d1FallbackForRuntimeEnv(env);
  if (!database) throw new Error("d1_database_unavailable");
  return database;
}

export async function requiredRuntimeDatabase(errorCode: string): Promise<D1Database> {
  const database = await runtimeDatabase();
  if (!database) throw new Error(errorCode);
  return database;
}
