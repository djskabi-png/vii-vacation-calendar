import type { D1Database } from "../../types/cloudflare-runtime";
import { databaseForRuntimeEnv } from "./aws-database.ts";

export async function runtimeDatabase(): Promise<D1Database | undefined> {
  const runtimeName = "cloudflare:workers";
  const runtime = await import(/* @vite-ignore */ runtimeName);
  return databaseForRuntimeEnv(runtime.env as unknown as {
    DB?: D1Database;
    VII_AWS_DB_ENDPOINT?: string;
    VII_AWS_DB_TOKEN?: string;
    VII_AWS_DB_MODE?: string;
  });
}

export async function requiredRuntimeDatabase(errorCode: string): Promise<D1Database> {
  const database = await runtimeDatabase();
  if (!database) throw new Error(errorCode);
  return database;
}
