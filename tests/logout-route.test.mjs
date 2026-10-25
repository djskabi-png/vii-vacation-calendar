import assert from "node:assert/strict";
import test from "node:test";

test("customer logout expires only customer and legacy session cookies and disables response caching", async () => {
  const { POST } = await import("../app/api/auth/logout/route.ts");
  const response = await POST();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const cookie = response.headers.get("set-cookie") || "";
  assert.match(cookie, /vii_customer_session=;/);
  assert.match(cookie, /vii_session=;/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Max-Age=0/);
});

test("administrator logout expires only administrator and legacy session cookies", async () => {
  const { POST } = await import("../app/api/auth/admin/logout/route.ts");
  const response = await POST();
  const cookie = response.headers.get("set-cookie") || "";
  assert.equal(response.status, 200);
  assert.match(cookie, /vii_admin_session=;/);
  assert.match(cookie, /vii_session=;/);
  assert.doesNotMatch(cookie, /vii_customer_session=/);
});
