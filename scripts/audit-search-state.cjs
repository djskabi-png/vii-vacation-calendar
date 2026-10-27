#!/usr/bin/env node
"use strict";

const { chromium } = require("playwright");
const { mkdirSync, writeFileSync } = require("node:fs");

function argument(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const baseUrl = argument("base-url", "https://vii.spaplus.co").replace(/\/$/, "");
const executablePath = argument("executable-path", process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe");
const version = argument("version", String(Date.now()));
const screenshotDirectory = argument("screenshot-dir", "");
const reportFile = argument("report-file", "");
if (screenshotDirectory) mkdirSync(screenshotDirectory, { recursive: true });
const dateAfterDays = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const auditFrom = dateAfterDays(14);
const auditTill = dateAfterDays(16);
const allRoutes = [
  ["home", "/"],
  ["vacation-results", `/search?location=%D7%9B%D7%9C+%D7%94%D7%90%D7%A8%D7%A5&from=${auditFrom}&till=${auditTill}&adults=4`],
  ["vacation-region", `/vacations/north?from=${auditFrom}&till=${auditTill}&adults=4`],
  ["spa", "/spas"],
  ["spa-region", "/spas/search/north"],
  ["events", "/events/search"],
  ["hourly", "/hourly"],
];
const routeFilter = argument("route", "");
const routes = routeFilter ? allRoutes.filter(([name]) => name === routeFilter) : allRoutes;
if (routeFilter && routes.length === 0) throw new Error(`Unknown search audit route: ${routeFilter}`);

const labels = {
  search: "\u05d7\u05d9\u05e4\u05d5\u05e9",
  closeGuests: "\u05e1\u05d2\u05d9\u05e8\u05ea \u05d1\u05d7\u05d9\u05e8\u05ea \u05d4\u05d0\u05d5\u05e8\u05d7\u05d9\u05dd",
};

function bounded(label, operation, timeoutMs = 15000) {
  let timeout;
  return Promise.race([
    operation,
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(`${label}-timeout-${timeoutMs}ms`)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timeout));
}

async function stablePageOperation(label, page, operation, timeoutMs = 15000) {
  try {
    return await bounded(label, operation(), timeoutMs);
  } catch (error) {
    if (!/Execution context was destroyed|navigation|Target page, context or browser has been closed/i.test(error.message)) throw error;
    await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(300);
    return bounded(`${label}-after-navigation`, operation(), timeoutMs);
  }
}

async function inspect(page) {
  return page.evaluate((searchLabel) => {
    const root = document.documentElement;
    const searchButtons = [...document.querySelectorAll("button")].filter((button) => button.textContent.trim() === searchLabel);
    return {
      bodyTextLength: document.body.innerText.trim().length,
      horizontalOverflow: root.scrollWidth > root.clientWidth + 1,
      scrollX: window.scrollX,
      bodyOverflow: document.body.style.overflow,
      bodyOverscroll: document.body.style.overscrollBehavior,
      expanded: Boolean(document.querySelector(".search-box-shell.mobile-expanded")),
      searchVisible: searchButtons.some((button) => button.offsetWidth > 0 && button.offsetHeight > 0),
      searchRect: searchButtons.find((button) => button.offsetWidth > 0 && button.offsetHeight > 0)?.getBoundingClientRect().toJSON() || null,
    };
  }, labels.search);
}

async function inspectVisibleContent(page, routeName) {
  return page.evaluate((name) => {
    const viewportHeight = window.innerHeight;
    const selectorsByRoute = {
      home: [".home-live-deals__card", ".home-live-deals__empty", ".home-slider__item"],
      "vacation-results": [".stay-card", ".empty-state", ".online-booking-filter-notice[role='alert'][aria-busy='false']"],
      "vacation-region": [".stay-card", ".empty-state", ".online-booking-filter-notice[role='alert'][aria-busy='false']"],
      spa: [".discovery-card", ".spa-results__empty"],
      "spa-region": [".discovery-card", ".spa-results__empty"],
      events: [".event-list > article", ".empty-state"],
      hourly: [".discovery-card", ".empty-state"],
    };
    const selectors = selectorsByRoute[name] || ["article", ".empty-state"];
    const elements = [...document.querySelectorAll(selectors.join(","))]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
    const first = elements
      .map((element) => element.getBoundingClientRect())
      .sort((a, b) => a.top - b.top)[0] || null;
    const anchor = document.querySelector(".results-heading, .spa-results__heading, .world-map-results__toolbar, .hero-search")?.getBoundingClientRect() || null;
    const emptyBand = first && anchor ? Math.max(0, first.top - anchor.bottom) : 0;
    return {
      visibleMeaningfulElements: elements.filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.top < viewportHeight && rect.bottom > 0;
      }).length,
      meaningfulElements: elements.length,
      firstMeaningfulTop: first?.top ?? null,
      largestUnexplainedEmptyBand: emptyBand,
      viewportHeight,
    };
  }, routeName);
}

async function focusResultsViewport(page, routeName) {
  const selectors = {
    home: "#home-live-deals-title",
    "vacation-results": ".results-heading",
    "vacation-region": ".results-heading",
    spa: ".spa-results__heading",
    "spa-region": ".spa-results__heading",
    events: ".world-map-results__toolbar",
    hourly: ".hourly-results__heading, .world-map-results__toolbar",
  };
  const selector = selectors[routeName];
  if (!selector) return;
  const anchor = page.locator(selector).first();
  if (!(await anchor.count())) return;
  await anchor.evaluate((element) => {
    const top = Math.max(0, element.getBoundingClientRect().top + window.scrollY - 8);
    window.scrollTo({ top, behavior: "instant" });
  });
  await page.waitForTimeout(150);
}

function visualFailures(state, { requireVisible = true } = {}) {
  const failures = [];
  if (state.meaningfulElements === 0) failures.push("missing-results-state");
  const unexplainedGap = state.largestUnexplainedEmptyBand > state.viewportHeight * 0.25;
  if (requireVisible && state.visibleMeaningfulElements === 0 && (state.meaningfulElements === 0 || unexplainedGap)) failures.push("no-visible-results-state");
  if (requireVisible && state.visibleMeaningfulElements === 0 && unexplainedGap) failures.push("excessive-empty-band");
  return failures;
}

async function inspectHorizontalRails(page) {
  return page.evaluate(async () => {
    const rails = [...document.querySelectorAll("[data-horizontal-rail]")];
    const scrollContainers = rails.filter((rail) => rail.scrollWidth > rail.clientWidth + 1);
    const overflowing = scrollContainers[0];
    let scrollMoved = null;

    if (overflowing) {
      const before = overflowing.scrollLeft;
      const distance = overflowing.scrollWidth - overflowing.clientWidth;
      const direction = getComputedStyle(overflowing).direction;
      overflowing.scrollLeft = direction === "rtl" ? -Math.max(240, distance / 2) : Math.max(240, distance / 2);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      scrollMoved = Math.abs(overflowing.scrollLeft - before) > 1;
      overflowing.scrollLeft = before;
    }

    return {
      count: rails.length,
      scrollMoved,
      rails: scrollContainers.map((rail) => {
        const rect = rail.getBoundingClientRect();
        return {
          clientWidth: rail.clientWidth,
          scrollWidth: rail.scrollWidth,
          left: rect.left,
          right: rect.right,
          insideViewport: rect.left >= -1 && rect.right <= document.documentElement.clientWidth + 1,
        };
      }),
    };
  });
}

function failuresFor(state, { requireExpanded = false, requireSearch = false, requireUnlocked = false } = {}) {
  const failures = [];
  if (state.bodyTextLength < 40) failures.push("blank-page");
  if (state.horizontalOverflow || Math.abs(state.scrollX) > 1) failures.push("horizontal-viewport-drift");
  if (requireExpanded && !state.expanded) failures.push("search-editor-closed-unexpectedly");
  if (requireSearch && !state.searchVisible) failures.push("search-action-not-visible");
  if (requireUnlocked && (state.bodyOverflow === "hidden" || state.bodyOverscroll === "none")) failures.push("stale-mobile-scroll-lock");
  return failures;
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  const reports = [];

  for (const [name, route] of routes) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    page.setDefaultTimeout(5000);
    page.setDefaultNavigationTimeout(45000);
    const separator = route.includes("?") ? "&" : "?";
    const report = { name, route, checks: [] };
    console.log(`[search-audit] start ${name}`);

    try {
      await page.goto(`${baseUrl}${route}${separator}v=${encodeURIComponent(version)}`, { waitUntil: "domcontentloaded", timeout: 45000 });
      console.log(`[search-audit] ${name} loaded`);
      if (name === "vacation-results" || name === "vacation-region") {
        await page.waitForFunction(
          () => Boolean(document.querySelector(".stay-card,.empty-state,.online-booking-filter-notice[role='alert'][aria-busy='false']")),
          undefined,
          { timeout: 30000 },
        );
      }
      if (name === "home") {
        await page.waitForFunction(() => document.querySelector("#home-live-deals-results")?.getAttribute("aria-busy") === "false", undefined, { timeout: 30000 });
      }
      let state = await stablePageOperation(`${name}:inspect-mobile`, page, () => inspect(page));
      report.checks.push({ name: "mobile-fresh", state, failures: failuresFor(state, { requireUnlocked: true }) });
      await stablePageOperation(`${name}:focus-results`, page, () => focusResultsViewport(page, name));
      const mobileVisual = await stablePageOperation(`${name}:inspect-visible-content`, page, () => inspectVisibleContent(page, name));
      report.checks.push({ name: "mobile-visual-content", state: mobileVisual, failures: visualFailures(mobileVisual, { requireVisible: name !== "home" }) });

      if (screenshotDirectory) {
        const screenshot = `${screenshotDirectory}/${name}-mobile-fresh-v${version}.png`;
        await page.screenshot({ path: screenshot, fullPage: false });
        report.checks.at(-1).screenshot = screenshot;
      }
      console.log(`[search-audit] ${name} mobile-checked`);

      const summary = page.locator(".search-mobile-summary");
      if (await summary.isVisible().catch(() => false)) {
        await summary.click();
        await page.waitForTimeout(150);
      }

      const guestTrigger = page.locator(".search-step--guests > .search-field");
      if (await guestTrigger.isVisible().catch(() => false)) {
        await guestTrigger.click();
        await page.waitForTimeout(150);
        state = await stablePageOperation(`${name}:inspect-guests-open`, page, () => inspect(page));
        report.checks.push({ name: "guests-open", state, failures: failuresFor(state, { requireExpanded: true, requireSearch: true }) });

        const contextualClose = page.locator(`button[aria-label="${labels.closeGuests}"]`).first();
        if (await contextualClose.isVisible().catch(() => false)) {
          await contextualClose.click();
          await page.waitForTimeout(150);
          state = await stablePageOperation(`${name}:inspect-guests-close`, page, () => inspect(page));
          report.checks.push({ name: "guests-close-x", state, failures: failuresFor(state, { requireExpanded: true, requireSearch: true }) });
        } else {
          report.checks.push({ name: "guests-close-x", failures: ["contextual-close-not-visible"] });
        }

        await guestTrigger.click();
        await page.waitForTimeout(100);
        await guestTrigger.click();
        await page.waitForTimeout(150);
        state = await stablePageOperation(`${name}:inspect-guests-toggle`, page, () => inspect(page));
        report.checks.push({ name: "guests-toggle-close", state, failures: failuresFor(state, { requireExpanded: true, requireSearch: true }) });
      }

      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.waitForTimeout(400);
      state = await stablePageOperation(`${name}:inspect-desktop`, page, () => inspect(page));
      report.checks.push({ name: "desktop-after-mobile", state, failures: failuresFor(state, { requireUnlocked: true }) });
      if (screenshotDirectory) {
        const screenshot = `${screenshotDirectory}/${name}-desktop-after-mobile-v${version}.png`;
        await page.screenshot({ path: screenshot, fullPage: false });
        report.checks.at(-1).screenshot = screenshot;
      }

      const horizontalRails = await stablePageOperation(`${name}:inspect-horizontal-rails`, page, () => inspectHorizontalRails(page));
      report.checks.push({
        name: "desktop-horizontal-rails",
        state: horizontalRails,
        failures: [
          ...(horizontalRails.rails.some((rail) => !rail.insideViewport) ? ["horizontal-rail-outside-viewport"] : []),
          ...(horizontalRails.scrollMoved === false ? ["horizontal-rail-does-not-scroll"] : []),
        ],
      });
      console.log(`[search-audit] ${name} desktop-checked`);

      await page.reload({ waitUntil: "domcontentloaded", timeout: 45000 });
      console.log(`[search-audit] ${name} reloaded`);
      if (name === "vacation-results" || name === "vacation-region") {
        await page.waitForFunction(
          () => Boolean(document.querySelector(".stay-card,.empty-state,.online-booking-filter-notice[role='alert'][aria-busy='false']")),
          undefined,
          { timeout: 30000 },
        );
      }
      state = await stablePageOperation(`${name}:inspect-desktop-reload`, page, () => inspect(page));
      report.checks.push({ name: "desktop-reload", state, failures: failuresFor(state, { requireUnlocked: true }) });

      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(300);
      state = await stablePageOperation(`${name}:inspect-mobile-return`, page, () => inspect(page));
      report.checks.push({ name: "mobile-return", state, failures: failuresFor(state, { requireUnlocked: true }) });
      if (screenshotDirectory) {
        const screenshot = `${screenshotDirectory}/${name}-mobile-return-v${version}.png`;
        await page.screenshot({ path: screenshot, fullPage: false });
        report.checks.at(-1).screenshot = screenshot;
      }
      console.log(`[search-audit] ${name} return-checked`);
    } catch (error) {
      report.checks.push({ name: "runtime", failures: [error.message] });
    }

    reports.push(report);
    await bounded(`${name}:page-close`, page.close(), 10000).catch((error) => {
      report.checks.push({ name: "cleanup", failures: [error.message] });
    });
    console.log(`[search-audit] finish ${name}`);
  }

  await bounded("browser-close", browser.close(), 10000);
  const failures = reports.flatMap((report) => report.checks.flatMap((check) => check.failures.map((failure) => `${report.name}:${check.name}:${failure}`)));
  const report = { baseUrl, version, passed: failures.length === 0, failures, reports };
  if (reportFile) writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  process.exit(failures.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
