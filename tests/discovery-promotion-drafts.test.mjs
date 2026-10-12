import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { parsePromotionDraft, PromotionDraftError, readPromotionDraftDashboard, savePromotionDraft } from "../app/lib/discovery-promotion-drafts.ts";
import { createSignedValue } from "../app/lib/google-auth.ts";
import { GET, POST } from "../app/api/admin/discovery-promotions/route.ts";

const input = (override = {}) => ({
  requestId: crypto.randomUUID(), world: "vacations", supplierId: 389, kind: "manual", weight: 2,
  startsOn: "2026-10-13", endsOn: "2026-10-20", contractEndsOn: "", contractSource: "",
  note: "בדיקה פנימית", status: "draft", ...override,
});

function database() {
  const events = [];
  let published = true;
  const db = { prepare(sql) {
    let parameters = [];
    return {
      bind(...values) { parameters = values; return this; },
      async first() {
        if (sql.includes("WHERE event_id = ?")) return events.find((event) => event.eventId === parameters[0]) || null;
        if (sql.includes("WHERE campaign_id = ?")) return [...events].reverse().find((event) => event.campaignId === parameters[0]) || null;
        if (sql.includes("JOIN supplier_catalog_entries")) return published ? { summaryJson: JSON.stringify({ name: "מקום לדוגמה" }), detailJson: null, acceptedAt: "2026-10-12" } : null;
        throw new Error(`Unexpected SELECT: ${sql}`);
      },
      async all() {
        return { results: sql.includes("WHERE version =") ? events.filter((event) =>
          event.version === Math.max(...events.filter((row) => row.campaignId === event.campaignId).map((row) => row.version)))
          : [...events].reverse() };
      },
      async run() {
        if (!sql.includes("INSERT INTO discovery_promotion_draft_events")) throw new Error("unexpected insert");
        if (events.some((event) => event.eventId === parameters[0] ||
          event.campaignId === parameters[1] && event.version === parameters[2])) throw new Error("UNIQUE constraint failed");
        const [eventId, campaignId, version, world, supplierId, placeName, kind, weight,
          startsOn, endsOn, contractEndsOn, contractSource, note, status, actorEmail, savedAt] = parameters;
        events.push({ eventId, campaignId, version, world, supplierId, placeName, kind, weight,
          startsOn, endsOn, contractEndsOn, contractSource, note, status, actorEmail, savedAt });
        return { success: true };
      },
    };
  } };
  return { db, events, removePlace() { published = false; } };
}

test("promotion input rejects unverified or invalid expiry details", () => {
  assert.throws(() => parsePromotionDraft(input({ kind: "ending_contract" })),
    (error) => error instanceof PromotionDraftError && error.code === "contract_end_required");
  assert.throws(() => parsePromotionDraft(input({ contractEndsOn: "2026-10-21" })),
    (error) => error instanceof PromotionDraftError && error.code === "contract_source_required");
  assert.throws(() => parsePromotionDraft(input({ endsOn: "2026-10-12" })),
    (error) => error instanceof PromotionDraftError && error.code === "invalid_period");
  assert.throws(() => parsePromotionDraft(input({ weight: 20 })),
    (error) => error instanceof PromotionDraftError && error.code === "invalid_weight");
});

test("drafts use published supplier identity, append audit versions, and deduplicate a repeated request", async () => {
  const { db, events } = database();
  const request = input();
  const created = await savePromotionDraft(db, request, "admin@vii.co.il");
  assert.equal(created.placeName, "מקום לדוגמה");
  assert.equal(created.status, "draft");
  assert.equal(created.version, 1);
  assert.deepEqual(await savePromotionDraft(db, request, "admin@vii.co.il"), created);
  await assert.rejects(savePromotionDraft(db, { ...request, weight: 3 }, "admin@vii.co.il"),
    (error) => error.code === "request_id_conflict");
  assert.equal(events.length, 1);

  const changed = await savePromotionDraft(db, input({ campaignId: created.campaignId,
    expectedVersion: 1, weight: 4, status: "archived" }), "editor@vii.co.il");
  assert.equal(changed.version, 2);
  assert.equal(changed.status, "archived");
  assert.equal(events.length, 2);
  const dashboard = await readPromotionDraftDashboard(db);
  assert.equal(dashboard.publicRankingEnabled, false);
  assert.equal(dashboard.drafts.length, 1);
  assert.equal(dashboard.drafts[0].version, 2);
  assert.equal(dashboard.activity.length, 2);
  await assert.rejects(savePromotionDraft(db, input({ campaignId: created.campaignId,
    expectedVersion: 1 }), "admin@vii.co.il"), (error) => error.code === "version_conflict");
});

test("a removed supplier cannot receive a new or updated promotion draft", async () => {
  const state = database();
  state.removePlace();
  await assert.rejects(savePromotionDraft(state.db, input(), "admin@vii.co.il"),
    (error) => error.code === "place_not_published");
  assert.equal(state.events.length, 0);
});

test("an existing draft can be archived after its supplier leaves the catalog", async () => {
  const state = database();
  const created = await savePromotionDraft(state.db, input(), "admin@vii.co.il");
  state.removePlace();
  const archive = input({ campaignId: created.campaignId, expectedVersion: 1, status: "archived" });
  const archived = await savePromotionDraft(state.db, archive, "admin@vii.co.il");
  assert.equal(archived.placeName, created.placeName);
  assert.equal(archived.status, "archived");
  await assert.rejects(savePromotionDraft(state.db,
    input({ campaignId: created.campaignId, expectedVersion: 2, status: "draft" }), "admin@vii.co.il"),
  (error) => error.code === "place_not_published");
});

test("promotion drafts have a dedicated migration and are not read by public ranking", async () => {
  const migration = await readFile(new URL("../drizzle/0004_futuristic_beast.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE `discovery_promotion_draft_events`/);
  const source = await readFile(new URL("../app/lib/discovery-promotion-drafts.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /export (?:function|const) (?:rank|boost|promote)Public/);
});

test("promotion administration rejects anonymous reads and cross-origin writes", async () => {
  const previousEmails = process.env.VII_ADMIN_EMAILS;
  const previousSecret = process.env.VII_AUTH_SECRET;
  process.env.VII_ADMIN_EMAILS = "admin@vii.co.il";
  process.env.VII_AUTH_SECRET = "test-secret-only-for-signing-sessions-123456789";
  try {
    const anonymous = await GET(new Request("https://vii.example/api/admin/discovery-promotions"));
    assert.equal(anonymous.status, 403);
    const session = await createSignedValue({ sub: "admin", name: "Admin", email: "admin@vii.co.il",
      provider: "google", exp: Math.floor(Date.now() / 1000) + 3600 });
    const crossOrigin = await POST(new Request("https://vii.example/api/admin/discovery-promotions", {
      method: "POST", headers: { cookie: `vii_session=${session}`, origin: "https://other.example" },
      body: JSON.stringify(input()),
    }));
    assert.equal(crossOrigin.status, 403);
  } finally {
    if (previousEmails === undefined) delete process.env.VII_ADMIN_EMAILS;
    else process.env.VII_ADMIN_EMAILS = previousEmails;
    if (previousSecret === undefined) delete process.env.VII_AUTH_SECRET;
    else process.env.VII_AUTH_SECRET = previousSecret;
  }
});
