import type { SupplierCatalogEntry, SupplierCatalogWorld } from "./supplier-catalog-store.ts";

export const catalogDiagnosticLimit = 100;
export const spaEditorialDiagnosticFields = ["title", "titleEN", "address", "city", "shortDescription", "about", "opening"] as const;
export type SpaEditorialDiagnosticField = typeof spaEditorialDiagnosticFields[number];
export type CatalogSyncDiagnostics = {
  spaEditorialReview?: {
    total: number;
    rejected: { supplierId: number; fields: SpaEditorialDiagnosticField[];
      reason: "content_changed" | "missing_title" | "baseline_unavailable" }[];
    truncated: boolean;
  };
  before?: number;
  candidate?: number;
  addedCount?: number;
  removedCount?: number;
  changedCount?: number;
  addedIds?: number[];
  removedIds?: number[];
  addedIdsTruncated?: boolean;
  removedIdsTruncated?: boolean;
  units?: {
    before: number; candidate: number; removedFromRetainedPlaces: number;
    removedWithPlaces: number; removedTotal: number;
    removed: { supplierId: number; childId: number; placeRemoved: boolean }[];
    truncated: boolean;
  };
  redirect?: { status: number; hostname: string | null };
  spaJsonFailure?: {
    httpStatus: number; contentType: string | null; responseBytes: number | null;
    firstCharacterKind: "json-like" | "html-like" | "other";
    parseErrorKind: "syntax_error" | "body_read_error" | "other";
  };
};

const diagnosticContentTypes = new Set(["application/json", "application/problem+json", "text/json",
  "text/html", "application/xhtml+xml", "text/plain", "application/octet-stream", "other"]);

function contentType(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // Only a known media type, never arbitrary header parameters or values.
  const mediaType = value.split(";", 1)[0].trim().toLowerCase();
  return diagnosticContentTypes.has(mediaType) ? mediaType : "other";
}

function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function id(value: unknown): value is number {
  return count(value) && value > 0;
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function hostname(value: unknown) {
  return typeof value === "string" && value.length <= 253 && /^[a-z0-9.-]+$/i.test(value) ? value.toLowerCase() : null;
}

// Explicit allowlist: never persist supplier payloads, contacts, URLs, headers or exception text.
export function sanitizeCatalogDiagnostics(value: unknown): CatalogSyncDiagnostics | undefined {
  const input = object(value);
  const output: CatalogSyncDiagnostics = {};
  const editorial = object(input.spaEditorialReview);
  if (count(editorial.total) && Array.isArray(editorial.rejected)) {
    const allowedFields = new Set<string>(spaEditorialDiagnosticFields);
    const allowedReasons = new Set(["content_changed", "missing_title", "baseline_unavailable"]);
    output.spaEditorialReview = {
      total: editorial.total,
      rejected: editorial.rejected.slice(0, catalogDiagnosticLimit).map(object)
        .filter((row) => id(row.supplierId) && allowedReasons.has(String(row.reason)))
        .map((row) => ({ supplierId: row.supplierId as number,
          fields: [...new Set(Array.isArray(row.fields) ? row.fields.filter((field): field is SpaEditorialDiagnosticField =>
            typeof field === "string" && allowedFields.has(field)) : [])],
          reason: row.reason as "content_changed" | "missing_title" | "baseline_unavailable" })),
      truncated: editorial.truncated === true || editorial.rejected.length > catalogDiagnosticLimit
        || editorial.total > editorial.rejected.length,
    };
  }
  for (const key of ["before", "candidate", "addedCount", "removedCount", "changedCount"] as const) {
    if (count(input[key])) output[key] = input[key];
  }
  for (const key of ["addedIds", "removedIds"] as const) {
    if (!Array.isArray(input[key])) continue;
    output[key] = input[key].slice(0, catalogDiagnosticLimit).filter(id);
    output[`${key}Truncated`] = input[`${key}Truncated`] === true || input[key].length > catalogDiagnosticLimit;
  }
  const units = object(input.units);
  if (["before", "candidate", "removedFromRetainedPlaces", "removedWithPlaces", "removedTotal"].every((key) => count(units[key]))) {
    const removed = Array.isArray(units.removed) ? units.removed : [];
    output.units = {
      before: units.before as number, candidate: units.candidate as number,
      removedFromRetainedPlaces: units.removedFromRetainedPlaces as number,
      removedWithPlaces: units.removedWithPlaces as number, removedTotal: units.removedTotal as number,
      removed: removed.slice(0, catalogDiagnosticLimit).map(object).filter((row) => id(row.supplierId) && id(row.childId))
        .map((row) => ({ supplierId: row.supplierId as number, childId: row.childId as number, placeRemoved: row.placeRemoved === true })),
      truncated: units.truncated === true || removed.length > catalogDiagnosticLimit,
    };
  }
  const redirect = object(input.redirect);
  if (count(redirect.status) && redirect.status >= 300 && redirect.status < 400) {
    output.redirect = { status: redirect.status, hostname: hostname(redirect.hostname) };
  }
  const spa = object(input.spaJsonFailure);
  if (count(spa.httpStatus) && spa.httpStatus >= 100 && spa.httpStatus <= 599) {
    output.spaJsonFailure = {
      httpStatus: spa.httpStatus, contentType: contentType(spa.contentType),
      responseBytes: count(spa.responseBytes) ? spa.responseBytes : null,
      firstCharacterKind: spa.firstCharacterKind === "json-like" || spa.firstCharacterKind === "html-like"
        ? spa.firstCharacterKind : "other",
      parseErrorKind: spa.parseErrorKind === "syntax_error" || spa.parseErrorKind === "body_read_error"
        ? spa.parseErrorKind : "other",
    };
  }
  return Object.keys(output).length ? output : undefined;
}

function childIds(world: SupplierCatalogWorld, entry: SupplierCatalogEntry): number[] {
  const summary = object(entry.summary);
  const detail = object(entry.detail);
  const children = world === "spa" ? summary.packages : world === "rooms" ? summary.rooms : detail.rooms;
  return Array.isArray(children) ? children.map((row) => object(row).id).filter(id) : [];
}

export function catalogInventoryDiagnostics(world: SupplierCatalogWorld, previous: SupplierCatalogEntry[], candidate: SupplierCatalogEntry[], changed: number) {
  const before = new Map(previous.map((entry) => [entry.supplierId, entry]));
  const next = new Map(candidate.map((entry) => [entry.supplierId, entry]));
  const removedIds = [...before.keys()].filter((value) => !next.has(value));
  const addedIds = [...next.keys()].filter((value) => !before.has(value));
  const removedUnits: NonNullable<CatalogSyncDiagnostics["units"]>["removed"] = [];
  let unitsBefore = 0;
  let removedWithPlaces = 0;
  for (const old of previous) {
    const oldChildren = childIds(world, old);
    unitsBefore += oldChildren.length;
    const updated = next.get(old.supplierId);
    const nextChildren = new Set(updated ? childIds(world, updated) : []);
    for (const childId of oldChildren.filter((value) => !nextChildren.has(value))) {
      if (!updated) removedWithPlaces += 1;
      removedUnits.push({ supplierId: old.supplierId, childId, placeRemoved: !updated });
    }
  }
  return sanitizeCatalogDiagnostics({
    before: previous.length, candidate: candidate.length, changedCount: changed,
    addedCount: addedIds.length, removedCount: removedIds.length, addedIds, removedIds,
    units: { before: unitsBefore, candidate: candidate.reduce((sum, entry) => sum + childIds(world, entry).length, 0),
      removedFromRetainedPlaces: removedUnits.length - removedWithPlaces,
      removedWithPlaces, removedTotal: removedUnits.length, removed: removedUnits },
  })!;
}

export class SupplierCatalogRedirectError extends Error {
  readonly diagnostics: CatalogSyncDiagnostics;
  constructor(code: "spa_redirect_not_allowed" | "sergey_redirect_not_allowed", status: number, location: string | null, base: string) {
    super(code);
    let host: string | null = null;
    try { host = hostname(new URL(location || "", base).hostname); } catch { /* Malformed Location: omit it. */ }
    this.diagnostics = { redirect: { status, hostname: location ? host : null } };
  }
}

export class SpaCatalogJsonError extends Error {
  readonly diagnostics: CatalogSyncDiagnostics;
  constructor(metadata: NonNullable<CatalogSyncDiagnostics["spaJsonFailure"]>) {
    super("invalid_spa_response");
    this.diagnostics = sanitizeCatalogDiagnostics({ spaJsonFailure: metadata })!;
  }
}

/** Fixed field names and IDs only. Never retain supplier prose in diagnostic history. */
export class SpaEditorialReviewError extends Error {
  readonly diagnostics: CatalogSyncDiagnostics;
  constructor(review: NonNullable<CatalogSyncDiagnostics["spaEditorialReview"]>) {
    super("catalog_editorial_requires_review");
    this.diagnostics = sanitizeCatalogDiagnostics({ spaEditorialReview: review })!;
  }
}
