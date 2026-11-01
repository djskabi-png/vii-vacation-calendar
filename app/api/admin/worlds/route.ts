import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { controllableWorlds, readWorldAvailability, setWorldAvailability, type ControllableWorld } from "../../../lib/world-availability.ts";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export function requestOriginMatches(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  let originUrl: URL;
  try { originUrl = new URL(origin); } catch { return false; }
  const direct = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim() || direct.host;
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol ? `${forwardedProtocol}:` : direct.protocol;
  return originUrl.origin === direct.origin || (originUrl.host === host && originUrl.protocol === protocol);
}

export async function GET(request: Request) {
  if (!await authorizedAdminSession(request).catch(() => null)) return Response.json({ error: "forbidden" }, { status: 403, headers });
  return Response.json({ worlds: await readWorldAvailability() }, { headers });
}

export async function POST(request: Request) {
  const session = await authorizedAdminSession(request).catch(() => null);
  if (!session) return Response.json({ error: "forbidden" }, { status: 403, headers });
  if (!requestOriginMatches(request)) return Response.json({ error: "invalid_origin" }, { status: 403, headers });
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
