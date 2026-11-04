import type { D1Database } from "../../types/cloudflare-runtime";
import { d1FallbackForRuntimeEnv } from "./aws-database.ts";

type RuntimeDatabaseEnvironment = { DB?: D1Database };

/** VII's approved authority is Cloudflare D1 (4 November 2026).
 * Stale migration variables must never switch canonical writes, reports or
 * scheduled tasks to another provider. The AWS adapter remains migration-only.
 */
export function cloudflareDatabaseForEnv(env: RuntimeDatabaseEnvironment): D1Database | undefined {
  return d1FallbackForRuntimeEnv(env);
}

export async function runtimeDatabase(): Promise<D1Database | undefined> {
  const runtimeName = "cloudflare:workers";
  const runtime = await import(/* @vite-ignore */ runtimeName);
  return cloudflareDatabaseForEnv(runtime.env ?? {});
}

export type ReportingDatabase = {
  database: D1Database;
  origin: "cloudflare-d1";
  degraded: boolean;
};

export async function reportingDatabaseForEnv(env: RuntimeDatabaseEnvironment): Promise<ReportingDatabase> {
  const database = cloudflareDatabaseForEnv(env);
  if (!database) throw new Error("reporting_database_unavailable");
  return { database, origin: "cloudflare-d1", degraded: false };
}

export async function reportingDatabase(): Promise<ReportingDatabase> {
  const runtimeName = "cloudflare:workers";
  const runtime = await import(/* @vite-ignore */ runtimeName);
  return reportingDatabaseForEnv(runtime.env ?? {});
}

export async function publicCatalogDatabaseForEnv(env: RuntimeDatabaseEnvironment,
  _now = Date.now()): Promise<ReportingDatabase> {
  const database = cloudflareDatabaseForEnv(env);
  if (!database) throw new Error("public_catalog_database_unavailable");
  return { database, origin: "cloudflare-d1", degraded: false };
}

export async function publicCatalogDatabase(): Promise<ReportingDatabase> {
  const runtimeName = "cloudflare:workers";
  const runtime = await import(/* @vite-ignore */ runtimeName);
  return publicCatalogDatabaseForEnv(runtime.env ?? {});
}

// Compatibility for callers of the former migration circuit. No remote probe runs.
export function resetPublicCatalogDatabaseCircuitForTests() {}

export async function runtimeD1Database(): Promise<D1Database> {
  const database = await runtimeDatabase();
  if (!database) throw new Error("d1_database_unavailable");
  return database;
}

export async function requiredRuntimeDatabase(errorCode: string): Promise<D1Database> {
  const database = await runtimeDatabase();
  if (!database) throw new Error(errorCode);
  return database;
}
