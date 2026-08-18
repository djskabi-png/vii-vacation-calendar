#!/usr/bin/env node
"use strict";

const { chromium } = require("playwright");
const { writeFileSync } = require("node:fs");

function argument(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const baseUrl = argument("base-url", "https://vii.spaplus.co").replace(/\/$/, "");
const executablePath = argument("executable-path", process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe");
const reportFile = argument("report-file", "");
const routeFilter = argument("route", "");
const profileFilter = argument("profile", "");
const allRoutes = [
  ["home", "/"],
  ["vacation-place", "/business?id=hilat-hanof"],
  ["spa-place", "/discover/place/spa-butik-tlv"],
  ["hourly-place", "/discover/place/gentleman-haifa"],
  ["event-place", "/events/place/black-loft"],
  ["trail-place", "/trails/snir-hatzbani"],
  ["provider-place", "/discover/place/masu-home-wellness"],
  ["attraction-place", "/discover/place/timna-park"],
  ["account", "/account"],
  ["join", "/join"],
];
const allProfiles = [
  { name: "mobile-touch", viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, action: "tap" },
  { name: "mobile-low-height", viewport: { width: 390, height: 568 }, hasTouch: true, isMobile: true, action: "tap" },
  { name: "desktop-pointer", viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false, action: "click" },
  { name: "desktop-keyboard", viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false, action: "keyboard" },
];
const routes = routeFilter ? allRoutes.filter(([name]) => name === routeFilter) : allRoutes;
const profiles = profileFilter ? allProfiles.filter(({ name }) => name === profileFilter) : allProfiles;
if (!routes.length) throw new Error(`Unknown route filter: ${routeFilter}`);
if (!profiles.length) throw new Error(`Unknown profile filter: ${profileFilter}`);

async function inspectHitTarget(page) {
  return page.locator("a.header-search").evaluate((link) => {
    const rect = link.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const top = document.elementFromPoint(x, y);
    return {
      href: link.getAttribute("href"),
      center: { x, y },
      topTag: top?.tagName || null,
      topClass: top instanceof Element ? top.className : null,
      searchIsTopTarget: Boolean(top?.closest("a.header-search")),
      backdropCount: document.querySelectorAll(".world-dock__backdrop").length,
    };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  const checks = [];
  try {
    for (const profile of profiles) {
      const context = await browser.newContext({
        viewport: profile.viewport,
        hasTouch: profile.hasTouch,
        isMobile: profile.isMobile,
      });
      for (const [routeName, route] of routes) {
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        const consoleErrors = [];
        const httpErrors = [];
        page.on("console", (message) => {
          if (message.type() === "error") consoleErrors.push(message.text());
        });
        page.on("pageerror", (error) => consoleErrors.push(error.message));
        page.on("response", (response) => {
          if (response.status() >= 400) httpErrors.push({ status: response.status(), url: response.url() });
        });
        const result = { profile: profile.name, routeName, route, passed: false };
        try {
          await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 90000 });
          const worldTrigger = page.getByRole("button", { name: "בחירת עולם" });
          const search = page.getByRole("link", { name: "חיפוש באתר" });
          await search.waitFor({ state: "visible", timeout: 15000 });
          result.selectorPresent = await worldTrigger.count() > 0;
          if (result.selectorPresent) {
            await worldTrigger.waitFor({ state: "visible", timeout: 15000 });
            await page.waitForFunction(() => {
              const trigger = document.querySelector('[aria-label="בחירת עולם"]');
              return Boolean(trigger && Object.keys(trigger).some((key) => key.startsWith("__reactProps$")));
            }, undefined, { timeout: 15000 });
            const triggerInsideViewport = await worldTrigger.evaluate((trigger) => {
              const rect = trigger.getBoundingClientRect();
              return rect.top >= 0 && rect.left >= 0 && rect.bottom <= innerHeight && rect.right <= innerWidth;
            });
            if (!triggerInsideViewport) throw new Error("world selector is outside the viewport");
            await worldTrigger.click();
            await page.getByRole("navigation", { name: "מעבר בין עולמות" }).waitFor({ state: "visible" });
          }
          result.hitTarget = await inspectHitTarget(page);
          if (!result.hitTarget.searchIsTopTarget || result.hitTarget.backdropCount !== 0) {
            throw new Error(`search is covered: ${JSON.stringify(result.hitTarget)}`);
          }

          if (profile.action === "tap") await search.tap();
          else if (profile.action === "keyboard") {
            await search.focus();
            await search.press("Enter");
          } else await search.click();

          await page.waitForURL((url) => url.pathname === "/search", { timeout: 10000 });
          result.destination = new URL(page.url()).pathname;
          result.firstActionNavigated = result.destination === "/search";
          result.horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
          result.consoleErrors = consoleErrors;
          result.httpErrors = httpErrors;
          result.passed = result.firstActionNavigated && !result.horizontalOverflow && consoleErrors.length === 0;
          if (!result.passed) throw new Error(`post-navigation check failed: ${JSON.stringify(result)}`);
        } catch (error) {
          result.error = error instanceof Error ? error.message : String(error);
          result.consoleErrors = consoleErrors;
          result.httpErrors = httpErrors;
          result.debug = await page.evaluate(() => ({
            url: location.href,
            triggerExpanded: document.querySelector('[aria-label="בחירת עולם"], [aria-label="סגירת בחירת עולם"]')?.getAttribute("aria-expanded") || null,
            panelCount: document.querySelectorAll('.world-dock__panel').length,
            backdropCount: document.querySelectorAll('.world-dock__backdrop').length,
            searchHref: document.querySelector('a.header-search')?.getAttribute('href') || null,
            triggerRect: document.querySelector('[aria-label="בחירת עולם"], [aria-label="סגירת בחירת עולם"]')?.getBoundingClientRect().toJSON() || null,
            searchRect: document.querySelector('a.header-search')?.getBoundingClientRect().toJSON() || null,
            viewport: { width: innerWidth, height: innerHeight },
            scroll: { x: scrollX, y: scrollY },
            worldDock: (() => {
              const element = document.querySelector('.header-actions .world-dock');
              if (!(element instanceof HTMLElement)) return null;
              const style = getComputedStyle(element);
              return { rect: element.getBoundingClientRect().toJSON(), position: style.position, inset: style.inset, transform: style.transform, display: style.display };
            })(),
            headerActionsRect: document.querySelector('.header-actions')?.getBoundingClientRect().toJSON() || null,
          })).catch(() => null);
        } finally {
          checks.push(result);
          console.error(`${result.passed ? "PASS" : "FAIL"} ${profile.name} ${routeName}${result.error ? `: ${result.error}` : ""}`);
          await page.close();
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const failures = checks.filter((check) => !check.passed);
  const report = {
    baseUrl,
    passed: failures.length === 0,
    checkedAt: new Date().toISOString(),
    total: checks.length,
    passedCount: checks.length - failures.length,
    failedCount: failures.length,
    failures,
    checks,
  };
  if (reportFile) writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ baseUrl, passed: report.passed, total: report.total, passedCount: report.passedCount, failedCount: report.failedCount, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
