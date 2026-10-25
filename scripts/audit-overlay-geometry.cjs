#!/usr/bin/env node
"use strict";

const { chromium } = require("playwright");
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const baseUrl = (process.env.BASE_URL || "https://vii.spaplus.co").replace(/\/$/, "");
const outputDir = process.env.QA_OUTPUT_DIR || join(process.cwd(), "qa-reports", "overlay-geometry");
const routes = (process.env.OVERLAY_QA_ROUTES || "/hourly,/spas,/events,/search").split(",").map((value) => value.trim()).filter(Boolean);
const locales = (process.env.OVERLAY_QA_LOCALES || "he,en,ru,fr").split(",").map((value) => value.trim()).filter(Boolean);
const profiles = [
  { id: "desktop", viewport: { width: 1440, height: 900 } },
  { id: "mobile-low", viewport: { width: 390, height: 667 } },
];
const candidateCssPath = process.env.QA_CANDIDATE_CSS || "";
const candidateCss = candidateCssPath ? readFileSync(candidateCssPath, "utf8") : "";

function localizedRoute(route, locale) {
  return locale === "he" ? route : `/${locale}${route === "/" ? "" : route}`;
}

async function inspectOverlay(page) {
  return page.evaluate(() => {
    const modal = document.querySelector(".location-list[role='dialog']");
    const backdrop = document.querySelector(".search-option-backdrop, .search-mobile-backdrop");
    if (!(modal instanceof HTMLElement)) return { failures: ["location_dialog_missing"] };
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const rect = modal.getBoundingClientRect();
    const failures = [];
    const tolerance = 2;
    const mobileShell = modal.closest(".search-box-shell.mobile-expanded");
    const mobilePresentation = window.matchMedia("(max-width: 820px)").matches && mobileShell;
    const protectedRoot = (mobilePresentation && modal.closest(".search-box")) || modal;
    const protectedRect = protectedRoot.getBoundingClientRect();
    const protectedStyle = getComputedStyle(protectedRoot);
    const verticallyScrollable = protectedRoot.scrollHeight > protectedRoot.clientHeight + tolerance && /auto|scroll/.test(protectedStyle.overflowY);
    if (protectedRect.left < -tolerance || protectedRect.top < -tolerance || protectedRect.right > viewport.width + tolerance || protectedRect.bottom > viewport.height + tolerance) {
      failures.push("dialog_outside_viewport");
    }
    const interactiveSelector = "a[href],button,input,select,textarea,[role='button'],[role='link']";
    const escapedControls = Array.from(modal.querySelectorAll(interactiveSelector)).filter((node) => {
      if (!(node instanceof HTMLElement)) return false;
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const item = node.getBoundingClientRect();
      if (!item.width || !item.height) return false;
      const horizontalEscape = item.left < protectedRect.left - tolerance || item.right > protectedRect.right + tolerance;
      const verticalEscape = !verticallyScrollable && (item.top < protectedRect.top - tolerance || item.bottom > protectedRect.bottom + tolerance);
      return horizontalEscape || verticalEscape;
    }).map((node) => node.className || node.tagName.toLowerCase());
    if (escapedControls.length) failures.push("interactive_control_escaped_dialog");

    const underlayIntersections = [];
    for (const node of document.querySelectorAll(interactiveSelector)) {
      if (!(node instanceof HTMLElement) || protectedRoot.contains(node) || node === backdrop) continue;
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") continue;
      const item = node.getBoundingClientRect();
      const left = Math.max(rect.left, item.left);
      const right = Math.min(rect.right, item.right);
      const top = Math.max(rect.top, item.top);
      const bottom = Math.min(rect.bottom, item.bottom);
      if (right - left < 3 || bottom - top < 3) continue;
      const x = Math.max(0, Math.min(viewport.width - 1, left + (right - left) / 2));
      const y = Math.max(0, Math.min(viewport.height - 1, top + (bottom - top) / 2));
      const painted = document.elementFromPoint(x, y);
      const protectedPaint = painted && (protectedRoot.contains(painted) || painted === backdrop);
      if (!protectedPaint) underlayIntersections.push({
        underlay: node.className || node.tagName.toLowerCase(),
        painted: painted instanceof HTMLElement ? painted.className || painted.tagName.toLowerCase() : null,
        point: { x: Math.round(x), y: Math.round(y) },
      });
    }
    if (underlayIntersections.length) failures.push("underlay_paints_above_dialog");

    const close = modal.querySelector(".location-list__close");
    if (!(close instanceof HTMLElement)) failures.push("close_control_missing");
    const activeHero = modal.closest(".home-hero,.results-search,.world-hero,.discovery-world-hero,.spa-discovery-hero,.events-hero");
    const heroZIndex = activeHero instanceof HTMLElement ? getComputedStyle(activeHero).zIndex : null;
    if (activeHero && Number(heroZIndex) < 1000) failures.push("overlay_host_not_elevated");
    return {
      failures,
      dialog: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
      protectedRoot: { left: protectedRect.left, top: protectedRect.top, right: protectedRect.right, bottom: protectedRect.bottom, width: protectedRect.width, height: protectedRect.height },
      verticallyScrollable,
      viewport,
      heroClass: activeHero instanceof HTMLElement ? activeHero.className : null,
      heroZIndex,
      escapedControls,
      underlayIntersections: underlayIntersections.slice(0, 12),
    };
  });
}

async function detectorSelfTest(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 667 } });
  try {
    await page.setContent(`<!doctype html><style>
      .location-list{position:fixed;z-index:10;left:-12px;top:40px;width:414px;height:300px;background:white}
      .escaped{position:absolute;left:-36px;top:120px}
      .underlay{position:fixed;z-index:50;left:120px;top:150px;width:120px;height:48px}
    </style><button class="underlay">underlay</button><section class="location-list" role="dialog"><button class="location-list__close">close</button><button class="escaped">escaped</button></section>`);
    const evidence = await inspectOverlay(page);
    const required = ["dialog_outside_viewport", "interactive_control_escaped_dialog", "underlay_paints_above_dialog"];
    return { status: required.every((failure) => evidence.failures.includes(failure)) ? "passed" : "failed", required, evidence };
  } finally {
    await page.close();
  }
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const systemChrome = process.env.CHROME_PATH || (process.platform === "win32" && existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe") ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : undefined);
  const browser = await chromium.launch({ headless: true, ...(systemChrome ? { executablePath: systemChrome } : {}) });
  const checks = [];
  let selfTest;
  try {
    selfTest = await detectorSelfTest(browser);
    for (const profile of profiles) {
      for (const locale of locales) {
        for (const route of routes) {
          const path = localizedRoute(route, locale);
          const page = await browser.newPage({ viewport: profile.viewport, locale: locale === "he" ? "he-IL" : locale });
          const check = { profile: profile.id, locale, route: path, url: `${baseUrl}${path}`, status: "failed", failures: [] };
          try {
            const response = await page.goto(check.url, { waitUntil: "domcontentloaded", timeout: 30000 });
            if (!response || response.status() >= 400) throw new Error(`http_${response ? response.status() : "no_response"}`);
            await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => undefined);
            await page.waitForTimeout(500);
            if (candidateCss) await page.addStyleTag({ content: candidateCss });
            let locationButton = page.locator(".search-step--location .search-field").first();
            if (!await locationButton.isVisible().catch(() => false)) {
              const summary = page.locator(".search-mobile-summary").first();
              if (await summary.isVisible().catch(() => false)) {
                await summary.click();
                await page.waitForTimeout(180);
                locationButton = page.locator(".search-box-shell.mobile-expanded .search-step--location .search-field").first();
              }
            }
            await locationButton.waitFor({ state: "visible", timeout: 15000 });
            await locationButton.click();
            const dialog = page.locator(".location-list[role='dialog']");
            if (!await dialog.isVisible().catch(() => false)) {
              await page.waitForTimeout(250);
              if (await locationButton.getAttribute("aria-expanded") !== "true") await locationButton.click();
            }
            await dialog.waitFor({ state: "visible", timeout: 10000 });
            await page.waitForTimeout(120);
            Object.assign(check, await inspectOverlay(page));
            if (profile.id === "mobile-low") {
              await page.setViewportSize({ width: 1440, height: 900 });
              await page.waitForTimeout(180);
              const transition = await inspectOverlay(page);
              check.responsiveTransition = transition;
              if (transition.failures.length === 1 && transition.failures[0] === "location_dialog_missing") {
                const reconciled = await page.evaluate(() => {
                  const visible = (node) => node instanceof HTMLElement && getComputedStyle(node).display !== "none" && node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0;
                  return !document.querySelector(".location-list[role='dialog'],.search-option-backdrop")
                    && !Array.from(document.querySelectorAll(".search-mobile-backdrop")).some(visible)
                    && getComputedStyle(document.body).overflow !== "hidden";
                });
                check.responsiveTransition = { ...transition, reconciledClosed: reconciled };
                if (!reconciled) check.failures.push("mobile_to_desktop:stale_overlay_state");
              } else {
                check.failures.push(...transition.failures.map((failure) => `mobile_to_desktop:${failure}`));
              }
              await page.setViewportSize(profile.viewport);
              await page.waitForTimeout(180);
            }
            check.status = check.failures.length ? "failed" : "passed";
            if (check.status === "failed" || process.env.QA_SCREENSHOT_ALL === "1") {
              check.screenshot = join(outputDir, `${profile.id}-${locale}-${route.replace(/\W+/g, "-")}.png`);
              await page.screenshot({ path: check.screenshot, fullPage: false });
            }
            const activeDialog = page.locator(".location-list[role='dialog']");
            if (await activeDialog.isVisible().catch(() => false)) {
              const closeControl = page.locator(".location-list__close:visible, .search-mobile-sheet-head__actions button:visible").first();
              await closeControl.click({ timeout: 5000 });
              await activeDialog.waitFor({ state: "hidden", timeout: 5000 });
            }
            const restored = await page.evaluate(() => !document.querySelector(".search-option-backdrop,.location-list[role='dialog']"));
            if (!restored) { check.failures.push("overlay_did_not_close_cleanly"); check.status = "failed"; }
          } catch (error) {
            check.failures.push(error instanceof Error ? error.message : String(error));
          } finally {
            checks.push(check);
            await page.close();
          }
        }
      }
    }
  } finally {
    await browser.close();
  }
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    baseUrl,
    detectorSelfTest: selfTest,
    status: selfTest?.status === "passed" && checks.every((check) => check.status === "passed") ? "passed" : "failed",
    checks,
  };
  const reportPath = join(outputDir, `overlay-geometry-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ report: reportPath, status: report.status, total: checks.length, failed: checks.filter((check) => check.status !== "passed").length }, null, 2));
  process.exitCode = report.status === "passed" ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
