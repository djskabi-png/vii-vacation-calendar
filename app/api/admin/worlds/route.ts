import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { controllableWorlds, readWorldAvailability, setWorldAvailability, type ControllableWorld } from "../../../lib/world-availability.ts";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(request: Request) {
  if (!await authorizedAdminSession(request).catch(() => null)) return Response.json({ error: "forbidden" }, { status: 403, headers });
  return Response.json({ worlds: await readWorldAvailability() }, { headers });
}

export async function POST(request: Request) {
  const session = await authorizedAdminSession(request).catch(() => null);
  if (!session) return Response.json({ error: "forbidden" }, { status: 403, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "invalid_origin" }, { status: 403, headers });
  const body = await request.json().catch(() => null) as { world?: unknown; enabled?: unknown } | null;
  if (!body || typeof body.world !== "string" || !controllableWorlds.includes(body.world as ControllableWorld) || typeof body.enabled !== "boolean") {
    return Response.json({ error: "invalid_request" }, { status: 400, headers });
  }
  try {
    return Response.json({ worlds: await setWorldAvailability(body.world as ControllableWorld, body.enabled, session.email) }, { headers });
  } catch {
    return Response.json({ error: "world_control_unavailable" }, { status: 503, headers });
  }
}
