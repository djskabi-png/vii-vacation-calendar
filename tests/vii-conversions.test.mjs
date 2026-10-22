import assert from "node:assert/strict";
import { test } from "node:test";
import { conversionTarget, fetchViiConversions, ViiConversionsError } from "../app/lib/vii-conversions.ts";

function fixture() {
  const bucket = { contacts: 7, identified: 6, converted: 4, rate: 57.1, customers: 3, orders: 3, revenue: 2900, medianDelay: 91800 };
  return { api_version: 1.1, created: "2026-10-22T10:00:00+03:00", siteID: 2566, from: "2026-10-01", till: "2026-10-22", domainID: 6,
    summary: { all: bucket, whatsapp: bucket, maskyoo: bucket, form: bucket }, clicks: { whatsapp: 2, showphone: 1, phone: 1 }, count: 7,
    contacts: [{ name: "must not leave the server", phone: "050-0000000", email: "private@example.com" }] };
}

test("conversion target accepts only supported world and numeric supplier slug", () => {
  assert.deepEqual(conversionTarget("vacation-2566", "vacation"), { world: "vacations", siteID: 2566 });
  assert.deepEqual(conversionTarget("event-42", "events"), { world: "events", siteID: 42 });
  assert.deepEqual(conversionTarget("hourly-475", "hourly"), { world: "rooms", siteID: 475 });
  assert.equal(conversionTarget("provider-5", "providers"), null);
  assert.equal(conversionTarget("vacation-x", "vacation"), null);
});

test("server conversion adapter authenticates, scopes to section and strips contacts", async () => {
  const calls = [];
  const result = await fetchViiConversions({ world: "vacations", siteID: 2566, from: "2026-10-01", till: "2026-10-22", token: "server-secret", sectionOnly: true,
    fetchImpl: async (url, init) => { calls.push({ url, init }); return Response.json(fixture()); } });
  assert.match(calls[0].url, /\/vacations\/2566\/conversions\?from=2026-10-01&till=2026-10-22&domain=section$/);
  assert.equal(calls[0].init.headers.Authorization, "Bearer server-secret");
  assert.equal(calls[0].init.cache, "no-store");
  assert.equal("contacts" in result, false);
  assert.equal(result.summary.all.orders, 3);
});

test("invalid ranges and malformed provider data fail closed without token disclosure", async () => {
  await assert.rejects(fetchViiConversions({ world: "vacations", siteID: 1, from: "2026-10-22", till: "2026-10-01", token: "secret" }), { code: "invalid_request" });
  await assert.rejects(fetchViiConversions({ world: "vacations", siteID: 2566, from: "2026-10-01", till: "2026-10-22", token: "secret",
    fetchImpl: async () => Response.json({ ...fixture(), contacts: [], summary: {} }) }),
  (error) => error instanceof ViiConversionsError && error.code === "invalid_response" && !error.message.includes("secret"));
});

test("unsupported and unavailable provider states remain distinct", async () => {
  await assert.rejects(fetchViiConversions({ world: "rooms", siteID: 475, from: "2026-10-01", till: "2026-10-22", token: "secret", fetchImpl: async () => new Response("", { status: 404 }) }), { code: "not_supported", status: 404 });
  await assert.rejects(fetchViiConversions({ world: "events", siteID: 42, from: "2026-10-01", till: "2026-10-22", token: "secret", fetchImpl: async () => new Response("", { status: 503 }) }), { code: "supplier_unavailable", status: 503 });
});
