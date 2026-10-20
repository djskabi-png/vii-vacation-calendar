import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { catalogSnapshotResponse } from "../../../lib/catalog-snapshot.ts";
import type { D1Database } from "../../../../types/cloudflare-runtime";
import { requiredRuntimeDatabase } from "../../../lib/runtime-database.ts";

const dependencies = {
  authorized: async (request: Request) => !!await authorizedAdminSession(request),
  database: async (): Promise<D1Database> => {
    return requiredRuntimeDatabase("database_unavailable");
  },
};
export function GET(request: Request) { return catalogSnapshotResponse(request, dependencies); }
export function POST(request: Request) { return catalogSnapshotResponse(request, dependencies); }
