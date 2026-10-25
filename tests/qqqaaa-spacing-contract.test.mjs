import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const previewCss = readFileSync(new URL("../app/preview-card-consistency.css", import.meta.url), "utf8");
const runner = readFileSync(new URL("../scripts/run-qqqaaa.cjs", import.meta.url), "utf8");
const audit = readFileSync(new URL("../scripts/audit-header-spacing.cjs", import.meta.url), "utf8");

test("mobile world selector preserves readable inline spacing", () => {
  assert.match(css, /\.world-dock > summary \{[\s\S]*?padding-inline: 10px;[\s\S]*?gap: 6px;/);
  assert.match(css, /\.stay-card__actions:has\(> :nth-child\(2\):last-child\) \{ grid-template-columns: repeat\(2,minmax\(0,1fr\)\); \}/);
  assert.match(previewCss, /\.place-preview-card__contact \{ container-type: inline-size; \}/);
  assert.match(previewCss, /@container \(max-width: 220px\)[\s\S]*?\.preview-card-contact-row \{ grid-template-columns: minmax\(0,1fr\); \}/);
});

test("QQQAAA measures framed-control spacing across site families, four languages and three widths", () => {
  assert.match(runner, /header-control-spacing/);
  assert.match(runner, /qa:spacing/);
  assert.match(audit, /\["he", "en", "ru", "fr"\]/);
  assert.match(audit, /vacation-search/);
  assert.match(audit, /vacation-place/);
  assert.match(audit, /event-place/);
  assert.match(audit, /hourly-place/);
  assert.match(audit, /spa-place/);
  assert.match(audit, /inspectSiteControls/);
  assert.match(audit, /framed-control-spacing/);
  assert.match(audit, /labelStartGap < 8/);
  assert.match(audit, /iconEndGap < 8/);
  assert.match(audit, /labelIconGap < 4/);
  assert.match(audit, /horizontalOverflow/);
});
