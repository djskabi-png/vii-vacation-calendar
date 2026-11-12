import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const secret = "vii-customer-account-test-secret-32-characters-minimum";
process.env.VII_AUTH_SECRET = secret;

test("customer profile update is authenticated, validated and persisted in the signed session", async () => {
  const { createSignedValue, readSignedValue } = await import("../app/lib/google-auth.ts");
  const { PATCH } = await import("../app/api/auth/session/route.ts");
  const initial = { sub: "customer-1", name: "Old Name", email: "customer@example.test", provider: "google", exp: Math.floor(Date.now() / 1000) + 3600 };
  const cookie = `vii_customer_session=${encodeURIComponent(await createSignedValue(initial, secret))}`;
  const response = await PATCH(new Request("https://vii.test/api/auth/session", { method: "PATCH", headers: { cookie, origin: "https://vii.test", "content-type": "application/json" }, body: JSON.stringify({ name: "  Adir   Naor ", phone: "050-1234567" }) }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).account, { name: "Adir Naor", email: "customer@example.test", phone: "050-1234567", provider: "google" });
  const setCookie = response.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly; Secure; SameSite=Lax/);
  const signed = decodeURIComponent(setCookie.match(/vii_customer_session=([^;]+)/)[1]);
  const persisted = await readSignedValue(signed, secret);
  assert.equal(persisted.name, "Adir Naor");
  assert.equal(persisted.phone, "050-1234567");
  assert.equal(persisted.email, initial.email);
  assert.equal(persisted.sub, initial.sub);
});

test("profile update rejects unauthenticated, cross-origin and invalid requests", async () => {
  const { createSignedValue } = await import("../app/lib/google-auth.ts");
  const { PATCH } = await import("../app/api/auth/session/route.ts");
  const initial = { sub: "customer-1", name: "Old Name", email: "customer@example.test", provider: "google", exp: Math.floor(Date.now() / 1000) + 3600 };
  const cookie = `vii_customer_session=${encodeURIComponent(await createSignedValue(initial, secret))}`;
  const unauthenticated = await PATCH(new Request("https://vii.test/api/auth/session", { method: "PATCH", headers: { origin: "https://vii.test", "content-type": "application/json" }, body: JSON.stringify({ name: "Adir Naor", phone: "" }) }));
  assert.equal(unauthenticated.status, 401);
  const crossOrigin = await PATCH(new Request("https://vii.test/api/auth/session", { method: "PATCH", headers: { cookie, origin: "https://evil.test", "content-type": "application/json" }, body: JSON.stringify({ name: "Adir Naor", phone: "" }) }));
  assert.equal(crossOrigin.status, 403);
  const invalid = await PATCH(new Request("https://vii.test/api/auth/session", { method: "PATCH", headers: { cookie, origin: "https://vii.test", "content-type": "application/json" }, body: JSON.stringify({ name: "A", phone: "not-a-phone" }) }));
  assert.equal(invalid.status, 422);
});

test("account frontend has loading, editable, localized and accessible states", async () => {
  const [page, access, css, session] = await Promise.all([
    readFile(new URL("../app/account/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/account-access.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/session/route.ts", import.meta.url), "utf8")
  ]);
  assert.match(page, /account-loading/);
  assert.match(page, /account-profile-form/);
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /readOnly aria-readonly="true"/);
  assert.match(page, /text\[language\]/);
  assert.match(page, /account-status--\$\{booking\.status\}/);
  assert.match(access, /updateProfile/);
  assert.match(access, /method: "PATCH"/);
  assert.match(access, /event\.key !== "Tab"/);
  assert.match(access, /aria-describedby=\{bodyId\}/);
  assert.match(session, /export async function PATCH/);
  assert.match(css, /\.account-profile-form input:focus-visible/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /prefers-reduced-motion/);
});
