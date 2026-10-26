#!/usr/bin/env node
"use strict";

const { chromium } = require("playwright");
const { mkdirSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");
const { localizedRoute } = require("./multilingual-qa-rules.cjs");

const baseUrl = (process.env.BASE_URL || "https://vii.spaplus.co").replace(/\/$/, "");
const executablePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outputDir = process.env.QA_OUTPUT_DIR || join(process.cwd(), "qa-reports", "header-spacing");
const allLocales = ["he", "en", "ru", "fr"];
const allRouteFamilies = [
  ["home", "/"],
  ["vacation-search", "/search"],
  ["events", "/events"],
  ["hourly", "/hourly"],
  ["spa", "/spas"],
  ["attractions", "/attractions"],
  ["trails", "/trails"],
  ["guides", "/guides"],
  ["gift-card", "/gift-card"],
  ["last-minute", "/last-minute"],
  ["vacation-place", "/business?id=vacation-116"],
  ["event-place", "/events/place/event-2575"],
  ["hourly-place", "/discover/place/hourly-475"],
  ["spa-place", "/discover/place/spa-6"],
];
const profiles = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
  ["narrow", { width: 360, height: 720 }],
];
const wantedLocales = new Set((process.env.QA_SPACING_LOCALES || allLocales.join(",")).split(",").map((value) => value.trim()).filter(Boolean));
const wantedFamilies = new Set((process.env.QA_SPACING_ROUTES || allRouteFamilies.map(([family]) => family).join(",")).split(",").map((value) => value.trim()).filter(Boolean));
const wantedProfiles = new Set((process.env.QA_SPACING_PROFILES || profiles.map(([profile]) => profile).join(",")).split(",").map((value) => value.trim()).filter(Boolean));
const locales = allLocales.filter((locale) => wantedLocales.has(locale));
const routeFamilies = allRouteFamilies.filter(([family]) => wantedFamilies.has(family));
const selectedProfiles = profiles.filter(([profile]) => wantedProfiles.has(profile));

async function inspectHeader(page) {
  return page.locator(".site-header details.world-dock > summary").evaluate((summary) => {
    const rect = summary.getBoundingClientRect();
    const style = getComputedStyle(summary);
    const label = [...summary.querySelectorAll("strong")].find((node) => getComputedStyle(node).display !== "none");
    const icon = summary.querySelector(".world-toggle-icon");
    if (!(label instanceof HTMLElement) || !(icon instanceof SVGElement)) return { missingContent: true };
    const labelRect = label.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();
    const rtl = style.direction === "rtl";
    const labelStartGap = rtl ? rect.right - labelRect.right : labelRect.left - rect.left;
    const iconEndGap = rtl ? iconRect.left - rect.left : rect.right - iconRect.right;
    const labelIconGap = rtl ? labelRect.left - iconRect.right : iconRect.left - labelRect.right;
    return {
      missingContent: false,
      direction: style.direction,
      label: label.textContent?.trim() || "",
      labelStartGap,
      iconEndGap,
      labelIconGap,
      paddingInlineStart: parseFloat(style.paddingInlineStart),
      paddingInlineEnd: parseFloat(style.paddingInlineEnd),
      insideViewport: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
      contentInside: labelRect.left >= rect.left && labelRect.right <= rect.right && iconRect.left >= rect.left && iconRect.right <= rect.right,
      horizontalOverflow: summary.scrollWidth > summary.clientWidth + 1,
      rect: rect.toJSON(),
    };
  });
}

async function inspectSiteControls(page) {
  return page.evaluate(() => {
    const failures = [];
    const checked = [];
    const selector = "button, a, summary, [role='button'], input:not([type='hidden']), select";
    const nodes = [...document.querySelectorAll(selector)];
    const visible = (element, rect) => {
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0;
    };
    const textRect = (element) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const rects = [];
      const clipToOverflowAncestors = (sourceRect, parent) => {
        let left = sourceRect.left;
        let right = sourceRect.right;
        let top = sourceRect.top;
        let bottom = sourceRect.bottom;
        let current = parent;
        while (current && current !== element.parentElement) {
          const style = getComputedStyle(current);
          const bounds = current.getBoundingClientRect();
          if (["hidden", "clip", "auto", "scroll"].includes(style.overflowX)) {
            left = Math.max(left, bounds.left);
            right = Math.min(right, bounds.right);
          }
          if (["hidden", "clip", "auto", "scroll"].includes(style.overflowY)) {
            top = Math.max(top, bounds.top);
            bottom = Math.min(bottom, bounds.bottom);
          }
          current = current.parentElement;
        }
        return right > left && bottom > top ? { left, right, top, bottom } : null;
      };
      let node;
      while ((node = walker.nextNode())) {
        if (!node.textContent?.trim()) continue;
        const parent = node.parentElement;
        if (parent) {
          const parentStyle = getComputedStyle(parent);
          const parentRect = parent.getBoundingClientRect();
          if (parentStyle.display === "none" || parentStyle.visibility === "hidden" || parentRect.width <= 2 || parentRect.height <= 2 || parentStyle.clip !== "auto") continue;
        }
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.width <= 0 || rect.height <= 0) continue;
          const clipped = clipToOverflowAncestors(rect, parent);
          if (clipped) rects.push(clipped);
        }
      }
      if (!rects.length && (element instanceof HTMLInputElement || element instanceof HTMLSelectElement)) {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          left: rect.left + parseFloat(style.paddingLeft || "0"),
          right: rect.right - parseFloat(style.paddingRight || "0"),
          top: rect.top + parseFloat(style.paddingTop || "0"),
          bottom: rect.bottom - parseFloat(style.paddingBottom || "0"),
        };
      }
      if (!rects.length) return null;
      return {
        left: Math.min(...rects.map((rect) => rect.left)),
        right: Math.max(...rects.map((rect) => rect.right)),
        top: Math.min(...rects.map((rect) => rect.top)),
        bottom: Math.max(...rects.map((rect) => rect.bottom)),
      };
    };
    for (const element of nodes) {
      if (!(element instanceof HTMLElement)) continue;
      const rect = element.getBoundingClientRect();
      if (!visible(element, rect) || rect.width > 460 || rect.height > 110) continue;
      const style = getComputedStyle(element);
      if ((element instanceof HTMLInputElement || element instanceof HTMLSelectElement) && parseFloat(style.borderLeftWidth) === 0 && parseFloat(style.borderRightWidth) === 0) continue;
      const hasFrame = parseFloat(style.borderLeftWidth) > 0 || parseFloat(style.borderRightWidth) > 0 || style.backgroundColor !== "rgba(0, 0, 0, 0)";
      if (!hasFrame) continue;
      const content = textRect(element);
      if (!content) continue;
      const text = (element.innerText || element.getAttribute("aria-label") || element.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 90);
      if (!text) continue;
      const gaps = {
        left: content.left - rect.left,
        right: rect.right - content.right,
        top: content.top - rect.top,
        bottom: rect.bottom - content.bottom,
      };
      const horizontalOverflow = element.scrollWidth > element.clientWidth + 1;
      const verticalOverflow = element.scrollHeight > element.clientHeight + 1;
      const contentInside = Object.values(gaps).every((gap) => gap >= -0.5);
      const issue = !contentInside || horizontalOverflow || verticalOverflow || gaps.left < 6 || gaps.right < 6 || gaps.top < 3 || gaps.bottom < 3;
      const evidence = {
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === "string" ? element.className.slice(0, 120) : "",
        text,
        gaps,
        horizontalOverflow,
        verticalOverflow,
        contentInside,
      };
      checked.push(evidence);
      if (issue) failures.push(evidence);
    }
    return { checked: checked.length, failures: failures.slice(0, 30), failureCount: failures.length };
  });
}

(async () => {
  mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath });
  const checks = [];
  try {
    for (const [profile, viewport] of selectedProfiles) {
      const context = await browser.newContext({ viewport });
      await context.addInitScript(() => localStorage.setItem("vii-cookie-choice", "essential"));
      for (const locale of locales) {
        for (const [family, canonicalRoute] of routeFamilies) {
          const route = localizedRoute(canonicalRoute, locale);
          const page = await context.newPage();
          const result = { profile, locale, family, route, passed: false };
          try {
            const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
            if (!response || response.status() >= 400) throw new Error(`route-status-${response?.status() || "missing"}`);
            await page.waitForLoadState("load", { timeout: 30000 });
            await page.locator("header").first().waitFor({ state: "visible", timeout: 15000 });
            await page.waitForFunction(() => {
              const header = document.querySelector(".site-header");
              return header && getComputedStyle(header).position !== "static";
            }, { timeout: 15000 });
            result.controls = await inspectSiteControls(page);
            result.failures = result.controls.failureCount ? [`framed-control-spacing-${result.controls.failureCount}`] : [];
            if (family === "home") {
              await page.locator(".site-header details.world-dock > summary").waitFor({ state: "visible", timeout: 15000 });
              result.geometry = await inspectHeader(page);
              const geometry = result.geometry;
              result.failures.push(...[
                geometry.missingContent ? "missing-visible-label-or-icon" : null,
                !geometry.insideViewport ? "selector-outside-viewport" : null,
                !geometry.contentInside ? "selector-content-crosses-border" : null,
                geometry.horizontalOverflow ? "selector-content-overflows" : null,
                geometry.labelStartGap < 8 ? `label-border-gap-${geometry.labelStartGap.toFixed(2)}` : null,
                geometry.iconEndGap < 8 ? `icon-border-gap-${geometry.iconEndGap.toFixed(2)}` : null,
                geometry.labelIconGap < 4 ? `label-icon-gap-${geometry.labelIconGap.toFixed(2)}` : null,
                geometry.paddingInlineStart < 8 || geometry.paddingInlineEnd < 8 ? "insufficient-inline-padding" : null,
              ].filter(Boolean));
            }
            result.passed = result.failures.length === 0;
          } catch (error) {
            result.failures = [error instanceof Error ? error.message : String(error)];
          } finally {
            checks.push(result);
            console.error(`${result.passed ? "PASS" : "FAIL"} ${profile}-${locale}-${family}${result.failures?.length ? ` ${result.failures.join(",")}` : ""}`);
            if (!result.passed) {
              const screenshot = join(outputDir, `${profile}-${locale}-${family}.png`);
              await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
              result.screenshot = screenshot;
            }
            await page.close().catch(() => {});
          }
        }
      }
      await context.close().catch(() => {});
    }
  } finally {
    await browser.close().catch(() => {});
  }
  const failures = checks.filter((check) => !check.passed);
  const report = { schemaVersion: 1, baseUrl, checkedAt: new Date().toISOString(), total: checks.length, passed: checks.length - failures.length, failed: failures.length, checks };
  const reportPath = join(outputDir, `header-spacing-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ reportPath, status: failures.length ? "failed" : "passed", summary: { total: report.total, passed: report.passed, failed: report.failed } }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exitCode = 1; });
