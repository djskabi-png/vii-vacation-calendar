import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("VII server forwards leads to the global system with a shared secret", async () => {
  const route = await read("app/api/leads/route.ts");

  assert.match(route, /https:\/\/app\.spaplus\.co\/api\/integrations\/vii-leads/);
  assert.match(route, /VII_LEADS_SECRET/);
  assert.match(route, /"X-VII-Leads-Secret": secret/);
  assert.match(route, /sourceSite: "vii\.co\.il"/);
  assert.match(route, /sourceHost: "vii\.spaplus\.co"/);
  assert.match(route, /sourceBrand: "VII"/);
  assert.match(route, /emailDelivered: result\.emailDelivered === true/);
});

test("vacation join form requires email and reports confirmed delivery", async () => {
  const form = await read("app/components/lead-intake-form.tsx");

  assert.match(form, /effectiveSelectedWorld === "vacation"/);
  assert.match(form, /required=\{isJoin && effectiveSelectedWorld === "vacation"\}/);
  assert.match(form, /sourceChannel: isJoin \? "site_join" : "site_form"/);
  assert.match(form, /locale: document\.documentElement\.lang \|\| "he"/);
  assert.match(form, /setEmailDelivered\(result\.emailDelivered === true\)/);
  assert.match(form, /אישור קבלת הבקשה נשלח לכתובת הדוא״ל שמילאתם/);
});
