import { readSession } from "../../../lib/google-auth.ts";
import { contentStudioSources, publicContentPath } from "../../../lib/content-studio-inventory.ts";
import { contentItemId, createContentItem, ensureContentItems, isContentLocale, isContentType, parseContentChange, parseContentCreate, readContentItem, readContentVersions, readOriginalContentItems, saveContentItem } from "../../../lib/content-studio.ts";
import type { D1Database } from "../../../../types/cloudflare-runtime";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
async function actor(request: Request) {
  const session = await readSession(request).catch(() => null);
  const allowed = (process.env.VII_ADMIN_EMAILS || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  return session && allowed.includes(session.email.toLowerCase()) ? session.email : null;
}
async function database(): Promise<D1Database> {
  const runtime = await import("cloudflare:workers"); const db = (runtime.env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("content_studio_database_unavailable"); return db;
}

export async function GET(request: Request) {
  if (!await actor(request)) return Response.json({ error: "forbidden" }, { status: 403, headers });
  try {
    const url = new URL(request.url); const requestedLocale = url.searchParams.get("locale");
    const locale = isContentLocale(requestedLocale) ? requestedLocale : "he";
    const requestedType = url.searchParams.get("type"); if (requestedType && !isContentType(requestedType)) return Response.json({ error: "invalid_type" }, { status: 400, headers });
    const selectedType = isContentType(requestedType) ? requestedType : null;
    if (!selectedType) return Response.json({ error: "type_required" }, { status: 400, headers });
    const db = await database(); const allSources = (await contentStudioSources(db, locale)).filter((item) => item.type === selectedType);
    const term = (url.searchParams.get("q") || "").normalize("NFC").trim().toLocaleLowerCase("he").slice(0, 100);
    const matchingSources = term ? allSources.filter((item) => `${item.title} ${item.key}`.toLocaleLowerCase("he").includes(term)) : allSources;
    const pageSources = matchingSources.slice(0, 80); const selectedId = url.searchParams.get("id");
    const selectedSource = selectedId ? allSources.find((item) => contentItemId(item.type, item.key, locale) === selectedId) : undefined;
    const seeded = await ensureContentItems(db, selectedSource && !pageSources.includes(selectedSource) ? [...pageSources, selectedSource] : pageSources);
    const originals = await readOriginalContentItems(db, selectedType, locale);
    const itemMap = new Map([...seeded, ...originals].map((item) => [item.id, item])); const items = [...itemMap.values()];
    const selected = selectedId ? itemMap.get(selectedId) || await readContentItem(db, selectedId) : null;
    if (selectedId && !selected) return Response.json({ error: "not_found" }, { status: 404, headers });
    const total = matchingSources.length + originals.filter((item) => !allSources.some((source) => contentItemId(source.type, source.key, locale) === item.id)).length;
    const counts = { [selectedType]: total };
    return Response.json({ items: items.map((item) => ({ ...item, publicPath: publicContentPath(item.contentType, item.entityKey) })), counts,
      total, truncated: total > items.length, selected: selected ? { ...selected, publicPath: publicContentPath(selected.contentType, selected.entityKey), versions: await readContentVersions(db, selected.id) } : null }, { headers });
  } catch (error) { console.error("VII content studio unavailable", error); return Response.json({ error: "content_studio_unavailable" }, { status: 503, headers }); }
}

export async function POST(request: Request) {
  const email = await actor(request); if (!email) return Response.json({ error: "forbidden" }, { status: 403, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "invalid_origin" }, { status: 403, headers });
  try {
    const raw = await request.text(); if (raw.length > 80_000) return Response.json({ error: "too_large" }, { status: 413, headers });
    const payload = JSON.parse(raw) as unknown; const db = await database(); const create = parseContentCreate(payload);
    const result = create ? await createContentItem(db, create, email) : await (async () => {
      const change = parseContentChange(payload); if (!change) return { error: "invalid_content" as const };
      return saveContentItem(db, change, email);
    })();
    if ("error" in result) return Response.json(result, { status: result.error === "not_found" ? 404 : result.error === "invalid_content" ? 400 : 409, headers });
    return Response.json(result, { headers });
  } catch (error) { console.error("VII content studio save unavailable", error); return Response.json({ error: "content_studio_unavailable" }, { status: 503, headers }); }
}
