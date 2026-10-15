import assert from "node:assert/strict";
import { test } from "node:test";
import { authorizedAdminSession } from "../app/lib/admin-session.ts";
import { createSignedValue, SESSION_COOKIE } from "../app/lib/google-auth.ts";

const secret = "test-secret-that-is-longer-than-thirty-two-characters";

async function requestFor(email) {
  const value = await createSignedValue({
    sub: `user-${email}`,
    name: "Test User",
    email,
    provider: "google",
    exp: Math.floor(Date.now() / 1000) + 600,
  }, secret);
  return new Request("https://vii.spaplus.co/admin", { headers: { cookie: `${SESSION_COOKIE}=${encodeURIComponent(value)}` } });
}

test("server admin gate denies anonymous requests before rendering the admin shell", async () => {
  process.env.VII_AUTH_SECRET = secret;
  assert.equal(await authorizedAdminSession(new Request("https://vii.spaplus.co/admin"), ["admin@example.com"]), null);
});

test("server admin gate denies a signed-in account outside the administrator allowlist", async () => {
  process.env.VII_AUTH_SECRET = secret;
  assert.equal(await authorizedAdminSession(await requestFor("visitor@example.com"), ["admin@example.com"]), null);
});

test("server admin gate accepts a signed-in administrator case-insensitively", async () => {
  process.env.VII_AUTH_SECRET = secret;
  const session = await authorizedAdminSession(await requestFor("ADMIN@example.com"), ["admin@example.com"]);
  assert.equal(session?.email, "ADMIN@example.com");
});
