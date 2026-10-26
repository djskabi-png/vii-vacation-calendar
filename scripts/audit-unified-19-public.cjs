#!/usr/bin/env node
"use strict";

const { chromium } = require("playwright");
const { existsSync, mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const baseUrl = (process.env.BASE_URL || "https://vii.spaplus.co").replace(/\/$/, "");
const outputDir = process.env.QA_OUTPUT_DIR || join(process.cwd(), "qa-reports", "unified-19-public");
mkdirSync(outputDir, { recursive: true });
const viewports = [{ id: "desktop", width: 1440, height: 900 }, { id: "mobile", width: 390, height: 844 }];
const dockCases = [
  { id: "vacation", path: "/business?id=vacation-2705", expected: ["tel", "whatsapp"] },
  { id: "events", path: "/events/place/event-2575", expected: ["tel", "whatsapp"] },
  { id: "hourly", path: "/discover/place/hourly-475", expected: ["tel"] },
  { id: "providers", path: "/discover/place/maor-natan", expected: ["tel", "whatsapp"] },
  { id: "spa", path: "/discover/place/spa-6", expected: ["online"] },
  { id: "activities", path: "/discover/place/bookable-atv", expected: ["online"] },
];
const report = { schemaVersion: 1, baseUrl, startedAt: new Date().toISOString(), exclusions: ["accessibility", "typography"], cases: [] };

async function openNatural(page, path) {
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  if (!response || response.status() >= 400) throw new Error(`http_${response?.status() || "none"}`);
  await page.waitForSelector("main", { state: "visible", timeout: 15_000 });
  await page.waitForSelector('html[data-vii-hydrated="true"]', { state: "attached", timeout: 20_000 });
  await page.waitForTimeout(700);
  const text = await page.locator("body").innerText();
  if (/Error 1102|Worker exceeded resource limits|העמוד לא נטען במלואו|Application error/i.test(text)) throw new Error("error_surface");
  if (/(^|\s)(?:VII|Vii)(?=\s|$|[:.,!?])/m.test(text)) throw new Error("legacy_vii_brand_visible");
}

async function findVisibleDock(page) {
  for (const y of [0, 500, 900, 1400, 2000, 2800]) {
    await page.evaluate((top) => scrollTo({ top, behavior: "instant" }), y);
    await page.waitForTimeout(250);
    const dock = page.locator(".floating-contact-actions:visible");
    if (await dock.count()) return dock;
  }
  throw new Error("floating_action_dock_never_visible");
}

async function runCase(browser, viewport, item) {
  const context = await browser.newContext({ viewport, locale: "he-IL", timezoneId: "Asia/Jerusalem", reducedMotion: "reduce" });
  await context.addInitScript(() => localStorage.setItem("vii-cookie-choice", "essential"));
  const page = await context.newPage();
  const id = `${viewport.id}-${item.id}`;
  try {
    await openNatural(page, item.path);
    const dock = await findVisibleDock(page);
    const evidence = await dock.evaluate((element) => ({
      text: element.textContent?.replace(/\s+/g, " ").trim() || "",
      tel: element.querySelectorAll('a[href^="tel:"]').length,
      whatsapp: element.querySelectorAll("button.floating-contact-actions__whatsapp").length,
      online: element.querySelectorAll("a.floating-contact-actions__online").length,
      rect: (() => { const rect = element.getBoundingClientRect(); return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height }; })(),
    }));
    for (const expected of item.expected) if (!evidence[expected]) throw new Error(`missing_${expected}_action`);
    if (evidence.rect.left < -1 || evidence.rect.right > viewport.width + 1 || evidence.rect.bottom > viewport.height + 1) throw new Error(`dock_outside_viewport:${JSON.stringify(evidence.rect)}`);
    const screenshot = join(outputDir, `${id}.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
    report.cases.push({ id, path: item.path, status: "passed", evidence: { ...evidence, screenshot } });
    process.stdout.write(`PASS ${id}\n`);
  } catch (error) {
    const screenshot = join(outputDir, `${id}-failed.png`);
    await page.screenshot({ path: screenshot, fullPage: false }).catch(() => undefined);
    report.cases.push({ id, path: item.path, status: "failed", evidence: `${error instanceof Error ? error.message : String(error)};screenshot=${screenshot}` });
    process.stdout.write(`FAIL ${id} ${error instanceof Error ? error.message : String(error)}\n`);
  } finally { await context.close(); }
}

(async () => {
  const systemChrome = process.platform === "win32" && existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe") ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : undefined;
  const browser = await chromium.launch({ headless: true, ...(systemChrome ? { executablePath: systemChrome } : {}) });
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport, locale: "he-IL", timezoneId: "Asia/Jerusalem", reducedMotion: "reduce" });
      await context.addInitScript(() => localStorage.setItem("vii-cookie-choice", "essential"));
      const page = await context.newPage();
      try {
        await openNatural(page, "/business?id=vacation-2705");
        await page.locator("[data-gallery-trigger]").first().click();
        await page.waitForSelector(".story-gallery", { state: "visible", timeout: 10_000 });
        const topics = await page.locator(".story-gallery__tabs button").allTextContents();
        for (const title of ["גלריה כללית", "פנים הסוויטות", "מתחם הבריכה והחצר לכל סוויטה", "מתחם הבר המשותף"]) {
          if (!topics.some((topic) => topic.includes(title))) throw new Error(`supplier_gallery_topic_missing:${title}`);
        }
        const screenshot = join(outputDir, `${viewport.id}-supplier-gallery.png`);
        await page.screenshot({ path: screenshot, fullPage: false });
        report.cases.push({ id: `${viewport.id}-supplier-gallery`, path: "/business?id=vacation-2705", status: "passed", evidence: { topics, screenshot } });
        process.stdout.write(`PASS ${viewport.id}-supplier-gallery\n`);
      } catch (error) {
        const screenshot = join(outputDir, `${viewport.id}-supplier-gallery-failed.png`);
        await page.screenshot({ path: screenshot, fullPage: false }).catch(() => undefined);
        report.cases.push({ id: `${viewport.id}-supplier-gallery`, path: "/business?id=vacation-2705", status: "failed", evidence: `${error instanceof Error ? error.message : String(error)};screenshot=${screenshot}` });
        process.stdout.write(`FAIL ${viewport.id}-supplier-gallery ${error instanceof Error ? error.message : String(error)}\n`);
      } finally { await context.close(); }
      for (const item of dockCases) await runCase(browser, viewport, item);
    }
  } finally { await browser.close(); }
  report.finishedAt = new Date().toISOString();
  report.summary = { total: report.cases.length, passed: report.cases.filter((item) => item.status === "passed").length, failed: report.cases.filter((item) => item.status === "failed").length };
  report.status = report.summary.failed ? "failed" : "passed";
  const reportPath = join(outputDir, `unified-19-public-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ report: reportPath, status: report.status, summary: report.summary }, null, 2));
  process.exitCode = report.status === "passed" ? 0 : 1;
})().catch((error) => { console.error(error); process.exitCode = 1; });
