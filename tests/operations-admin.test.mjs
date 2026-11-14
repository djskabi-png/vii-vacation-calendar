import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { GET } from "../app/api/admin/operations/route.ts";

test("operations report is private without an administrator session", async () => {
  const previous = process.env.VII_ADMIN_EMAILS;
  process.env.VII_ADMIN_EMAILS = "owner@example.test";
  try {
    const response = await GET(new Request("https://vii.spaplus.co/api/admin/operations"));
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  } finally {
    if (previous === undefined) delete process.env.VII_ADMIN_EMAILS;
    else process.env.VII_ADMIN_EMAILS = previous;
  }
});

test("operations report distinguishes supplier receipt, lead acceptance and local review storage", async () => {
  const [page, booking, leads, reviews] = await Promise.all([
    readFile(new URL("../app/admin/operations/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/vii/booking/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/leads/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/operations/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(booking, /status: "supplier_accepted"/);
  assert.match(booking, /status: "status_unknown"/);
  assert.match(leads, /status: "lead_service_accepted"/);
  assert.match(page, /מסירה לספק לא אומתה/);
  assert.match(page, /אין ביומן הזה אישור מסירה לספק/);
  assert.match(reviews, /manualChecks:/);
  assert.doesNotMatch(page, /2026-10-13|אדיר/);
  assert.match(reviews, /import \{ authorizedAdminSession \} from "\.\.\/\.\.\/\.\.\/lib\/admin-session\.ts"/);
  assert.match(reviews, /await authorizedAdminSession\(request\)/);
  assert.match(reviews, /if \(!session\)/);
  assert.doesNotMatch(reviews, /user_email|visitor_phone/);
  assert.match(reviews, /Promise\.allSettled/);
  assert.match(reviews, /warnings/);
  assert.doesNotMatch(reviews, /\? = ''/);
});

test("spa booking requests are durably audited before the external lead side effect", async () => {
  const [leads, analytics, client, operations] = await Promise.all([
    readFile(new URL("../app/api/leads/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/analytics.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/booking/client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/operations/page.tsx", import.meta.url), "utf8"),
  ]);
  const auditIndex = leads.indexOf('status: "submission_started"');
  const upstreamIndex = leads.indexOf("const response = await fetch(upstream");
  assert.ok(auditIndex >= 0 && upstreamIndex > auditIndex, "audit must precede the external request");
  assert.match(leads, /booking_audit_unavailable/);
  assert.match(leads, /lead_service_rejected/);
  assert.match(leads, /status: "status_unknown"/);
  assert.match(analytics, /transaction_id: details\.reference/);
  assert.match(analytics, /vii-booking-receipt:/);
  assert.match(client, /trackBookingReceipt/);
  assert.match(operations, /requiredFromGal/);
  assert.doesNotMatch(analytics, /event:\s*["']purchase["']/);
});

test("spa provider receipt endpoint fails closed before touching booking state", async () => {
  const { POST } = await import("../app/api/integrations/spaplus/bookings/route.ts");
  const previous = process.env.VII_SPAPLUS_BOOKING_WEBHOOK_SECRET;
  try {
    delete process.env.VII_SPAPLUS_BOOKING_WEBHOOK_SECRET;
    const unconfigured = await POST(new Request("https://vii.spaplus.co/api/integrations/spaplus/bookings", { method: "POST", body: "{}" }));
    assert.equal(unconfigured.status, 503);
    process.env.VII_SPAPLUS_BOOKING_WEBHOOK_SECRET = "a-secure-test-secret-that-is-longer-than-32-characters";
    const unauthorized = await POST(new Request("https://vii.spaplus.co/api/integrations/spaplus/bookings", { method: "POST", headers: { "x-vii-spa-booking-secret": "wrong" }, body: "{}" }));
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.headers.get("Cache-Control"), "no-store");
  } finally {
    if (previous === undefined) delete process.env.VII_SPAPLUS_BOOKING_WEBHOOK_SECRET;
    else process.env.VII_SPAPLUS_BOOKING_WEBHOOK_SECRET = previous;
  }
});
