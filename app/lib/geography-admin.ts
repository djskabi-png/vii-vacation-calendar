import type { D1Database } from "../../types/cloudflare-runtime";

export const geographyLevels = ["district", "area", "city"] as const;
export type GeographyLevel = (typeof geographyLevels)[number];

export type SupplierGeographyNode = {
  key: string;
  level: GeographyLevel;
  supplierId: number;
  parentKey: string | null;
  title: string;
  titleEn: string;
  gpsLat: number | null;
  gpsLong: number | null;
  unassigned: boolean;
};

export type ManagedGeographyNode = SupplierGeographyNode & {
  effectiveTitle: string;
  effectiveTitleEn: string;
  titleOverride: string;
  titleEnOverride: string;
  slug: string;
  visible: boolean;
  featured: boolean;
  version: number;
  updatedAt: string;
  updatedBy: string;
};

const API_ROOT = "https://bizonline.co.il/api/ai/vii";

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function array(value: unknown) {
  if (Array.isArray(value)) return value;
  return value && typeof value === "object" ? Object.values(value as Record<string, unknown>) : [];
}

function geographyRoot(payload: unknown) {
  let current = record(payload);
  for (let depth = 0; depth < 3; depth += 1) {
    const nested = current.data ?? current.result ?? current.locations ?? current.geography;
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) break;
    current = record(nested);
  }
  return current;
}

function shape(value: unknown, depth = 0): unknown {
  if (depth >= 4) return Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
  if (Array.isArray(value)) return { type: "array", length: value.length, item: value.length ? shape(value[0], depth + 1) : "empty" };
  if (value === null) return "null";
  if (typeof value !== "object") return typeof value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .slice(0, 40)
    .map(([key, nested]) => [key, shape(nested, depth + 1)]));
}

export function supplierGeographyShape(payload: unknown) {
  return shape(payload);
}

function id(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function text(value: unknown, max = 100) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function coordinate(value: unknown, minimum: number, maximum: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
}

function sourceId(value: Record<string, unknown>, level: GeographyLevel) {
  return id(value.id ?? value[`${level}_id`] ?? value[`${level}ID`]);
}

function titleEn(value: Record<string, unknown>) { return text(value.title_en ?? value.titleEn ?? value.name_en ?? value.nameEn); }

function nestedRows(value: Record<string, unknown>, level: GeographyLevel) {
  const keys = level === "district" ? ["districts", "main_areas", "regions", "counties"]
    : level === "area" ? ["areas", "subareas", "regions"] : ["cities", "settlements", "towns"];
  return keys.flatMap((key) => array(value[key]));
}

function inferredRootDistricts(root: Record<string, unknown>) {
  const reserved = new Set(["unassigned", "areas", "cities", "districts", "main_areas", "regions", "counties", "data", "result", "locations", "geography"]);
  return Object.entries(root)
    .filter(([key]) => !reserved.has(key))
    .map(([, value]) => value)
    .filter((value) => {
      const candidate = record(value);
      return sourceId(candidate, "district") !== null
        && Boolean(text(candidate.title ?? candidate.name))
        && (nestedRows(candidate, "area").length > 0 || nestedRows(candidate, "city").length > 0);
    });
}

export function normalizeSupplierGeography(payload: unknown): SupplierGeographyNode[] {
  const root = geographyRoot(payload);
  const collected = new Map<string, SupplierGeographyNode>();
  const add = (level: GeographyLevel, rawValue: unknown, parentKey: string | null, unassigned = false) => {
    const raw = record(rawValue);
    const supplierId = sourceId(raw, level);
    const title = text(raw.title ?? raw.name);
    if (supplierId === null || !title) return null;
    const key = `${level}:${supplierId}`;
    const parentId = level === "area" ? id(raw.district_id ?? raw.districtID ?? raw.district)
      : level === "city" ? id(raw.area_id ?? raw.areaID ?? raw.area) : null;
    // The supplier uses zero for an explicitly unassigned parent. Never create
    // a synthetic area:0 or district:0 relationship from that sentinel.
    const resolvedParent = parentKey || (parentId !== null && parentId > 0 ? `${level === "area" ? "district" : "area"}:${parentId}` : null);
    const node: SupplierGeographyNode = {
      key,
      level,
      supplierId,
      parentKey: resolvedParent,
      title,
      titleEn: titleEn(raw),
      gpsLat: level === "city" ? coordinate(raw.gps_lat ?? raw.gpsLat ?? record(raw.gps).lat, 29, 34) : null,
      gpsLong: level === "city" ? coordinate(raw.gps_long ?? raw.gpsLong ?? record(raw.gps).long ?? record(raw.gps).lng, 34, 36) : null,
      unassigned: unassigned || resolvedParent === null && level !== "district",
    };
    collected.set(key, node);
    return node;
  };

  const walkDistrict = (value: unknown, unassigned = false) => {
    const district = add("district", value, null, unassigned);
    const raw = record(value);
    for (const areaValue of nestedRows(raw, "area")) {
      const area = add("area", areaValue, district?.key || null, unassigned);
      for (const cityValue of nestedRows(record(areaValue), "city")) add("city", cityValue, area?.key || null, unassigned);
    }
    for (const cityValue of nestedRows(raw, "city")) add("city", cityValue, null, true);
  };

  const namedDistricts = nestedRows(root, "district");
  for (const district of [...namedDistricts, ...inferredRootDistricts(root)]) walkDistrict(district);
  for (const areaValue of array(root.areas)) {
    const area = add("area", areaValue, null);
    for (const cityValue of nestedRows(record(areaValue), "city")) add("city", cityValue, area?.key || null);
  }
  for (const cityValue of array(root.cities)) add("city", cityValue, null);

  const unassignedValue = root.unassigned;
  const unassigned = record(unassignedValue);
  for (const areaValue of array(unassigned.areas)) {
    const area = add("area", areaValue, null, true);
    for (const cityValue of nestedRows(record(areaValue), "city")) add("city", cityValue, area?.key || null, true);
  }
  for (const cityValue of array(unassigned.cities)) add("city", cityValue, null, true);
  if (Array.isArray(unassignedValue)) {
    for (const cityValue of unassignedValue) add("city", cityValue, null, true);
  }

  return [...collected.values()].sort((left, right) => geographyLevels.indexOf(left.level) - geographyLevels.indexOf(right.level)
    || left.title.localeCompare(right.title, "he"));
}

export async function fetchSupplierGeography(token: string, fetchImpl: typeof fetch = fetch) {
  if (!token) throw new Error("missing_supplier_token");
  let response: Response;
  try {
    response = await fetchImpl(`${API_ROOT}/areas`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
  } catch { throw new Error("supplier_geography_transport_error"); }
  if (response.status >= 300 && response.status < 400) throw new Error("supplier_geography_redirect_not_allowed");
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "supplier_not_authorized" : "supplier_geography_unavailable");
  const payload = await response.json();
  const nodes = normalizeSupplierGeography(payload);
  // This endpoint is the full national corpus. A response containing only the
  // unassigned bucket is a partial parse or a partial upstream response and
  // must not replace the accepted geography generation.
  if (!nodes.some((node) => node.level === "area")
    || !nodes.some((node) => node.level === "city" && !node.unassigned)) {
    console.error("VII supplier geography invalid", {
      shape: supplierGeographyShape(payload),
      counts: Object.fromEntries(geographyLevels.map((level) => [level, nodes.filter((node) => node.level === level).length])),
      assignedCities: nodes.filter((node) => node.level === "city" && !node.unassigned).length,
    });
    throw new Error("invalid_supplier_geography");
  }
  return nodes;
}

export async function geographyDatabase(database: D1Database) {
  await database.batch([
    database.prepare(`CREATE TABLE IF NOT EXISTS vii_geography_nodes (
      node_key TEXT PRIMARY KEY NOT NULL, level TEXT NOT NULL, supplier_id INTEGER NOT NULL,
      parent_key TEXT, supplier_title TEXT NOT NULL, supplier_title_en TEXT NOT NULL DEFAULT '',
      title_override TEXT NOT NULL DEFAULT '', title_en_override TEXT NOT NULL DEFAULT '', slug TEXT NOT NULL DEFAULT '',
      visible INTEGER NOT NULL DEFAULT 1, featured INTEGER NOT NULL DEFAULT 0,
      gps_lat REAL, gps_long REAL, unassigned INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1, source_updated_at TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL)`),
    database.prepare(`CREATE TABLE IF NOT EXISTS vii_geography_versions (
      id TEXT PRIMARY KEY NOT NULL, node_key TEXT NOT NULL, version INTEGER NOT NULL,
      snapshot_json TEXT NOT NULL, action TEXT NOT NULL, actor_email TEXT NOT NULL, created_at TEXT NOT NULL)`),
    database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_vii_geography_level_supplier ON vii_geography_nodes(level, supplier_id)"),
    database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_vii_geography_version ON vii_geography_versions(node_key, version)"),
  ]);
  return database;
}

export async function refreshGeography(database: D1Database, nodes: SupplierGeographyNode[], actor: string) {
  const now = new Date().toISOString();
  const statements = nodes.map((node) => database.prepare(`INSERT INTO vii_geography_nodes
    (node_key, level, supplier_id, parent_key, supplier_title, supplier_title_en, gps_lat, gps_long, unassigned,
     source_updated_at, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(node_key) DO UPDATE SET parent_key = excluded.parent_key, supplier_title = excluded.supplier_title,
      supplier_title_en = excluded.supplier_title_en, gps_lat = excluded.gps_lat, gps_long = excluded.gps_long,
      unassigned = excluded.unassigned, source_updated_at = excluded.source_updated_at`)
    .bind(node.key, node.level, node.supplierId, node.parentKey, node.title, node.titleEn, node.gpsLat, node.gpsLong,
      node.unassigned ? 1 : 0, now, now, actor));
  for (let index = 0; index < statements.length; index += 75) await database.batch(statements.slice(index, index + 75));
  return { refreshedAt: now, imported: nodes.length };
}

type GeographyRow = {
  nodeKey: string; level: GeographyLevel; supplierId: number; parentKey: string | null; supplierTitle: string;
  supplierTitleEn: string; titleOverride: string; titleEnOverride: string; slug: string; visible: number; featured: number;
  gpsLat: number | null; gpsLong: number | null; unassigned: number; version: number; updatedAt: string; updatedBy: string;
};

function managed(row: GeographyRow): ManagedGeographyNode {
  return {
    key: row.nodeKey,
    level: row.level,
    supplierId: Number(row.supplierId),
    parentKey: row.parentKey,
    title: row.supplierTitle,
    titleEn: row.supplierTitleEn,
    effectiveTitle: row.titleOverride || row.supplierTitle,
    effectiveTitleEn: row.titleEnOverride || row.supplierTitleEn,
    titleOverride: row.titleOverride,
    titleEnOverride: row.titleEnOverride,
    slug: row.slug,
    visible: row.visible === 1,
    featured: row.featured === 1,
    gpsLat: row.gpsLat,
    gpsLong: row.gpsLong,
    unassigned: row.unassigned === 1,
    version: Number(row.version),
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

const selectNodes = `SELECT node_key AS nodeKey, level, supplier_id AS supplierId, parent_key AS parentKey,
  supplier_title AS supplierTitle, supplier_title_en AS supplierTitleEn, title_override AS titleOverride,
  title_en_override AS titleEnOverride, slug, visible, featured, gps_lat AS gpsLat, gps_long AS gpsLong,
  unassigned, version, updated_at AS updatedAt, updated_by AS updatedBy FROM vii_geography_nodes`;

export async function readGeography(database: D1Database, visibleOnly = false) {
  const result = await database.prepare(`${selectNodes}${visibleOnly ? " WHERE visible = 1" : ""} ORDER BY level, supplier_title`).all<GeographyRow>();
  return result.results.map(managed).sort((left, right) => geographyLevels.indexOf(left.level) - geographyLevels.indexOf(right.level)
    || Number(right.featured) - Number(left.featured) || left.effectiveTitle.localeCompare(right.effectiveTitle, "he"));
}

export function parseGeographyChange(value: unknown) {
  const row = record(value);
  const key = text(row.key, 140);
  const titleOverride = text(row.titleOverride, 90);
  const titleEnOverride = text(row.titleEnOverride, 90);
  const slug = text(row.slug, 120).toLowerCase();
  const expectedVersion = id(row.expectedVersion);
  const gpsLat = row.gpsLat === null || row.gpsLat === "" ? null : coordinate(row.gpsLat, 29, 34);
  const gpsLong = row.gpsLong === null || row.gpsLong === "" ? null : coordinate(row.gpsLong, 34, 36);
  if (!/^(?:district|area|city):(?:\d+|manual-[a-f0-9-]+)$/.test(key) || expectedVersion === null
    || typeof row.visible !== "boolean" || typeof row.featured !== "boolean"
    || slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    || (row.gpsLat !== null && row.gpsLat !== "" && gpsLat === null)
    || (row.gpsLong !== null && row.gpsLong !== "" && gpsLong === null)) return null;
  return { key, titleOverride, titleEnOverride, slug, visible: row.visible, featured: row.featured, gpsLat, gpsLong, expectedVersion };
}

export async function saveGeographyNode(database: D1Database, change: NonNullable<ReturnType<typeof parseGeographyChange>>, actor: string) {
  const prior = await database.prepare(`${selectNodes} WHERE node_key = ?`).bind(change.key).first<GeographyRow>();
  if (!prior) return { error: "not_found" as const };
  if (Number(prior.version) !== change.expectedVersion) return { error: "version_conflict" as const };
  const version = change.expectedVersion + 1;
  const now = new Date().toISOString();
  const snapshot = managed({ ...prior, titleOverride: change.titleOverride, titleEnOverride: change.titleEnOverride,
    slug: change.slug, visible: change.visible ? 1 : 0, featured: change.featured ? 1 : 0,
    gpsLat: change.gpsLat, gpsLong: change.gpsLong, version, updatedAt: now, updatedBy: actor });
  await database.batch([
    database.prepare(`UPDATE vii_geography_nodes SET title_override = ?, title_en_override = ?, slug = ?, visible = ?,
      featured = ?, gps_lat = ?, gps_long = ?, version = ?, updated_at = ?, updated_by = ? WHERE node_key = ? AND version = ?`)
      .bind(change.titleOverride, change.titleEnOverride, change.slug, change.visible ? 1 : 0, change.featured ? 1 : 0,
        change.gpsLat, change.gpsLong, version, now, actor, change.key, change.expectedVersion),
    database.prepare(`INSERT INTO vii_geography_versions
      (id, node_key, version, snapshot_json, action, actor_email, created_at) VALUES (?, ?, ?, ?, 'save', ?, ?)`)
      .bind(crypto.randomUUID(), change.key, version, JSON.stringify(snapshot), actor, now),
  ]);
  return { node: snapshot };
}
