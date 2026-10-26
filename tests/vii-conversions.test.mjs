import assert from "node:assert/strict";
import { test } from "node:test";
import { conversionTarget, fetchViiConversions, ViiConversionsError } from "../app/lib/vii-conversions.ts";

function fixture() {
  const bucket = { contacts: 7, identified: 6, converted: 4, rate: 57.1, customers: 3, orders: 3, revenue: 2900, medianDelay: 91800 };
  return { api_version: 1.1, created: "2026-10-22T10:00:00+03:00", siteID: 2566, from: "2026-10-01", till: "2026-10-22", domainID: 6,
    summary: { all: bucket, whatsapp: bucket, maskyoo: bucket, form: bucket }, clicks: { whatsapp: 2, showphone: 1, phone: 1 }, count: 7,
    contacts: [{ name: "must not leave the server", phone: "050-0000000", email: "private@example.com" }] };
}

function detailedFixture() {
  const base = fixture();
  return { ...base, count: 2, contacts: [
    { source: "maskyoo", id: 11, domainID: 6, time: "2026-10-01 09:00:00", name: "", phone: "050-2222222", email: null,
      details: { status: "ANSWER", duration: 95 }, order: null, delay: null, moreOrders: [] },
    { source: "whatsapp", id: 12, domainID: 6, time: "2026-10-01 10:00:00", name: "Dana", phone: "050-1111111", email: "private@example.com",
      details: { date: "2026-10-21", guests: 2, note: "must not leave the server" },
      order: { orderID: 101, orderIDBySite: "A-17", created: "2026-10-02 12:00:00", customerName: "Dana", price: 1000 }, delay: 93600, moreOrders: [102] },
  ] };
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
  assert.equal(calls[0].init.redirect, undefined);
  assert.equal("contacts" in result, false);
  assert.equal(result.summary.all.orders, 3);
});

test("authorized detail mode returns minimized contact and order evidence", async () => {
  const result = await fetchViiConversions({ world: "vacations", siteID: 2566, from: "2026-10-01", till: "2026-10-22", token: "server-secret", sectionOnly: true, includeContacts: true,
    fetchImpl: async () => Response.json(detailedFixture()) });
  assert.equal(result.contacts.length, 2);
  assert.deepEqual(result.contacts[0], { source: "maskyoo", id: 11, domainID: 6, time: "2026-10-01 09:00:00", phone: "050-2222222", details: { status: "ANSWER", duration: 95 }, order: null, delay: null, moreOrders: [] });
  assert.equal(result.contacts[1].order.price, 1000);
  assert.deepEqual(result.contacts[1].moreOrders, ["102"]);
  assert.equal("email" in result.contacts[1], false);
  assert.equal("name" in result.contacts[1], false);
  assert.equal("customerName" in result.contacts[1].order, false);
  assert.equal("note" in result.contacts[1].details, false);
});

test("detail mode rejects malformed contacts instead of leaking raw provider rows", async () => {
  await assert.rejects(fetchViiConversions({ world: "vacations", siteID: 2566, from: "2026-10-01", till: "2026-10-22", token: "secret", includeContacts: true,
    fetchImpl: async () => Response.json({ ...detailedFixture(), contacts: [{ source: "maskyoo", id: 1, phone: "050-0000000", details: { status: "ANSWER", duration: -1 } }] }) }),
  (error) => error instanceof ViiConversionsError && error.code === "invalid_response" && error.diagnostic === "contacts.item.domainID");
});

test("contact diagnostics identify only the malformed field and never its private value", async () => {
  const response = detailedFixture();
  response.contacts[1].phone = { private: "050-9999999" };
  await assert.rejects(fetchViiConversions({ world: "vacations", siteID: 2566, from: "2026-10-01", till: "2026-10-22", token: "secret", includeContacts: true,
    fetchImpl: async () => Response.json(response) }),
  (error) => error instanceof ViiConversionsError && error.diagnostic === "contacts.item.phone" && !error.message.includes("050-9999999"));
});

test("numeric and omitted Biz contact phones normalize without losing report rows", async () => {
  const response = detailedFixture();
  response.contacts[0].phone = 501111111;
  delete response.contacts[1].phone;
  const result = await fetchViiConversions({ world: "vacations", siteID: 2566, from: "2026-10-01", till: "2026-10-22", token: "secret", includeContacts: true,
    fetchImpl: async () => Response.json(response) });
  assert.equal(result.contacts[0].phone, "501111111");
  assert.equal(result.contacts[1].phone, null);
});

test("invalid ranges and malformed provider data fail closed without token disclosure", async () => {
  await assert.rejects(fetchViiConversions({ world: "vacations", siteID: 1, from: "2026-10-22", till: "2026-10-01", token: "secret" }), { code: "invalid_request" });
  await assert.rejects(fetchViiConversions({ world: "vacations", siteID: 2566, from: "2026-10-01", till: "2026-10-22", token: "secret",
    fetchImpl: async () => Response.json({ ...fixture(), contacts: [], summary: {} }) }),
  (error) => error instanceof ViiConversionsError && error.code === "invalid_response" && error.diagnostic === "summary.all.contacts" && !error.message.includes("secret"));
});

test("aggregate diagnostics identify the exact malformed field without exposing its value", async () => {
  const response = fixture();
  response.summary.all.medianDelay = "not-a-number";
  await assert.rejects(fetchViiConversions({ world: "vacations", siteID: 2566, from: "2026-10-01", till: "2026-10-22", token: "secret",
    fetchImpl: async () => Response.json(response) }),
  (error) => error instanceof ViiConversionsError && error.code === "invalid_response" && error.diagnostic === "summary.all.medianDelay" && !error.message.includes("not-a-number"));
});

test("fractional median delay values are accepted by the official Biz number contract", async () => {
  const response = fixture();
  response.summary.all.medianDelay = 91800.5;
  const result = await fetchViiConversions({ world: "vacations", siteID: 2566, from: "2026-10-01", till: "2026-10-22", token: "secret",
    fetchImpl: async () => Response.json(response) });
  assert.equal(result.summary.all.medianDelay, 91800.5);
});

test("unsupported and unavailable provider states remain distinct", async () => {
  await assert.rejects(fetchViiConversions({ world: "rooms", siteID: 475, from: "2026-10-01", till: "2026-10-22", token: "secret", fetchImpl: async () => new Response("", { status: 404 }) }), { code: "not_supported", status: 404 });
  await assert.rejects(fetchViiConversions({ world: "events", siteID: 42, from: "2026-10-01", till: "2026-10-22", token: "secret", fetchImpl: async () => new Response("", { status: 503 }) }), { code: "supplier_unavailable", status: 503 });
});
