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
const requestedLanguages = new Set((process.env.MAP_LANGUAGES || languages.join(",")).split(",").filter(Boolean));

function localized(path, language) {
  if (language === "he") return path;
  const queryAt = path.indexOf("?");
  return queryAt < 0 ? `/${language}${path}` : `/${language}${path.slice(0, queryAt)}${path.slice(queryAt)}`;
}

async function visibleCount(page, selector) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await page.locator(selector).evaluateAll((nodes) => nodes.filter((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      }).length);
    } catch (error) {
      if (attempt || !String(error).includes("Execution context was destroyed")) throw error;
      await page.waitForLoadState("domcontentloaded", { timeout: 10_000 });
      await page.waitForSelector('html[data-vii-hydrated="true"]', { timeout: 20_000 });
    }
  }
}

async function snapshot(page) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await page.evaluate(() => {
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
    } catch (error) {
      if (attempt || !String(error).includes("Execution context was destroyed")) throw error;
      await page.waitForLoadState("domcontentloaded", { timeout: 10_000 });
      await page.waitForSelector('html[data-vii-hydrated="true"]', { timeout: 20_000 });
    }
  }
}

async function waitForStableMap(page, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let consecutiveReadySamples = 0;
  while (Date.now() < deadline) {
    const state = await snapshot(page);
    if (state.ready && state.tiles && state.markers && state.summary) consecutiveReadySamples += 1;
    else consecutiveReadySamples = 0;
    if (consecutiveReadySamples >= 3) return state;
    await page.waitForTimeout(180);
  }
  throw new Error(`map_did_not_stabilize:${JSON.stringify(await snapshot(page))}`);
}

async function selectMarker(page) {
  const expansionTrace = [];
  const clickViewportMarkers = async (selector, waitForSelection) => {
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
      const hitTestable = await candidate.evaluate((node, point) => {
        const hit = document.elementFromPoint(point.x, point.y);
        return Boolean(hit && (node === hit || node.contains(hit)));
      }, { x: centerX, y: centerY });
      if (!hitTestable) continue;
      // Use a real pointer at the currently rendered center. A forced locator
      // click can target a marker hidden below a map control and report a false
      // product failure that a user could never reproduce.
      await page.mouse.click(centerX, centerY);
      if (!waitForSelection) return true;
      const selected = await page.locator(".map-selection-card:visible").waitFor({ timeout: 1_800 }).then(() => true).catch(() => false);
      if (selected) return true;
    }
    return false;
  };
  // Dense national catalogs can legitimately require more than four nested
  // cluster expansions before Leaflet exposes an individual place marker.
  // Keep this bounded, but follow the same cluster until a real selection is
  // possible instead of reporting a false product failure mid-animation.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    expansionTrace.push(await page.evaluate((attemptIndex) => ({
      attempt: attemptIndex,
      zoom: Number(document.querySelector(".listing-map")?.getAttribute("data-map-zoom") || 0),
      clusters: document.querySelectorAll(".vii-map-marker-wrap.is-cluster").length,
      places: document.querySelectorAll(".vii-map-marker-wrap:not(.is-cluster):not(.is-hover-preview)").length,
    }), attempt));
    if (await clickViewportMarkers(".vii-map-marker-wrap:not(.is-cluster):not(.is-hover-preview):visible", true)) return;
    if (!await clickViewportMarkers(".vii-map-marker-wrap.is-cluster:visible", false)) break;
    await page.waitForTimeout(900);
  }
  throw new Error(`no_selectable_marker_after_cluster_expansion:${JSON.stringify(expansionTrace)}`);
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
    const redirectedDisabledWorld = await page.evaluate(({ expectedPath, worldId }) => {
      const normalized = location.pathname.replace(/^\/(en|ru|fr)(?=\/|$)/, "") || "/";
      const expected = expectedPath.split("?")[0];
      if (normalized === expected) return false;
      const source = document.documentElement.innerHTML;
      const availabilityKey = worldId === "vacations" ? "vacation" : worldId === "activities" ? "attractions" : worldId;
      return source.includes(`${availabilityKey}\\\":false`);
    }, { expectedPath: path, worldId: world });
    if (redirectedDisabledWorld) {
      record.checks.disabledWorldRedirect = page.url();
      record.status = "passed";
      return record;
    }
    const toggle = page.locator('.mobile-map-fab[data-map-interactive="true"]:visible').first();
    await toggle.waitFor({ timeout: 20_000 });
    record.checks.toggleBefore = await visibleCount(page, ".mobile-map-fab");
    await toggle.click({ force: true, timeout: 10_000 });
    await page.waitForFunction(() => {
      const button = document.querySelector(".mobile-map-fab");
      return button?.getAttribute("aria-pressed") === "true" || Boolean(document.querySelector(".map-results-experience"));
    }, null, { timeout: 10_000 });
    record.checks.firstClickAccepted = true;
    await page.locator(".listing-map.is-ready").waitFor({ timeout: 35_000 });
    await page.waitForFunction(() => document.querySelectorAll(".vii-map-marker-wrap").length > 0, null, { timeout: 15_000 });
    // A locale route can finish a same-URL document handoff just after the
    // first hydrated frame. Sample only after the retained map is stable.
    await page.waitForTimeout(650);
    record.open = await waitForStableMap(page);
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
      let searchAreaVisible = await page.locator(".map-search-area:visible").waitFor({ timeout: 3_500 }).then(() => true).catch(() => false);
      if (!searchAreaVisible) {
        // A catalog refresh can make the first zoom control stale between the
        // class read and the pointer action. A real drag is a distinct viewport
        // change and verifies the same user-facing search-this-area contract.
        const mapBox = await page.locator(".listing-map:visible").boundingBox();
        if (mapBox) {
          const startX = mapBox.x + mapBox.width * 0.62;
          const startY = mapBox.y + mapBox.height * 0.56;
          await page.mouse.move(startX, startY);
          await page.mouse.down();
          await page.mouse.move(startX - 72, startY, { steps: 8 });
          await page.mouse.up();
        }
        searchAreaVisible = await page.locator(".map-search-area:visible").waitFor({ timeout: 5_000 }).then(() => true).catch(() => false);
      }
      if (!searchAreaVisible) throw new Error("search_this_area_not_offered_after_two_distinct_viewport_changes");
      record.checks.searchAreaAfterViewportChange = await visibleCount(page, ".map-search-area");
      await page.locator(".map-search-area:visible").click({ force: true });
      await page.locator(".listing-map.is-ready").waitFor({ timeout: 10_000 });
      await page.waitForFunction(() => document.querySelectorAll(".vii-map-marker-wrap").length > 0, null, { timeout: 10_000 });
      await page.waitForTimeout(500);
    }
    // Desktop maps open inline and may begin below the current fold. Bring the
    // interactive canvas into the viewport before hit-testing markers, just as
    // a real user must scroll to the map before choosing a place.
    await page.locator(".listing-map-shell:visible").first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await selectMarker(page);
    const decision = page.locator(".map-selection-card__decision:visible");
    record.checks.selectedDecision = await decision.count();
    record.selected = await snapshot(page);
    if (world === "vacations" && language === "he" && viewportId === "mobile") {
      await page.setViewportSize({ width: 844, height: 390 });
      // Rotation triggers a real Leaflet resize and can briefly replace the
      // ready frame. Judge the settled experience, not that transition frame.
      const rotated = await waitForStableMap(page);
      record.checks.rotation = rotated;
      if (!rotated.ready || rotated.horizontalOverflow > 2 || !rotated.selectedCards || !rotated.shell || rotated.shell.width < 700 || rotated.shell.height < 300) {
        throw new Error(`rotation_geometry_failed:${JSON.stringify(rotated)}`);
      }
      await page.setViewportSize(viewport);
      const restored = await waitForStableMap(page);
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
    const caseLanguages = (fullLocales || world === "vacations" ? languages : ["he"]).filter((language) => requestedLanguages.has(language));
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
