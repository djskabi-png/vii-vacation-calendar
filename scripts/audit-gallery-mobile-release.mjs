import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const valueAfter = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};

const base = valueAfter("--base", "https://vii.spaplus.co").replace(/\/$/, "");
const proofDir = path.resolve(valueAfter("--proof-dir", "project_knowledge/proofs/gallery-mobile-release"));
const routes = [
  { id: "vacation", path: "/business?id=vacation-2563", hash: "gallery=all&photo=4" },
  { id: "event", path: "/events/place/event-680", hash: "gallery=all&photo=4" },
  { id: "spa", path: "/discover/place/spa-6", hash: "gallery=all&photo=4" },
  { id: "hourly", path: "/discover/place/hourly-475", hash: "gallery=all&photo=4" },
];

const executable = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  chromium.executablePath(),
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((candidate) => candidate && fs.existsSync(candidate));

if (!executable) throw new Error("No Chromium-family browser is available for the gallery release audit");
fs.mkdirSync(proofDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: executable });
const results = [];
try {
  for (const route of routes) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "he-IL", colorScheme: "light" });
    const page = await context.newPage();
    const url = `${base}${route.path}#${route.hash}`;
    const result = { id: route.id, url, checks: {}, errors: [] };
    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      result.checks.http = response?.status() || 0;
      await page.locator(".story-gallery").waitFor({ state: "visible", timeout: 30000 });
      await page.waitForFunction(() => [...document.querySelectorAll(".story-gallery__mobile-tour img")]
        .some((image) => image.complete && image.naturalWidth > 0), null, { timeout: 15000 });

      result.checks.initial = await page.locator(".story-gallery").evaluate((gallery) => {
        const tour = gallery.querySelector(".story-gallery__mobile-tour");
        const stage = gallery.querySelector(".story-gallery__mobile-stage");
        const images = [...gallery.querySelectorAll(".story-gallery__mobile-tour img")];
        return {
          tourDisplay: tour ? getComputedStyle(tour).display : "missing",
          stageDisplay: stage ? getComputedStyle(stage).display : "missing",
          loadedImages: images.filter((image) => image.complete && image.naturalWidth > 0).length,
          imageCount: images.length,
          scrollX: window.scrollX,
          viewportWidth: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          bodyOverflow: document.body.style.overflow,
          fontFamily: getComputedStyle(gallery.querySelector(".story-gallery__header h2")).fontFamily,
          replacementGlyph: gallery.textContent?.includes("�") || false,
        };
      });
      const axe = await new AxeBuilder({ page }).include(".story-gallery").analyze();
      result.checks.accessibility = axe.violations
        .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
        .map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length }));
      await page.screenshot({ path: path.join(proofDir, `${route.id}-mobile-initial.png`), fullPage: false });

      const firstImage = page.locator(".story-gallery__mobile-tour button").first();
      await firstImage.click();
      await page.locator(".story-gallery__mobile-stage.is-viewer").waitFor({ state: "visible", timeout: 10000 });
      result.checks.viewer = await page.locator(".story-gallery__mobile-stage").evaluate((stage) => ({ display: getComputedStyle(stage).display, backVisible: Boolean(stage.querySelector(".story-gallery__mobile-back")) }));
      await page.locator(".story-gallery__mobile-back").click();
      await page.locator(".story-gallery__mobile-tour:not(.is-hidden)").waitFor({ state: "visible", timeout: 10000 });
      result.checks.returnedToOverview = true;

      const secondTab = page.locator(".story-gallery__tabs button").nth(1);
      if (await secondTab.count()) {
        await secondTab.click();
        result.checks.tabOverviewDisplay = await page.locator(".story-gallery__mobile-tour").evaluate((tour) => getComputedStyle(tour).display);
      }

      await page.setViewportSize({ width: 1280, height: 800 });
      result.checks.desktop = await page.locator(".story-gallery").evaluate((gallery) => ({
        storyDisplay: getComputedStyle(gallery.querySelector(".story-gallery__story")).display,
        mobileTourDisplay: getComputedStyle(gallery.querySelector(".story-gallery__mobile-tour")).display,
        scrollX: window.scrollX,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      }));
      await page.locator(".story-gallery__close").click();
      await page.locator(".story-gallery").waitFor({ state: "detached", timeout: 10000 });
      result.checks.close = await page.evaluate(() => ({ bodyOverflow: document.body.style.overflow, hash: window.location.hash }));
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    const initial = result.checks.initial;
    const desktop = result.checks.desktop;
    result.passed = result.errors.length === 0
      && result.checks.http === 200
      && initial?.tourDisplay === "grid"
      && initial?.stageDisplay === "none"
      && initial?.imageCount > 0
      && initial?.loadedImages > 0
      && initial?.scrollX === 0
      && initial?.documentWidth <= initial?.viewportWidth + 1
      && /Heebo|Rubik|Assistant|Arial/.test(initial?.fontFamily || "")
      && initial?.replacementGlyph === false
      && result.checks.accessibility?.length === 0
      && result.checks.viewer?.display !== "none"
      && result.checks.viewer?.backVisible === true
      && result.checks.returnedToOverview === true
      && (!result.checks.tabOverviewDisplay || result.checks.tabOverviewDisplay === "grid")
      && desktop?.storyDisplay !== "none"
      && desktop?.mobileTourDisplay === "none"
      && desktop?.scrollX === 0
      && desktop?.documentWidth <= desktop?.viewportWidth + 1
      && result.checks.close?.bodyOverflow === ""
      && result.checks.close?.hash === "";
    results.push(result);
    await context.close();
  }
} finally {
  await browser.close();
}

const report = {
  checkedAt: new Date().toISOString(),
  base,
  viewport: { width: 390, height: 844 },
  passed: results.every((result) => result.passed),
  results,
};
fs.writeFileSync(path.join(proofDir, "gallery-mobile-release-audit.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
