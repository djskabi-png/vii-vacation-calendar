import test from "node:test";
import assert from "node:assert/strict";
import { parseProfessorIntent, professorNeedsInventory, professorRange } from "../app/lib/admin-professor-intent.ts";
import { metricSnapshot } from "../app/lib/admin-professor.ts";

const now = new Date("2026-10-26T12:00:00Z");
const places = [
  { placeId: "vacation-11", name: "הילת הנוף", world: "vacations", siteID: 11 },
  { placeId: "event-22", name: "הילת האירועים", world: "events", siteID: 22 },
  { placeId: "hourly-33", name: "סוויטת הכרמל", world: "rooms", siteID: 33 },
];

test("a Biz-only Professor question never touches unrelated V event or booking tables", async () => {
  const bucket = (contacts, orders = 0, revenue = 0) => ({ contacts, identified: contacts, converted: orders,
    rate: null, customers: orders, orders, revenue, medianDelay: null });
  const db = { prepare() { throw new Error("unrelated V query must not run"); } };
  const intent = parseProfessorIntent("כמה שיחות היו החודש", places, now);
  const snapshot = await metricSnapshot(db, intent.range, intent, { loadBizConversions: async () => [{
    world: "vacations", siteID: 11,
    conversions: { siteID: 11, from: intent.range.from, till: intent.range.till, domainID: null,
      created: "2026-10-26T12:00:00.000Z", count: 37,
      summary: { all: bucket(37, 3, 4200), maskyoo: bucket(37, 3, 4200), whatsapp: bucket(0), form: bucket(0) },
      clicks: { whatsapp: 0, showphone: 0, phone: 0 } },
    cache: { status: "fresh", savedAt: "2026-10-26T12:00:00.000Z", stale: false },
  }] });
  assert.equal(snapshot.metrics.bizCalls, 37);
  assert.equal(snapshot.metrics.bizWhatsapp, 0);
  assert.equal(snapshot.bizRows, 1);
});

test("generic Professor questions skip the full supplier inventory while named-business questions load it", () => {
  assert.equal(professorNeedsInventory("כמה שיחות היו החודש"), false);
  assert.equal(professorNeedsInventory("למי היו הכי הרבה שיחות החודש"), true);
  assert.equal(professorNeedsInventory("תן לי נתונים של החודש להילת הנוף"), true);
  assert.equal(professorNeedsInventory("כמה הזמנות היו לעסק הילת הנוף"), true);
});

test("Professor answers a cached Biz-only question from aggregate cache tables without loading every supplier payload", async () => {
  const db = { prepare(sql) {
    return { bind() { return { async first() {
      if (sql.includes("vii_biz_conversion_coverage_v1")) return { businesses: 459, savedAt: "2026-10-26T16:17:40.000Z" };
      if (sql.includes("SUM(CASE WHEN source = 'maskyoo'")) return { calls: 584, whatsapp: 316 };
      if (sql.includes("SELECT COUNT(*) AS orders")) return { orders: 41, revenue: 125000 };
      throw new Error(`unexpected query: ${sql}`);
    } }; } };
  } };
  const intent = parseProfessorIntent("כמה שיחות היו החודש", [], now);
  const snapshot = await metricSnapshot(db, intent.range, intent, { now: new Date("2026-10-27T12:00:00Z") });
  assert.equal(snapshot.metrics.bizCalls, 584);
  assert.equal(snapshot.bizRows, 459);
  assert.equal(snapshot.bizSavedAt, "2026-10-26T16:17:40.000Z");
});

test("Professor falls back to the last closed Biz day without scanning every cached supplier payload", async () => {
  const seen = [];
  const db = { prepare(sql) {
    return { bind(...params) { seen.push({ sql, params }); return { async first() {
      if (sql.includes("vii_biz_conversion_coverage_v1")) return params[1] === "2026-10-26"
        ? { businesses: 459, savedAt: "2026-10-25T16:17:40.000Z" }
        : { businesses: 0, savedAt: null };
      if (sql.includes("SUM(CASE WHEN source = 'maskyoo'")) return { calls: 584, whatsapp: 316 };
      if (sql.includes("SELECT COUNT(*) AS orders")) return { orders: 41, revenue: 125000 };
      throw new Error(`unexpected query: ${sql}`);
    } }; } };
  } };
  const intent = parseProfessorIntent("כמה שיחות היו החודש", [], new Date("2026-10-27T12:00:00Z"));
  const snapshot = await metricSnapshot(db, intent.range, intent, { now: new Date("2026-10-27T12:00:00Z") });
  assert.equal(snapshot.metrics.bizCalls, 584);
  assert.equal(snapshot.bizRange?.till, "2026-10-26");
  assert.equal(snapshot.bizRows, 459);
  assert.ok(seen.every(({ sql }) => !sql.includes("vii_biz_conversion_snapshots_v1")));
});

test("Professor understands a named business and only the requested verified metrics", () => {
  const intent = parseProfessorIntent("תן לי נתונים של החודש להילת הנוף: כמה טלפונים, וואטסאפ והזמנות Biz", places, now);
  assert.equal(intent.place?.placeId, "vacation-11");
  assert.equal(intent.world, "vacations");
  assert.deepEqual(intent.metrics, ["phone", "bizCalls", "whatsapp", "bizWhatsapp", "bizOrders", "bizRevenue"]);
  assert.equal(intent.range.from, "2026-10-01");
  assert.equal(intent.range.till, "2026-10-26");
});

test("Professor understands worlds, rankings and equivalent previous periods", () => {
  const intent = parseProfessorIntent("מי הכי מוביל בכניסות בכל הנופש ב־30 הימים האחרונים לעומת התקופה הקודמת?", places, now);
  assert.equal(intent.place, null);
  assert.equal(intent.world, "vacations");
  assert.equal(intent.ranking, true);
  assert.deepEqual(intent.metrics, ["pageViews"]);
  assert.deepEqual(intent.range, { from: "2026-09-27", till: "2026-10-26", label: "30 הימים האחרונים" });
  assert.deepEqual(intent.compareRange, { from: "2026-08-28", till: "2026-09-26", label: "התקופה הקודמת, 2026-08-28 עד 2026-09-26" });
});

test("Professor accepts explicit Israeli and ISO date ranges", () => {
  assert.deepEqual(professorRange("מ־01/09/2026 עד 30/09/2026", now), { from: "2026-09-01", till: "2026-09-30", label: "2026-09-01 עד 2026-09-30" });
  assert.deepEqual(professorRange("2026-08-10 עד 2026-08-12", now), { from: "2026-08-10", till: "2026-08-12", label: "2026-08-10 עד 2026-08-12" });
});

test("Professor refuses to invent causal explanations", () => {
  const intent = parseProfessorIntent("למה ירדו ההזמנות של הילת הנוף החודש?", places, now);
  assert.match(intent.unsupportedReason || "", /אינם מוכיחים את הסיבה/);
});

test("Professor refuses to answer for an unknown explicitly named business", () => {
  const intent = parseProfessorIntent("תן לי נתונים לעסק שלא קיים החודש", places, now);
  assert.match(intent.unsupportedReason || "", /לא מצאתי עסק/);
  assert.equal(intent.place, null);
});

test("Professor requests clarification for equally plausible businesses", () => {
  const duplicate = [...places, { placeId: "vacation-44", name: "הילת נוף", world: "vacations", siteID: 44 }];
  const intent = parseProfessorIntent("נתונים של הילת נוף", duplicate, now);
  assert.ok(intent.place || intent.ambiguous.length >= 1);
  assert.ok(intent.ambiguous.every((place) => typeof place.name === "string" && place.name.length > 0));
});

test("plain Hebrew calls means Biz Maskyoo calls instead of an all-metrics fallback", () => {
  const intent = parseProfessorIntent("כמה שיחות היו החודש לכולם?", places, now);
  assert.deepEqual(intent.metrics, ["bizCalls"]);
});

test("natural ranking question about calls ranks Biz Maskyoo calls", () => {
  const intent = parseProfessorIntent("למי היו הכי הרבה שיחות החודש?", places, now);
  assert.deepEqual(intent.metrics, ["bizCalls"]);
  assert.equal(intent.ranking, true);
});

test("Professor safely recognizes a one-letter business typo", () => {
  const intent = parseProfessorIntent("תן לי כניסות להילת הנוףף החודש", places, now);
  assert.equal(intent.place?.placeId, "vacation-11");
  assert.deepEqual(intent.metrics, ["pageViews"]);
});

test("Professor conversion questions include the outcome and do not infer a ratio from calls alone", () => {
  const intent = parseProfessorIntent("מכל כמה שיחות נוצרת הזמנה בביז החודש?", places, now);
  assert.ok(intent.metrics.includes("bizCalls"));
  assert.ok(intent.metrics.includes("bizOrders"));
  assert.equal(intent.explicitMetrics, true);
});

test("Professor marks a metric-free follow-up so the engine can preserve the previous context", () => {
  const intent = parseProfessorIntent("ומה לעומת החודש הקודם?", places, now);
  assert.equal(intent.explicitMetrics, false);
  assert.ok(intent.compareRange);
});

test("the public comparison suggestion always requests the equivalent previous period", () => {
  const intent = parseProfessorIntent("השווה את כל הנופש החודש לתקופה הקודמת", places, now);
  assert.equal(intent.world, "vacations");
  assert.deepEqual(intent.compareRange, {
    from: "2026-09-05",
    till: "2026-09-30",
    label: "התקופה הקודמת, 2026-09-05 עד 2026-09-30",
  });
});
