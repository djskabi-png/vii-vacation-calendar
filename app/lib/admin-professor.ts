import type { D1Database } from "../../types/cloudflare-runtime";
import { cachedBizConversions, loadCachedBizConversions } from "./biz-conversion-cache.ts";
import { fetchViiConversions, type ConversionWorld } from "./vii-conversions.ts";
import { supplierToken } from "./vii-supplier-token.ts";
import { publicCatalogSummaries } from "./public-catalog-read.ts";
import { parseProfessorIntent, professorNeedsInventory, type ProfessorIntent, type ProfessorMetric, type ProfessorPlace, type ProfessorRange, type ProfessorWorld } from "./admin-professor-intent.ts";
import { interpretProfessorQuestion } from "./admin-professor-openai.ts";
import { readProfessorBusinessBreakdown, type ProfessorBusinessRow } from './professor-business-breakdown.ts';
import {professorPeriodBounds} from './professor-period-bounds.ts';

type MetricValues = {
  impressions: number | null; pageViews: number | null; phone: number | null; whatsapp: number | null; viiBookings: number | null;
  bizCalls: number | null; bizWhatsapp: number | null; bizOrders: number | null; bizRevenue: number | null;
};
type ProfessorAnswer = {
  answer: string; range: ProfessorRange; compareRange: ProfessorRange | null; place: ProfessorPlace | null; world: ProfessorWorld | null;
  metrics: MetricValues; comparison: Partial<Record<ProfessorMetric, number | null>> | null;
  insights: Array<{ kind: "up" | "down" | "neutral" | "conversion" | "warning"; title: string; detail: string }>;
  plan: { scope: string; metrics: ProfessorMetric[]; source: string }; ranking: Array<{ name: string; value: number }>;
  freshness: { internal: string; biz: string | null; coverage: string; bizRange?: ProfessorRange | null }; reportHref: string;
  businessRows?: ProfessorBusinessRow[];
  dataStatus?: 'ready'|'partial'|'unavailable';
};

type ProfessorHistoryEntry = {
  id: string; question: string; answer: ProfessorAnswer | null; status: string;
  error: { code: string; message: string } | null; durationMs: number; createdAt: string;
};

export class ProfessorQuestionError extends Error {
  readonly code: "clarification_required" | "unsupported_question";
  constructor(code: "clarification_required" | "unsupported_question", message: string) { super(message); this.code = code; this.name = "ProfessorQuestionError"; }
}

const schema = [
  `CREATE TABLE IF NOT EXISTS vii_professor_quota_v1 (email TEXT PRIMARY KEY NOT NULL, daily_limit INTEGER NOT NULL DEFAULT 20, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS vii_professor_questions_v1 (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL, question TEXT NOT NULL, answer_json TEXT NOT NULL, status TEXT NOT NULL, duration_ms INTEGER NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_vii_professor_questions_email_day ON vii_professor_questions_v1(email, created_at)`,
];

export async function ensureProfessorSchema(db: D1Database) { await db.batch(schema.map((sql) => db.prepare(sql))); }
const day = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const WORLD_LABEL: Record<ProfessorWorld, string> = { vacations: "כל הנופש", events: "כל האירועים", rooms: "כל החדרים לפי שעה", spa: "כל הספא" };
const WORLD_DB: Record<ProfessorWorld, string[]> = { vacations: ["vacation", "vacations"], events: ["event", "events"], rooms: ["hourly", "room", "rooms"], spa: ["spa"] };
const METRIC_LABEL: Record<ProfessorMetric, string> = {
  impressions: "חשיפות", pageViews: "כניסות לעמודים", phone: "פעולות טלפון באתר V", whatsapp: "פניות WhatsApp באתר V",
  viiBookings: "בקשות הזמנה באתר V", bizCalls: "שיחות Maskyoo", bizWhatsapp: "שיחות WhatsApp במערכת Biz", bizOrders: "הזמנות Biz", bizRevenue: "הכנסות Biz",
};

async function inventory(strict = false): Promise<ProfessorPlace[]> {
  const worlds = ["vacations", "events", "rooms", "spa"] as const;
  const results = await Promise.allSettled(worlds.map((world) => publicCatalogSummaries<Record<string, unknown>>(world)));
  if(strict&&results.some(result=>result.status==='rejected'))throw new Error('professor_inventory_unavailable');
  return results.flatMap((result, index) => {
    if (result.status !== "fulfilled") return [];
    const world = worlds[index];
    const prefix = world === "vacations" ? "vacation" : world === "events" ? "event" : world === "rooms" ? "hourly" : "spa";
    return result.value.flatMap((row) => {
    const siteID = Number(row.supplierId || (typeof row.id === "string" ? row.id.match(/\d+$/)?.[0] : row.id));
    const name = String(row.name || row.title || "").trim(); if (!name) return [];
    return [{ placeId: Number.isSafeInteger(siteID) && siteID > 0 ? `${prefix}-${siteID}` : String(row.id || ""), name, world, siteID: Number.isSafeInteger(siteID) && siteID > 0 ? siteID : null }];
    });
  });
}

function scopeWhere(intent: ProfessorIntent, alias = "") {
  const column = (name: string) => `${alias}${name}`;
  if (intent.place) return { sql: ` AND ${column("place_id")} = ?`, values: [intent.place.placeId] as unknown[] };
  if (intent.world) { const worlds = WORLD_DB[intent.world]; return { sql: ` AND ${column("world")} IN (${worlds.map(() => "?").join(",")})`, values: worlds as unknown[] }; }
  return { sql: "", values: [] as unknown[] };
}

function bizScopeWhere(intent: ProfessorIntent, alias = "") {
  const column = (name: string) => `${alias}${name}`;
  if (intent.place?.siteID) return { sql: ` AND ${column("world")} = ? AND ${column("site_id")} = ?`, values: [intent.place.world, intent.place.siteID] as unknown[] };
  if (intent.world && intent.world !== "spa") { const worlds = WORLD_DB[intent.world]; return { sql: ` AND ${column("world")} IN (${worlds.map(() => "?").join(",")})`, values: worlds as unknown[] }; }
  return { sql: "", values: [] as unknown[] };
}

async function fastCachedBizTotals(db: D1Database, range: ProfessorRange, intent: ProfessorIntent) {
  if (intent.world === "spa" || intent.place?.world === "spa") return null;
  const scope = bizScopeWhere(intent);
  const coverage = await db.prepare(`SELECT COUNT(DISTINCT world || ':' || site_id) AS businesses, MAX(saved_at) AS savedAt
    FROM vii_biz_conversion_coverage_v1 WHERE from_day <= ? AND till_day >= ?${scope.sql}`)
    .bind(range.from, range.till, ...scope.values).first<{ businesses: number; savedAt: string | null }>();
  if (!Number(coverage?.businesses || 0)) return null;
  const contacts = await db.prepare(`SELECT
    SUM(CASE WHEN source = 'maskyoo' THEN 1 ELSE 0 END) AS calls,
    SUM(CASE WHEN source = 'whatsapp' THEN 1 ELSE 0 END) AS whatsapp
    FROM vii_biz_conversion_contacts_v1 WHERE contact_day >= ? AND contact_day <= ?${scope.sql}`)
    .bind(range.from, range.till, ...scope.values).first<{ calls: number; whatsapp: number }>();
  const orders = await db.prepare(`SELECT COUNT(*) AS orders, COALESCE(SUM(price), 0) AS revenue FROM (
    SELECT world, site_id, order_id, MAX(order_price) AS price FROM vii_biz_conversion_contacts_v1
    WHERE contact_day >= ? AND contact_day <= ? AND order_id IS NOT NULL${scope.sql} GROUP BY world, site_id, order_id
  )`).bind(range.from, range.till, ...scope.values).first<{ orders: number; revenue: number }>();
  return { calls: Number(contacts?.calls || 0), whatsapp: Number(contacts?.whatsapp || 0), orders: Number(orders?.orders || 0),
    revenue: Number(orders?.revenue || 0), businesses: Number(coverage?.businesses || 0), savedAt: coverage?.savedAt || null };
}

export async function metricSnapshot(db: D1Database, range: ProfessorRange, intent: ProfessorIntent, dependencies: {
  loadBizConversions?: typeof loadCachedBizConversions;
  bizDb?: D1Database;
  now?: Date;
  forceBizRefresh?: boolean;
} = {}) {
  const {since,until}=professorPeriodBounds(range.from,range.till); const scope = scopeWhere(intent);
  const needsInternal = intent.metrics.some((metric) => ["impressions", "pageViews", "phone", "whatsapp"].includes(metric));
  const needsBookings = intent.metrics.includes("viiBookings");
  const needsBiz = intent.metrics.some((metric) => metric.startsWith("biz"));
  const bizDb = dependencies.bizDb || db;
  const internal = needsInternal ? await db.prepare(`SELECT
    SUM(CASE WHEN name = 'impression' THEN 1 ELSE 0 END) AS impressions,
    SUM(CASE WHEN name = 'page_view' THEN 1 ELSE 0 END) AS pageViews,
    SUM(CASE WHEN name IN ('phone_reveal','phone_click') THEN 1 ELSE 0 END) AS phone,
    SUM(CASE WHEN name IN ('whatsapp_lead','whatsapp_handoff') THEN 1 ELSE 0 END) AS whatsapp
    FROM vii_business_events WHERE created_at >= ? AND created_at < ? AND internal = 0${scope.sql}`)
    .bind(since, until, ...scope.values).first<{ impressions: number; pageViews: number; phone: number; whatsapp: number }>() : null;
  const bookingScope = scopeWhere(intent);
  const bookings = needsBookings ? await db.prepare(`SELECT COUNT(*) AS total FROM vii_booking_audit WHERE created_at >= ? AND created_at < ?${bookingScope.sql}`)
    .bind(since, until, ...bookingScope.values).first<{ total: number }>() : null;
  let bizRange = range;
  const injectedBizLoader = dependencies.loadBizConversions;
  let fastBiz = needsBiz && !injectedBizLoader ? await fastCachedBizTotals(bizDb, range, intent).catch(() => null) : null;
  let cached = needsBiz && injectedBizLoader ? await injectedBizLoader(bizDb, range.from, range.till).catch(() => []) : [];
  let autoRefreshAttempted = false;
  let autoRefreshError: string | null = null;
  if (needsBiz && (dependencies.forceBizRefresh || !fastBiz && !cached.length) && intent.place?.siteID && intent.place.world !== "spa") {
    autoRefreshAttempted = true;
    try {
      const target = { world: intent.place.world as ConversionWorld, siteID: intent.place.siteID };
      await cachedBizConversions({ db: bizDb, ...target, from: range.from, till: range.till,
        forceRefresh: dependencies.forceBizRefresh === true,
        fetcher: async () => fetchViiConversions({ ...target, from: range.from, till: range.till, token: await supplierToken() }) });
      fastBiz = !injectedBizLoader ? await fastCachedBizTotals(bizDb, range, intent).catch(() => null) : null;
      cached = injectedBizLoader ? await injectedBizLoader(bizDb, range.from, range.till).catch(() => []) : [];
    } catch (error) {
      autoRefreshError = error instanceof Error ? error.message.slice(0, 120) : "biz_source_unavailable";
    }
  }
  if (needsBiz && !fastBiz && !cached.length) {
    const today = day(dependencies.now || new Date());
    const yesterday = new Date(`${today}T12:00:00Z`); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const closedTill = day(yesterday);
    if (range.from <= closedTill && range.till >= today) {
      bizRange = { from: range.from, till: closedTill, label: `${range.from} עד ${closedTill}` };
      fastBiz = !injectedBizLoader ? await fastCachedBizTotals(bizDb, bizRange, intent).catch(() => null) : null;
      cached = injectedBizLoader ? await injectedBizLoader(bizDb, bizRange.from, bizRange.till).catch(() => []) : [];
    }
  }
  const selected = cached.filter((row) => intent.place?.siteID ? row.siteID === intent.place.siteID && row.world === intent.place.world : intent.world && intent.world !== "spa" ? row.world === intent.world : !intent.world);
  const bizSupported = needsBiz && intent.world !== "spa" && (!intent.place || intent.place.world !== "spa");
  const hasBiz = bizSupported && (Boolean(fastBiz) || selected.length > 0);
  const sum = (pick: (row: typeof selected[number]) => number) => selected.reduce((total, row) => total + pick(row), 0);
  const metrics: MetricValues = {
    impressions: Number(internal?.impressions || 0), pageViews: Number(internal?.pageViews || 0), phone: Number(internal?.phone || 0), whatsapp: Number(internal?.whatsapp || 0), viiBookings: Number(bookings?.total || 0),
    bizCalls: hasBiz ? fastBiz?.calls ?? sum((row) => row.conversions.summary.maskyoo.contacts) : null,
    bizWhatsapp: hasBiz ? fastBiz?.whatsapp ?? sum((row) => row.conversions.summary.whatsapp.contacts) : null,
    bizOrders: hasBiz ? fastBiz?.orders ?? sum((row) => row.conversions.summary.all.orders) : null,
    bizRevenue: hasBiz ? fastBiz?.revenue ?? sum((row) => row.conversions.summary.all.revenue) : null,
  };
  return { metrics, bizSavedAt: fastBiz?.savedAt || selected.map((row) => row.cache.savedAt).sort().at(-1) || null,
    bizRows: fastBiz?.businesses || selected.length, bizSupported, bizRange: hasBiz ? bizRange : null,
    autoRefreshAttempted, autoRefreshError };
}

async function ranking(db: D1Database, bizDb: D1Database, range: ProfessorRange, intent: ProfessorIntent, places: ProfessorPlace[]) {
  if (!intent.ranking) return [];
  const {since,until}=professorPeriodBounds(range.from,range.till); const scope = scopeWhere({ ...intent, place: null });
  const requested = intent.metrics[0];
  const eventNames: Partial<Record<ProfessorMetric, string[]>> = { impressions: ["impression"], pageViews: ["page_view"], phone: ["phone_reveal", "phone_click"], whatsapp: ["whatsapp_lead", "whatsapp_handoff"] };
  const names = eventNames[requested];
  if (!names?.length && ["bizCalls", "bizWhatsapp", "bizOrders", "bizRevenue"].includes(requested)) {
    if (intent.world === "spa") return [];
    const allowedWorlds = intent.world ? WORLD_DB[intent.world] : [];
    const worldWhere = allowedWorlds.length ? ` AND world IN (${allowedWorlds.map(() => "?").join(",")})` : "";
    const params: unknown[] = [range.from, range.till, ...allowedWorlds];
    const aggregate = requested === "bizRevenue"
      ? `SELECT world, site_id AS siteID, COALESCE(SUM(price), 0) AS value FROM (
          SELECT world, site_id, order_id, MAX(order_price) AS price FROM vii_biz_conversion_contacts_v1
          WHERE contact_day >= ? AND contact_day <= ? AND order_id IS NOT NULL${worldWhere}
          GROUP BY world, site_id, order_id
        ) GROUP BY world, site_id ORDER BY value DESC LIMIT 5`
      : `SELECT world, site_id AS siteID, ${requested === "bizCalls"
        ? "SUM(CASE WHEN source = 'maskyoo' THEN 1 ELSE 0 END)"
        : requested === "bizWhatsapp"
          ? "SUM(CASE WHEN source = 'whatsapp' THEN 1 ELSE 0 END)"
          : "COUNT(DISTINCT order_id)"} AS value
        FROM vii_biz_conversion_contacts_v1
        WHERE contact_day >= ? AND contact_day <= ?${requested === "bizOrders" ? " AND order_id IS NOT NULL" : ""}${worldWhere}
        GROUP BY world, site_id ORDER BY value DESC LIMIT 5`;
    let rows = await bizDb.prepare(aggregate).bind(...params).all<{ world: ProfessorWorld; siteID: number; value: number }>().catch(() => ({ results: [] }));
    if (!rows.results.length) {
      const today = day(new Date()); const yesterday = new Date(`${today}T12:00:00Z`); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const closedTill = day(yesterday);
      if (range.from <= closedTill && range.till >= today) rows = await bizDb.prepare(aggregate).bind(range.from, closedTill, ...allowedWorlds)
        .all<{ world: ProfessorWorld; siteID: number; value: number }>().catch(() => ({ results: [] }));
    }
    const labelByKey = new Map(places.filter((place) => place.siteID).map((place) => [`${place.world}:${place.siteID}`, place.name]));
    return rows.results.map((row) => ({
      name: labelByKey.get(`${row.world}:${row.siteID}`) || `${row.world}-${row.siteID}`, value: Number(row.value || 0),
    }));
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
  if (value === null) return `${METRIC_LABEL[metric]}: המקור לא החזיר נתון מאומת לטווח הזה`;
  return `${METRIC_LABEL[metric]}: ${metric === "bizRevenue" ? "₪ " : ""}${value.toLocaleString("he-IL")}`;
}
function answerText(intent: ProfessorIntent, current: MetricValues, comparison: MetricValues | null, ranked: Array<{ name: string; value: number }>) {
  const requested = intent.metrics.map((metric) => formatMetric(metric, metricValue(current, metric)));
  const comparisonText = comparison ? intent.metrics.flatMap((metric) => {
    const value = metricValue(current, metric); const previous = metricValue(comparison, metric);
    if (value === null || previous === null) return [];
    const delta = value - previous; const direction = delta > 0 ? "עלייה" : delta < 0 ? "ירידה" : "ללא שינוי";
    return `${METRIC_LABEL[metric]}: ${direction}${delta ? ` של ${Math.abs(delta).toLocaleString("he-IL")}` : ""}`;
  }) : [];
  const lines = [`היי אדיר, ${intent.range.label} עבור ${scopeLabel(intent)}.`, ...requested];
  if (comparisonText.length) lines.push(`בהשוואה לתקופה הקודמת: ${comparisonText.join("; ")}.`);
  if (ranked.length) lines.push(`המובילים לפי ${METRIC_LABEL[intent.metrics[0]]}: ${ranked.map((row, index) => `${index + 1}. ${row.name}, ${row.value.toLocaleString("he-IL")}`).join("; ")}.`);
  if(intent.breakdown)lines.push('הפירוט לכל עסק מוצג בטבלה. סכומים כוללים רק עסקים שיש להם נתונים שמורים לטווח שנבחר.');
  return lines.join("\n");
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
  if (contacts > 0 && current.bizOrders && current.bizOrders > 0) insights.unshift({ kind: "conversion", title: "יחס קשר להזמנה", detail: `הזמנה אחת לכל ${Math.max(1, Math.round(contacts / current.bizOrders)).toLocaleString("he-IL")} אנשי קשר שנשמרו במערכת Biz` });
  const unavailable = intent.metrics.filter((metric) => metricValue(current, metric) === null);
  if (unavailable.length) insights.push({ kind: "warning", title: "כיסוי נתונים חלקי", detail: `${unavailable.map((metric) => METRIC_LABEL[metric]).join(", ")} לא הוחזרו ממקור מאומת לטווח הזה ולכן לא חושבו` });
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

export async function answerProfessor(db: D1Database, email: string, question: string, reportingDb: D1Database = db,
  options: { forceBizRefresh?: boolean } = {}): Promise<ProfessorAnswer> {
  await ensureProfessorSchema(db); const started = Date.now(); const normalizedQuestion = question.trim().slice(0, 800);
  const quota = await professorQuota(db, email); if (!normalizedQuestion || quota.remaining < 1) throw new Error(quota.remaining < 1 ? "quota_exceeded" : "question_required");
  const interpretation = await interpretProfessorQuestion(normalizedQuestion);
  const interpretedQuestion = interpretation.canonicalQuestion;
  const places = professorNeedsInventory(normalizedQuestion) || professorNeedsInventory(interpretedQuestion) ? await inventory(Boolean(parseProfessorIntent(normalizedQuestion,[]).breakdown)) : [];
  const originalIntent = parseProfessorIntent(normalizedQuestion, places);
  const interpretedIntent = parseProfessorIntent(interpretedQuestion, places);
  // Explicit scope, metric and period from the visitor cannot be erased by a rewrite.
  const parsed = originalIntent.breakdown ? {...interpretedIntent,...originalIntent} : interpretedIntent;
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
  const readSnapshot = async (range: ProfessorRange, forceBizRefresh = false) => {
    try { return await metricSnapshot(reportingDb, range, intent, { bizDb: db, forceBizRefresh }); }
    catch (error) {
      if (reportingDb === db) throw error;
      return metricSnapshot(db, range, intent, { bizDb: db, forceBizRefresh });
    }
  };
  const current = await readSnapshot(intent.range, options.forceBizRefresh === true);
  const previous = intent.compareRange ? await readSnapshot(intent.compareRange) : null;
  const closedDate = new Date(`${day(new Date())}T12:00:00Z`);closedDate.setUTCDate(closedDate.getUTCDate()-1);
  const closedTill=day(closedDate);
  const effectiveBizRange=current.bizRange||(intent.range.till>=day(new Date())&&intent.range.from<=closedTill?{...intent.range,till:closedTill}:intent.range);
  const businessRows = intent.breakdown ? await readProfessorBusinessBreakdown(reportingDb,db,intent.range,effectiveBizRange,intent,places) : undefined;
  if(businessRows){
   for(const metric of intent.metrics){const values=businessRows.map(row=>row.values[metric]).filter((value):value is number=>value!=null);current.metrics[metric]=values.length?values.reduce((sum,value)=>sum+value,0):null;}
   if(businessRows.some(row=>intent.metrics.some(metric=>metric.startsWith('biz')&&row.values[metric]!=null))){current.bizRange=effectiveBizRange;current.bizSavedAt=businessRows.map(row=>row.bizSavedAt||'').sort().at(-1)||current.bizSavedAt;}
  }
  let ranked: Array<{ name: string; value: number }> = [];
  try { ranked = businessRows ? businessRows.filter(row=>row.values[intent.metrics[0]]!=null).slice(0,10).map(row=>({name:row.name,value:row.values[intent.metrics[0]]!})) : await ranking(reportingDb, db, intent.range, intent, places); }
  catch (error) {
    if (reportingDb === db) throw error;
    ranked = await ranking(db, db, intent.range, intent, places);
  }
  const previousBusinessRows = businessRows&&previous ? await readProfessorBusinessBreakdown(reportingDb,db,intent.compareRange!,previous.bizRange||intent.compareRange!,intent,places) : undefined;
  const comparison = previous ? Object.fromEntries(intent.metrics.map((metric) => [metric,previousBusinessRows ? businessRows!.every(row=>row.values[metric]!=null)&&previousBusinessRows.every(row=>row.values[metric]!=null)?previousBusinessRows.reduce((sum,row)=>sum+Number(row.values[metric]),0):null : metricValue(previous.metrics, metric)])) as Partial<Record<ProfessorMetric, number | null>> : null;
  const previousMetrics=previous&&comparison?{...previous.metrics,...comparison}:null;
  const bizRequested = intent.metrics.some((metric) => metric.startsWith("biz"));
  const knownRows = businessRows?.filter(row=>intent.metrics.every(metric=>row.values[metric]!=null)).length || 0;
  const dataStatus = businessRows ? knownRows===businessRows.length&&knownRows>0?'ready':knownRows>0?'partial':'unavailable' : intent.metrics.some(metric=>current.metrics[metric]!=null)?'ready':'unavailable';
  const partialBizRange = current.bizRange && (current.bizRange.from !== intent.range.from || current.bizRange.till !== intent.range.till);
  const coverage = businessRows ? `נתונים שמורים עבור ${knownRows} מתוך ${businessRows.length} עסקים${current.bizRange?`, נתוני Biz עד ${current.bizRange.till}`:''}` : !bizRequested ? "נתוני V מאומתים" : !current.bizSupported ? "נתוני V מאומתים; Biz אינו תומך בעולם הזה" : current.bizRows
    ? `נתוני V ומערכת Biz שמורים, כיסוי Biz עבור ${current.bizRows} עסקים${partialBizRange ? ` עד ${current.bizRange?.till}` : ""}`
    : current.autoRefreshAttempted
      ? "נתוני V מאומתים; בוצע ניסיון רענון אוטומטי מול Biz אך לא התקבל נתון מאומת"
      : "נתוני V מאומתים; נתוני Biz אינם זמינים כרגע לטווח הזה";
  const result: ProfessorAnswer = {
    answer: answerText(intent, current.metrics, previousMetrics, ranked), range: intent.range, compareRange: intent.compareRange,
    place: intent.place, world: intent.world, metrics: current.metrics, comparison, ranking: ranked,
    businessRows, dataStatus,
    insights: buildInsights(intent, current.metrics, previousMetrics),
    plan: { scope: scopeLabel(intent), metrics: intent.metrics, source: interpretation.provider === "openai"
      ? "פענוח OpenAI מאומת מול מסד V ומטמון Biz"
      : "מסד V ומטמון Biz בלבד" },
    freshness: { internal: new Date().toISOString(), biz: current.bizSavedAt, coverage, bizRange: current.bizRange },
    reportHref: `/admin/business-performance?from=${intent.range.from}&till=${intent.range.till}${intent.place ? `&business=${encodeURIComponent(intent.place.placeId)}` : intent.world ? `&scope=${intent.world}` : ""}`,
  };
  await db.prepare("INSERT INTO vii_professor_questions_v1(id,email,question,answer_json,status,duration_ms,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(), email.trim().toLowerCase(), normalizedQuestion, JSON.stringify(result), dataStatus==='unavailable'?'unavailable':"success", Date.now() - started, new Date().toISOString()).run();
  return result;
}
export async function saveProfessorFailure(db: D1Database, email: string, question: string, code: string, message: string, durationMs: number) {
  await ensureProfessorSchema(db);
  const payload = { code: code.slice(0, 80), message: message.slice(0, 500) };
  await db.prepare("INSERT INTO vii_professor_questions_v1(id,email,question,answer_json,status,duration_ms,created_at) VALUES(?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), email.trim().toLowerCase(), question.trim().slice(0, 800), JSON.stringify(payload), "failed", Math.max(0, durationMs), new Date().toISOString()).run();
}

export async function professorHistory(db: D1Database, email: string): Promise<ProfessorHistoryEntry[]> {
  await ensureProfessorSchema(db);
  const rows = await db.prepare("SELECT id,question,answer_json AS answerJson,status,duration_ms AS durationMs,created_at AS createdAt FROM vii_professor_questions_v1 WHERE email = ? ORDER BY created_at DESC LIMIT 20")
    .bind(email.trim().toLowerCase()).all<{ id: string; question: string; answerJson: string; status: string; durationMs: number; createdAt: string }>();
  return rows.results.map((row) => {
    try {
      const parsed = JSON.parse(row.answerJson) as ProfessorAnswer | { code?: unknown; message?: unknown };
      if (row.status === "success" || row.status === "unavailable") return { ...row, answer: parsed as ProfessorAnswer, error: null };
      const failure = parsed as { code?: unknown; message?: unknown };
      return { ...row, answer: null, error: { code: String(failure.code || "professor_unavailable"), message: String(failure.message || "לא התקבלה תשובה מאומתת") } };
    } catch { return { ...row, answer: null, error: { code: "invalid_history", message: "הרשומה לא ניתנת לקריאה" } }; }
  });
}
