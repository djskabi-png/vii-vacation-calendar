import type { D1Database } from "../../types/cloudflare-runtime";

export type QualitySeverity = "critical" | "high" | "medium" | "low";
export type QualityStatus = "passed" | "failed" | "degraded" | "blocked";
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
};

// Production synthetics are intentionally read-only. Browser interaction and
// visual checks remain release-gate jobs; the recurring worker never creates a
// booking, lead, review, payment or message.
export const qualityRegistry: readonly QualityCheck[] = [
  { checkId: "global.home.html", family: "global-shell", world: "all", route: "/", viewport: "server", severity: "critical", cadenceMinutes: 10, timeoutMs: 8_000, expected: "HTML 200 with a non-empty document", releaseBlocking: true },
  { checkId: "search.location.html", family: "search", world: "all", route: "/search?location=%D7%9E%D7%A9%D7%9E%D7%A8%20%D7%94%D7%99%D7%A8%D7%93%D7%9F", viewport: "desktop", severity: "critical", cadenceMinutes: 10, timeoutMs: 10_000, expected: "Search returns HTML and never a 404/5xx", releaseBlocking: true },
  { checkId: "world.vacations.html", family: "global-shell", world: "vacations", route: "/search", viewport: "mobile", severity: "high", cadenceMinutes: 60, timeoutMs: 10_000, expected: "Vacation search world returns HTML", releaseBlocking: true },
  { checkId: "world.events.html", family: "global-shell", world: "events", route: "/events", viewport: "mobile", severity: "high", cadenceMinutes: 60, timeoutMs: 10_000, expected: "Events world returns HTML", releaseBlocking: true },
  { checkId: "world.hourly.html", family: "global-shell", world: "rooms", route: "/hourly", viewport: "mobile", severity: "high", cadenceMinutes: 60, timeoutMs: 10_000, expected: "Hourly world returns HTML", releaseBlocking: true },
  { checkId: "world.spas.html", family: "global-shell", world: "spa", route: "/spas", viewport: "mobile", severity: "high", cadenceMinutes: 60, timeoutMs: 10_000, expected: "Spa world returns HTML", releaseBlocking: true },
  { checkId: "place.vacation.sample", family: "place-pages", world: "vacations", route: "/business?id=vacation-116", viewport: "desktop", severity: "critical", cadenceMinutes: 60, timeoutMs: 12_000, expected: "Known place page returns HTML", releaseBlocking: true },
  { checkId: "seo.sitemap.xml", family: "seo-legacy", world: "all", route: "/sitemap.xml", viewport: "server", severity: "high", cadenceMinutes: 60, timeoutMs: 10_000, expected: "Sitemap returns XML", releaseBlocking: true },
] as const;

export function qualityHeartbeatWindow(now = new Date()) {
  return new Date(Math.floor(now.getTime() / 600_000) * 600_000);
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
      headers: { "user-agent": "VII-Quality-Monitor/1.0", accept: check.route.endsWith(".xml") ? "application/xml,text/xml" : "text/html" },
      signal: AbortSignal.timeout(check.timeoutMs),
    });
    const type = response.headers.get("content-type") || "";
    const body = await response.text();
    const expectedType = check.route.endsWith(".xml") ? /xml/i.test(type) || /^\s*<\?xml|<urlset|<sitemapindex/i.test(body) : /html/i.test(type) || /<!doctype html|<html/i.test(body);
    const passed = response.status >= 200 && response.status < 400 && expectedType && body.length >= 256;
    return { status: passed ? "passed" as const : "failed" as const, statusCode: response.status,
      durationMs: Date.now() - started, observed: passed ? `${response.status} ${type}; ${body.length} bytes` : `${response.status} ${type || "unknown"}; ${body.length} bytes`, url };
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
    ? `scheduled:${Math.floor(nowDate.getTime() / 600_000)}`
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
