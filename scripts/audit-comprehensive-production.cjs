#!/usr/bin/env node
"use strict";

const { chromium } = require("playwright");
const { mkdirSync, writeFileSync } = require("node:fs");
const { existsSync } = require("node:fs");
const { join } = require("node:path");

const baseUrl = (process.env.BASE_URL || "https://vii.spaplus.co").replace(/\/$/, "");
const outputDir = process.env.QA_OUTPUT_DIR || join(process.cwd(), "qa-reports", "comprehensive-production");
mkdirSync(outputDir, { recursive: true });
const report = { schemaVersion: 1, baseUrl, startedAt: new Date().toISOString(), exclusions: ["accessibility", "typography"], cases: [] };
const caseTimeoutMs = Number(process.env.QA_CASE_TIMEOUT_MS || 30_000);

function record(id, surface, viewport, status, evidence, durationMs) {
  report.cases.push({ id, surface, viewport, status, evidence, durationMs });
}

async function observed(id, surface, viewport, fn) {
  const started = Date.now();
  try {
    const evidence = await Promise.race([
      fn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`case_timeout_${caseTimeoutMs}`)), caseTimeoutMs)),
    ]);
    record(id, surface, viewport, "passed", evidence || "verified", Date.now() - started);
  } catch (error) {
    record(id, surface, viewport, "failed", error instanceof Error ? error.message : String(error), Date.now() - started);
  } finally {
    const last = report.cases.at(-1);
    process.stdout.write(`${last?.status === "passed" ? "PASS" : "FAIL"} ${id} ${Date.now() - started}ms${last?.status === "failed" ? ` ${last.evidence}` : ""}\n`);
  }
}

async function assertNaturalPage(page, path) {
  let response;
  try { response = await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 45_000 }); }
  catch (error) {
    if (!String(error).includes("ERR_ABORTED") || !await page.locator("main").count()) throw error;
  }
  if (!response || response.status() >= 400) throw new Error(`http_${response?.status() || "no_response"}`);
  await page.waitForSelector("main", { state: "visible", timeout: 15_000 });
  const body = await page.locator("body").innerText();
  if (/Error 1102|Worker exceeded resource limits|Application error|Internal Server Error/i.test(body)) throw new Error("provider_or_application_error_surface");
  const metrics = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, text: (document.body.innerText || "").trim().length }));
  if (metrics.text < 120) throw new Error("insufficient_visible_content");
  if (metrics.width > metrics.client + 1) throw new Error(`horizontal_overflow_${metrics.width}_${metrics.client}`);
  return { status: response.status(), ...metrics };
}

async function verifyImages(page) {
  await page.waitForTimeout(900);
  return page.evaluate(() => {
    const visible = [...document.images].filter((image) => {
      const box = image.getBoundingClientRect();
      return box.width > 40 && box.height > 40 && box.bottom > 0 && box.top < innerHeight * 2;
    });
    const broken = visible.filter((image) => image.complete && (image.naturalWidth < 2 || image.naturalHeight < 2)).map((image) => image.currentSrc || image.src);
    if (broken.length) throw new Error(`broken_images:${broken.slice(0, 3).join("|")}`);
    return { visibleImages: visible.length };
  });
}

async function verifyResultsMap(page) {
  const firstCard = page.locator(".discovery-card,.stay-card,.event-card").first();
  if (await firstCard.count()) { await firstCard.scrollIntoViewIfNeeded(); await page.waitForTimeout(650); }
  const region = page.locator(".results-list,.event-list,.hourly-results,.spa-results,.attraction-explorer,.world-map-results").first();
  if (await region.count()) { await region.scrollIntoViewIfNeeded(); await page.waitForTimeout(500); }
  const toggle = page.locator(".mobile-map-fab:visible").first();
  if (!await toggle.count()) throw new Error("map_toggle_missing");
  await toggle.scrollIntoViewIfNeeded();
  await toggle.click({ timeout: 10_000 });
  await page.waitForSelector(".leaflet-container", { state: "visible", timeout: 20_000 });
  await page.waitForFunction(() => document.querySelectorAll(".leaflet-tile").length > 0, null, { timeout: 20_000 });
  const state = await page.evaluate(() => ({ tiles: document.querySelectorAll(".leaflet-tile").length, markers: document.querySelectorAll(".vii-map-marker").length, selectedCards: document.querySelectorAll(".map-selection-card").length }));
  if (!state.markers) throw new Error("map_markers_missing");
  const marker = page.locator(".vii-map-marker-wrap:not(.is-cluster) .vii-map-marker").first();
  if (!await marker.count()) throw new Error("map_selectable_marker_missing");
  await marker.click({ timeout: 10_000 });
  await page.waitForSelector(".map-selection-card", { state: "visible", timeout: 10_000 });
  state.selectedCards = await page.locator(".map-selection-card").count();
  const close = page.locator(".map-mobile-close").first();
  if (await close.count()) await close.click();
  else await toggle.click();
  return state;
}

async function verifyPlace(page, path, expectations) {
  const base = await assertNaturalPage(page, path);
  const location = page.locator("#location,#event-map").first();
  if (await location.count()) { await location.scrollIntoViewIfNeeded(); await page.waitForTimeout(1_200); }
  const state = await page.evaluate(() => ({
    phone: Boolean(document.querySelector('a[href^="tel:"]')),
    whatsapp: Boolean(document.querySelector('.property-whatsapp-action,[class*="whatsapp"]')),
    galleryTrigger: Boolean(document.querySelector(".property-gallery button")),
    reviewSummary: Boolean(document.querySelector(".detail-mobile-review-summary")),
    mapPreview: Boolean(document.querySelector(".map-preview-card,.listing-map-shell")),
  }));
  if (expectations.phone && !state.phone || expectations.gallery && !state.galleryTrigger || expectations.map && !state.mapPreview) throw new Error(`place_contract:${JSON.stringify(state)}`);
  if (!expectations.gallery || !state.galleryTrigger) return { ...base, ...state, galleryTabs: 0 };
  const gallery = page.locator(".property-gallery button").first();
  await gallery.click({ timeout: 10_000 });
  await page.waitForSelector(".story-gallery", { state: "visible", timeout: 15_000 });
  const tabs = await page.locator(".story-gallery button[aria-pressed]").count();
  if (!tabs) throw new Error("gallery_tabs_missing");
  const close = page.locator(".story-gallery__close").first();
  if (await close.count()) await close.click(); else await page.keyboard.press("Escape");
  return { ...base, ...state, galleryTabs: tabs };
}

async function runViewport(browser, viewport) {
  const context = await browser.newContext({ viewport: viewport.size, locale: "he-IL", timezoneId: "Asia/Jerusalem", reducedMotion: "reduce" });
  const browserCase = async (id, surface, fn) => {
    const page = await context.newPage();
    page.on("dialog", (dialog) => dialog.dismiss());
    try { await observed(id, surface, viewport.id, () => fn(page)); }
    finally {
      await Promise.race([
        page.close({ runBeforeUnload: false }).catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 2_000)),
      ]);
    }
  };

  await browserCase(`shell-home-${viewport.id}`, "/", async (page) => {
    const result = await assertNaturalPage(page, "/");
    const rails = await page.locator("[data-horizontal-rail]").count();
    const tabs = await page.locator('[role="tab"]').count();
    if (rails < 3 || tabs < 2) throw new Error(`home_slider_contract:rails=${rails},tabs=${tabs}`);
    return { ...result, rails, tabs, ...(await verifyImages(page)) };
  });

  const mapRoutes = [
    ["vacations", "/search?location=%D7%9B%D7%9C%20%D7%94%D7%90%D7%A8%D7%A5"], ["events", "/events/search?location=%D7%9B%D7%9C%20%D7%94%D7%90%D7%A8%D7%A5"], ["hourly", "/hourly"], ["spa", "/spas"], ["activities", "/attractions"],
  ];
  for (const [world, path] of mapRoutes) {
    await browserCase(`map-${world}-${viewport.id}`, path, async (page) => {
      await assertNaturalPage(page, path);
      return { ...(await verifyResultsMap(page)), ...(await verifyImages(page)) };
    });
  }

  const places = [
    ["vacation", "/business?id=vacation-116", { phone: true, gallery: true, map: true }], ["event", "/events/place/event-2575", { phone: true, gallery: true, map: true }], ["hourly", "/discover/place/hourly-475", { phone: true, gallery: false, map: true }], ["spa", "/discover/place/spa-6", { phone: false, gallery: false, map: true }],
  ];
  for (const [world, path, expectations] of places) await browserCase(`place-${world}-${viewport.id}`, path, (page) => verifyPlace(page, path, expectations));

  await browserCase(`navigation-back-${viewport.id}`, "public navigation", async (page) => {
    await assertNaturalPage(page, "/");
    const link = page.locator('a[href="/search"],a[href^="/search?"]').first();
    if (!await link.count()) throw new Error("home_search_link_missing");
    await link.click();
    await page.waitForURL(/\/search(?:\?|$)/, { timeout: 15_000 });
    await page.goBack({ waitUntil: "domcontentloaded" });
    if (new URL(page.url()).pathname !== "/") throw new Error(`back_wrong_route:${page.url()}`);
    return { url: page.url() };
  });

  const screenshot = join(outputDir, `public-${viewport.id}.png`);
  await browserCase(`screenshot-${viewport.id}`, "/", async (page) => {
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(1_000);
    await page.screenshot({ path: screenshot, fullPage: true });
    return screenshot;
  });
  await Promise.race([
    context.close().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 3_000)),
  ]);
}

(async () => {
  const systemChrome = process.platform === "win32" && existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : undefined;
  const browser = await chromium.launch({ headless: true, ...(systemChrome ? { executablePath: systemChrome } : {}) });
  try {
    await runViewport(browser, { id: "desktop", size: { width: 1440, height: 900 } });
    await runViewport(browser, { id: "mobile", size: { width: 390, height: 844 } });
    await runViewport(browser, { id: "low-height", size: { width: 390, height: 620 } });
  } finally {
    await browser.close();
  }
  report.finishedAt = new Date().toISOString();
  report.summary = { total: report.cases.length, passed: report.cases.filter((item) => item.status === "passed").length, failed: report.cases.filter((item) => item.status === "failed").length };
  report.status = report.summary.failed ? "failed" : "passed";
  const path = join(outputDir, `comprehensive-${Date.now()}.json`);
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ report: path, status: report.status, summary: report.summary }, null, 2));
  process.exitCode = report.summary.failed ? 1 : 0;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
