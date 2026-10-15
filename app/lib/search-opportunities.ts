import type { D1Database } from "../../types/cloudflare-runtime";
import { searchPageDatabase, searchPageDefinitions, searchPageInventory } from "./search-page-content.ts";
import { searchAnalyticsDatabase } from "./search-analytics.ts";
import { publicSearchPagePath } from "./search-page-url-policy.ts";
import { validSearchWorld, type SearchWorld } from "./search-analytics.ts";
import type { SiteLanguage } from "../i18n/locale-routing.ts";
import legacySearchPublications from "../data/legacy-search-page-publications.json" with { type: "json" };
import { holidayWorldPath } from "./holiday-world.ts";

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
  internalSearches: number;
  internalUniqueSessions: number;
  internalOnly: boolean;
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

type LegacySearchPageRecord = {
  id: string; legacySourcePath: string; sourcePath: string; location: string; slug: string;
  title: string; metaTitle: string; metaDescription: string; h1: string; summary: string;
  canonicalPath: string; latestResultCount: number; updatedAt: string;
};
type LegacySearchOpportunity = SearchOpportunity & { legacySourcePath: string };

function legacyBody(page: LegacySearchPageRecord) {
  return (legacySearchPublications.bodyTemplate as string[]).map((paragraph) => paragraph
    .replaceAll("{{metaDescription}}", page.metaDescription)
    .replaceAll("{{h1}}", page.h1)).join("\n\n");
}

function hydrateLegacyPage(page: LegacySearchPageRecord): LegacySearchOpportunity {
  const generatedAt = legacySearchPublications.generatedAt;
  return { ...page, origin: "managed", world: "vacation", locale: "he", filters: {},
    proposedPath: page.canonicalPath, suggestedTitle: page.h1, firstSeenAt: generatedAt, lastSeenAt: generatedAt,
    searches: 0, uniqueSessions: 0, internalSearches: 0, internalUniqueSessions: 0, internalOnly: false,
    zeroResults: 0, status: "published", assignee: null, body: legacyBody(page), faq: [], robotsIndex: true,
    scheduledAt: null, publishedAt: generatedAt, version: 1, updatedBy: "system-legacy-migration", readiness: 100, priority: 0 };
}

const legacySearchPages = (legacySearchPublications.pages as LegacySearchPageRecord[]).map(hydrateLegacyPage);

function normalizedHolidayName(value: string) {
  return value.toLocaleLowerCase("he").replace(/^(?:חג|ערב חג)\s+/, "").replace(/["'״׳]/g, "").replace(/\s+/g, " ").trim();
}

export function legacyHolidaySearchPath(name: string) {
  const holiday = normalizedHolidayName(name);
  if (!holiday) return null;
  if (/חנוכה|hanukkah/i.test(holiday)) return holidayWorldPath(name);
  const preferredHolidayTitle = /^מקומות\s+פנויים/;
  const candidates = legacySearchPages.filter((page) => {
    const content = normalizedHolidayName(`${page.title} ${page.h1} ${page.metaTitle}`);
    return content.includes(holiday) && /חג|פסח|חנוכה|סוכות|שבועות|סיגד|ראש השנה|יום העצמאות/.test(`${page.title} ${page.h1}`);
  });
  return candidates.sort((left, right) => Number(preferredHolidayTitle.test(right.title)) - Number(preferredHolidayTitle.test(left.title))
    || right.latestResultCount - left.latestResultCount)[0]?.canonicalPath || null;
}

function legacyOpportunityById(id: string) {
  return legacySearchPages.find((page) => page.id === id) || null;
}

function legacyOpportunityByPath(world: string, slug: string, locale: string) {
  return legacySearchPages.find((page) => page.world === world && page.slug === slug && page.locale === locale) || null;
}

type OpportunityRow = {
  id: string; canonicalKey: string; world: string; locale: string; location: string; filtersJson: string;
  sourcePath: string; proposedPath: string; suggestedTitle: string; latestResultCount: number;
  firstSeenAt: string; lastSeenAt: string; searchCount: number; zeroResultCount: number; status: OpportunityStatus;
  assignee: string | null; title: string | null; metaTitle: string | null; metaDescription: string | null;
  h1: string | null; summary: string | null; body: string | null; faqJson: string; slug: string | null;
  canonicalPath: string | null; robotsIndex: number; scheduledAt: string | null; publishedAt: string | null;
  version: number; updatedAt: string | null; updatedBy: string | null; periodSearches: number; uniqueSessions: number;
  internalPeriodSearches: number; internalUniqueSessions: number; periodZeroResults: number;
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
  const internalSearches = Number(row.internalPeriodSearches ?? 0);
  const internalUniqueSessions = Number(row.internalUniqueSessions ?? 0);
  const zeroResults = Number(row.periodZeroResults ?? row.zeroResultCount ?? 0);
  return {
    id: row.id,
    origin: row.canonicalKey.startsWith("managed:") ? "managed" : "search",
    world: row.world, locale: row.locale, location: row.location,
    filters, sourcePath: row.sourcePath, proposedPath: row.proposedPath, suggestedTitle: row.suggestedTitle,
    latestResultCount: Number(row.latestResultCount || 0), firstSeenAt: row.firstSeenAt, lastSeenAt: row.lastSeenAt,
    searches, uniqueSessions, internalSearches, internalUniqueSessions,
    internalOnly: searches === 0 && internalSearches > 0 && !row.canonicalKey.startsWith("managed:"),
    zeroResults, status: row.status, assignee: row.assignee,
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
  const [rows, globalUnique, globalInternal] = await Promise.all([db.prepare(`SELECT ${selectColumns},
    COALESCE((SELECT COUNT(*) FROM vii_search_demand_events e WHERE e.opportunity_id = o.id AND e.internal = 0 AND e.created_at >= ?), 0) AS periodSearches,
    COALESCE((SELECT COUNT(DISTINCT e.session_id) FROM vii_search_demand_events e WHERE e.opportunity_id = o.id AND e.internal = 0 AND e.created_at >= ? AND e.session_id IS NOT NULL), 0) AS uniqueSessions,
    COALESCE((SELECT COUNT(*) FROM vii_search_demand_events e WHERE e.opportunity_id = o.id AND e.internal = 1 AND e.created_at >= ?), 0) AS internalPeriodSearches,
    COALESCE((SELECT COUNT(DISTINCT e.session_id) FROM vii_search_demand_events e WHERE e.opportunity_id = o.id AND e.internal = 1 AND e.created_at >= ? AND e.session_id IS NOT NULL), 0) AS internalUniqueSessions,
    COALESCE((SELECT COUNT(*) FROM vii_search_demand_events e WHERE e.opportunity_id = o.id AND e.internal = 0 AND e.created_at >= ? AND e.zero_result = 1), 0) AS periodZeroResults
    FROM vii_search_page_opportunities o ORDER BY o.last_seen_at DESC`).bind(since, since, since, since, since).all<OpportunityRow>(),
    db.prepare("SELECT COUNT(DISTINCT session_id) AS count FROM vii_search_demand_events WHERE internal = 0 AND created_at >= ? AND session_id IS NOT NULL").bind(since).first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM vii_search_demand_events WHERE internal = 1 AND created_at >= ?").bind(since).first<{ count: number }>(),
  ]);
  const databaseOpportunities = rows.results.map(hydrate);
  const databaseIds = new Set(databaseOpportunities.map((item) => item.id));
  const opportunities = [...databaseOpportunities, ...legacySearchPages.filter((item) => !databaseIds.has(item.id))]
    .sort((a, b) => b.priority - a.priority || b.searches - a.searches || b.lastSeenAt.localeCompare(a.lastSeenAt));
  const statusCounts = Object.fromEntries(opportunityStatuses.map((status) => [status, opportunities.filter((item) => item.status === status).length]));
  return {
    periodDays: days,
    generatedAt: new Date().toISOString(),
    metrics: {
      recordedSearches: opportunities.reduce((sum, item) => sum + item.searches, 0),
      uniqueSessions: Number(globalUnique?.count || 0),
      pending: opportunities.filter((item) => !item.internalOnly && ["pending", "draft", "review"].includes(item.status)).length,
      published: statusCounts.published,
      zeroResultSearches: opportunities.reduce((sum, item) => sum + item.zeroResults, 0),
      internalSearches: Number(globalInternal?.count || 0),
    },
    statusCounts,
    opportunities,
  };
}

export async function readOpportunity(db: D1Database, id: string) {
  const row = await db.prepare(`SELECT ${selectColumns}, o.search_count AS periodSearches,
    (SELECT COUNT(DISTINCT e.session_id) FROM vii_search_demand_events e WHERE e.opportunity_id = o.id AND e.internal = 0 AND e.session_id IS NOT NULL) AS uniqueSessions,
    (SELECT COUNT(*) FROM vii_search_demand_events e WHERE e.opportunity_id = o.id AND e.internal = 1) AS internalPeriodSearches,
    (SELECT COUNT(DISTINCT e.session_id) FROM vii_search_demand_events e WHERE e.opportunity_id = o.id AND e.internal = 1 AND e.session_id IS NOT NULL) AS internalUniqueSessions,
    o.zero_result_count AS periodZeroResults FROM vii_search_page_opportunities o WHERE o.id = ?`).bind(id).first<OpportunityRow>();
  if (!row) {
    const legacy = legacyOpportunityById(id);
    return legacy ? { opportunity: legacy, versions: [] } : null;
  }
  const versions = await db.prepare(`SELECT version, action, actor_email AS actorEmail, created_at AS createdAt, snapshot_json AS snapshotJson
    FROM vii_search_page_opportunity_versions WHERE opportunity_id = ? ORDER BY version DESC LIMIT 30`).bind(id).all<{ version: number; action: string; actorEmail: string; createdAt: string; snapshotJson: string }>();
  return { opportunity: hydrate(row), versions: versions.results.map((version) => ({ ...version, snapshot: safeJson(version.snapshotJson, {}) })) };
}

async function materializeLegacyOpportunity(db: D1Database, id: string) {
  const page = legacyOpportunityById(id);
  if (!page) return false;
  const canonicalKey = `managed:legacy:${page.legacySourcePath}`;
  const snapshot = JSON.stringify(page);
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO vii_search_page_opportunities
      (id, canonical_key, world, locale, location, filters_json, source_path, proposed_path, suggested_title,
       latest_result_count, first_seen_at, last_seen_at, search_count, zero_result_count, status, assignee,
       title, meta_title, meta_description, h1, summary, body, faq_json, slug, canonical_path, robots_index,
       scheduled_at, published_at, version, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(page.id, canonicalKey, page.world, page.locale, page.location, JSON.stringify(page.filters), page.sourcePath,
        page.proposedPath, page.suggestedTitle, page.latestResultCount, page.firstSeenAt, page.lastSeenAt,
        page.searches, page.zeroResults, page.status, page.assignee, page.title, page.metaTitle, page.metaDescription,
        page.h1, page.summary, page.body, JSON.stringify(page.faq), page.slug, page.canonicalPath, 1,
        page.scheduledAt, page.publishedAt, page.version, page.updatedAt, page.updatedBy),
    db.prepare(`INSERT OR IGNORE INTO vii_search_page_publications
      (opportunity_id, canonical_path, locale, world, snapshot_json, scheduled_at, published_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(page.id, page.canonicalPath, page.locale, page.world, snapshot, page.scheduledAt,
        page.publishedAt || page.updatedAt, page.updatedAt),
  ]);
  return true;
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
  if ((status === "published" || status === "scheduled") && row.robotsIndex !== true) return null;
  const content = { title: title!, metaTitle: metaTitle!, metaDescription: metaDescription!, h1: h1!, summary: summary!, body: body!, slug };
  if ((status === "published" || status === "scheduled" || status === "review") && opportunityReadiness(content) < 100) return null;
  return { id: row.id, expectedVersion: Number(row.expectedVersion), status, assignee, ...content, faq,
    robotsIndex: row.robotsIndex === true, scheduledAt: scheduled?.toISOString() || null };
}

export async function saveOpportunity(db: D1Database, change: NonNullable<ReturnType<typeof parseOpportunityChange>>, actor: string) {
  let prior = await db.prepare(`SELECT version, status, proposed_path AS proposedPath, world, locale, location,
    filters_json AS filtersJson, source_path AS sourcePath, suggested_title AS suggestedTitle,
    latest_result_count AS latestResultCount, first_seen_at AS firstSeenAt, last_seen_at AS lastSeenAt,
    search_count AS searchCount, zero_result_count AS zeroResultCount
    FROM vii_search_page_opportunities WHERE id = ?`).bind(change.id).first<{
      version: number; status: string; proposedPath: string; world: string; locale: string; location: string;
      filtersJson: string; sourcePath: string; suggestedTitle: string; latestResultCount: number;
      firstSeenAt: string; lastSeenAt: string; searchCount: number; zeroResultCount: number;
    }>();
  if (!prior && await materializeLegacyOpportunity(db, change.id)) prior = await db.prepare(`SELECT version, status, proposed_path AS proposedPath, world, locale, location,
    filters_json AS filtersJson, source_path AS sourcePath, suggested_title AS suggestedTitle,
    latest_result_count AS latestResultCount, first_seen_at AS firstSeenAt, last_seen_at AS lastSeenAt,
    search_count AS searchCount, zero_result_count AS zeroResultCount
    FROM vii_search_page_opportunities WHERE id = ?`).bind(change.id).first<{
      version: number; status: string; proposedPath: string; world: string; locale: string; location: string;
      filtersJson: string; sourcePath: string; suggestedTitle: string; latestResultCount: number;
      firstSeenAt: string; lastSeenAt: string; searchCount: number; zeroResultCount: number;
    }>();
  if (!prior) return { error: "not_found" as const };
  if (prior.version !== change.expectedVersion) return { error: "version_conflict" as const };
  if (!validSearchWorld(prior.world) || !["he", "en", "ru", "fr"].includes(prior.locale)) return { error: "invalid_identity" as const };
  if (["published", "scheduled"].includes(change.status) && !change.robotsIndex) return { error: "indexing_required" as const };
  const version = prior.version + 1;
  const at = new Date().toISOString();
  const canonicalPath = publicSearchPagePath(prior.world as SearchWorld, change.slug, prior.locale as SiteLanguage);
  const collision = await db.prepare("SELECT opportunity_id AS id FROM vii_search_page_publications WHERE canonical_path = ? AND opportunity_id <> ? LIMIT 1").bind(canonicalPath, change.id).first<{ id: string }>();
  if (collision) return { error: "url_conflict" as const };
  const publishedAt = change.status === "published" ? at : null;
  const snapshot: SearchOpportunity = {
    ...change, id: change.id, origin: "search", world: prior.world, locale: prior.locale, location: prior.location,
    filters: safeJson(prior.filtersJson, {}), sourcePath: prior.sourcePath, proposedPath: prior.proposedPath,
    suggestedTitle: prior.suggestedTitle, latestResultCount: Number(prior.latestResultCount || 0),
    firstSeenAt: prior.firstSeenAt, lastSeenAt: prior.lastSeenAt, searches: Number(prior.searchCount || 0),
    uniqueSessions: 0, internalSearches: 0, internalUniqueSessions: 0, internalOnly: false,
    zeroResults: Number(prior.zeroResultCount || 0), canonicalPath,
    publishedAt, version, updatedAt: at, updatedBy: actor, readiness: opportunityReadiness(change), priority: 0,
  };
  const statements = [
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
  ];
  if (change.status === "published" || change.status === "scheduled") statements.push(db.prepare(`INSERT INTO vii_search_page_publications
    (opportunity_id, canonical_path, locale, world, snapshot_json, scheduled_at, published_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(opportunity_id) DO UPDATE SET canonical_path = excluded.canonical_path,
    locale = excluded.locale, world = excluded.world, snapshot_json = excluded.snapshot_json,
    scheduled_at = excluded.scheduled_at, published_at = excluded.published_at, updated_at = excluded.updated_at`)
    .bind(change.id, canonicalPath, prior.locale, prior.world, JSON.stringify(snapshot), change.scheduledAt, publishedAt || change.scheduledAt || at, at));
  if (change.status === "archived") statements.push(db.prepare("DELETE FROM vii_search_page_publications WHERE opportunity_id = ?").bind(change.id));
  await db.batch(statements);
  return { opportunity: snapshot };
}

export async function publishedOpportunityBySlug(slug: string) {
  const fallback = legacySearchPages.find((page) => page.slug === slug && page.locale === "he") || null;
  try {
    const db = await opportunityDatabase();
    const now = new Date().toISOString();
    const row = await db.prepare(`SELECT ${selectColumns}, o.search_count AS periodSearches, 0 AS uniqueSessions,
      0 AS internalPeriodSearches, 0 AS internalUniqueSessions,
      o.zero_result_count AS periodZeroResults FROM vii_search_page_opportunities o
      WHERE o.slug = ? AND o.robots_index = 1 AND (o.status = 'published' OR (o.status = 'scheduled' AND o.scheduled_at <= ?))
      ORDER BY o.version DESC LIMIT 1`).bind(slug, now).first<OpportunityRow>();
    return row ? hydrate(row) : fallback;
  } catch { return fallback; }
}

export async function publishedOpportunityByPath(world: string, slug: string, locale: string) {
  if (!validSearchWorld(world) || !["he", "en", "ru", "fr"].includes(locale)) return null;
  const path = publicSearchPagePath(world, slug, locale as SiteLanguage);
  const fallback = legacyOpportunityByPath(world, slug, locale);
  try {
    const db = await opportunityDatabase();
    const now = new Date().toISOString();
    const row = await db.prepare(`SELECT snapshot_json AS snapshotJson FROM vii_search_page_publications
      WHERE canonical_path = ? AND locale = ? AND (scheduled_at IS NULL OR scheduled_at <= ?) LIMIT 1`)
      .bind(path, locale, now).first<{ snapshotJson: string }>();
    return row ? safeJson<SearchOpportunity | null>(row.snapshotJson, null) : fallback;
  } catch { return fallback; }
}

export async function publishedOpportunityPaths() {
  try {
    const db = await opportunityDatabase();
    const now = new Date().toISOString();
    const rows = await db.prepare(`SELECT canonical_path AS path, updated_at AS updatedAt FROM vii_search_page_publications
      WHERE scheduled_at IS NULL OR scheduled_at <= ?`).bind(now).all<{ path: string; updatedAt: string | null }>();
    const liveRows = rows.results.filter((row) => /^\/(?:en\/|ru\/|fr\/)?search\/(?:vacations|events|spas|hourly)\/[a-z0-9-]+$/.test(row.path || ""));
    return [...new Map([...liveRows, ...legacySearchPages.map((page) => ({ path: page.canonicalPath, updatedAt: page.updatedAt }))]
      .map((row) => [row.path, row])).values()];
  } catch { return legacySearchPages.map((page) => ({ path: page.canonicalPath, updatedAt: page.updatedAt })); }
}

export function managedDefinitionCount() { return searchPageDefinitions.length; }
