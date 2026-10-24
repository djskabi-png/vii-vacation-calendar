import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../scripts/audit-comprehensive-production.cjs", import.meta.url), "utf8");

test("comprehensive QA verifies first-visit consent before interaction checks", () => {
  assert.match(source, /privacy-consent-\$\{viewport\.id\}/);
  assert.match(source, /essential_cookie_choice_not_persisted/);
  assert.match(source, /await card\.waitFor\(\{ state: "detached"/);
});

test("locale QA starts with a deterministic essential-only consent state", () => {
  assert.match(source, /context\.addInitScript\(\(\) => localStorage\.setItem\("vii-cookie-choice", "essential"\)\)/);
});

test("map QA observes the live map and clicks a topmost marker wrapper", () => {
  assert.match(source, /waitForSelector\("\.listing-map"/);
  assert.doesNotMatch(source, /waitForSelector\("\.leaflet-container"/);
  assert.match(source, /document\.elementFromPoint\(x, y\)/);
  assert.match(source, /\.vii-map-marker-wrap\.is-cluster/);
  assert.match(source, /page\.mouse\.click\(markerBox\.x, markerBox\.y\)/);
});

test("production QA supports bounded viewport and core-only reruns", () => {
  assert.match(source, /process\.env\.QA_VIEWPORTS/);
  assert.match(source, /process\.env\.QA_CORE_ONLY/);
  assert.match(source, /qa_viewports_empty_or_invalid/);
});
