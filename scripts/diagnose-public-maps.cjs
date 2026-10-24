#!/usr/bin/env node
"use strict";

const { chromium } = require("playwright");
const { existsSync, mkdirSync, writeFileSync } = require("node:fs");
const { dirname, resolve } = require("node:path");

const baseUrl = (process.env.BASE_URL || "https://vii.spaplus.co").replace(/\/$/, "");
const output = resolve(process.env.MAP_DIAG_OUTPUT || "qa-reports/map-public-diagnosis.json");
const systemChrome = process.platform === "win32" && existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")
  ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  : undefined;
const routes = [
  ["vacations", "/search?location=%D7%9B%D7%9C%20%D7%94%D7%90%D7%A8%D7%A5"],
  ["events", "/events/search?location=%D7%9B%D7%9C%20%D7%94%D7%90%D7%A8%D7%A5"],
  ["hourly", "/hourly"],
  ["spa", "/spas"],
  ["activities", "/attractions"],
];
const viewports = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
  ["low-height", { width: 390, height: 620 }],
];
const requestedWorlds = new Set((process.env.MAP_WORLDS || routes.map(([world]) => world).join(",")).split(",").map((value) => value.trim()).filter(Boolean));
const requestedViewports = new Set((process.env.MAP_VIEWPORTS || viewports.map(([id]) => id).join(",")).split(",").map((value) => value.trim()).filter(Boolean));

function visibleBox(element) {
  const box = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return style.visibility !== "hidden" && style.display !== "none" && box.width > 0 && box.height > 0
    ? { left: box.left, top: box.top, width: box.width, height: box.height }
    : null;
}

async function state(page) {
  return page.evaluate(() => {
    const visible = (selector) => [...document.querySelectorAll(selector)].filter((node) => {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return style.visibility !== "hidden" && style.display !== "none" && box.width > 0 && box.height > 0;
    });
    return {
      url: location.href,
      cards: document.querySelectorAll(".discovery-card,.stay-card,.event-card").length,
      toggleCount: document.querySelectorAll(".mobile-map-fab").length,
      visibleToggles: visible(".mobile-map-fab").length,
      pressed: document.querySelector(".mobile-map-fab")?.getAttribute("aria-pressed") || null,
      deferredLoaders: visible(".map-deferred-loading").length,
      shells: visible(".listing-map-shell").length,
      maps: visible(".listing-map").length,
      readyMaps: visible(".listing-map.is-ready").length,
      tiles: document.querySelectorAll(".leaflet-tile").length,
      loadedTiles: [...document.querySelectorAll(".leaflet-tile")].filter((image) => image.complete && image.naturalWidth > 0).length,
      markers: document.querySelectorAll(".vii-map-marker-wrap").length,
      selectableMarkers: document.querySelectorAll(".vii-map-marker-wrap:not(.is-cluster)").length,
      selectedCards: visible(".map-selection-card").length,
      mapExperience: visible(".map-results-experience").length,
      bodyMapVisible: Boolean(document.body?.hasAttribute("data-map-results-visible")),
    };
  });
}

async function runCase(browser, viewportId, viewport, world, path) {
  const context = await browser.newContext({ viewport, locale: "he-IL", timezoneId: "Asia/Jerusalem", reducedMotion: "reduce" });
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text().slice(0, 500)); });
  page.on("requestfailed", (request) => failedRequests.push({ url: request.url(), reason: request.failure()?.errorText || "unknown" }));
  const record = { viewportId, viewport, world, path, startedAt: new Date().toISOString(), timeline: [], consoleErrors, failedRequests };
  try {
    const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    record.statusCode = response?.status() || null;
    await page.waitForSelector("main", { state: "visible", timeout: 15_000 });
    await page.waitForSelector('html[data-vii-hydrated="true"]', { state: "attached", timeout: 20_000 });
    const cookieChoice = page.locator(".cookie-card .cookie-actions .button.subtle").first();
    if (await cookieChoice.count()) await cookieChoice.click();
    const firstCard = page.locator(".discovery-card,.stay-card,.event-card").first();
    if (await firstCard.count()) await firstCard.scrollIntoViewIfNeeded();
    const region = page.locator(".results-list,.event-list,.hourly-results,.spa-results,.attraction-explorer,.world-map-results").first();
    if (await region.count()) await region.scrollIntoViewIfNeeded();
    let toggle = page.locator(".mobile-map-fab:visible").first();
    record.before = await state(page);
    if (!await toggle.count()) throw new Error("map_toggle_missing");
    record.toggleBox = await toggle.evaluate(visibleBox);
    // Pointer entry intentionally preloads the dynamic Leaflet chunk. Let that
    // render settle and resolve the button again before the click; otherwise a
    // test can click a detached pre-preload node that no real user still owns.
    await toggle.hover({ timeout: 10_000 });
    await page.waitForTimeout(350);
    toggle = page.locator(".mobile-map-fab:visible").first();
    await toggle.click({ timeout: 10_000 });
    record.afterClick = await state(page);
    for (let second = 1; second <= 30; second += 1) {
      await page.waitForTimeout(1_000);
      const snapshot = await state(page);
      record.timeline.push({ second, ...snapshot });
      if (snapshot.readyMaps && snapshot.markers) break;
    }
    const mapState = await state(page);
    if (!mapState.readyMaps || !mapState.markers) throw new Error(`map_not_ready:${JSON.stringify(mapState)}`);
    const marker = page.locator(".vii-map-marker-wrap:not(.is-cluster):visible").first();
    if (!await marker.count()) throw new Error("map_selectable_marker_missing");
    record.markerBox = await marker.evaluate(visibleBox);
    await marker.click({ timeout: 10_000 });
    await page.locator(".map-selection-card").waitFor({ state: "visible", timeout: 10_000 });
    record.final = await state(page);
    record.status = "passed";
  } catch (error) {
    record.status = "failed";
    record.error = error instanceof Error ? error.message : String(error);
    record.final = await state(page).catch(() => null);
  } finally {
    record.finishedAt = new Date().toISOString();
    await context.close().catch(() => undefined);
  }
  return record;
}

(async () => {
  const browser = await chromium.launch({ headless: true, ...(systemChrome ? { executablePath: systemChrome } : {}) });
  const results = [];
  try {
    for (const [viewportId, viewport] of viewports.filter(([id]) => requestedViewports.has(id))) {
      for (const [world, path] of routes.filter(([id]) => requestedWorlds.has(id))) {
        const result = await runCase(browser, viewportId, viewport, world, path);
        results.push(result);
        process.stdout.write(`${result.status === "passed" ? "PASS" : "FAIL"} ${viewportId} ${world}${result.error ? ` ${result.error}` : ""}\n`);
      }
    }
  } finally {
    await browser.close();
  }
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify({ baseUrl, generatedAt: new Date().toISOString(), results }, null, 2));
  const failed = results.filter((result) => result.status === "failed");
  console.log(JSON.stringify({ output, total: results.length, passed: results.length - failed.length, failed: failed.length }, null, 2));
  process.exitCode = failed.length ? 1 : 0;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
