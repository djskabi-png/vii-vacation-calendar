import type { D1Database } from "../../types/cloudflare-runtime";

export const contentTypes = ["homepage", "vacation", "events", "hourly", "spa", "providers", "attractions", "trails", "magazine", "navigation", "footer"] as const;
export const contentLocales = ["he", "en", "ru", "fr"] as const;
export const contentStatuses = ["draft", "review", "scheduled", "published", "archived"] as const;
export type ContentType = typeof contentTypes[number];
export type ContentLocale = typeof contentLocales[number];
export type ContentStatus = typeof contentStatuses[number];

export type ManagedLink = { id: string; label: string; href: string; group: string; order: number; visible: boolean; newWindow: boolean };
export type EditorialContent = {
  title: string;
  summary: string;
  body: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
  imageAlt: string;
  indexable: boolean;
  links: ManagedLink[];
  attributes: Record<string, string>;
};
export type ContentSource = {
  type: ContentType; key: string; world: string; locale?: ContentLocale; sourceLabel: string;
  title: string; summary?: string; body?: string; slug?: string; imageAlt?: string; indexable?: boolean; links?: ManagedLink[]; attributes?: Record<string, string>;
};
export type ContentItem = {
  id: string; contentType: ContentType; entityKey: string; world: string; locale: ContentLocale; sourceLabel: string;
  source: EditorialContent; draft: EditorialContent; status: ContentStatus; scheduledAt: string | null; version: number;
  publishedVersion: number | null; updatedAt: string; updatedBy: string;
};
export type ContentVersion = { version: number; action: string; status: ContentStatus; content: EditorialContent; scheduledAt: string | null; createdAt: string; createdBy: string };
export type ContentCreate = { type: ContentType; key: string; world: string; locale: ContentLocale; title: string };

const asciiSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const safePath = /^\/(?!\/)(?!admin(?:\/|$)|api(?:\/|$))[A-Za-z0-9._~!$&'()*+,;=:@%/?#-]*$/;

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.normalize("NFC").replace(/\r\n/g, "\n").trim().slice(0, max) : "";
}

function links(value: unknown): ManagedLink[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const result: ManagedLink[] = [];
  const ids = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") return null;
    const row = raw as Record<string, unknown>;
    const id = clean(row.id, 80); const label = clean(row.label, 100); const href = clean(row.href, 500); const group = clean(row.group, 80);
    if (!id || ids.has(id) || !label || !group || !safePath.test(href) || !Number.isSafeInteger(row.order)) return null;
    ids.add(id); result.push({ id, label, href, group, order: Number(row.order), visible: row.visible !== false, newWindow: row.newWindow === true });
  }
  return result.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "he"));
}

function attributes(value: unknown) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length > 40) return null;
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[a-z][A-Za-z0-9]{0,39}$/.test(key) || typeof raw !== "string" || /[<>]/.test(raw)) return null;
    result[key] = clean(raw, 1200);
  }
  return result;
}

export function normalizeEditorial(value: unknown): EditorialContent | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>; const parsedLinks = links(row.links ?? []); const parsedAttributes = attributes(row.attributes);
  const result: EditorialContent = {
    title: clean(row.title, 160), summary: clean(row.summary, 1000), body: clean(row.body, 30_000),
    metaTitle: clean(row.metaTitle, 90), metaDescription: clean(row.metaDescription, 320), slug: clean(row.slug, 160),
    imageAlt: clean(row.imageAlt, 300), indexable: row.indexable === true, links: parsedLinks || [], attributes: parsedAttributes || {},
  };
  if (!result.title || /[<>]/.test(`${result.title}${result.summary}${result.metaTitle}${result.metaDescription}${result.imageAlt}`)
    || (result.slug && !asciiSlug.test(result.slug)) || parsedLinks === null || parsedAttributes === null) return null;
  return result;
}

export function sourceEditorial(source: ContentSource): EditorialContent {
  return { title: clean(source.title, 160), summary: clean(source.summary, 1000), body: clean(source.body, 30_000),
    metaTitle: clean(source.title, 90), metaDescription: clean(source.summary, 320), slug: clean(source.slug, 160),
    imageAlt: clean(source.imageAlt, 300), indexable: source.indexable === true, links: source.links || [], attributes: source.attributes || {} };
}

export function contentItemId(type: ContentType, key: string, locale: ContentLocale) { return `${type}:${key}:${locale}`; }
export function isContentType(value: unknown): value is ContentType { return contentTypes.includes(value as ContentType); }
export function isContentLocale(value: unknown): value is ContentLocale { return contentLocales.includes(value as ContentLocale); }

function parseItem(row: Record<string, unknown>): ContentItem {
  return { id: String(row.id), contentType: row.contentType as ContentType, entityKey: String(row.entityKey), world: String(row.world),
    locale: row.locale as ContentLocale, sourceLabel: String(row.sourceLabel), source: JSON.parse(String(row.sourceJson)),
    draft: JSON.parse(String(row.draftJson)), status: row.status as ContentStatus, scheduledAt: row.scheduledAt ? String(row.scheduledAt) : null,
    version: Number(row.version), publishedVersion: row.publishedVersion === null ? null : Number(row.publishedVersion),
    updatedAt: String(row.updatedAt), updatedBy: String(row.updatedBy) };
}

export async function ensureContentItem(db: D1Database, source: ContentSource, actor = "system") {
  const locale = source.locale || "he"; const id = contentItemId(source.type, source.key, locale); const content = sourceEditorial(source); const now = new Date().toISOString();
  await db.prepare(`INSERT OR IGNORE INTO vii_content_items
    (id, content_type, entity_key, world, locale, source_label, source_json, draft_json, status, version, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?, ?)`)
    .bind(id, source.type, source.key, source.world, locale, source.sourceLabel, JSON.stringify(content), JSON.stringify(content), now, actor).run();
  await db.prepare(`UPDATE vii_content_items SET source_label = ?, source_json = ? WHERE id = ?`)
    .bind(source.sourceLabel, JSON.stringify(content), id).run();
  const row = await db.prepare(`SELECT id, content_type AS contentType, entity_key AS entityKey, world, locale,
    source_label AS sourceLabel, source_json AS sourceJson, draft_json AS draftJson, status, scheduled_at AS scheduledAt,
    version, published_version AS publishedVersion, updated_at AS updatedAt, updated_by AS updatedBy FROM vii_content_items WHERE id = ?`)
    .bind(id).first<Record<string, unknown>>();
  if (!row) throw new Error("content_item_unavailable");
  return parseItem(row);
}

export async function ensureContentItems(db: D1Database, sources: readonly ContentSource[], actor = "system") {
  if (!sources.length) return [];
  const now = new Date().toISOString();
  for (let offset = 0; offset < sources.length; offset += 40) {
    const statements = sources.slice(offset, offset + 40).flatMap((source) => {
      const locale = source.locale || "he"; const id = contentItemId(source.type, source.key, locale); const content = JSON.stringify(sourceEditorial(source));
      return [
        db.prepare(`INSERT OR IGNORE INTO vii_content_items
          (id, content_type, entity_key, world, locale, source_label, source_json, draft_json, status, version, updated_at, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?, ?)`).bind(id, source.type, source.key, source.world, locale, source.sourceLabel, content, content, now, actor),
        db.prepare("UPDATE vii_content_items SET source_label = ?, source_json = ? WHERE id = ?").bind(source.sourceLabel, content, id),
      ];
    });
    await db.batch(statements);
  }
  const ids = sources.map((source) => contentItemId(source.type, source.key, source.locale || "he")); const placeholders = ids.map(() => "?").join(",");
  const rows = await db.prepare(`SELECT id, content_type AS contentType, entity_key AS entityKey, world, locale,
    source_label AS sourceLabel, source_json AS sourceJson, draft_json AS draftJson, status, scheduled_at AS scheduledAt,
    version, published_version AS publishedVersion, updated_at AS updatedAt, updated_by AS updatedBy
    FROM vii_content_items WHERE id IN (${placeholders}) ORDER BY updated_at DESC, entity_key`).bind(...ids).all<Record<string, unknown>>();
  return rows.results.map(parseItem);
}

export async function readContentItems(db: D1Database, type: ContentType, locale: ContentLocale) {
  const rows = await db.prepare(`SELECT id, content_type AS contentType, entity_key AS entityKey, world, locale,
    source_label AS sourceLabel, source_json AS sourceJson, draft_json AS draftJson, status, scheduled_at AS scheduledAt,
    version, published_version AS publishedVersion, updated_at AS updatedAt, updated_by AS updatedBy
    FROM vii_content_items WHERE content_type = ? AND locale = ? ORDER BY updated_at DESC, entity_key`)
    .bind(type, locale).all<Record<string, unknown>>();
  return rows.results.map(parseItem);
}

export async function readOriginalContentItems(db: D1Database, type: ContentType, locale: ContentLocale) {
  const rows = await db.prepare(`SELECT id, content_type AS contentType, entity_key AS entityKey, world, locale,
    source_label AS sourceLabel, source_json AS sourceJson, draft_json AS draftJson, status, scheduled_at AS scheduledAt,
    version, published_version AS publishedVersion, updated_at AS updatedAt, updated_by AS updatedBy
    FROM vii_content_items WHERE content_type = ? AND locale = ? AND source_label = 'VII original content' ORDER BY updated_at DESC`)
    .bind(type, locale).all<Record<string, unknown>>();
  return rows.results.map(parseItem);
}

export async function readContentItem(db: D1Database, id: string) {
  const row = await db.prepare(`SELECT id, content_type AS contentType, entity_key AS entityKey, world, locale,
    source_label AS sourceLabel, source_json AS sourceJson, draft_json AS draftJson, status, scheduled_at AS scheduledAt,
    version, published_version AS publishedVersion, updated_at AS updatedAt, updated_by AS updatedBy FROM vii_content_items WHERE id = ?`)
    .bind(id).first<Record<string, unknown>>();
  return row ? parseItem(row) : null;
}

export function parseContentCreate(value: unknown): ContentCreate | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>; const type = row.type; const locale = row.locale;
  const title = clean(row.title, 160); const key = clean(row.key, 160).toLowerCase();
  if (!isContentType(type) || !isContentLocale(locale) || !title || !asciiSlug.test(key)
    || type === "homepage" || type === "navigation" || type === "footer") return null;
  const worlds: Record<Exclude<ContentType, "navigation" | "footer">, string> = {
    homepage: "global",
    vacation: "vacation", events: "events", hourly: "hourly", spa: "spa", providers: "providers",
    attractions: "activities", trails: "activities", magazine: "magazine",
  };
  return { type, key, locale, title, world: worlds[type] };
}

export async function createContentItem(db: D1Database, input: ContentCreate, actor: string) {
  const id = contentItemId(input.type, input.key, input.locale); const now = new Date().toISOString();
  const content: EditorialContent = { title: input.title, summary: "", body: "", metaTitle: input.title.slice(0, 90),
    metaDescription: "", slug: input.key, imageAlt: input.title, indexable: false, links: [], attributes: {} };
  const inserted = await db.prepare(`INSERT OR IGNORE INTO vii_content_items
    (id, content_type, entity_key, world, locale, source_label, source_json, draft_json, status, version, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?, 'VII original content', ?, ?, 'draft', 1, ?, ?)`).bind(id, input.type, input.key, input.world,
      input.locale, JSON.stringify(content), JSON.stringify(content), now, actor).run();
  if (inserted.meta.changes !== 1) return { error: "already_exists" as const };
  await db.prepare(`INSERT INTO vii_content_versions (id, item_id, version, action, status, content_json, created_at, created_by)
    VALUES (?, ?, 1, 'create', 'draft', ?, ?, ?)`).bind(`${id}:1`, id, JSON.stringify(content), now, actor).run();
  return { id, version: 1, status: "draft" as const, updatedAt: now, updatedBy: actor };
}

export async function readContentVersions(db: D1Database, itemId: string) {
  const rows = await db.prepare(`SELECT version, action, status, content_json AS contentJson, scheduled_at AS scheduledAt,
    created_at AS createdAt, created_by AS createdBy FROM vii_content_versions WHERE item_id = ? ORDER BY version DESC LIMIT 30`)
    .bind(itemId).all<Record<string, unknown>>();
  return rows.results.map((row): ContentVersion => ({ version: Number(row.version), action: String(row.action), status: row.status as ContentStatus,
    content: JSON.parse(String(row.contentJson)), scheduledAt: row.scheduledAt ? String(row.scheduledAt) : null,
    createdAt: String(row.createdAt), createdBy: String(row.createdBy) }));
}

export function parseContentChange(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>; const content = normalizeEditorial(row.content);
  if (typeof row.id !== "string" || !/^[a-z]+:[A-Za-z0-9._-]+:(?:he|en|ru|fr)$/.test(row.id) || !Number.isSafeInteger(row.expectedVersion)
    || !content || !contentStatuses.includes(row.status as ContentStatus)) return null;
  const status = row.status as ContentStatus; const scheduled = typeof row.scheduledAt === "string" && row.scheduledAt ? new Date(row.scheduledAt) : null;
  if (status === "scheduled" && (!scheduled || !Number.isFinite(scheduled.getTime()) || scheduled.getTime() <= Date.now())) return null;
  const chromeItem = row.id.startsWith("navigation:") || row.id.startsWith("footer:");
  const homepageItem = row.id.startsWith("homepage:");
  if (["published", "scheduled"].includes(status) && ((chromeItem ? content.links.length < 1 : !homepageItem && content.summary.length < 20)
    || (content.indexable && (!content.metaTitle || content.metaDescription.length < 30)))) return null;
  const required: Record<string, string[]> = {
    trails: ["mainArea", "region", "nature", "duration", "difficulty", "officialSource", "sourceName", "mapQuery"],
    providers: ["location", "area", "features", "image", "sourceName"], attractions: ["location", "area", "features", "image", "sourceName"],
    magazine: ["category", "image", "dateLabel", "readTime"],
  };
  const family = row.id.split(":", 1)[0];
  if (["published", "scheduled"].includes(status) && required[family]?.some((key) => !content.attributes[key])) return null;
  if (["published", "scheduled"].includes(status) && family === "trails" && !/^https:\/\//.test(content.attributes.officialSource || "")) return null;
  if (["published", "scheduled"].includes(status) && family === "trails"
    && (!['צפון', 'כנרת', 'חיפה', 'מרכז', 'תל אביב', 'דרום ונגב', 'ירושלים', 'אילת והסביבה'].includes(content.attributes.mainArea)
      || !['קל', 'בינוני', 'למיטיבי לכת'].includes(content.attributes.difficulty))) return null;
  if (["published", "scheduled"].includes(status) && ["providers", "attractions", "magazine"].includes(family)
    && !/^(?:\/|https:\/\/)/.test(content.attributes.image || "")) return null;
  return { id: row.id, expectedVersion: Number(row.expectedVersion), status, content, scheduledAt: scheduled?.toISOString() || null,
    action: typeof row.action === "string" && ["save", "review", "publish", "schedule", "archive", "restore"].includes(row.action) ? row.action : "save" };
}

export async function saveContentItem(db: D1Database, change: NonNullable<ReturnType<typeof parseContentChange>>, actor: string) {
  const current = await db.prepare("SELECT version, status, scheduled_at AS scheduledAt, published_version AS publishedVersion FROM vii_content_items WHERE id = ?")
    .bind(change.id).first<{ version: number; status: ContentStatus; scheduledAt: string | null; publishedVersion: number | null }>();
  if (!current) return { error: "not_found" as const };
  if (current.version !== change.expectedVersion) return { error: "version_conflict" as const };
  const version = current.version + 1; const now = new Date().toISOString();
  const maturedSchedule = current.status === "scheduled" && current.scheduledAt && new Date(current.scheduledAt).getTime() <= Date.now() ? current.version : current.publishedVersion;
  const publishedVersion = change.status === "published" ? version : change.status === "archived" ? null : maturedSchedule;
  const updated = await db.prepare(`UPDATE vii_content_items SET draft_json = ?, status = ?, scheduled_at = ?, version = ?,
    published_version = ?, updated_at = ?, updated_by = ? WHERE id = ? AND version = ?`)
    .bind(JSON.stringify(change.content), change.status, change.scheduledAt, version, publishedVersion, now, actor, change.id, change.expectedVersion).run();
  if (updated.meta.changes !== 1) return { error: "version_conflict" as const };
  await db.prepare(`INSERT INTO vii_content_versions (id, item_id, version, action, status, content_json, scheduled_at, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(`${change.id}:${version}`, change.id, version, change.action, change.status, JSON.stringify(change.content), change.scheduledAt, now, actor).run();
  return { id: change.id, version, status: change.status, updatedAt: now, updatedBy: actor };
}

export async function readPublishedContent(db: D1Database, type: ContentType, key: string, locale: ContentLocale = "he") {
  const id = contentItemId(type, key, locale); const now = new Date().toISOString();
  const row = await db.prepare(`SELECT v.content_json AS contentJson, v.version FROM vii_content_items i
    JOIN vii_content_versions v ON v.item_id = i.id AND v.version = CASE
      WHEN i.status = 'scheduled' AND i.scheduled_at <= ? THEN i.version ELSE i.published_version END
    WHERE i.id = ? AND i.status <> 'archived' LIMIT 1`)
    .bind(now, id).first<{ contentJson: string; version: number }>();
  return row ? { content: JSON.parse(row.contentJson) as EditorialContent, version: row.version } : null;
}

export async function readPublishedContentBatch(db: D1Database, type: ContentType, keys: readonly string[], locale: ContentLocale = "he") {
  const unique = [...new Set(keys)].filter((key) => /^[A-Za-z0-9._-]+$/.test(key)); if (!unique.length) return new Map<string, EditorialContent>();
  const ids = unique.map((key) => contentItemId(type, key, locale)); const placeholders = ids.map(() => "?").join(","); const now = new Date().toISOString();
  const rows = await db.prepare(`SELECT i.id AS itemId, v.content_json AS contentJson FROM vii_content_items i
    JOIN vii_content_versions v ON v.item_id = i.id AND v.version = CASE
      WHEN i.status = 'scheduled' AND i.scheduled_at <= ? THEN i.version ELSE i.published_version END
    WHERE i.id IN (${placeholders}) AND i.status <> 'archived'`).bind(now, ...ids).all<{ itemId: string; contentJson: string }>();
  return new Map(rows.results.map((row) => [row.itemId.split(":").slice(1, -1).join(":"), JSON.parse(row.contentJson) as EditorialContent]));
}

export async function readPublishedItems(db: D1Database, type: ContentType, locale: ContentLocale = "he") {
  const now = new Date().toISOString();
  const rows = await db.prepare(`SELECT i.entity_key AS entityKey, v.content_json AS contentJson FROM vii_content_items i
    JOIN vii_content_versions v ON v.item_id = i.id AND v.version = CASE
      WHEN i.status = 'scheduled' AND i.scheduled_at <= ? THEN i.version ELSE i.published_version END
    WHERE i.content_type = ? AND i.locale = ? AND i.status <> 'archived' ORDER BY i.entity_key`)
    .bind(now, type, locale).all<{ entityKey: string; contentJson: string }>();
  return rows.results.map((row) => ({ key: row.entityKey, content: JSON.parse(row.contentJson) as EditorialContent }));
}
