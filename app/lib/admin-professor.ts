import type { D1Database } from "../../types/cloudflare-runtime";
import { loadCachedBizConversions } from "./biz-conversion-cache.ts";
import { publicCatalogSummaries } from "./public-catalog-read.ts";
import { parseProfessorIntent, type ProfessorIntent, type ProfessorMetric, type ProfessorPlace, type ProfessorRange, type ProfessorWorld } from "./admin-professor-intent.ts";

type MetricValues = {
  impressions: number; pageViews: number; phone: number; whatsapp: number; viiBookings: number;
  bizCalls: number | null; bizWhatsapp: number | null; bizOrders: number | null; bizRevenue: number | null;
};
type ProfessorAnswer = {
  answer: string; range: ProfessorRange; compareRange: ProfessorRange | null; place: ProfessorPlace | null; world: ProfessorWorld | null;
  metrics: MetricValues; comparison: Partial<Record<ProfessorMetric, number | null>> | null;
  insights: Array<{ kind: "up" | "down" | "neutral" | "conversion" | "warning"; title: string; detail: string }>;
  plan: { scope: string; metrics: ProfessorMetric[]; source: string }; ranking: Array<{ name: string; value: number }>;
  freshness: { internal: string; biz: string | null; coverage: string; bizRange?: ProfessorRange | null }; reportHref: string;
};

export class ProfessorQuestionError extends Error {
  constructor(readonly code: "clarification_required" | "unsupported_question", message: string) { super(message); this.name = "ProfessorQuestionError"; }
}

const schema = [
  `CREATE TABLE IF NOT EXISTS vii_professor_quota_v1 (email TEXT PRIMARY KEY NOT NULL, daily_limit INTEGER NOT NULL DEFAULT 20, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS vii_professor_questions_v1 (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL, question TEXT NOT NULL, answer_json TEXT NOT NULL, status TEXT NOT NULL, duration_ms INTEGER NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_vii_professor_questions_email_day ON vii_professor_questions_v1(email, created_at)`,
];

export async function ensureProfessorSchema(db: D1Database) { await db.batch(schema.map((sql) => db.prepare(sql))); }
const day = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const nextDay = (value: string) => { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString(); };
const WORLD_LABEL: Record<ProfessorWorld, string> = { vacations: "כל הנופש", events: "כל האירועים", rooms: "כל החדרים לפי שעה", spa: "כל הספא" };
const WORLD_DB: Record<ProfessorWorld, string[]> = { vacations: ["vacation", "vacations"], events: ["event", "events"], rooms: ["hourly", "room", "rooms"], spa: ["spa"] };
const METRIC_LABEL: Record<ProfessorMetric, string> = {
  impressions: "חשיפות", pageViews: "כניסות לעמודים", phone: "פעולות טלפון ב־V", whatsapp: "פניות WhatsApp ב־V",
  viiBookings: "בקשות הזמנה מ־V", bizCalls: "שיחות Maskyoo", bizWhatsapp: "שיחות WhatsApp ב־Biz", bizOrders: "הזמנות Biz", bizRevenue: "הכנסות Biz",
};

async function inventory(): Promise<ProfessorPlace[]> {
  const [vacations, events, rooms, spa] = await Promise.all(["vacations", "events", "rooms", "spa"].map((world) => publicCatalogSummaries<Record<string, unknown>>(world)));
  return [[vacations, "vacations", "vacation"], [events, "events", "event"], [rooms, "rooms", "hourly"], [spa, "spa", "spa"]].flatMap(([rows, world, prefix]) => (rows as Record<string, unknown>[]).flatMap((row) => {
    const siteID = Number(row.supplierId || (typeof row.id === "string" ? row.id.match(/\d+$/)?.[0] : row.id));
    const name = String(row.name || row.title || "").trim(); if (!name) return [];
    return [{ placeId: Number.isSafeInteger(siteID) && siteID > 0 ? `${prefix}-${siteID}` : String(row.id || ""), name, world: world as ProfessorWorld, siteID: Number.isSafeInteger(siteID) && siteID > 0 ? siteID : null }];
  }));
}

function scopeWhere(intent: ProfessorIntent, alias = "") {
  const column = (name: string) => `${alias}${name}`;
  if (intent.place) return { sql: ` AND ${column("place_id")} = ?`, values: [intent.place.placeId] as unknown[] };
  if (intent.world) { const worlds = WORLD_DB[intent.world]; return { sql: ` AND ${column("world")} IN (${worlds.map(() => "?").join(",")})`, values: worlds as unknown[] }; }
  return { sql: "", values: [] as unknown[] };
}

async function metricSnapshot(db: D1Database, range: ProfessorRange, intent: ProfessorIntent) {
  const since = `${range.from}T00:00:00.000Z`; const until = nextDay(range.till); const scope = scopeWhere(intent);
  const internal = await db.prepare(`SELECT
    SUM(CASE WHEN name = 'impression' THEN 1 ELSE 0 END) AS impressions,
    SUM(CASE WHEN name = 'page_view' THEN 1 ELSE 0 END) AS pageViews,
    SUM(CASE WHEN name IN ('phone_reveal','phone_click') THEN 1 ELSE 0 END) AS phone,
    SUM(CASE WHEN name IN ('whatsapp_lead','whatsapp_handoff') THEN 1 ELSE 0 END) AS whatsapp
    FROM vii_business_events WHERE created_at >= ? AND created_at < ? AND internal = 0${scope.sql}`)
    .bind(since, until, ...scope.values).first<{ impressions: number; pageViews: number; phone: number; whatsapp: number }>();
  const bookingScope = scopeWhere(intent);
  const bookings = await db.prepare(`SELECT COUNT(*) AS total FROM vii_booking_audit WHERE created_at >= ? AND created_at < ?${bookingScope.sql}`)
    .bind(since, until, ...bookingScope.values).first<{ total: number }>();
  let bizRange = range;
  let cached = await loadCachedBizConversions(db, range.from, range.till).catch(() => []);
  if (!cached.length) {
    const today = day(new Date());
    const yesterday = new Date(`${today}T12:00:00Z`); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const closedTill = day(yesterday);
    if (range.from <= closedTill && range.till >= today) {
      bizRange = { from: range.from, till: closedTill, label: `${range.from} עד ${closedTill}` };
      cached = await loadCachedBizConversions(db, bizRange.from, bizRange.till).catch(() => []);
    }
  }
  const selected = cached.filter((row) => intent.place?.siteID ? row.siteID === intent.place.siteID && row.world === intent.place.world : intent.world && intent.world !== "spa" ? row.world === intent.world : !intent.world);
  const bizSupported = intent.world !== "spa" && (!intent.place || intent.place.world !== "spa");
  const hasBiz = bizSupported && selected.length > 0;
  const sum = (pick: (row: typeof selected[number]) => number) => selected.reduce((total, row) => total + pick(row), 0);
  const metrics: MetricValues = {
    impressions: Number(internal?.impressions || 0), pageViews: Number(internal?.pageViews || 0), phone: Number(internal?.phone || 0), whatsapp: Number(internal?.whatsapp || 0), viiBookings: Number(bookings?.total || 0),
    bizCalls: hasBiz ? sum((row) => row.conversions.summary.maskyoo.contacts) : null,
    bizWhatsapp: hasBiz ? sum((row) => row.conversions.summary.whatsapp.contacts) : null,
    bizOrders: hasBiz ? sum((row) => row.conversions.summary.all.orders) : null,
    bizRevenue: hasBiz ? sum((row) => row.conversions.summary.all.revenue) : null,
  };
  return { metrics, bizSavedAt: selected.map((row) => row.cache.savedAt).sort().at(-1) || null, bizRows: selected.length,
    bizSupported, bizRange: selected.length ? bizRange : null };
}

async function ranking(db: D1Database, range: ProfessorRange, intent: ProfessorIntent, places: ProfessorPlace[]) {
  if (!intent.ranking) return [];
  const since = `${range.from}T00:00:00.000Z`; const until = nextDay(range.till); const scope = scopeWhere({ ...intent, place: null });
  const requested = intent.metrics[0];
  const eventNames: Partial<Record<ProfessorMetric, string[]>> = { impressions: ["impression"], pageViews: ["page_view"], phone: ["phone_reveal", "phone_click"], whatsapp: ["whatsapp_lead", "whatsapp_handoff"] };
  const names = eventNames[requested];
  if (!names?.length && ["bizCalls", "bizWhatsapp", "bizOrders", "bizRevenue"].includes(requested)) {
    let cached = await loadCachedBizConversions(db, range.from, range.till).catch(() => []);
    if (!cached.length) {
      const today = day(new Date()); const yesterday = new Date(`${today}T12:00:00Z`); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const closedTill = day(yesterday);
      if (range.from <= closedTill && range.till >= today) cached = await loadCachedBizConversions(db, range.from, closedTill).catch(() => []);
    }
    const allowedWorlds = intent.world && intent.world !== "spa" ? new Set(WORLD_DB[intent.world]) : null;
    const labelByKey = new Map(places.filter((place) => place.siteID).map((place) => [`${place.world}:${place.siteID}`, place.name]));
    const pick = (row: typeof cached[number]) => requested === "bizCalls" ? row.conversions.summary.maskyoo.contacts
      : requested === "bizWhatsapp" ? row.conversions.summary.whatsapp.contacts
        : requested === "bizOrders" ? row.conversions.summary.all.orders : row.conversions.summary.all.revenue;
    return cached.filter((row) => !allowedWorlds || allowedWorlds.has(row.world)).map((row) => ({
      name: labelByKey.get(`${row.world}:${row.siteID}`) || `${row.world}-${row.siteID}`, value: pick(row),
    })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "he")).slice(0, 5);
  }
  if (!names?.length) return [];
  const rows = await db.prepare(`SELECT MAX(place_name) AS name, COUNT(*) AS value FROM vii_business_events
    WHERE created_at >= ? AND created_at < ? AND internal = 0${scope.sql} AND name IN (${names.map(() => "?").join(",")})
    GROUP BY place_id ORDER BY value DESC, name ASC LIMIT 5`).bind(since, until, ...scope.values, ...names).all<{ name: string; value: number }>();
  return rows.results.map((row) => ({ name: row.name, value: Number(row.value || 0) }));
}

function scopeLabel(intent: ProfessorIntent) { return intent.place?.name || (intent.world ? WORLD_LABEL[intent.world] : "כל העסקים"); }
function metricValue(metrics: MetricValues, metric: ProfessorMetric) { return metrics[metric]; }
function formatMetric(metric: ProfessorMetric, value: number | null) {
  if (value === null) return `${METRIC_LABEL[metric]}: לא נשמר במטמון לטווח הזה`;
  return `${METRIC_LABEL[metric]}: ${value.toLocaleString("he-IL")}${metric === "bizRevenue" ? " ₪" : ""}`;
}
function answerText(intent: ProfessorIntent, current: MetricValues, comparison: MetricValues | null, ranked: Array<{ name: string; value: number }>) {
  const requested = intent.metrics.map((metric) => formatMetric(metric, metricValue(current, metric)));
  const comparisonText = comparison ? intent.metrics.flatMap((metric) => {
    const value = metricValue(current, metric); const previous = metricValue(comparison, metric);
    if (value === null || previous === null) return [];
    const delta = value - previous; const direction = delta > 0 ? "עלייה" : delta < 0 ? "ירידה" : "ללא שינוי";
    return `${METRIC_LABEL[metric]}: ${direction}${delta ? ` של ${Math.abs(delta).toLocaleString("he-IL")}` : ""}`;
  }).join("; ") : "";
  const rankingText = ranked.length ? ` המובילים לפי ${METRIC_LABEL[intent.metrics[0]]}: ${ranked.map((row, index) => `${index + 1}. ${row.name}, ${row.value.toLocaleString("he-IL")}`).join("; ")}.` : "";
  return `היי אדיר, ${intent.range.label} עבור ${scopeLabel(intent)}. ${requested.join("; ")}.${comparisonText ? ` בהשוואה לתקופה הקודמת: ${comparisonText}.` : ""}${rankingText}`;
}

function buildInsights(intent: ProfessorIntent, current: MetricValues, comparison: MetricValues | null) {
  const insights: ProfessorAnswer["insights"] = [];
  if (comparison) intent.metrics.forEach((metric) => {
    const value = metricValue(current, metric); const previous = metricValue(comparison, metric);
    if (value === null || previous === null) return;
    const delta = value - previous; const percent = previous === 0 ? null : Math.round(delta / previous * 100);
    insights.push({ kind: delta > 0 ? "up" : delta < 0 ? "down" : "neutral", title: METRIC_LABEL[metric], detail: delta === 0
      ? "ללא שינוי מול התקופה הקודמת"
      : `${delta > 0 ? "עלייה" : "ירידה"} של ${Math.abs(delta).toLocaleString("he-IL")}${percent === null ? "" : ` (${Math.abs(percent).toLocaleString("he-IL")}%)`} מול התקופה הקודמת` });
  });
  const contacts = (current.bizCalls || 0) + (current.bizWhatsapp || 0);
  if (contacts > 0 && current.bizOrders && current.bizOrders > 0) insights.unshift({ kind: "conversion", title: "יחס קשר להזמנה", detail: `הזמנה אחת לכל ${Math.max(1, Math.round(contacts / current.bizOrders)).toLocaleString("he-IL")} אנשי קשר שנשמרו ב־Biz` });
  const unavailable = intent.metrics.filter((metric) => metricValue(current, metric) === null);
  if (unavailable.length) insights.push({ kind: "warning", title: "כיסוי נתונים חלקי", detail: `${unavailable.map((metric) => METRIC_LABEL[metric]).join(", ")} לא נשמרו לטווח הזה ולכן לא חושבו` });
  return insights.slice(0, 5);
}

async function previousProfessorContext(db: D1Database, email: string) {
  const row = await db.prepare("SELECT answer_json AS answerJson FROM vii_professor_questions_v1 WHERE email = ? AND status = 'success' ORDER BY created_at DESC LIMIT 1")
    .bind(email.trim().toLowerCase()).first<{ answerJson: string }>();
  if (!row?.answerJson) return null;
  try { return JSON.parse(row.answerJson) as ProfessorAnswer; } catch { return null; }
}

export async function professorQuota(db: D1Database, email: string) {
  await ensureProfessorSchema(db); const normalized = email.trim().toLowerCase();
  const row = await db.prepare("SELECT daily_limit AS dailyLimit FROM vii_professor_quota_v1 WHERE email = ?").bind(normalized).first<{ dailyLimit: number }>();
  const start = `${day(new Date())}T00:00:00`; const used = await db.prepare("SELECT COUNT(*) AS total FROM vii_professor_questions_v1 WHERE email = ? AND status = 'success' AND created_at >= ?").bind(normalized, start).first<{ total: number }>();
  const limit = Math.max(0, Math.min(500, Number(row?.dailyLimit ?? 20))); return { limit, used: Number(used?.total || 0), remaining: Math.max(0, limit - Number(used?.total || 0)) };
}
export async function saveProfessorQuota(db: D1Database, email: string, limit: number, actor: string) {
  await ensureProfessorSchema(db); const value = Math.max(0, Math.min(500, Math.trunc(limit))); const now = new Date().toISOString();
  await db.prepare(`INSERT INTO vii_professor_quota_v1(email,daily_limit,updated_at,updated_by) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET daily_limit=excluded.daily_limit,updated_at=excluded.updated_at,updated_by=excluded.updated_by`).bind(email.trim().toLowerCase(), value, now, actor.trim().toLowerCase()).run(); return value;
}

export async function answerProfessor(db: D1Database, email: string, question: string): Promise<ProfessorAnswer> {
  await ensureProfessorSchema(db); const started = Date.now(); const normalizedQuestion = question.trim().slice(0, 800);
  const quota = await professorQuota(db, email); if (!normalizedQuestion || quota.remaining < 1) throw new Error(quota.remaining < 1 ? "quota_exceeded" : "question_required");
  const places = await inventory(); const parsed = parseProfessorIntent(normalizedQuestion, places);
  if (parsed.ambiguous.length) throw new ProfessorQuestionError("clarification_required", `מצאתי כמה עסקים מתאימים: ${parsed.ambiguous.map((place) => place.name).join(", ")}. כתוב את השם המלא של העסק.`);
  if (parsed.unsupportedReason) throw new ProfessorQuestionError("unsupported_question", parsed.unsupportedReason);
  const isFollowUp = /^(?:ומה|ומה לגבי|ואיך|אותו|אותה|ובחודש|ובשבוע|לעומת|בהשוואה)/.test(normalizedQuestion);
  const context = isFollowUp ? await previousProfessorContext(db, email) : null;
  const intent: ProfessorIntent = context ? {
    ...parsed,
    place: parsed.place || context.place,
    world: parsed.place?.world || parsed.world || context.world,
    metrics: parsed.explicitMetrics ? parsed.metrics : context.plan.metrics,
  } : parsed;
  const current = await metricSnapshot(db, intent.range, intent);
  const previous = intent.compareRange ? await metricSnapshot(db, intent.compareRange, intent) : null;
  const ranked = await ranking(db, intent.range, intent, places);
  const comparison = previous ? Object.fromEntries(intent.metrics.map((metric) => [metric, metricValue(previous.metrics, metric)])) as Partial<Record<ProfessorMetric, number | null>> : null;
  const bizRequested = intent.metrics.some((metric) => metric.startsWith("biz"));
  const partialBizRange = current.bizRange && (current.bizRange.from !== intent.range.from || current.bizRange.till !== intent.range.till);
  const coverage = !bizRequested ? "נתוני V מאומתים" : !current.bizSupported ? "נתוני V מאומתים; Biz אינו תומך בעולם הזה" : current.bizRows
    ? `נתוני V ו־Biz שמורים, כיסוי Biz ל־${current.bizRows} עסקים${partialBizRange ? ` עד ${current.bizRange?.till}` : ""}`
    : "נתוני V מאומתים; נתוני Biz לטווח הזה עדיין לא נשמרו במטמון";
  const result: ProfessorAnswer = {
    answer: answerText(intent, current.metrics, previous?.metrics || null, ranked), range: intent.range, compareRange: intent.compareRange,
    place: intent.place, world: intent.world, metrics: current.metrics, comparison, ranking: ranked,
    insights: buildInsights(intent, current.metrics, previous?.metrics || null),
    plan: { scope: scopeLabel(intent), metrics: intent.metrics, source: "מסד V ומטמון Biz בלבד" },
    freshness: { internal: new Date().toISOString(), biz: current.bizSavedAt, coverage, bizRange: current.bizRange },
    reportHref: `/admin/business-performance?from=${intent.range.from}&till=${intent.range.till}${intent.place ? `&business=${encodeURIComponent(intent.place.placeId)}` : intent.world ? `&scope=${intent.world}` : ""}`,
  };
  await db.prepare("INSERT INTO vii_professor_questions_v1(id,email,question,answer_json,status,duration_ms,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(), email.trim().toLowerCase(), normalizedQuestion, JSON.stringify(result), "success", Date.now() - started, new Date().toISOString()).run();
  return result;
}
export async function professorHistory(db: D1Database, email: string) { await ensureProfessorSchema(db); const rows = await db.prepare("SELECT id,question,answer_json AS answerJson,duration_ms AS durationMs,created_at AS createdAt FROM vii_professor_questions_v1 WHERE email = ? AND status = 'success' ORDER BY created_at DESC LIMIT 20").bind(email.trim().toLowerCase()).all<{ id: string; question: string; answerJson: string; durationMs: number; createdAt: string }>(); return rows.results.map((row) => { try { return { ...row, answer: JSON.parse(row.answerJson) as ProfessorAnswer }; } catch { return null; } }).filter(Boolean); }
