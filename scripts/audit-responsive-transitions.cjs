#!/usr/bin/env node
"use strict";

const { chromium } = require("playwright");
const { existsSync, mkdirSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");

const baseUrl = (process.env.BASE_URL || "https://vii.spaplus.co").replace(/\/$/, "");
const outputDir = resolve(process.env.QA_OUTPUT_DIR || "qa-reports/responsive-transitions");
const chrome = process.platform === "win32" && existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")
  ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : undefined;
const states = [
  { id: "vacation-filter", path: "/search?location=%D7%9B%D7%9C%20%D7%94%D7%90%D7%A8%D7%A5", trigger: ".primary-filter", open: ".filter-panel.open", close: ".filter-panel .filter-head button[aria-label='סגירה']" },
  { id: "events-filter", path: "/events/search?location=%D7%9B%D7%9C%20%D7%94%D7%90%D7%A8%D7%A5", trigger: ".event-filter-toggle", open: ".filter-panel.open", close: ".filter-panel .filter-head button[aria-label='סגירת סינון']" },
  { id: "hourly-filter", path: "/hourly", trigger: ".hourly-filter-toggle", open: ".hourly-results__filters.open", close: ".hourly-filter-toggle" },
  { id: "spa-filter", path: "/spas", trigger: ".spa-results__filter-toggle", open: "#spa-result-filters", close: ".spa-results__filter-toggle" },
  { id: "vacation-gallery", path: "/business?id=vacation-116", trigger: "[data-gallery-trigger]", open: ".story-gallery", close: ".story-gallery__close" },
];
const sizes = [
  { id: "mobile", width: 390, height: 844 },
  { id: "landscape", width: 844, height: 390 },
  { id: "tablet", width: 820, height: 900 },
  { id: "desktop", width: 1440, height: 900 },
  { id: "mobile-return", width: 390, height: 844 },
];

async function geometry(page, selector) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await page.evaluate((target) => {
        const node = document.querySelector(target);
        const rect = node?.getBoundingClientRect();
        const body = document.body;
        return {
          found: Boolean(node), visible: Boolean(rect && rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== "hidden"),
          rect: rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } : null,
          viewport: { width: innerWidth, height: innerHeight }, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          bodyLock: Boolean(body?.hasAttribute("data-map-overlay-lock")), bodyPosition: body ? getComputedStyle(body).position : "transition",
        };
      }, selector);
    } catch (error) {
      if (attempt === 2 || !String(error).includes("Execution context was destroyed")) throw error;
      await page.waitForLoadState("domcontentloaded", { timeout: 10_000 });
      await page.waitForTimeout(450);
    }
  }
}

async function runState(browser, state) {
  const context = await browser.newContext({ viewport: sizes[0], locale: "he-IL", timezoneId: "Asia/Jerusalem", reducedMotion: "reduce" });
  const page = await context.newPage();
  const result = { id: state.id, path: state.path, samples: [], status: "failed" };
  try {
    const response = await page.goto(`${baseUrl}${state.path}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    if (!response || response.status() >= 400) throw new Error(`http_${response?.status() || 0}`);
    await page.waitForSelector('html[data-vii-hydrated="true"]', { timeout: 25_000 });
    await page.waitForTimeout(1_200);
    await page.locator(state.trigger).first().waitFor({ state: "visible", timeout: 25_000 });
    let opened = false;
    for (let attempt = 0; attempt < 2 && !opened; attempt += 1) {
      await page.locator(state.trigger).first().click({ force: true });
      opened = await page.locator(state.open).first().waitFor({ state: "visible", timeout: 4_000 }).then(() => true).catch(() => false);
      if (!opened) await page.waitForTimeout(450);
    }
    if (!opened) throw new Error("surface_did_not_open_after_two_current-document_clicks");
    for (const size of sizes) {
      await page.setViewportSize(size);
      await page.waitForTimeout(350);
      const sample = { size: size.id, ...(await geometry(page, state.open)) };
      result.samples.push(sample);
      if (!sample.found || !sample.visible) throw new Error(`${size.id}_state_disappeared`);
      if (sample.overflow > 2) throw new Error(`${size.id}_horizontal_overflow_${sample.overflow}`);
      if (!sample.rect || sample.rect.left < -3 || sample.rect.right > size.width + 3 || sample.rect.width > size.width + 6) {
        throw new Error(`${size.id}_surface_outside_viewport`);
      }
    }
    if (state.close) await page.locator(state.close).first().click({ force: true });
    else await page.locator(state.trigger).first().click({ force: true }).catch(() => page.keyboard.press("Escape"));
    await page.waitForTimeout(250);
    const closed = await geometry(page, state.open);
    result.closed = closed;
    if (closed.visible || closed.bodyLock || closed.bodyPosition === "fixed" || closed.overflow > 2) throw new Error("stale_overlay_state_after_close");
    await page.screenshot({ path: join(outputDir, `${state.id}.png`), fullPage: false });
    result.status = "passed";
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    await page.screenshot({ path: join(outputDir, `${state.id}-failed.png`), fullPage: false }).catch(() => undefined);
  } finally { await context.close(); }
  return result;
}

(async () => {
  mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(chrome ? { executablePath: chrome } : {}) });
  const results = [];
  try { for (const state of states) { const result = await runState(browser, state); results.push(result); console.log(`${result.status.toUpperCase()} ${result.id}${result.error ? ` ${result.error}` : ""}`); } }
  finally { await browser.close(); }
  const failed = results.filter((result) => result.status !== "passed");
  const report = { schemaVersion: 1, baseUrl, generatedAt: new Date().toISOString(), cases: results.length, passed: results.length - failed.length, failed: failed.length, results };
  const reportPath = join(outputDir, "responsive-transitions-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ reportPath, passed: report.passed, failed: report.failed }));
  process.exitCode = failed.length ? 1 : 0;
})().catch((error) => { console.error(error); process.exitCode = 1; });
