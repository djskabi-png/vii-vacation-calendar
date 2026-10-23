import type { D1Database } from "../../types/cloudflare-runtime";

export type QualitySeverity = "critical" | "high" | "medium" | "low";
export type QualityStatus = "passed" | "failed" | "degraded" | "blocked";
export type QualityContentKind = "html" | "xml" | "json" | "image";
export type QualityCheck = {
  checkId: string;
  family: string;
  world: string;
  route: string;
  viewport: "server" | "desktop" | "mobile";
  severity: QualitySeverity;
  cadenceMinutes: number;
  timeoutMs: number;
  expected: string;
  releaseBlocking: boolean;
  contentKind?: QualityContentKind;
  minBytes?: number;
  requiredAll?: readonly string[];
  requiredAny?: readonly string[];
  forbidden?: readonly string[];
};

// Production synthetics are intentionally read-only. Browser interaction and
// visual checks remain release-gate jobs; the recurring worker never creates a
// booking, lead, review, payment or message.
const html = (input: Omit<QualityCheck, "contentKind" | "minBytes"> & Partial<Pick<QualityCheck, "minBytes">>): QualityCheck => ({ contentKind: "html", minBytes: 2_000, ...input });
const json = (input: Omit<QualityCheck, "contentKind" | "minBytes" | "viewport"> & Partial<Pick<QualityCheck, "minBytes">>): QualityCheck => ({ contentKind: "json", minBytes: 20, viewport: "server", ...input });
const image = (input: Omit<QualityCheck, "contentKind" | "minBytes" | "viewport"> & Partial<Pick<QualityCheck, "minBytes">>): QualityCheck => ({ contentKind: "image", minBytes: 8_000, viewport: "server", ...input });

// This is the production-safe layer of the VII QA pyramid. It validates the
// public contract without creating bookings, leads, calls, WhatsApp messages,
// payments or reviews. Browser interaction and visual matrices run separately.
export const qualityRegistry: readonly QualityCheck[] = [
  html({ checkId: "global.home.semantic", family: "global-shell", world: "all", route: "/", viewport: "desktop", severity: "critical", cadenceMinutes: 5, timeoutMs: 10_000, expected: "Home contains the public shell, search and discovery results", releaseBlocking: true, requiredAll: ["<main", "discovery-card"], requiredAny: ["\u05d7\u05d9\u05e4\u05d5\u05e9", "\u05e0\u05d5\u05e4\u05e9"] }),
  html({ checkId: "search.location.semantic", family: "search", world: "vacations", route: "/search?location=%D7%9E%D7%A9%D7%9E%D7%A8%20%D7%94%D7%99%D7%A8%D7%93%D7%9F", viewport: "desktop", severity: "critical", cadenceMinutes: 5, timeoutMs: 12_000, expected: "Sparse-location search remains a result page with place cards and no error surface", releaseBlocking: true, requiredAll: ["<main", "discovery-card"], forbidden: ["Error 1102", "Worker exceeded resource limits", "404 Not Found"] }),
  html({ checkId: "place.vacation.semantic", family: "place-pages", world: "vacations", route: "/business?id=vacation-116", viewport: "mobile", severity: "critical", cadenceMinutes: 5, timeoutMs: 14_000, expected: "Vacation place contains gallery, contacts, reviews and location", releaseBlocking: true, requiredAll: ["property-gallery", "tel:", "\u05d7\u05d5\u05d5\u05ea \u05d3\u05e2\u05ea", "\u05de\u05d9\u05e7\u05d5\u05dd"], requiredAny: ["\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4", "WhatsApp"] }),

  html({ checkId: "world.vacations.semantic", family: "world-landings", world: "vacations", route: "/search", viewport: "mobile", severity: "critical", cadenceMinutes: 10, timeoutMs: 12_000, expected: "Vacation results render cards and controls", releaseBlocking: true, requiredAll: ["<main", "discovery-card"] }),
  html({ checkId: "world.events.semantic", family: "world-landings", world: "events", route: "/events", viewport: "mobile", severity: "critical", cadenceMinutes: 10, timeoutMs: 14_000, expected: "Events landing renders cards and search controls", releaseBlocking: true, requiredAll: ["<main", "discovery-card"], requiredAny: ["\u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd", "\u05de\u05e7\u05d5\u05de\u05d5\u05ea \u05dc\u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd"] }),
  html({ checkId: "world.hourly.semantic", family: "world-landings", world: "hourly", route: "/hourly", viewport: "mobile", severity: "critical", cadenceMinutes: 10, timeoutMs: 12_000, expected: "Hourly landing renders cards and filters", releaseBlocking: true, requiredAll: ["<main", "discovery-card"], requiredAny: ["\u05d7\u05d3\u05e8\u05d9\u05dd \u05dc\u05e4\u05d9 \u05e9\u05e2\u05d4", "\u05e9\u05d4\u05d9\u05d9\u05d4 \u05dc\u05e4\u05d9 \u05e9\u05e2\u05d4"] }),
  html({ checkId: "world.spas.semantic", family: "world-landings", world: "spa", route: "/spas", viewport: "mobile", severity: "critical", cadenceMinutes: 10, timeoutMs: 12_000, expected: "Spa landing renders packages or spa cards", releaseBlocking: true, requiredAll: ["<main", "discovery-card"], requiredAny: ["\u05e1\u05e4\u05d0", "\u05d7\u05d1\u05d9\u05dc\u05d5\u05ea"] }),
  html({ checkId: "world.attractions.semantic", family: "world-landings", world: "activities", route: "/attractions", viewport: "mobile", severity: "high", cadenceMinutes: 10, timeoutMs: 12_000, expected: "Attractions landing renders paid experience cards", releaseBlocking: true, requiredAll: ["<main", "discovery-card"], requiredAny: ["\u05d0\u05d8\u05e8\u05e7\u05e6\u05d9\u05d5\u05ea", "\u05d7\u05d5\u05d5\u05d9\u05d5\u05ea"] }),

  html({ checkId: "place.event.semantic", family: "place-pages", world: "events", route: "/events/place/event-2575", viewport: "mobile", severity: "high", cadenceMinutes: 60, timeoutMs: 14_000, expected: "Event place contains gallery, contacts, reviews and booking inquiry", releaseBlocking: true, requiredAll: ["property-gallery", "tel:", "\u05d7\u05d5\u05d5\u05ea \u05d3\u05e2\u05ea", "event-booking"] }),
  html({ checkId: "place.hourly.semantic", family: "place-pages", world: "hourly", route: "/discover/place/hourly-475", viewport: "mobile", severity: "high", cadenceMinutes: 60, timeoutMs: 14_000, expected: "Hourly place contains gallery, contacts and location", releaseBlocking: true, requiredAll: ["tel:", "\u05de\u05d9\u05e7\u05d5\u05dd"], requiredAny: ["\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4", "WhatsApp", "\u05db\u05e0\u05d9\u05e1\u05d4 \u05d3\u05d9\u05e1\u05e7\u05e8\u05d8\u05d9\u05ea"] }),
  html({ checkId: "place.spa.semantic", family: "place-pages", world: "spa", route: "/discover/place/spa-6", viewport: "mobile", severity: "high", cadenceMinutes: 60, timeoutMs: 14_000, expected: "Spa place contains gallery or packages and location", releaseBlocking: true, requiredAll: ["\u05de\u05d9\u05e7\u05d5\u05dd"], requiredAny: ["\u05d7\u05d1\u05d9\u05dc\u05d5\u05ea", "\u05d8\u05d9\u05e4\u05d5\u05dc\u05d9\u05dd", "\u05d2\u05dc\u05e8"] }),
  html({ checkId: "world.trails.semantic", family: "world-landings", world: "trails", route: "/trails", viewport: "desktop", severity: "high", cadenceMinutes: 60, timeoutMs: 12_000, expected: "Trails explorer renders", releaseBlocking: true, requiredAll: ["<main"], requiredAny: ["\u05d8\u05d9\u05d5\u05dc\u05d9\u05dd", "\u05de\u05e1\u05dc\u05d5\u05dc\u05d9\u05dd"] }),
  html({ checkId: "world.providers.semantic", family: "world-landings", world: "providers", route: "/providers", viewport: "desktop", severity: "high", cadenceMinutes: 60, timeoutMs: 12_000, expected: "Providers catalog renders", releaseBlocking: true, requiredAll: ["<main"], requiredAny: ["\u05e1\u05e4\u05e7\u05d9\u05dd", "\u05e9\u05d9\u05e8\u05d5\u05ea\u05d9\u05dd"] }),
  html({ checkId: "world.holidays.semantic", family: "editorial-landings", world: "vacations", route: "/holidays", viewport: "mobile", severity: "high", cadenceMinutes: 60, timeoutMs: 12_000, expected: "Holiday index renders future holiday links", releaseBlocking: true, requiredAll: ["<main"], requiredAny: ["\u05d7\u05d2\u05d9\u05dd", "\u05e0\u05d5\u05e4\u05e9"] }),
  html({ checkId: "world.last-minute.semantic", family: "editorial-landings", world: "vacations", route: "/last-minute", viewport: "mobile", severity: "high", cadenceMinutes: 60, timeoutMs: 12_000, expected: "Last-minute permanent landing renders", releaseBlocking: true, requiredAll: ["<main"], requiredAny: ["\u05e8\u05d2\u05e2 \u05d4\u05d0\u05d7\u05e8\u05d5\u05df", "\u05e0\u05d5\u05e4\u05e9"] }),

  image({ checkId: "map.snapshot.vacation", family: "maps", world: "vacations", route: "/api/map-snapshot?world=vacation&id=vacation-116", severity: "critical", cadenceMinutes: 60, timeoutMs: 12_000, expected: "Stored vacation map snapshot is a valid image", releaseBlocking: true }),
  image({ checkId: "map.snapshot.event", family: "maps", world: "events", route: "/api/map-snapshot?world=events&id=event-2575", severity: "high", cadenceMinutes: 360, timeoutMs: 12_000, expected: "Stored event map snapshot is a valid image", releaseBlocking: true }),
  image({ checkId: "map.snapshot.hourly", family: "maps", world: "hourly", route: "/api/map-snapshot?world=hourly&id=hourly-475", severity: "high", cadenceMinutes: 360, timeoutMs: 12_000, expected: "Stored hourly map snapshot is a valid image", releaseBlocking: true }),
  image({ checkId: "map.snapshot.spa", family: "maps", world: "spa", route: "/api/map-snapshot?world=spa&id=spa-6", severity: "high", cadenceMinutes: 360, timeoutMs: 12_000, expected: "Stored spa map snapshot is a valid image", releaseBlocking: true }),

  json({ checkId: "api.catalog.vacations", family: "catalog-apis", world: "vacations", route: "/api/catalog?world=vacations&view=search", severity: "critical", cadenceMinutes: 10, timeoutMs: 14_000, expected: "Vacation search catalog is valid JSON with entries", releaseBlocking: true, requiredAll: ["\"world\":\"vacations\"", "\"entries\":"] }),
  json({ checkId: "api.catalog.events", family: "catalog-apis", world: "events", route: "/api/catalog?world=events&view=search", severity: "critical", cadenceMinutes: 10, timeoutMs: 14_000, expected: "Event search catalog is valid JSON with entries", releaseBlocking: true, requiredAll: ["\"world\":\"events\"", "\"entries\":"] }),
  json({ checkId: "api.catalog.hourly", family: "catalog-apis", world: "hourly", route: "/api/catalog?world=rooms", severity: "high", cadenceMinutes: 60, timeoutMs: 14_000, expected: "Hourly catalog is valid JSON with entries", releaseBlocking: true, requiredAll: ["\"world\":\"rooms\"", "\"entries\":"] }),
  json({ checkId: "api.catalog.spa", family: "catalog-apis", world: "spa", route: "/api/catalog?world=spa", severity: "high", cadenceMinutes: 60, timeoutMs: 14_000, expected: "Spa catalog is valid JSON with entries", releaseBlocking: true, requiredAll: ["\"world\":\"spa\"", "\"entries\":"] }),
  json({ checkId: "api.home.presentation", family: "home-sliders", world: "all", route: "/api/vii/homepage-presentation", severity: "high", cadenceMinutes: 60, timeoutMs: 10_000, expected: "Home slider presentation JSON is available", releaseBlocking: true, requiredAny: ["slider", "section", "world"] }),
  json({ checkId: "api.starting-prices", family: "pricing", world: "vacations", route: "/api/vii/starting-prices?world=vacations", severity: "high", cadenceMinutes: 60, timeoutMs: 12_000, expected: "Starting-price cache returns JSON", releaseBlocking: true, requiredAny: ["prices", "vacation-"] }),
  json({ checkId: "api.reviews.read", family: "reviews", world: "vacations", route: "/api/reviews?subjectId=vacation-116", severity: "medium", cadenceMinutes: 360, timeoutMs: 10_000, expected: "Review read API returns a JSON collection", releaseBlocking: false, requiredAny: ["reviews", "items", "[]"] }),

  html({ checkId: "content.guides", family: "content-pages", world: "all", route: "/guides", viewport: "desktop", severity: "medium", cadenceMinutes: 360, timeoutMs: 10_000, expected: "Guides index renders", releaseBlocking: false, requiredAll: ["<main"] }),
  html({ checkId: "content.questions", family: "content-pages", world: "all", route: "/questions", viewport: "desktop", severity: "medium", cadenceMinutes: 360, timeoutMs: 10_000, expected: "Questions page renders", releaseBlocking: false, requiredAll: ["<main"], requiredAny: ["\u05e9\u05d0\u05dc\u05d5\u05ea", "\u05ea\u05e9\u05d5\u05d1\u05d5\u05ea"] }),
  html({ checkId: "content.contact", family: "content-pages", world: "all", route: "/contact", viewport: "mobile", severity: "medium", cadenceMinutes: 360, timeoutMs: 10_000, expected: "Contact page renders", releaseBlocking: false, requiredAll: ["<main"], requiredAny: ["\u05d9\u05e6\u05d9\u05e8\u05ea \u05e7\u05e9\u05e8", "\u05e4\u05e0\u05d9\u05d9\u05d4"] }),
  html({ checkId: "legal.terms", family: "public-trust", world: "all", route: "/legal/terms", viewport: "server", severity: "high", cadenceMinutes: 1440, timeoutMs: 10_000, expected: "Terms page renders", releaseBlocking: true, requiredAll: ["<main"], requiredAny: ["\u05ea\u05e7\u05e0\u05d5\u05df", "\u05ea\u05e0\u05d0\u05d9 \u05e9\u05d9\u05de\u05d5\u05e9"] }),
  html({ checkId: "legal.privacy", family: "public-trust", world: "all", route: "/legal/privacy", viewport: "server", severity: "high", cadenceMinutes: 1440, timeoutMs: 10_000, expected: "Privacy page renders", releaseBlocking: true, requiredAll: ["<main"], requiredAny: ["\u05e4\u05e8\u05d8\u05d9\u05d5\u05ea", "\u05de\u05d9\u05d3\u05e2"] }),
  { checkId: "seo.sitemap.xml", family: "seo-legacy", world: "all", route: "/sitemap.xml", viewport: "server", severity: "high", cadenceMinutes: 360, timeoutMs: 12_000, expected: "Sitemap returns populated XML", releaseBlocking: true, contentKind: "xml", minBytes: 1_000, requiredAny: ["<urlset", "<sitemapindex"] },
] as const;

export function qualityHeartbeatWindow(now = new Date()) {
  return new Date(Math.floor(now.getTime() / 300_000) * 300_000);
}

export function shouldStartQualityHeartbeat(request: Request) {
  if (request.method !== "GET") return false;
  if ((request.headers.get("user-agent") || "").includes("VII-Quality-Monitor/")) return false;
  return (request.headers.get("accept") || "").includes("text/html");
}

const schema = [
  `CREATE TABLE IF NOT EXISTS quality_checks (
    check_id TEXT PRIMARY KEY, family TEXT NOT NULL, world TEXT NOT NULL, route TEXT NOT NULL,
    viewport TEXT NOT NULL, severity TEXT NOT NULL, cadence_minutes INTEGER NOT NULL,
    timeout_ms INTEGER NOT NULL, expected TEXT NOT NULL, release_blocking INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS quality_runs (
    id TEXT PRIMARY KEY, operation_key TEXT NOT NULL UNIQUE, trigger_kind TEXT NOT NULL, release_id TEXT, status TEXT NOT NULL,
    started_at TEXT NOT NULL, finished_at TEXT, passed_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0, degraded_count INTEGER NOT NULL DEFAULT 0,
    blocked_count INTEGER NOT NULL DEFAULT 0, duration_ms INTEGER, actor TEXT)`,
  `CREATE INDEX IF NOT EXISTS quality_runs_started ON quality_runs(started_at DESC)`,
  `CREATE TABLE IF NOT EXISTS quality_results (
    id TEXT PRIMARY KEY, run_id TEXT NOT NULL, check_id TEXT NOT NULL, status TEXT NOT NULL,
    status_code INTEGER, duration_ms INTEGER NOT NULL, observed TEXT NOT NULL, evidence_url TEXT,
    checked_at TEXT NOT NULL, UNIQUE(run_id,check_id))`,
  `CREATE INDEX IF NOT EXISTS quality_results_run ON quality_results(run_id,checked_at DESC)`,
  `CREATE TABLE IF NOT EXISTS quality_incidents (
    id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL UNIQUE, check_id TEXT NOT NULL, family TEXT NOT NULL,
    world TEXT NOT NULL, route TEXT NOT NULL, viewport TEXT NOT NULL, severity TEXT NOT NULL,
    status TEXT NOT NULL, first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
    recovered_at TEXT, acknowledged_at TEXT, acknowledged_by TEXT, resolved_at TEXT,
    resolved_by TEXT, occurrences INTEGER NOT NULL DEFAULT 1, last_result_id TEXT NOT NULL,
    last_observed TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS quality_incidents_status ON quality_incidents(status,severity,last_seen_at DESC)`,
  `CREATE TABLE IF NOT EXISTS quality_notification_deliveries (
    id TEXT PRIMARY KEY, incident_id TEXT NOT NULL, channel TEXT NOT NULL, event_kind TEXT NOT NULL,
    status TEXT NOT NULL, provider_message_id TEXT, reason TEXT, created_at TEXT NOT NULL,
    UNIQUE(incident_id,channel,event_kind))`,
] as const;

export async function ensureQualitySchema(db: D1Database) {
  await db.batch(schema.map((statement) => db.prepare(statement)));
}

function fingerprint(check: QualityCheck) {
  return `production:${check.checkId}:${check.route}:${check.viewport}`;
}

export function incidentTransition(previous: { status: string; occurrences: number } | null, result: QualityStatus) {
  if (result === "passed") return previous ? { action: "recover" as const, occurrences: previous.occurrences } : { action: "none" as const, occurrences: 0 };
  return previous ? { action: "update" as const, occurrences: previous.occurrences + 1 } : { action: "open" as const, occurrences: 1 };
}

async function registerChecks(db: D1Database, now: string) {
  await db.batch(qualityRegistry.map((check) => db.prepare(`INSERT INTO quality_checks
    (check_id,family,world,route,viewport,severity,cadence_minutes,timeout_ms,expected,release_blocking,active,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,1,?) ON CONFLICT(check_id) DO UPDATE SET family=excluded.family,world=excluded.world,
    route=excluded.route,viewport=excluded.viewport,severity=excluded.severity,cadence_minutes=excluded.cadence_minutes,
    timeout_ms=excluded.timeout_ms,expected=excluded.expected,release_blocking=excluded.release_blocking,active=1,updated_at=excluded.updated_at`)
    .bind(check.checkId, check.family, check.world, check.route, check.viewport, check.severity,
      check.cadenceMinutes, check.timeoutMs, check.expected, check.releaseBlocking ? 1 : 0, now)));
}

function checksDue(now: Date, trigger: "scheduled" | "manual") {
  if (trigger === "manual") return [...qualityRegistry];
  const minute = Math.floor(now.getTime() / 60_000);
  return qualityRegistry.filter((check) => minute % check.cadenceMinutes === 0);
}

async function executeCheck(check: QualityCheck, origin: string, fetcher: typeof fetch) {
  const started = Date.now();
  const url = new URL(check.route, origin).toString();
  try {
    const response = await fetcher(url, {
      method: "GET",
      redirect: "follow",
      headers: { "user-agent": "VII-Quality-Monitor/2.0", accept: check.contentKind === "image" ? "image/avif,image/webp,image/png,image/jpeg" : check.contentKind === "json" ? "application/json" : check.contentKind === "xml" ? "application/xml,text/xml" : "text/html" },
      signal: AbortSignal.timeout(check.timeoutMs),
    });
    const type = response.headers.get("content-type") || "";
    const bytes = new Uint8Array(await response.arrayBuffer());
    const body = check.contentKind === "image" ? "" : new TextDecoder().decode(bytes);
    const expectedType = check.contentKind === "image" ? /^image\/(?:avif|webp|png|jpeg)/i.test(type)
      : check.contentKind === "json" ? /json/i.test(type) && (() => { try { JSON.parse(body); return true; } catch { return false; } })()
      : check.contentKind === "xml" ? /xml/i.test(type) || /^\s*<\?xml|<urlset|<sitemapindex/i.test(body)
      : /html/i.test(type) || /<!doctype html|<html/i.test(body);
    const missingAll = (check.requiredAll || []).filter((token) => !body.includes(token));
    const hasAny = !check.requiredAny?.length || check.requiredAny.some((token) => body.includes(token));
    const forbidden = (check.forbidden || []).filter((token) => body.includes(token));
    const passed = response.status >= 200 && response.status < 400 && expectedType && bytes.byteLength >= (check.minBytes || 256)
      && missingAll.length === 0 && hasAny && forbidden.length === 0;
    const assertions = [
      missingAll.length ? `missing:${missingAll.join("|")}` : null,
      !hasAny ? `missing-any:${check.requiredAny?.join("|")}` : null,
      forbidden.length ? `forbidden:${forbidden.join("|")}` : null,
    ].filter(Boolean).join("; ");
    return { status: passed ? "passed" as const : "failed" as const, statusCode: response.status,
      durationMs: Date.now() - started, observed: `${response.status} ${type || "unknown"}; ${bytes.byteLength} bytes${assertions ? `; ${assertions}` : ""}`, url };
  } catch (error) {
    return { status: "failed" as const, statusCode: null, durationMs: Date.now() - started,
      observed: error instanceof Error ? error.message.slice(0, 500) : "unknown fetch failure", url };
  }
}

async function reconcileIncident(db: D1Database, check: QualityCheck, result: { id: string; status: QualityStatus; observed: string }, now: string) {
  if (result.status === "passed") {
    const unresolved = await db.prepare(`SELECT id FROM quality_incidents WHERE check_id=? AND status!='resolved'`)
      .bind(check.checkId).all<{ id: string }>();
    for (const incident of unresolved.results || []) {
      await db.prepare(`UPDATE quality_incidents SET status='resolved',last_seen_at=?,recovered_at=?,resolved_at=?,resolved_by='automatic-recovery',last_result_id=?,last_observed=? WHERE id=?`)
        .bind(now, now, now, result.id, result.observed, incident.id).run();
      await db.prepare(`INSERT INTO quality_notification_deliveries
        (id,incident_id,channel,event_kind,status,provider_message_id,reason,created_at)
        VALUES (?,?,'email','recovered','disabled',NULL,'verified_email_provider_not_configured',?)
        ON CONFLICT(incident_id,channel,event_kind) DO NOTHING`).bind(crypto.randomUUID(), incident.id, now).run();
    }
    return;
  }
  const key = fingerprint(check);
  const prior = await db.prepare(`SELECT id,status,occurrences FROM quality_incidents WHERE fingerprint=?`).bind(key)
    .first<{ id: string; status: string; occurrences: number }>();
  const transition = incidentTransition(prior, result.status);
  if (transition.action === "none") return;
  if (transition.action === "open") {
    const incidentId = crypto.randomUUID();
    await db.prepare(`INSERT INTO quality_incidents
      (id,fingerprint,check_id,family,world,route,viewport,severity,status,first_seen_at,last_seen_at,recovered_at,
       acknowledged_at,acknowledged_by,resolved_at,resolved_by,occurrences,last_result_id,last_observed)
      VALUES (?,?,?,?,?,?,?,?,'open',?,?,NULL,NULL,NULL,NULL,NULL,1,?,?)`)
      .bind(incidentId, key, check.checkId, check.family, check.world, check.route, check.viewport, check.severity, now, now, result.id, result.observed).run();
    await db.prepare(`INSERT INTO quality_notification_deliveries
      (id,incident_id,channel,event_kind,status,provider_message_id,reason,created_at)
      VALUES (?,?,'email','opened','disabled',NULL,'verified_email_provider_not_configured',?)
      ON CONFLICT(incident_id,channel,event_kind) DO NOTHING`).bind(crypto.randomUUID(), incidentId, now).run();
    return;
  }
  await db.prepare(`UPDATE quality_incidents SET status='open',last_seen_at=?,recovered_at=NULL,resolved_at=NULL,resolved_by=NULL,
    occurrences=?,last_result_id=?,last_observed=? WHERE fingerprint=?`)
    .bind(now, transition.occurrences, result.id, result.observed, key).run();
}

export async function runQualityChecks(db: D1Database, options: {
  origin: string; trigger: "scheduled" | "manual"; scheduledAt?: Date; releaseId?: string; actor?: string; fetcher?: typeof fetch;
}) {
  const nowDate = options.scheduledAt || new Date();
  const now = nowDate.toISOString();
  const runId = crypto.randomUUID();
  const operationKey = options.trigger === "scheduled"
    ? `scheduled:${Math.floor(nowDate.getTime() / 300_000)}`
    : `manual:${runId}`;
  const started = Date.now();
  await ensureQualitySchema(db);
  await registerChecks(db, now);
  const due = checksDue(nowDate, options.trigger);
  await db.prepare(`INSERT INTO quality_runs (id,operation_key,trigger_kind,release_id,status,started_at,actor) VALUES (?,?,?,?,'running',?,?)
    ON CONFLICT(operation_key) DO NOTHING`).bind(runId, operationKey, options.trigger, options.releaseId || null, now, options.actor || null).run();
  const claimed = await db.prepare(`SELECT id,status FROM quality_runs WHERE operation_key=?`).bind(operationKey).first<{ id: string; status: string }>();
  if (!claimed || claimed.id !== runId) return { runId: claimed?.id || null, status: "skipped" as const, counts: null, checkCount: 0, startedAt: now, finishedAt: null };
  const counts = { passed: 0, failed: 0, degraded: 0, blocked: 0 };
  for (const check of due) {
    const observed = await executeCheck(check, options.origin, options.fetcher || fetch);
    const resultId = crypto.randomUUID();
    counts[observed.status] += 1;
    await db.prepare(`INSERT INTO quality_results (id,run_id,check_id,status,status_code,duration_ms,observed,evidence_url,checked_at)
      VALUES (?,?,?,?,?,?,?,?,?)`).bind(resultId, runId, check.checkId, observed.status, observed.statusCode,
      observed.durationMs, observed.observed, observed.url, new Date().toISOString()).run();
    await reconcileIncident(db, check, { id: resultId, status: observed.status, observed: observed.observed }, new Date().toISOString());
  }
  const finished = new Date().toISOString();
  const status = counts.failed || counts.blocked ? "failed" : counts.degraded ? "degraded" : "passed";
  await db.prepare(`UPDATE quality_runs SET status=?,finished_at=?,passed_count=?,failed_count=?,degraded_count=?,blocked_count=?,duration_ms=? WHERE id=?`)
    .bind(status, finished, counts.passed, counts.failed, counts.degraded, counts.blocked, Date.now() - started, runId).run();
  return { runId, status, counts, checkCount: due.length, startedAt: now, finishedAt: finished };
}

export async function readQualityDashboard(db: D1Database) {
  await ensureQualitySchema(db);
  const [runs, incidents, deliveries, checks] = await Promise.all([
    db.prepare(`SELECT id,operation_key AS operationKey,trigger_kind AS triggerKind,release_id AS releaseId,status,started_at AS startedAt,finished_at AS finishedAt,
      passed_count AS passedCount,failed_count AS failedCount,degraded_count AS degradedCount,blocked_count AS blockedCount,duration_ms AS durationMs,actor
      FROM quality_runs ORDER BY started_at DESC LIMIT 30`).all(),
    db.prepare(`SELECT id,check_id AS checkId,family,world,route,viewport,severity,status,first_seen_at AS firstSeenAt,last_seen_at AS lastSeenAt,
      recovered_at AS recoveredAt,acknowledged_at AS acknowledgedAt,acknowledged_by AS acknowledgedBy,resolved_at AS resolvedAt,
      occurrences,last_observed AS lastObserved FROM quality_incidents ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END,last_seen_at DESC LIMIT 100`).all(),
    db.prepare(`SELECT incident_id AS incidentId,channel,event_kind AS eventKind,status,provider_message_id AS providerMessageId,reason,created_at AS createdAt
      FROM quality_notification_deliveries ORDER BY created_at DESC LIMIT 50`).all(),
    db.prepare(`SELECT check_id AS checkId,family,world,route,viewport,severity,cadence_minutes AS cadenceMinutes,expected,release_blocking AS releaseBlocking,active,updated_at AS updatedAt
      FROM quality_checks ORDER BY severity,check_id`).all(),
  ]);
  return { generatedAt: new Date().toISOString(), notificationProvider: { email: "not_configured" }, checks: checks.results, runs: runs.results, incidents: incidents.results, deliveries: deliveries.results };
}

export async function updateQualityIncident(db: D1Database, input: { incidentId: string; action: "acknowledge" | "resolve" | "reopen"; actor: string }) {
  await ensureQualitySchema(db);
  const now = new Date().toISOString();
  if (input.action === "acknowledge") await db.prepare(`UPDATE quality_incidents SET status='acknowledged',acknowledged_at=?,acknowledged_by=? WHERE id=? AND status='open'`).bind(now, input.actor, input.incidentId).run();
  if (input.action === "resolve") await db.prepare(`UPDATE quality_incidents SET status='resolved',resolved_at=?,resolved_by=? WHERE id=? AND status!='resolved'`).bind(now, input.actor, input.incidentId).run();
  if (input.action === "reopen") await db.prepare(`UPDATE quality_incidents SET status='open',resolved_at=NULL,resolved_by=NULL,recovered_at=NULL,last_seen_at=? WHERE id=?`).bind(now, input.incidentId).run();
  return db.prepare(`SELECT id,status,acknowledged_at AS acknowledgedAt,resolved_at AS resolvedAt FROM quality_incidents WHERE id=?`).bind(input.incidentId).first();
}
