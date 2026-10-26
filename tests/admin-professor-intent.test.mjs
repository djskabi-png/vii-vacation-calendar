import test from "node:test";
import assert from "node:assert/strict";
import { parseProfessorIntent, professorRange } from "../app/lib/admin-professor-intent.ts";

const now = new Date("2026-10-26T12:00:00Z");
const places = [
  { placeId: "vacation-11", name: "הילת הנוף", world: "vacations", siteID: 11 },
  { placeId: "event-22", name: "הילת האירועים", world: "events", siteID: 22 },
  { placeId: "hourly-33", name: "סוויטת הכרמל", world: "rooms", siteID: 33 },
];

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
});
