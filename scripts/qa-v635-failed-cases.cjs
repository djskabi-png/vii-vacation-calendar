#!/usr/bin/env node
"use strict";

const { chromium } = require("playwright");
const { mkdirSync, writeFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:4310").replace(/\/$/, "");
const publicOrigin = (process.env.PUBLIC_ORIGIN || "https://vii.spaplus.co").replace(/\/$/, "");
const outputDir = process.env.QA_OUTPUT_DIR || join(process.cwd(), "qa-reports", "v635-failed-cases");
mkdirSync(outputDir, { recursive: true });
const locales = ["he", "en", "ru", "fr"];
const viewports = [
  { id: "desktop", width: 1440, height: 900 },
  { id: "mobile", width: 390, height: 844 },
  { id: "low-height", width: 390, height: 620 },
  { id: "desktop-1365", width: 1365, height: 768 },
];
const report = { baseUrl, startedAt: new Date().toISOString(), cases: [] };
const caseFilter = process.env.QA_CASE_FILTER ? new RegExp(process.env.QA_CASE_FILTER) : null;
const localized = (path, locale) => locale === "he" ? path : `/${locale}${path === "/" ? "" : path}`;
const expectedCount = {
  he: /ספק(?:ים| אחד)/,
  en: /matching provider/,
  ru: /подходящ/i,
  fr: /prestataire/i,
};

async function observed(id, fn) {
  if (caseFilter && !caseFilter.test(id)) return;
  const started = Date.now();
  try {
    const evidence = await fn();
    report.cases.push({ id, status: "passed", durationMs: Date.now() - started, evidence });
    process.stdout.write(`PASS ${id}\n`);
  } catch (error) {
    report.cases.push({ id, status: "failed", durationMs: Date.now() - started, evidence: error instanceof Error ? error.message : String(error) });
    process.stdout.write(`FAIL ${id}: ${error instanceof Error ? error.message : String(error)}\n`);
  }
}

async function ready(page, path) {
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  if (!response || response.status() >= 400) throw new Error(`http_${response?.status() || "none"}`);
  await page.waitForSelector("main", { state: "visible", timeout: 20_000 });
  await page.waitForSelector('html[data-vii-hydrated="true"]', { state: "attached", timeout: 25_000 });
  await page.waitForFunction(() => !/Error 1102|Worker exceeded resource limits|Internal Server Error/i.test(document.body.innerText), null, { timeout: 10_000 });
  return response.status();
}

async function clickTopmost(page, selector) {
  const point = await page.locator(selector).evaluateAll((elements) => {
    for (const element of elements) {
      const box = element.getBoundingClientRect();
      if (!box.width || !box.height || box.bottom <= 0 || box.top >= innerHeight || box.right <= 0 || box.left >= innerWidth) continue;
      const x = Math.max(1, Math.min(innerWidth - 2, box.left + box.width / 2));
      const y = Math.max(1, Math.min(innerHeight - 2, box.top + box.height / 2));
      const top = document.elementFromPoint(x, y);
      if (top && (top === element || element.contains(top))) return { x, y };
    }
    return null;
  });
  if (!point) return false;
  await page.mouse.click(point.x, point.y);
  return true;
}

async function verifyMap(page) {
  await page.waitForSelector(".mobile-map-fab", { state: "visible", timeout: 20_000 });
  let toggle = page.locator(".mobile-map-fab:visible").first();
  await toggle.hover({ timeout: 10_000 });
  await page.waitForTimeout(350);
  toggle = page.locator(".mobile-map-fab:visible").first();
  await toggle.click({ timeout: 10_000 });
  await page.waitForSelector(".listing-map.is-ready", { state: "visible", timeout: 25_000 });
  await page.waitForSelector(".vii-map-marker-wrap", { state: "visible", timeout: 20_000 });
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const selected = await clickTopmost(page, ".vii-map-marker-wrap:not(.is-cluster)");
    if (selected) {
      await page.waitForTimeout(700);
      if (await page.locator(".map-selection-card:visible").count()) break;
    }
    const expanded = await clickTopmost(page, ".vii-map-marker-wrap.is-cluster");
    await page.waitForTimeout(expanded ? 900 : 500);
  }
  await page.waitForSelector(".map-selection-card", { state: "visible", timeout: 12_000 });
  return { markers: await page.locator(".vii-map-marker-wrap").count(), selectedCards: await page.locator(".map-selection-card").count() };
}

(async () => {
  for (const locale of locales) {
    for (const path of ["/", "/search", "/attractions", "/trails", "/activities", "/providers"]) {
      await observed(`raw-${locale}-${path}`, async () => {
        const url = `${baseUrl}${localized(path, locale)}`;
        const response = await fetch(url);
        const html = await response.text();
        const canonicals = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map((item) => item[1]);
        const og = [...html.matchAll(/<meta property="og:url" content="([^"]+)"/g)].map((item) => item[1]);
        const alternates = [...html.matchAll(/hreflang="([^"]+)"/g)].map((item) => item[1]);
        const expected = new URL(localized(path, locale), publicOrigin).toString().replace(/\/$/, path === "/" ? "/" : "");
        if (canonicals.length !== 1 || canonicals[0].replace(/\/$/, path === "/" ? "/" : "") !== expected) throw new Error(`canonical:${JSON.stringify(canonicals)} expected=${expected}`);
        if (og.length !== 1 || og[0].replace(/\/$/, path === "/" ? "/" : "") !== expected) throw new Error(`og:${JSON.stringify(og)} expected=${expected}`);
        if (alternates.length !== 5 || new Set(alternates).size !== 5) throw new Error(`alternates:${JSON.stringify(alternates)}`);
        return { canonical: canonicals[0], og: og[0], alternates };
      });
    }
  }

  const executablePath = process.platform === "win32" && existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe") ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : undefined;
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    for (const viewport of viewports) for (const locale of locales) {
      const context = await browser.newContext({ viewport, locale: locale === "he" ? "he-IL" : locale === "en" ? "en-GB" : locale === "ru" ? "ru-RU" : "fr-FR", timezoneId: "Asia/Jerusalem", reducedMotion: "reduce" });
      await context.addInitScript(() => localStorage.setItem("vii-cookie-choice", "essential"));

      await observed(`provider-${locale}-${viewport.id}`, async () => {
        const page = await context.newPage();
        try {
          await ready(page, localized("/providers", locale));
          const count = page.locator(".provider-results-count");
          await count.waitFor({ state: "visible", timeout: 20_000 });
          const text = (await count.innerText()).trim();
          if (!expectedCount[locale].test(text)) throw new Error(`provider_count=${text}`);
          if (locale !== "he" && /[\u0590-\u05ff]/.test(text)) throw new Error(`hebrew_leak=${text}`);
          return { text };
        } finally { await page.close(); }
      });

      await observed(`attractions-og-${locale}-${viewport.id}`, async () => {
        const page = await context.newPage();
        try {
          await ready(page, localized("/attractions", locale));
          const current = new URL(page.url()); current.search = ""; current.hash = "";
          const og = await page.locator('meta[property="og:url"]').getAttribute("content");
          if (!og || new URL(og, current).pathname.replace(/\/$/, "") !== current.pathname.replace(/\/$/, "")) throw new Error(`og=${og};current=${current}`);
          return { og };
        } finally { await page.close(); }
      });

      await observed(`map-${locale}-${viewport.id}`, async () => {
        const page = await context.newPage();
        try {
          await ready(page, localized("/search?location=all-country", locale));
          return await verifyMap(page);
        } finally { await page.close(); }
      });

      await observed(`history-${locale}-${viewport.id}`, async () => {
        const page = await context.newPage();
        try {
          const startPath = localized("/", locale);
          const targetPath = localized("/search", locale);
          await ready(page, startPath);
          await ready(page, targetPath);
          await page.goBack();
          await page.waitForURL((url) => url.pathname === startPath, { timeout: 15_000 });
          await page.goForward();
          await page.waitForURL((url) => url.pathname === targetPath, { timeout: 15_000 });
          await page.reload({ waitUntil: "domcontentloaded" });
          await page.waitForFunction((expected) => document.documentElement.lang === expected, locale, { timeout: 15_000 });
          return { url: page.url() };
        } finally { await page.close(); }
      });

      await context.close();
    }

    await observed("events-he-desktop-load", async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "he-IL", timezoneId: "Asia/Jerusalem" });
      const page = await context.newPage();
      try { const status = await ready(page, "/events"); return { status, text: (await page.locator("main").innerText()).length }; }
      finally { await page.close(); await context.close(); }
    });

    await observed("map-en-events-mobile", async () => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-GB", timezoneId: "Asia/Jerusalem", reducedMotion: "reduce" });
      await context.addInitScript(() => localStorage.setItem("vii-cookie-choice", "essential"));
      const page = await context.newPage();
      try {
        await ready(page, "/en/events/search");
        return await verifyMap(page);
      } finally { await page.close(); await context.close(); }
    });
  } finally { await browser.close(); }

  report.finishedAt = new Date().toISOString();
  report.summary = { total: report.cases.length, passed: report.cases.filter((item) => item.status === "passed").length, failed: report.cases.filter((item) => item.status === "failed").length };
  report.status = report.summary.failed ? "failed" : "passed";
  const output = join(outputDir, `v635-${Date.now()}.json`);
  writeFileSync(output, JSON.stringify(report, null, 2));
  process.stdout.write(`${output}\n${JSON.stringify(report.summary)}\n`);
  if (report.summary.failed) process.exitCode = 1;
})();
