import assert from "node:assert/strict";
import { test } from "node:test";
import { createSignedValue } from "../app/lib/google-auth.ts";
import { GET, POST } from "../app/api/admin/catalog-sync/route.ts";

const origin = "https://vii.spaplus.co";

test("catalog administration rejects unauthenticated reads and writes", async () => {
  const previous = process.env.VII_ADMIN_EMAILS;
  const previousManagers = process.env.VII_ACCESS_MANAGER_EMAILS;
  process.env.VII_ADMIN_EMAILS = "owner@example.test";
  process.env.VII_ACCESS_MANAGER_EMAILS = "owner@example.test";
  try {
    assert.equal((await GET(new Request(`${origin}/api/admin/catalog-sync`))).status, 403);
    assert.equal((await POST(new Request(`${origin}/api/admin/catalog-sync`, {
      method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ world: "spa" }),
    }))).status, 403);
  } finally {
    if (previous === undefined) delete process.env.VII_ADMIN_EMAILS;
    else process.env.VII_ADMIN_EMAILS = previous;
    if (previousManagers === undefined) delete process.env.VII_ACCESS_MANAGER_EMAILS; else process.env.VII_ACCESS_MANAGER_EMAILS = previousManagers;
  }
});

test("signed-in non-admin users cannot read or trigger diagnostic catalog runs", async () => {
  const oldEmails = process.env.VII_ADMIN_EMAILS;
  const oldSecret = process.env.VII_AUTH_SECRET;
  const oldManagers = process.env.VII_ACCESS_MANAGER_EMAILS;
  process.env.VII_ADMIN_EMAILS = "owner@example.test";
  process.env.VII_ACCESS_MANAGER_EMAILS = "owner@example.test";
  process.env.VII_AUTH_SECRET = "test-catalog-admin-secret-of-32-characters";
  try {
    const token = await createSignedValue({ sub: "visitor", name: "Visitor", email: "visitor@example.test",
      provider: "google", exp: Math.floor(Date.now() / 1000) + 60 });
    const headers = { Cookie: `vii_session=${encodeURIComponent(token)}`, Origin: origin, "Content-Type": "application/json" };
    for (const response of [await GET(new Request(`${origin}/api/admin/catalog-sync`, { headers })),
      await POST(new Request(`${origin}/api/admin/catalog-sync`, { method: "POST", headers, body: JSON.stringify({ world: "spa" }) }))]) {
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: "forbidden" });
    }
  } finally {
    if (oldEmails === undefined) delete process.env.VII_ADMIN_EMAILS; else process.env.VII_ADMIN_EMAILS = oldEmails;
    if (oldSecret === undefined) delete process.env.VII_AUTH_SECRET; else process.env.VII_AUTH_SECRET = oldSecret;
    if (oldManagers === undefined) delete process.env.VII_ACCESS_MANAGER_EMAILS; else process.env.VII_ACCESS_MANAGER_EMAILS = oldManagers;
  }
});

test("catalog administration blocks cross-origin and invalid manual actions before touching D1", async () => {
  const oldEmails = process.env.VII_ADMIN_EMAILS;
  const oldSecret = process.env.VII_AUTH_SECRET;
  const oldManagers = process.env.VII_ACCESS_MANAGER_EMAILS;
  process.env.VII_ADMIN_EMAILS = "owner@example.test";
  process.env.VII_ACCESS_MANAGER_EMAILS = "owner@example.test";
  process.env.VII_AUTH_SECRET = "test-catalog-admin-secret-of-32-characters";
  try {
    const token = await createSignedValue({ sub: "owner", name: "Owner", email: "owner@example.test",
      provider: "google", exp: Math.floor(Date.now() / 1000) + 60 });
    const headers = { Cookie: `vii_session=${encodeURIComponent(token)}`, "Content-Type": "application/json" };
    assert.equal((await POST(new Request(`${origin}/api/admin/catalog-sync`, {
      method: "POST", headers: { ...headers, Origin: "https://other.example" },
      body: JSON.stringify({ world: "spa" }),
    }))).status, 403);
    assert.equal((await POST(new Request(`${origin}/api/admin/catalog-sync`, {
      method: "POST", headers: { ...headers, Origin: origin },
      body: JSON.stringify({ world: "providers" }),
    }))).status, 400);
  } finally {
    if (oldEmails === undefined) delete process.env.VII_ADMIN_EMAILS;
    else process.env.VII_ADMIN_EMAILS = oldEmails;
    if (oldSecret === undefined) delete process.env.VII_AUTH_SECRET;
    else process.env.VII_AUTH_SECRET = oldSecret;
    if (oldManagers === undefined) delete process.env.VII_ACCESS_MANAGER_EMAILS;
    else process.env.VII_ACCESS_MANAGER_EMAILS = oldManagers;
  }
});
