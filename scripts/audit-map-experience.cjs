#!/usr/bin/env node
"use strict";

const { chromium } = require("playwright");
const { existsSync, mkdirSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");

const baseUrl = (process.env.BASE_URL || "https://vii.spaplus.co").replace(/\/$/, "");
const outputDir = resolve(process.env.QA_OUTPUT_DIR || "qa-reports/map-experience");
const systemChrome = process.platform === "win32" && existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")
  ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  : undefined;
const routes = [
  ["vacations", "/search?location=%D7%9B%D7%9C%20%D7%94%D7%90%D7%A8%D7%A5"],
  ["events", "/events/search?location=%D7%9B%D7%9C%20%D7%94%D7%90%D7%A8%D7%A5"],
  ["hourly", "/hourly"],
  ["spa", "/spas"],
  ["activities", "/attractions"],
  ["trails", "/trails"],
];
const viewports = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
  ["low-height", { width: 390, height: 620 }],
];
const languages = ["he", "en", "ru", "fr"];
const requestedWorlds = new Set((process.env.MAP_WORLDS || routes.map(([world]) => world).join(",")).split(",").filter(Boolean));
const requestedViewports = new Set((process.env.MAP_VIEWPORTS || viewports.map(([id]) => id).join(",")).split(",").filter(Boolean));

function localized(path, language) {
  if (language === "he") return path;
  const queryAt = path.indexOf("?");
  return queryAt < 0 ? `/${language}${path}` : `/${language}${path.slice(0, queryAt)}${path.slice(queryAt)}`;
}

async function visibleCount(page, selector) {
  return page.locator(selector).evaluateAll((nodes) => nodes.filter((node) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }).length);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const visible = (selector) => [...document.querySelectorAll(selector)].filter((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });
    const shell = visible(".listing-map-shell")[0];
    const rect = shell?.getBoundingClientRect();
    return {
      ready: visible(".listing-map.is-ready").length,
      tiles: [...document.querySelectorAll(".leaflet-tile")].filter((image) => image.complete && image.naturalWidth > 0).length,
      markers: visible(".vii-map-marker-wrap").length,
      priceMarkers: visible(".marker-kind--price:not(.is-cluster)").length,
      clusters: visible(".vii-map-marker-wrap.is-cluster").length,
      selectedCards: visible(".map-selection-card").length,
      summary: visible(".map-results-summary").length,
      placeCount: Number(visible(".map-results-summary")[0]?.dataset.placeCount || 0),
      pricedPlaceCount: Number(visible(".map-results-summary")[0]?.dataset.pricedCount || 0),
      searchArea: visible(".map-search-area").length,
      viewport: { width: innerWidth, height: innerHeight },
      shell: rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } : null,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      bodyOverflow: document.body ? getComputedStyle(document.body).overflow : "document-transition",
    };
  });
}

async function selectMarker(page) {
  const clickViewportMarker = async (selector) => {
    const candidates = page.locator(selector);
    const count = Math.min(await candidates.count(), 40);
    const viewport = page.viewportSize();
    for (let index = 0; index < count; index += 1) {
      const candidate = candidates.nth(index);
      const box = await candidate.boundingBox();
      if (!box || !viewport) continue;
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      if (centerX < 0 || centerX > viewport.width || centerY < 0 || centerY > viewport.height) continue;
      await candidate.click({ force: true, timeout: 8_000 });
      return true;
    }
    return false;
  };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await clickViewportMarker(".vii-map-marker-wrap:not(.is-cluster):not(.is-hover-preview):visible")) {
      const selected = await page.locator(".map-selection-card:visible").waitFor({ timeout: 2_500 }).then(() => true).catch(() => false);
      if (selected) return;
      await page.waitForTimeout(300);
      continue;
    }
    if (!await clickViewportMarker(".vii-map-marker-wrap.is-cluster:visible")) break;
    await page.waitForTimeout(500);
  }
  throw new Error("no_selectable_marker_after_cluster_expansion");
}

async function runCase(browser, { world, path, language, viewportId, viewport }) {
  const context = await browser.newContext({ viewport, locale: language === "he" ? "he-IL" : language, timezoneId: "Asia/Jerusalem", reducedMotion: "reduce" });
  const page = await context.newPage();
  const failures = [];
  const consoleErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text().slice(0, 600)); });
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (!/google-analytics|doubleclick|facebook|clarity/i.test(url)) failures.push({ url, error: request.failure()?.errorText || "request_failed" });
  });
  const id = `${viewportId}-${language}-${world}`;
  const record = { id, world, language, viewportId, path: localized(path, language), checks: {}, consoleErrors, failedRequests: failures };
  try {
    const response = await page.goto(`${baseUrl}${record.path}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    record.checks.http = response?.status() || 0;
    if (!response || response.status() >= 400) throw new Error(`http_${response?.status() || 0}`);
    await page.waitForSelector('html[data-vii-hydrated="true"]', { timeout: 25_000 });
    const cookie = page.locator(".cookie-card .button.subtle").first();
    if (await cookie.count()) await cookie.click({ force: true });
    // Locale middleware can complete a same-URL document replacement after
    // the global hydration flag appears. Let that bounded handoff settle
    // before binding the interaction target.
    await page.waitForTimeout(800);
    const toggle = page.locator('.mobile-map-fab[data-map-interactive="true"]:visible').first();
    await toggle.waitFor({ timeout: 20_000 });
    record.checks.toggleBefore = await visibleCount(page, ".mobile-map-fab");
    await toggle.click({ force: true, timeout: 10_000 });
    await page.waitForFunction(() => {
      const button = document.querySelector(".mobile-map-fab");
      return button?.getAttribute("aria-pressed") === "true" || Boolean(document.querySelector(".map-results-experience"));
    }, null, { timeout: 5_000 });
    record.checks.firstClickAccepted = true;
    await page.locator(".listing-map.is-ready").waitFor({ timeout: 35_000 });
    await page.waitForFunction(() => document.querySelectorAll(".vii-map-marker-wrap").length > 0, null, { timeout: 15_000 });
    // A locale route can finish a same-URL document handoff just after the
    // first hydrated frame. Sample only after the retained map is stable.
    await page.waitForTimeout(650);
    await page.locator(".listing-map.is-ready").waitFor({ timeout: 10_000 });
    await page.waitForFunction(() => Boolean(document.body) && document.querySelectorAll(".vii-map-marker-wrap").length > 0, null, { timeout: 10_000 });
    record.open = await snapshot(page);
    if (!record.open.ready || !record.open.tiles || !record.open.markers || !record.open.summary) throw new Error(`incomplete_map:${JSON.stringify(record.open)}`);
    if (record.open.horizontalOverflow > 2) throw new Error(`horizontal_overflow_${record.open.horizontalOverflow}`);
    if (viewportId !== "desktop") {
      const shell = record.open.shell;
      if (!shell || shell.width < viewport.width - 4 || shell.height < viewport.height - 4) throw new Error(`mobile_map_not_full_screen:${JSON.stringify(shell)}`);
    }
    await page.screenshot({ path: join(outputDir, `${id}-map-open.png`), fullPage: false });
    if (world === "vacations" && language === "he" && viewportId === "desktop") {
      // Wait until the map's initial fit/resize suppression has settled, then
      // choose a zoom control that can definitely change the viewport.
      await page.waitForTimeout(450);
      const zoomIn = page.locator(".leaflet-control-zoom-in:visible").first();
      const zoomInClass = await zoomIn.getAttribute("class");
      const zoomControl = zoomInClass?.includes("leaflet-disabled")
        ? page.locator(".leaflet-control-zoom-out:visible").first()
        : zoomIn;
      await zoomControl.click({ force: true });
      await page.locator(".map-search-area:visible").waitFor({ timeout: 8_000 });
      record.checks.searchAreaAfterViewportChange = await visibleCount(page, ".map-search-area");
      await page.locator(".map-search-area:visible").click({ force: true });
      await page.locator(".listing-map.is-ready").waitFor({ timeout: 10_000 });
      await page.waitForFunction(() => document.querySelectorAll(".vii-map-marker-wrap").length > 0, null, { timeout: 10_000 });
      await page.waitForTimeout(500);
    }
    await selectMarker(page);
    const decision = page.locator(".map-selection-card__decision:visible");
    record.checks.selectedDecision = await decision.count();
    record.selected = await snapshot(page);
    if (world === "vacations" && language === "he" && viewportId === "mobile") {
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(450);
      const rotated = await snapshot(page);
      record.checks.rotation = rotated;
      if (!rotated.ready || rotated.horizontalOverflow > 2 || !rotated.selectedCards || !rotated.shell || rotated.shell.width < 700 || rotated.shell.height < 300) {
        throw new Error(`rotation_geometry_failed:${JSON.stringify(rotated)}`);
      }
      await page.setViewportSize(viewport);
      await page.waitForTimeout(450);
      const restored = await snapshot(page);
      record.checks.rotationRestored = restored;
      if (!restored.ready || restored.horizontalOverflow > 2 || !restored.shell || restored.shell.width < viewport.width - 4 || restored.shell.height < viewport.height - 4) {
        throw new Error(`rotation_restore_failed:${JSON.stringify(restored)}`);
      }
    }
    await page.screenshot({ path: join(outputDir, `${id}-map-selected.png`), fullPage: false });
    const close = page.locator(".map-mobile-close:visible").first();
    if (viewportId !== "desktop") {
      await close.waitFor({ timeout: 8_000 });
      await close.click({ force: true });
    } else {
      await page.locator(".mobile-map-fab.active:visible, .map-mobile-close:visible").first().click({ force: true });
    }
    await page.waitForFunction(() => !document.querySelector(".map-results-experience"), null, { timeout: 10_000 });
    record.checks.toggleAfter = await visibleCount(page, ".mobile-map-fab");
    if (!record.checks.toggleAfter) throw new Error("map_toggle_did_not_return_after_close");
    await page.screenshot({ path: join(outputDir, `${id}-map-closed.png`), fullPage: false });
    record.status = "passed";
  } catch (error) {
    record.status = "failed";
    record.error = error instanceof Error ? error.message : String(error);
    await page.screenshot({ path: join(outputDir, `${id}-failed.png`), fullPage: false }).catch(() => undefined);
  } finally {
    await context.close();
  }
  return record;
}

(async () => {
  mkdirSync(outputDir, { recursive: true });
  const fullLocales = process.env.MAP_FULL_LOCALES === "1";
  const cases = [];
  for (const [world, path] of routes.filter(([world]) => requestedWorlds.has(world))) for (const [viewportId, viewport] of viewports.filter(([id]) => requestedViewports.has(id))) {
    const caseLanguages = fullLocales || world === "vacations" ? languages : ["he"];
    for (const language of caseLanguages) cases.push({ world, path, language, viewportId, viewport });
  }
  const browser = await chromium.launch({ headless: true, ...(systemChrome ? { executablePath: systemChrome } : {}) });
  const results = [];
  try {
    for (const item of cases) {
      const result = await runCase(browser, item);
      results.push(result);
      console.log(`${result.status === "passed" ? "PASS" : "FAIL"} ${result.id}${result.error ? ` ${result.error}` : ""}`);
    }
  } finally {
    await browser.close();
  }
  const failed = results.filter((result) => result.status === "failed");
  const report = { schemaVersion: 1, baseUrl, generatedAt: new Date().toISOString(), cases: results.length, passed: results.length - failed.length, failed: failed.length, results };
  const reportPath = join(outputDir, "map-experience-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ reportPath, cases: report.cases, passed: report.passed, failed: report.failed }, null, 2));
  process.exitCode = failed.length ? 1 : 0;
})().catch((error) => { console.error(error); process.exitCode = 1; });
