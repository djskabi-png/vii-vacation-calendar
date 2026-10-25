import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  ADMIN_SESSION_COOKIE,
  CUSTOMER_SESSION_COOKIE,
  authAudience,
  createSignedValue,
  readAdminSession,
  readCustomerSession,
  safeReturnTo,
} from "../app/lib/google-auth.ts";

const secret = "test-auth-audience-secret-longer-than-thirty-two-characters";
const origin = "https://vii.spaplus.co";
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

async function token(email = "owner@example.test") {
  return createSignedValue({ sub: `google:${email}`, name: "Test User", email, provider: "google", exp: Math.floor(Date.now() / 1000) + 600 }, secret);
}

test("customer and administrator cookies are mutually exclusive session boundaries", async () => {
  process.env.VII_AUTH_SECRET = secret;
  const value = await token();
  const customerRequest = new Request(`${origin}/account`, { headers: { cookie: `${CUSTOMER_SESSION_COOKIE}=${encodeURIComponent(value)}` } });
  const adminRequest = new Request(`${origin}/admin`, { headers: { cookie: `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(value)}` } });
  assert.equal((await readCustomerSession(customerRequest))?.email, "owner@example.test");
  assert.equal(await readAdminSession(customerRequest), null);
  assert.equal((await readAdminSession(adminRequest))?.email, "owner@example.test");
  assert.equal(await readCustomerSession(adminRequest), null);
});

test("OAuth audience and return targets cannot cross customer and administrator flows", () => {
  assert.equal(authAudience("/admin/business-performance", null), "admin");
  assert.equal(authAudience("/account", null), "customer");
  assert.equal(safeReturnTo("/admin/business-performance", "customer"), "/account");
  assert.equal(safeReturnTo("/account", "admin"), "/admin");
  assert.equal(safeReturnTo("/admin/business-performance", "admin"), "/admin/business-performance");
  assert.equal(safeReturnTo("/favorites", "customer"), "/favorites");
});

test("Google OAuth start writes a role-specific nonce cookie", async () => {
  const startRoute = await read("app/api/auth/google/route.ts");
  assert.match(startRoute, /nonceCookieFor\(audience\)/);
  assert.match(startRoute, /authAudience\(url\.searchParams\.get\("returnTo"\), url\.searchParams\.get\("audience"\)\)/);
  assert.match(startRoute, /safeReturnTo\(url\.searchParams\.get\("returnTo"\), audience\)/);
});

test("admin rendering excludes the public account provider and both login surfaces preload the approved logo", async () => {
  const [layout, account, publicSession, adminLayout, adminLogin, adminCommand, callback] = await Promise.all([
    read("app/layout.tsx"),
    read("app/components/account-access.tsx"),
    read("app/api/auth/session/route.ts"),
    read("app/admin/layout.tsx"),
    read("app/admin/login/page.tsx"),
    read("app/admin/admin-command-bar.tsx"),
    read("app/api/auth/google/callback/route.ts"),
  ]);
  assert.match(layout, /isAdmin \? worldTree : <AccountAccessProvider>/);
  assert.match(layout, /href="\/vii-logo\.png" as="image"/);
  assert.match(account, /loading="eager" decoding="sync" fetchPriority="high"/);
  assert.match(publicSession, /readCustomerSession/);
  assert.doesNotMatch(publicSession, /readAdminSession/);
  assert.match(adminLayout, /pathname === "\/admin\/login"/);
  assert.match(adminLayout, /readAdminSession/);
  assert.doesNotMatch(adminLayout, /\/account\?authError/);
  assert.match(adminLogin, /priority unoptimized/);
  assert.match(adminLogin, /audience=admin/);
  assert.match(adminCommand, /\/api\/auth\/admin\/session/);
  assert.match(adminCommand, /\/api\/auth\/admin\/logout/);
  assert.doesNotMatch(adminCommand, /\/account\?loggedOut/);
  assert.match(callback, /sessionCookieFor\(audience\)/);
  assert.match(callback, /admin\/login\?authError/);
});
