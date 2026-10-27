import type { D1Database } from "../../types/cloudflare-runtime";
import { databaseForRuntimeEnv } from "./aws-database.ts";

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
  if (database === env.DB) return { database, origin: "cloudflare-d1", degraded: false };
  try {
    await database.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    return { database, origin: "aws-aurora", degraded: false };
  } catch (error) {
    if (!env.DB) throw error;
    console.error("reporting_database_using_d1_fallback", {
      reason: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    });
    return { database: env.DB, origin: "cloudflare-d1", degraded: true };
  }
}

export async function reportingDatabase(): Promise<ReportingDatabase> {
  const runtimeName = "cloudflare:workers";
  const runtime = await import(/* @vite-ignore */ runtimeName);
  return reportingDatabaseForEnv((runtime.env ?? {}) as unknown as RuntimeDatabaseEnvironment);
}

export async function requiredRuntimeDatabase(errorCode: string): Promise<D1Database> {
  const database = await runtimeDatabase();
  if (!database) throw new Error(errorCode);
  return database;
}
