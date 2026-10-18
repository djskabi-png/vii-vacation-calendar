import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { createStagingHealthClient, readStagingHealthConfiguration } from "../../../../infrastructure/http/staging-site-client.mjs";

export const dynamic = "force-dynamic";
const handle = createStagingHealthClient({
  authorize: async (request: Request) => !!await authorizedAdminSession(request),
  getCredentials: async () => {
    let workerValue: string | undefined;
    try {
      const { env } = await import("cloudflare:workers");
      workerValue = (env as unknown as { VII_STAGE_HEALTH_CONFIG?: string }).VII_STAGE_HEALTH_CONFIG;
    } catch { /* The supported Site secret channel remains server-only. */ }
    return readStagingHealthConfiguration(workerValue, process.env.VII_STAGE_HEALTH_CONFIG);
  },
});

export function GET(request: Request) { return handle(request); }
export function POST(request: Request) { return handle(request); }
export function PUT(request: Request) { return handle(request); }
export function DELETE(request: Request) { return handle(request); }
export function PATCH(request: Request) { return handle(request); }
export function OPTIONS(request: Request) { return handle(request); }
export function HEAD(request: Request) { return handle(request); }
