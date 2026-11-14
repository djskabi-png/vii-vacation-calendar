import type { D1Database } from "../../types/cloudflare-runtime";
import { requiredRuntimeDatabase } from "./runtime-database.ts";
import { readOnceInServerRequest } from "./server-request-reads.ts";

export type PublicSearchContent = { title: string; metaTitle: string; metaDescription: string; h1: string; summary: string; body: string; faq: Array<{ question: string; answer: string }> };
/** Read the approved snapshot, never the editable draft. No schema writes on a public request. */
export async function readPublicSearchContent(db: D1Database, path: string, now = new Date().toISOString()): Promise<PublicSearchContent | null> {
  let row = await db.prepare(`SELECT snapshot_json AS snapshotJson, opportunity_id AS opportunityId, scheduled_at AS scheduledAt FROM vii_search_page_publications
    WHERE canonical_path = ? LIMIT 1`)
    .bind(path).first<{ snapshotJson: string; opportunityId?: string; scheduledAt?: string }>();
  if (!row) return null;
  if (row.scheduledAt && row.scheduledAt > now) {
    const previous = await db.prepare(`SELECT snapshot_json AS snapshotJson FROM vii_search_page_opportunity_versions
      WHERE opportunity_id = ? AND (action = 'published' OR (action = 'scheduled' AND json_extract(snapshot_json, '$.scheduledAt') <= ?))
      AND json_extract(snapshot_json, '$.canonicalPath') = ? ORDER BY version DESC LIMIT 1`)
      .bind(row.opportunityId, now, path).first<{ snapshotJson: string }>();
    if (!previous) return null;
    row = previous;
  }
  let value: Record<string, unknown>;
  try { value = JSON.parse(row.snapshotJson); } catch { return null; }
  if (!value || value.canonicalPath !== path || value.robotsIndex !== true) return null;
  const text = (key: string, max: number) => typeof value[key] === "string" ? (value[key] as string).slice(0, max) : "";
  return { title: text("title", 90), metaTitle: text("metaTitle", 70), metaDescription: text("metaDescription", 180),
    h1: text("h1", 100), summary: text("summary", 420), body: text("body", 30_000),
    faq: Array.isArray(value.faq) ? value.faq.slice(0, 20).flatMap(item => item && typeof item.question === "string" && typeof item.answer === "string"
      ? [{ question: item.question.slice(0, 180), answer: item.answer.slice(0, 600) }] : []) : [] };
}

export function publicSearchContent(path: string): Promise<PublicSearchContent | null> {
  return readOnceInServerRequest(`public-search-content:${path}`, async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // A slow editorial store must not hold the complete existing regional page.
      return await Promise.race([requiredRuntimeDatabase("search_content_unavailable").then(db => readPublicSearchContent(db, path)),
        new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 350); })]);
    } catch { return null; }
    finally { if (timer) clearTimeout(timer); }
  });
}
