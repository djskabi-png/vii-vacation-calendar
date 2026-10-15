import { readSession } from "../../../lib/google-auth.ts";
import { isAdminEmail } from "../../../lib/admin-access.ts";
import { fetchSupplierGeography, geographyDatabase, parseGeographyChange, readGeography, refreshGeography, saveGeographyNode } from "../../../lib/geography-admin.ts";
import { supplierToken } from "../../../lib/vii-supplier-token.ts";
import type { D1Database } from "../../../../types/cloudflare-runtime";

const responseHeaders = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

async function admin(request: Request) {
  const session = await readSession(request).catch(() => null);
  return session && isAdminEmail(session.email) ? session.email : null;
}

async function database() {
  const runtime = await import("cloudflare:workers");
  const db = (runtime.env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("geography_database_unavailable");
  return geographyDatabase(db);
}

export async function GET(request: Request) {
  if (!await admin(request)) return Response.json({ error: "forbidden" }, { status: 403, headers: responseHeaders });
  try {
    const nodes = await readGeography(await database());
    return Response.json({
      nodes,
      counts: Object.fromEntries(["district", "area", "city"].map((level) => [level, nodes.filter((node) => node.level === level).length])),
      unassigned: nodes.filter((node) => node.unassigned).length,
      withCoordinates: nodes.filter((node) => node.level === "city" && node.gpsLat !== null && node.gpsLong !== null).length,
    }, { headers: responseHeaders });
  } catch (error) {
    console.error("VII geography administration unavailable", error);
    return Response.json({ error: "geography_unavailable" }, { status: 503, headers: responseHeaders });
  }
}

export async function POST(request: Request) {
  const actor = await admin(request);
  if (!actor) return Response.json({ error: "forbidden" }, { status: 403, headers: responseHeaders });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "invalid_origin" }, { status: 403, headers: responseHeaders });
  let input: unknown;
  try {
    const body = await request.text();
    if (body.length > 20_000) return Response.json({ error: "too_large" }, { status: 413, headers: responseHeaders });
    input = JSON.parse(body);
  } catch { return Response.json({ error: "invalid_input" }, { status: 400, headers: responseHeaders }); }
  const row = input && typeof input === "object" ? input as Record<string, unknown> : {};
  try {
    const db = await database();
    if (row.action === "refresh") {
      const result = await refreshGeography(db, await fetchSupplierGeography(await supplierToken()), actor);
      return Response.json({ ...result, nodes: await readGeography(db) }, { headers: responseHeaders });
    }
    if (row.action !== "save") return Response.json({ error: "invalid_action" }, { status: 400, headers: responseHeaders });
    const change = parseGeographyChange(row.node);
    if (!change) return Response.json({ error: "invalid_node" }, { status: 400, headers: responseHeaders });
    const result = await saveGeographyNode(db, change, actor);
    if ("error" in result) return Response.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 409, headers: responseHeaders });
    return Response.json(result, { headers: responseHeaders });
  } catch (error) {
    console.error("VII geography change unavailable", error);
    return Response.json({ error: "geography_unavailable" }, { status: 503, headers: responseHeaders });
  }
}
