import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { PromotionDraftError, promotionWorlds, readPromotionDraftDashboard, savePromotionDraft } from "../../../lib/discovery-promotion-drafts.ts";
import { readSupplierCatalogEntry, type SupplierCatalogWorld } from "../../../lib/supplier-catalog-store.ts";
import type { D1Database } from "../../../../types/cloudflare-runtime";
import { requiredRuntimeDatabase } from "../../../lib/runtime-database.ts";

const headers = { "Cache-Control": "no-store" };

async function adminEmail(request: Request) {
  try {
    const session = await authorizedAdminSession(request);
    return session ? session.email.toLowerCase() : null;
  } catch { return null; }
}

async function database(): Promise<D1Database> {
  return requiredRuntimeDatabase("promotion_database_unavailable");
}

export async function GET(request: Request) {
  if (!await adminEmail(request)) return Response.json({ error: "forbidden" }, { status: 403, headers });
  try {
    const url = new URL(request.url);
    if (url.searchParams.has("world") || url.searchParams.has("id")) {
      const world = url.searchParams.get("world") as SupplierCatalogWorld;
      const id = Number(url.searchParams.get("id"));
      if (!promotionWorlds.includes(world) || !Number.isSafeInteger(id) || id < 1) {
        return Response.json({ error: "invalid_place" }, { status: 400, headers });
      }
      const entry = await readSupplierCatalogEntry(await database(), world, id);
      if (!entry) return Response.json({ error: "place_not_published" }, { status: 404, headers });
      const summary = entry.summary as Record<string, unknown>;
      const name = typeof summary.name === "string" ? summary.name : summary.title;
      return Response.json({ world, supplierId: id, name }, { headers });
    }
    return Response.json(await readPromotionDraftDashboard(await database()), { headers });
  }
  catch {
    return Response.json({ error: "promotion_storage_unavailable" }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  const actor = await adminEmail(request);
  if (!actor) return Response.json({ error: "forbidden" }, { status: 403, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "invalid_origin" }, { status: 403, headers });
  }
  let input: unknown;
  try {
    const body = await request.text();
    if (body.length > 4096) return Response.json({ error: "request_too_large" }, { status: 413, headers });
    input = JSON.parse(body);
  } catch { return Response.json({ error: "invalid_request" }, { status: 400, headers }); }
  try { return Response.json(await savePromotionDraft(await database(), input, actor), { headers }); }
  catch (error) {
    if (error instanceof PromotionDraftError) {
      return Response.json({ error: error.code }, { status: error.status, headers });
    }
    return Response.json({ error: "promotion_storage_unavailable" }, { status: 503, headers });
  }
}
