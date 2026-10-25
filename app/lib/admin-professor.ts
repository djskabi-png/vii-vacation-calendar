import type { D1Database } from "../../types/cloudflare-runtime";
import { loadCachedBizConversions } from "./biz-conversion-cache.ts";
import { publicCatalogSummaries } from "./public-catalog-read.ts";

type Place = { placeId: string; name: string; world: "vacations" | "events" | "rooms" | "spa"; siteID: number | null };
type ProfessorAnswer = {
  answer: string; range: { from: string; till: string; label: string }; place: Place | null;
  metrics: { phone: number; whatsapp: number; viiBookings: number; bizOrders: number | null; bizRevenue: number | null };
  freshness: { internal: string; biz: string | null; coverage: string }; reportHref: string;
};

const schema = [
  `CREATE TABLE IF NOT EXISTS vii_professor_quota_v1 (email TEXT PRIMARY KEY NOT NULL, daily_limit INTEGER NOT NULL DEFAULT 20, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS vii_professor_questions_v1 (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL, question TEXT NOT NULL, answer_json TEXT NOT NULL, status TEXT NOT NULL, duration_ms INTEGER NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_vii_professor_questions_email_day ON vii_professor_questions_v1(email, created_at)`,
];

export async function ensureProfessorSchema(db: D1Database) { await db.batch(schema.map((sql) => db.prepare(sql))); }
const clean = (value: string) => value.normalize("NFKC").replace(/[\u0591-\u05C7]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLowerCase();
const day = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
function rangeFor(question: string, now = new Date()) {
  const israelToday = day(now); const current = new Date(`${israelToday}T12:00:00Z`);
  if (/חודש\s+שעבר/.test(question)) { const start = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1, 12)); const end = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 0, 12)); return { from: day(start), till: day(end), label: "החודש הקודם" }; }
  const recent = question.match(/(?:אחרונים|האחרונים)\s*(\d{1,3})\s*(?:יום|ימים)/) || question.match(/(\d{1,3})\s*(?:יום|ימים)\s*(?:אחרונים|האחרונים)/);
  if (recent) { const count = Math.min(365, Math.max(1, Number(recent[1]))); const start = new Date(current); start.setUTCDate(start.getUTCDate() - count + 1); return { from: day(start), till: israelToday, label: `${count} הימים האחרונים` }; }
  if (/היום/.test(question)) return { from: israelToday, till: israelToday, label: "היום" };
  return { from: `${israelToday.slice(0, 7)}-01`, till: israelToday, label: "החודש הנוכחי עד היום" };
}

async function inventory(): Promise<Place[]> {
  const [vacations, events, rooms, spa] = await Promise.all(["vacations", "events", "rooms", "spa"].map((world) => publicCatalogSummaries<Record<string, unknown>>(world)));
  return [[vacations, "vacations", "vacation"], [events, "events", "event"], [rooms, "rooms", "hourly"], [spa, "spa", "spa"]].flatMap(([rows, world, prefix]) => (rows as Record<string, unknown>[]).flatMap((row) => {
    const siteID = Number(row.supplierId || (typeof row.id === "string" ? row.id.match(/\d+$/)?.[0] : row.id));
    const name = String(row.name || row.title || "").trim(); if (!name) return [];
    return [{ placeId: Number.isSafeInteger(siteID) && siteID > 0 ? `${prefix}-${siteID}` : String(row.id || ""), name, world: world as Place["world"], siteID: Number.isSafeInteger(siteID) && siteID > 0 ? siteID : null }];
  }));
}

function findPlace(question: string, places: Place[]) {
  const query = clean(question); return places.filter((place) => query.includes(clean(place.name))).sort((a, b) => b.name.length - a.name.length)[0] || null;
}
export async function professorQuota(db: D1Database, email: string) {
  await ensureProfessorSchema(db); const normalized = email.trim().toLowerCase();
  const row = await db.prepare("SELECT daily_limit AS dailyLimit FROM vii_professor_quota_v1 WHERE email = ?").bind(normalized).first<{ dailyLimit: number }>();
  const start = `${day(new Date())}T00:00:00`;
  const used = await db.prepare("SELECT COUNT(*) AS total FROM vii_professor_questions_v1 WHERE email = ? AND status = 'success' AND created_at >= ?").bind(normalized, start).first<{ total: number }>();
  const limit = Math.max(0, Math.min(500, Number(row?.dailyLimit ?? 20))); return { limit, used: Number(used?.total || 0), remaining: Math.max(0, limit - Number(used?.total || 0)) };
}
export async function saveProfessorQuota(db: D1Database, email: string, limit: number, actor: string) {
  await ensureProfessorSchema(db); const value = Math.max(0, Math.min(500, Math.trunc(limit))); const now = new Date().toISOString();
  await db.prepare(`INSERT INTO vii_professor_quota_v1(email,daily_limit,updated_at,updated_by) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET daily_limit=excluded.daily_limit,updated_at=excluded.updated_at,updated_by=excluded.updated_by`).bind(email.trim().toLowerCase(), value, now, actor.trim().toLowerCase()).run(); return value;
}
export async function answerProfessor(db: D1Database, email: string, question: string): Promise<ProfessorAnswer> {
  await ensureProfessorSchema(db); const started = Date.now(); const normalizedQuestion = question.trim().slice(0, 800);
  const quota = await professorQuota(db, email); if (!normalizedQuestion || quota.remaining < 1) throw new Error(quota.remaining < 1 ? "quota_exceeded" : "question_required");
  const range = rangeFor(clean(normalizedQuestion)); const places = await inventory(); const place = findPlace(normalizedQuestion, places);
  const since = `${range.from}T00:00:00.000Z`; const untilDate = new Date(`${range.till}T00:00:00.000Z`); untilDate.setUTCDate(untilDate.getUTCDate() + 1); const until = untilDate.toISOString();
  const where = place ? " AND place_id = ?" : ""; const binds = place ? [since, until, place.placeId] : [since, until];
  const internal = await db.prepare(`SELECT SUM(CASE WHEN name IN ('phone_reveal','phone_click') THEN 1 ELSE 0 END) AS phone, SUM(CASE WHEN name IN ('whatsapp_lead','whatsapp_handoff') THEN 1 ELSE 0 END) AS whatsapp FROM vii_business_events WHERE created_at >= ? AND created_at < ? AND internal = 0${where}`).bind(...binds).first<{ phone: number; whatsapp: number }>();
  const bookings = await db.prepare(`SELECT COUNT(*) AS total FROM vii_booking_audit WHERE created_at >= ? AND created_at < ?${where}`).bind(...binds).first<{ total: number }>();
  const cached = await loadCachedBizConversions(db, range.from, range.till).catch(() => []); const biz = place?.siteID ? cached.find((row) => row.siteID === place.siteID && row.world === place.world) : null;
  const allBiz = place ? biz ? [biz] : [] : cached; const bizOrders = allBiz.length ? allBiz.reduce((sum, row) => sum + row.conversions.summary.all.orders, 0) : null; const bizRevenue = allBiz.length ? allBiz.reduce((sum, row) => sum + row.conversions.summary.all.revenue, 0) : null;
  const phone = Number(internal?.phone || 0); const whatsapp = Number(internal?.whatsapp || 0); const viiBookings = Number(bookings?.total || 0);
  const subject = place ? `ל${place.name}` : "לכל העסקים"; const bizSentence = bizOrders === null ? "נתוני Biz לטווח הזה עדיין לא נשמרו במטמון, ולכן לא הצגתי מספר משוער." : `${bizOrders.toLocaleString("he-IL")} הזמנות Biz בסכום ${Number(bizRevenue || 0).toLocaleString("he-IL")} ₪`;
  const answer = `היי, ${range.label} ${subject} נמדדו ${phone.toLocaleString("he-IL")} פעולות טלפון, ${whatsapp.toLocaleString("he-IL")} פעולות WhatsApp ו־${viiBookings.toLocaleString("he-IL")} בקשות הזמנה מ־V. ${bizSentence}`;
  const result: ProfessorAnswer = { answer, range, place, metrics: { phone, whatsapp, viiBookings, bizOrders, bizRevenue }, freshness: { internal: new Date().toISOString(), biz: allBiz.map((row) => row.cache.savedAt).sort().at(-1) || null, coverage: bizOrders === null ? "נתוני V מלאים; Biz אינו שמור לטווח" : "נתוני V ו־Biz שמורים" }, reportHref: `/admin/business-performance?from=${range.from}&till=${range.till}${place ? `&business=${encodeURIComponent(place.placeId)}` : ""}` };
  await db.prepare("INSERT INTO vii_professor_questions_v1(id,email,question,answer_json,status,duration_ms,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(), email.trim().toLowerCase(), normalizedQuestion, JSON.stringify(result), "success", Date.now() - started, new Date().toISOString()).run();
  return result;
}
export async function professorHistory(db: D1Database, email: string) { await ensureProfessorSchema(db); const rows = await db.prepare("SELECT id,question,answer_json AS answerJson,duration_ms AS durationMs,created_at AS createdAt FROM vii_professor_questions_v1 WHERE email = ? AND status = 'success' ORDER BY created_at DESC LIMIT 20").bind(email.trim().toLowerCase()).all<{ id: string; question: string; answerJson: string; durationMs: number; createdAt: string }>(); return rows.results.map((row) => { try { return { ...row, answer: JSON.parse(row.answerJson) as ProfessorAnswer }; } catch { return null; } }).filter(Boolean); }
