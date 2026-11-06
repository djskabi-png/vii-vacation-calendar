import { composeWorldStyles } from "../build/world-style-slots.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const marker = "/* VII_SPA_AUDIENCE_DATE_CSS_SLOT */";
const canonical = (value) => value.replace(/\r\n?/g, "\n");
const baseline = canonical(execFileSync("git", ["show", "2c6fda30:app/globals.css"], { cwd: root, encoding: "utf8" }));
const current = canonical(fs.readFileSync(path.join(root, "app/globals.css"), "utf8"));
const spa = canonical(fs.readFileSync(path.join(root, "app/worlds/spa/styles/spa-audience-date.css"), "utf8"));
assert.equal(current.split(marker).length - 1, 1);
assert.equal(spa.trimEnd(), baseline.slice(baseline.indexOf("/* Spa audience and date */"), baseline.indexOf("\n\n@media (max-width: 980px)", baseline.indexOf("/* Spa audience and date */"))).trimEnd());
const commentIndex = current.indexOf("/* Spa audience and date */");
assert.ok(current.indexOf(marker) > commentIndex);

const compiled = canonical(composeWorldStyles(current));
assert.equal(compiled.replace(spa, "__SPA_BLOCK__").includes("__SPA_BLOCK__"), true);

const { chromium } = await import("playwright");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const html = (css) => `<!doctype html><style>${css}</style><div class="spa-date-dialog"><div class="spa-date-dialog__header"><h2>תאריך</h2></div><div class="spa-calendar"><button class="spa-date-confirm">אישור</button></div></div>`;
  await page.setContent(html(baseline));
  const before = await page.locator(".spa-date-dialog").evaluate((el) => { const s = getComputedStyle(el); return { width: s.width, radius: s.borderRadius, bg: s.backgroundColor }; });
  await page.setContent(html(compiled));
  const after = await page.locator(".spa-date-dialog").evaluate((el) => { const s = getComputedStyle(el); return { width: s.width, radius: s.borderRadius, bg: s.backgroundColor }; });
  assert.deepEqual(after, before);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.locator(".spa-date-dialog__header").evaluate((el) => { const s = getComputedStyle(el); return { padding: s.padding, display: s.display }; });
  assert.equal(mobile.display, "flex");
} finally {
  await browser.close();
}
console.log("spa CSS slot parity: ok");
