import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { createStagingHealthClient } from "../../../../infrastructure/http/staging-site-client.mjs";

export const dynamic = "force-dynamic";
const handle = createStagingHealthClient({
  authorize: async (request: Request) => !!await authorizedAdminSession(request),
  getCredentials: async () => {
    const { env } = await import("cloudflare:workers");
    const raw = (env as unknown as { VII_STAGE_HEALTH_CONFIG?: string }).VII_STAGE_HEALTH_CONFIG;
    if (typeof raw !== "string" || raw.length > 2048) throw new Error("private_health_unavailable");
    return JSON.parse(raw);
  },
});

export function GET(request: Request) { return handle(request); }
export function POST(request: Request) { return handle(request); }
export function PUT(request: Request) { return handle(request); }
export function DELETE(request: Request) { return handle(request); }
export function PATCH(request: Request) { return handle(request); }
export function OPTIONS(request: Request) { return handle(request); }
export function HEAD(request: Request) { return handle(request); }
