import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../scripts/audit-comprehensive-production.cjs", import.meta.url), "utf8");

test("comprehensive QA verifies first-visit consent before interaction checks", () => {
  assert.match(source, /privacy-consent-\$\{viewport\.id\}/);
  assert.match(source, /essential_cookie_choice_not_persisted/);
  assert.match(source, /await card\.waitFor\(\{ state: "detached"/);
  assert.match(source, /html\[data-vii-hydrated="true"\]/);
  assert.match(source, /waitForTimeout\(800\)/);
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
  assert.match(source, /page\.locator\("\.map-mobile-close:visible"\)/);
  assert.match(source, /waitForSelector\("\.map-preview-card,\.listing-map-shell"/);
  assert.match(source, /waitForFunction\(\(\) => location\.pathname === "\/search"/);
});

test("production QA supports bounded viewport and core-only reruns", () => {
  assert.match(source, /process\.env\.QA_VIEWPORTS/);
  assert.match(source, /process\.env\.QA_CORE_ONLY/);
  assert.match(source, /qa_viewports_empty_or_invalid/);
});

test("QQQAAA geometry gate measures every visible semantic feature icon", () => {
  assert.match(source, /async function verifyFeatureIconGeometry\(page\)/);
  assert.match(source, /feature_icon_escapes_frame/);
  assert.match(source, /feature_icon_off_center/);
  assert.match(source, /feature_icon_label_collision/);
  assert.match(source, /document\.querySelectorAll\("\[data-feature-icon\]"\)/);
  assert.match(source, /await verifyFeatureIconGeometry\(page\)/);
});
