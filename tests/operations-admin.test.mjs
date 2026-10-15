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
  assert.match(reviews, /import \{ isAdminEmail \} from "\.\.\/\.\.\/\.\.\/lib\/admin-access\.ts"/);
  assert.match(reviews, /isAdminEmail\(session\.email\)/);
  assert.doesNotMatch(reviews, /user_email|visitor_phone/);
});
