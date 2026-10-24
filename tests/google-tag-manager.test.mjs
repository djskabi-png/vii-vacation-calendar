import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the verified VII GTM container is consent gated and reacts to preference changes", async () => {
  const source = await read("app/components/google-tag-manager.tsx");
  assert.match(source, /GTM-WG8VXDB/);
  assert.match(source, /localStorage\.getItem\(CONSENT_STORAGE_KEY\)/);
  assert.match(source, /choice === "all"/);
  assert.match(source, /if \(granted\) loadContainer\(\)/);
  assert.match(source, /vii-cookie-choice-changed/);
  assert.match(source, /pushConsent\("default", false\)/);
  assert.match(source, /gtag\("consent", command, state\)/);
});

test("cookie preferences notify the GTM gate and admin pages never load it", async () => {
  const consent = await read("app/components/cookie-consent.tsx");
  const layout = await read("app/layout.tsx");
  assert.match(consent, /new CustomEvent\(CHOICE_EVENT, \{ detail: value \}\)/);
  assert.match(layout, /<GoogleTagManager enabled=\{!isAdmin\} \/>/);
});

test("the growth center reports only the identifiers verified in the live Google accounts", async () => {
  const page = await read("app/admin/growth/page.tsx");
  assert.match(page, /G-6DMS0FKGYK/);
  assert.match(page, /GTM-WG8VXDB/);
  assert.match(page, /2,703/);
  assert.match(page, /מחובר בהסכמה/);
});
