import assert from "node:assert/strict";
import { test } from "node:test";
import { createSignedValue } from "../app/lib/google-auth.ts";
import { GET } from "../app/api/admin/overview/route.ts";

const endpoint = "https://vii.spaplus.co/api/admin/overview";

test("admin overview denies anonymous visitors without exposing activity", async () => {
  const old = process.env.VII_ADMIN_EMAILS;
  process.env.VII_ADMIN_EMAILS = "owner@example.test";
  try {
    const response = await GET(new Request(endpoint));
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "forbidden" });
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
  } finally {
    if (old === undefined) delete process.env.VII_ADMIN_EMAILS;
    else process.env.VII_ADMIN_EMAILS = old;
  }
});

test("admin overview denies a signed-in account outside the admin allowlist", async () => {
  const oldEmails = process.env.VII_ADMIN_EMAILS;
  const oldSecret = process.env.VII_AUTH_SECRET;
  process.env.VII_ADMIN_EMAILS = "owner@example.test";
  process.env.VII_AUTH_SECRET = "test-admin-overview-secret-of-32-characters";
  try {
    const token = await createSignedValue({ sub: "visitor", name: "Visitor", email: "visitor@example.test",
      provider: "google", exp: Math.floor(Date.now() / 1000) + 60 });
    const response = await GET(new Request(endpoint, { headers: { Cookie: `vii_session=${encodeURIComponent(token)}` } }));
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "forbidden" });
  } finally {
    if (oldEmails === undefined) delete process.env.VII_ADMIN_EMAILS; else process.env.VII_ADMIN_EMAILS = oldEmails;
    if (oldSecret === undefined) delete process.env.VII_AUTH_SECRET; else process.env.VII_AUTH_SECRET = oldSecret;
  }
});

