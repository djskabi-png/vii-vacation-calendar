#!/usr/bin/env node
"use strict";

const { chromium } = require("playwright");
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const baseUrl = (process.env.BASE_URL || "https://vii.spaplus.co").replace(/\/$/, "");
const outputDir = process.env.QA_OUTPUT_DIR || join(process.cwd(), "qa-reports", "feature-icon-geometry");
const locales = (process.env.QA_LOCALES || "he,en,ru,fr").split(",").map((value) => value.trim()).filter(Boolean);
const viewports = [
  { id: "desktop", width: 1440, height: 900 },
  { id: "mobile", width: 390, height: 844 },
  { id: "low-height", width: 390, height: 620 },
];
const routes = ["/discover/place/hourly-475", "/discover/place/spa-6", "/business?id=vacation-116", "/events/place/event-2575"];
const candidateCssPath = process.env.QA_CANDIDATE_CSS || "";
const candidateCss = candidateCssPath ? readFileSync(candidateCssPath, "utf8") : "";
mkdirSync(outputDir, { recursive: true });

function localized(route, locale) {
  return locale === "he" ? route : `/${locale}${route}`;
}

async function geometry(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && rect.width > 2 && rect.height > 2;
    };
    const problems = [];
    const icons = [...document.querySelectorAll("[data-feature-icon]")].filter(visible);
    for (const icon of icons) {
      const svg = icon.querySelector("svg");
      if (!svg || !visible(svg)) { problems.push({ kind: "missing_svg", label: icon.parentElement?.textContent?.trim().slice(0, 100) || "" }); continue; }
      const frame = icon.getBoundingClientRect();
      const graphic = svg.getBoundingClientRect();
      if (graphic.left < frame.left - 1.25 || graphic.right > frame.right + 1.25 || graphic.top < frame.top - 1.25 || graphic.bottom > frame.bottom + 1.25) problems.push({ kind: "escapes_frame", label: icon.parentElement?.textContent?.trim().slice(0, 100) || "" });
      const dx = Math.abs((frame.left + frame.width / 2) - (graphic.left + graphic.width / 2));
      const dy = Math.abs((frame.top + frame.height / 2) - (graphic.top + graphic.height / 2));
      if (dx > 2.25 || dy > 2.25) problems.push({ kind: "off_center", label: icon.parentElement?.textContent?.trim().slice(0, 100) || "", dx, dy });
      const label = [...(icon.parentElement?.children || [])].find((candidate) => candidate !== icon && visible(candidate));
      if (label) {
        const text = label.getBoundingClientRect();
        const overlap = Math.max(0, Math.min(frame.right, text.right) - Math.max(frame.left, text.left)) * Math.max(0, Math.min(frame.bottom, text.bottom) - Math.max(frame.top, text.top));
        if (overlap > 1) problems.push({ kind: "label_collision", label: label.textContent?.trim().slice(0, 100) || "", overlap });
      }
    }
    return { icons: icons.length, problems };
  });
}

(async () => {
  const systemChrome = process.platform === "win32" && existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe") ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : undefined;
  const browser = await chromium.launch({ headless: true, ...(systemChrome ? { executablePath: systemChrome } : {}) });
  const report = { schemaVersion: 1, baseUrl, startedAt: new Date().toISOString(), exclusions: ["accessibility", "typography"], cases: [] };
  try {
    for (const viewport of viewports) for (const locale of locales) for (const route of routes) {
      const context = await browser.newContext({ viewport, locale: locale === "he" ? "he-IL" : locale, timezoneId: "Asia/Jerusalem", reducedMotion: "reduce" });
      await context.addInitScript(() => localStorage.setItem("vii-cookie-choice", "essential"));
      const page = await context.newPage();
      const path = localized(route, locale);
      const id = `${viewport.id}-${locale}-${route.split("?")[0].replaceAll("/", "-").replace(/^-+/, "")}`;
      try {
        const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
        if (!response || response.status() >= 400) throw new Error(`http_${response?.status() || "none"}`);
        let evidence;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => undefined);
            await page.waitForSelector("main", { state: "visible", timeout: 15_000 });
            await page.waitForTimeout(800);
            if (candidateCss) await page.addStyleTag({ content: candidateCss });
            await page.waitForTimeout(150);
            evidence = await geometry(page);
            break;
          } catch (error) {
            if (attempt || !String(error).includes("Execution context was destroyed")) throw error;
            await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });
          }
        }
        if (!evidence) throw new Error("feature_icon_geometry_not_observed");
        if (route.includes("hourly-475") && evidence.icons < 4) throw new Error(`hourly_icon_inventory_too_small:${evidence.icons}`);
        if (evidence.problems.length) throw new Error(`feature_icon_geometry:${JSON.stringify(evidence.problems.slice(0, 12))}`);
        const screenshot = join(outputDir, `${id}.png`);
        await page.screenshot({ path: screenshot, fullPage: false });
        report.cases.push({ id, path, viewport: viewport.id, locale, status: "passed", evidence: { ...evidence, screenshot } });
        process.stdout.write(`PASS ${id} icons=${evidence.icons}\n`);
      } catch (error) {
        const screenshot = join(outputDir, `${id}-failed.png`);
        await page.screenshot({ path: screenshot, fullPage: true }).catch(() => undefined);
        report.cases.push({ id, path, viewport: viewport.id, locale, status: "failed", evidence: `${error instanceof Error ? error.message : String(error)};screenshot=${screenshot}` });
        process.stdout.write(`FAIL ${id} ${error instanceof Error ? error.message : String(error)}\n`);
      } finally {
        await context.close();
      }
    }
  } finally { await browser.close(); }
  report.finishedAt = new Date().toISOString();
  report.summary = { total: report.cases.length, passed: report.cases.filter((item) => item.status === "passed").length, failed: report.cases.filter((item) => item.status === "failed").length };
  report.status = report.summary.failed ? "failed" : "passed";
  const reportPath = join(outputDir, `feature-icons-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ report: reportPath, status: report.status, summary: report.summary }, null, 2));
  process.exitCode = report.status === "passed" ? 0 : 1;
})().catch((error) => { console.error(error); process.exitCode = 1; });
