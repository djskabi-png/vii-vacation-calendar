import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { backendSourceMetadataResponse } from "../../../lib/backend-source-metadata.ts";
import type { D1Database } from "../../../../types/cloudflare-runtime";

const dependencies = {
  authorized: async (request: Request) => !!await authorizedAdminSession(request),
  database: async (): Promise<D1Database> => {
    const { env } = await import("cloudflare:workers");
    const db = (env as unknown as { DB?: D1Database }).DB;
    if (!db) throw new Error("database_unavailable");
    return db;
  },
};

export function GET(request: Request) { return backendSourceMetadataResponse(request, dependencies); }
export function POST(request: Request) { return backendSourceMetadataResponse(request, dependencies); }
