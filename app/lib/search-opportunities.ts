import type { D1Database } from "../../types/cloudflare-runtime";
import { searchPageDatabase, searchPageDefinitions, searchPageInventory } from "./search-page-content.ts";
import { searchAnalyticsDatabase } from "./search-analytics.ts";

export const opportunityStatuses = ["pending", "draft", "review", "scheduled", "published", "archived"] as const;
export type OpportunityStatus = (typeof opportunityStatuses)[number];

export type SearchOpportunity = {
  id: string;
  origin: "search" | "managed";
  world: string;
  locale: string;
  location: string;
  filters: Record<string, string | number | boolean>;
  sourcePath: string;
  proposedPath: string;
  suggestedTitle: string;
  latestResultCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  searches: number;
  uniqueSessions: number;
  zeroResults: number;
  status: OpportunityStatus;
  assignee: string | null;
  title: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  summary: string;
  body: string;
  faq: Array<{ question: string; answer: string }>;
  slug: string;
  canonicalPath: string;
  robotsIndex: boolean;
  scheduledAt: string | null;
  publishedAt: string | null;
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
  readiness: number;
  priority: number;
};

type OpportunityRow = {
  id: string; canonicalKey: string; world: string; locale: string; location: string; filtersJson: string;
  sourcePath: string; proposedPath: string; suggestedTitle: string; latestResultCount: number;
  firstSeenAt: string; lastSeenAt: string; searchCount: number; zeroResultCount: number; status: OpportunityStatus;
  assignee: string | null; title: string | null; metaTitle: string | null; metaDescription: string | null;
  h1: string | null; summary: string | null; body: string | null; faqJson: string; slug: string | null;
  canonicalPath: string | null; robotsIndex: number; scheduledAt: string | null; publishedAt: string | null;
  version: number; updatedAt: string | null; updatedBy: string | null; periodSearches: number; uniqueSessions: number; periodZeroResults: number;
};

function safeJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function fieldReady(row: Pick<SearchOpportunity, "title" | "metaTitle" | "metaDescription" | "h1" | "summary" | "body" | "slug">) {
  return [row.title.length >= 8, row.metaTitle.length >= 8, row.metaDescription.length >= 40,
    row.h1.length >= 8, row.summary.length >= 30, row.body.length >= 120, /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug)];
}

export function opportunityReadiness(row: Pick<SearchOpportunity, "title" | "metaTitle" | "metaDescription" | "h1" | "summary" | "body" | "slug">) {
  const checks = fieldReady(row);
  return Math.round(checks.filter(Boolean).length / checks.length * 100);
}

function hydrate(row: OpportunityRow): SearchOpportunity {
  const filters = safeJson<Record<string, string | number | boolean>>(row.filtersJson, {});
  const faq = safeJson<Array<{ question: string; answer: string }>>(row.faqJson, []);
  const slug = row.slug || row.proposedPath.split("/").filter(Boolean).at(-1) || row.id;
  const content = {
    title: row.title || row.suggestedTitle,
    metaTitle: row.metaTitle || row.title || row.suggestedTitle,
    metaDescription: row.metaDescription || "",
    h1: row.h1 || row.title || row.suggestedTitle,
    summary: row.summary || "",
    body: row.body || "",
    slug,
  };
  const searches = Number(row.periodSearches ?? row.searchCount ?? 0);
  const uniqueSessions = Number(row.uniqueSessions ?? 0);
  const zeroResults = Number(row.periodZeroResults ?? row.zeroResultCount ?? 0);
  return {
    id: row.id,
    origin: row.canonicalKey.startsWith("managed:") ? "managed" : "search",
    world: row.world, locale: row.locale, location: row.location,
    filters, sourcePath: row.sourcePath, proposedPath: row.proposedPath, suggestedTitle: row.suggestedTitle,
    latestResultCount: Number(row.latestResultCount || 0), firstSeenAt: row.firstSeenAt, lastSeenAt: row.lastSeenAt,
    searches, uniqueSessions, zeroResults, status: row.status, assignee: row.assignee,
    ...content, faq, canonicalPath: row.canonicalPath || row.proposedPath, robotsIndex: row.robotsIndex === 1,
    scheduledAt: row.scheduledAt, publishedAt: row.publishedAt, version: Number(row.version || 0),
    updatedAt: row.updatedAt, updatedBy: row.updatedBy,
    readiness: opportunityReadiness(content),
    priority: searches * 4 + uniqueSessions * 2 + Math.min(zeroResults, 10) + (row.latestResultCount > 0 ? 6 : 0),
  };
}

async function stableManagedId(path: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(path));
  const hash = Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `managed-${hash.slice(0, 24)}`;
}

async function seedManagedPages(db: D1Database) {
  const legacy = await searchPageInventory(await searchPageDatabase());
  const now = new Date().toISOString();
  const statements = await Promise.all(legacy.map(async (page) => {
    const content = page.override;
    const status = content?.status || "published";
    const path = page.path;
    const slug = path.split("/").filter(Boolean).join("-") || "home";
    return db.prepare(`INSERT OR IGNORE INTO vii_search_page_opportunities
      (id, canonical_key, world, location, filters_json, source_path, proposed_path, suggested_title,
       latest_result_count, first_seen_at, last_seen_at, status, title, meta_title, meta_description, h1,
       summary, body, slug, canonical_path, robots_index, scheduled_at, published_at, version, updated_at, updated_by)
      VALUES (?, ?, ?, ?, '{}', ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, 1, ?, ?, ?, ?, ?)`)
      .bind(await stableManagedId(path), `managed:${path}`, page.world, path, path, path, page.title, now, now,
        status, content?.title || page.title, content?.title || page.title, content?.description || page.description,
        content?.title || page.title, content?.description || page.description, slug, path,
        content?.scheduledAt || null, status === "published" ? content?.updatedAt || now : null,
        content?.version || 0, content?.updatedAt || now, content?.updatedBy || "system-migration");
  }));
  if (statements.length) await db.batch(statements);
}

export async function opportunityDatabase() {
  const db = await searchAnalyticsDatabase();
  await seedManagedPages(db);
  return db;
}

const selectColumns = `o.id, o.canonical_key AS canonicalKey, o.world, o.locale, o.location,
  o.filters_json AS filtersJson, o.source_path AS sourcePath, o.proposed_path AS proposedPath,
  o.suggested_title AS suggestedTitle, o.latest_result_count AS latestResultCount,
  o.first_seen_at AS firstSeenAt, o.last_seen_at AS lastSeenAt, o.search_count AS searchCount,
  o.zero_result_count AS zeroResultCount, o.status, o.assignee, o.title, o.meta_title AS metaTitle,
  o.meta_description AS metaDescription, o.h1, o.summary, o.body, o.faq_json AS faqJson, o.slug,
  o.canonical_path AS canonicalPath, o.robots_index AS robotsIndex, o.scheduled_at AS scheduledAt,
  o.published_at AS publishedAt, o.version, o.updated_at AS updatedAt, o.updated_by AS updatedBy`;

export async function readOpportunityDashboard(db: D1Database, days: number) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const [rows, globalUnique] = await Promise.all([db.prepare(`SELECT ${selectColumns},
    COALESCE((SELECT COUNT(*) FROM vii_search_demand_events e WHERE e.opportunity_id = o.id AND e.internal = 0 AND e.created_at >= ?), 0) AS periodSearches,
    COALESCE((SELECT COUNT(DISTINCT e.session_id) FROM vii_search_demand_events e WHERE e.opportunity_id = o.id AND e.internal = 0 AND e.created_at >= ? AND e.session_id IS NOT NULL), 0) AS uniqueSessions,
    COALESCE((SELECT COUNT(*) FROM vii_search_demand_events e WHERE e.opportunity_id = o.id AND e.internal = 0 AND e.created_at >= ? AND e.zero_result = 1), 0) AS periodZeroResults
    FROM vii_search_page_opportunities o ORDER BY o.last_seen_at DESC`).bind(since, since, since).all<OpportunityRow>(),
    db.prepare("SELECT COUNT(DISTINCT session_id) AS count FROM vii_search_demand_events WHERE internal = 0 AND created_at >= ? AND session_id IS NOT NULL").bind(since).first<{ count: number }>(),
  ]);
  const opportunities = rows.results.map(hydrate).sort((a, b) => b.priority - a.priority || b.searches - a.searches || b.lastSeenAt.localeCompare(a.lastSeenAt));
  const statusCounts = Object.fromEntries(opportunityStatuses.map((status) => [status, opportunities.filter((item) => item.status === status).length]));
  return {
    periodDays: days,
    generatedAt: new Date().toISOString(),
    metrics: {
      recordedSearches: opportunities.reduce((sum, item) => sum + item.searches, 0),
      uniqueSessions: Number(globalUnique?.count || 0),
      pending: statusCounts.pending + statusCounts.draft + statusCounts.review,
      published: statusCounts.published,
      zeroResultSearches: opportunities.reduce((sum, item) => sum + item.zeroResults, 0),
    },
    statusCounts,
    opportunities,
  };
}

export async function readOpportunity(db: D1Database, id: string) {
  const row = await db.prepare(`SELECT ${selectColumns}, o.search_count AS periodSearches,
    (SELECT COUNT(DISTINCT e.session_id) FROM vii_search_demand_events e WHERE e.opportunity_id = o.id AND e.internal = 0 AND e.session_id IS NOT NULL) AS uniqueSessions,
    o.zero_result_count AS periodZeroResults FROM vii_search_page_opportunities o WHERE o.id = ?`).bind(id).first<OpportunityRow>();
  if (!row) return null;
  const versions = await db.prepare(`SELECT version, action, actor_email AS actorEmail, created_at AS createdAt, snapshot_json AS snapshotJson
    FROM vii_search_page_opportunity_versions WHERE opportunity_id = ? ORDER BY version DESC LIMIT 30`).bind(id).all<{ version: number; action: string; actorEmail: string; createdAt: string; snapshotJson: string }>();
  return { opportunity: hydrate(row), versions: versions.results.map((version) => ({ ...version, snapshot: safeJson(version.snapshotJson, {}) })) };
}

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length <= max && !/[<>]/.test(text) ? text : null;
}

export function parseOpportunityChange(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || row.id.length > 80 || !Number.isSafeInteger(row.expectedVersion) || Number(row.expectedVersion) < 0 ||
    typeof row.status !== "string" || !opportunityStatuses.includes(row.status as OpportunityStatus)) return null;
  const title = cleanText(row.title, 90); const metaTitle = cleanText(row.metaTitle, 70);
  const metaDescription = cleanText(row.metaDescription, 180); const h1 = cleanText(row.h1, 100);
  const summary = cleanText(row.summary, 420); const body = cleanText(row.body, 8000);
  const slug = cleanText(row.slug, 120); const assignee = cleanText(row.assignee, 120) || "";
  if ([title, metaTitle, metaDescription, h1, summary, body, slug].some((field) => field === null) || !slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const faq = Array.isArray(row.faq) ? row.faq.slice(0, 8).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const question = cleanText((item as Record<string, unknown>).question, 180);
    const answer = cleanText((item as Record<string, unknown>).answer, 600);
    return question && answer ? [{ question, answer }] : [];
  }) : [];
  const status = row.status as OpportunityStatus;
  const scheduled = typeof row.scheduledAt === "string" && row.scheduledAt ? new Date(row.scheduledAt) : null;
  if (status === "scheduled" && (!scheduled || !Number.isFinite(scheduled.getTime()) || scheduled.getTime() <= Date.now())) return null;
  const content = { title: title!, metaTitle: metaTitle!, metaDescription: metaDescription!, h1: h1!, summary: summary!, body: body!, slug };
  if ((status === "published" || status === "scheduled" || status === "review") && opportunityReadiness(content) < 100) return null;
  return { id: row.id, expectedVersion: Number(row.expectedVersion), status, assignee, ...content, faq,
    robotsIndex: row.robotsIndex === true, scheduledAt: scheduled?.toISOString() || null };
}

export async function saveOpportunity(db: D1Database, change: NonNullable<ReturnType<typeof parseOpportunityChange>>, actor: string) {
  const prior = await db.prepare("SELECT version, status, proposed_path AS proposedPath FROM vii_search_page_opportunities WHERE id = ?").bind(change.id).first<{ version: number; status: string; proposedPath: string }>();
  if (!prior) return { error: "not_found" as const };
  if (prior.version !== change.expectedVersion) return { error: "version_conflict" as const };
  const version = prior.version + 1;
  const at = new Date().toISOString();
  const canonicalPath = `/find/${change.slug}`;
  const publishedAt = change.status === "published" ? at : null;
  const snapshot = { ...change, version, canonicalPath, publishedAt, updatedAt: at, updatedBy: actor };
  await db.batch([
    db.prepare(`UPDATE vii_search_page_opportunities SET status = ?, assignee = ?, title = ?, meta_title = ?,
      meta_description = ?, h1 = ?, summary = ?, body = ?, faq_json = ?, slug = ?, canonical_path = ?, robots_index = ?,
      scheduled_at = ?, published_at = CASE WHEN ? = 'published' THEN ? WHEN ? = 'archived' THEN NULL ELSE published_at END,
      version = ?, updated_at = ?, updated_by = ? WHERE id = ? AND version = ?`)
      .bind(change.status, change.assignee || null, change.title, change.metaTitle, change.metaDescription, change.h1,
        change.summary, change.body, JSON.stringify(change.faq), change.slug, canonicalPath, change.robotsIndex ? 1 : 0,
        change.scheduledAt, change.status, publishedAt, change.status, version, at, actor, change.id, change.expectedVersion),
    db.prepare(`INSERT INTO vii_search_page_opportunity_versions
      (id, opportunity_id, version, snapshot_json, action, actor_email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), change.id, version, JSON.stringify(snapshot), change.status, actor, at),
  ]);
  return { opportunity: snapshot };
}

export async function publishedOpportunityBySlug(slug: string) {
  const db = await opportunityDatabase();
  const now = new Date().toISOString();
  const row = await db.prepare(`SELECT ${selectColumns}, o.search_count AS periodSearches, 0 AS uniqueSessions,
    o.zero_result_count AS periodZeroResults FROM vii_search_page_opportunities o
    WHERE o.slug = ? AND o.robots_index = 1 AND (o.status = 'published' OR (o.status = 'scheduled' AND o.scheduled_at <= ?))
    ORDER BY o.version DESC LIMIT 1`).bind(slug, now).first<OpportunityRow>();
  return row ? hydrate(row) : null;
}

export async function publishedOpportunityPaths() {
  try {
    const db = await opportunityDatabase();
    const now = new Date().toISOString();
    const rows = await db.prepare(`SELECT canonical_path AS path, updated_at AS updatedAt FROM vii_search_page_opportunities
      WHERE robots_index = 1 AND canonical_path IS NOT NULL AND (status = 'published' OR (status = 'scheduled' AND scheduled_at <= ?))`).bind(now).all<{ path: string; updatedAt: string | null }>();
    return rows.results.filter((row) => row.path?.startsWith("/find/"));
  } catch { return []; }
}

export function managedDefinitionCount() { return searchPageDefinitions.length; }
