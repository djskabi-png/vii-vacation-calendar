import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = (process.argv[2] || "https://vii.spaplus.co").replace(/\/$/, "");
const output = path.resolve(process.argv[3] || "project_knowledge/release_evidence/liran-palumbo-release");
const executable = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  chromium.executablePath(),
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((candidate) => candidate && fs.existsSync(candidate));
if (!executable) throw new Error("No Chromium-family browser is available");

const routes = [
  { id: "vacation", path: "/business?id=vacation-1296", section: null, video: false },
  { id: "event", path: "/events/place/event-680", section: "#event-features", video: false },
  { id: "hourly", path: "/discover/place/hourly-475", section: "#hourly-amenities", video: false },
  { id: "vacation-video", path: "/business?id=vacation-2356", section: null, video: true },
];
const viewports = [{ id: "mobile", width: 390, height: 844 }, { id: "desktop", width: 1440, height: 900 }];
fs.mkdirSync(output, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: executable });
const results = [];
try {
  for (const viewport of viewports) for (const route of routes) {
    const context = await browser.newContext({ viewport, locale: "he-IL", serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(`${base}${route.path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.locator("h1:visible").first().waitFor({ state: "visible", timeout: 30_000 });
    // The production shell streams before client controls hydrate. Exercise
    // the real interactive control only after the hydration turn has settled.
    await page.waitForTimeout(1_200);
    if (route.section) await page.locator(route.section).scrollIntoViewIfNeeded();
    if (route.section) await page.locator(`${route.section} .unified-amenities`).waitFor({ state: "visible", timeout: 30_000 });
    const initial = route.section ? await page.locator(`${route.section} .unified-amenities`).evaluate((root) => ({
      itemCount: root.querySelectorAll(".unified-amenities__list > li").length,
      toggleCount: root.querySelectorAll(".unified-amenities__toggle").length,
      toggleText: root.querySelector(".unified-amenities__toggle")?.textContent?.trim() || "",
      itemBorder: getComputedStyle(root.querySelector(".unified-amenities__list > li")).borderStyle,
      itemBackground: getComputedStyle(root.querySelector(".unified-amenities__list > li")).backgroundColor,
    })) : null;
    let expanded = null;
    const toggle = route.section ? page.locator(`${route.section} .unified-amenities__toggle`) : null;
    if (toggle && await toggle.count()) {
      await toggle.click();
      expanded = await page.locator(`${route.section} .unified-amenities`).evaluate((root) => ({
        itemCount: root.querySelectorAll(".unified-amenities__list > li").length,
        expanded: root.querySelector(".unified-amenities__toggle")?.getAttribute("aria-expanded"),
        label: root.querySelector(".unified-amenities__toggle")?.textContent?.trim(),
      }));
      await toggle.click();
    }
    const pageGeometry = await page.evaluate(() => ({
      h1Count: document.querySelectorAll("h1").length,
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
      font: getComputedStyle(document.querySelector("h1")).fontFamily,
    }));
    const fullGallery = page.locator(".property-gallery__open-full:visible");
    let gallery = null;
    if (await fullGallery.count()) {
      await fullGallery.click();
      await page.locator(".story-gallery").waitFor({ state: "visible", timeout: 20_000 });
      gallery = await page.locator(".story-gallery").evaluate((root) => ({
        titleIdCount: root.querySelectorAll("#story-gallery-title").length,
        videoTabCount: [...root.querySelectorAll(".story-gallery__tabs button")].filter((button) => button.textContent?.includes("סרטונים")).length,
        closeLabel: root.querySelector(".story-gallery__close")?.getAttribute("aria-label"),
      }));
      await page.locator(".story-gallery__close").click();
    }
    await page.screenshot({ path: path.join(output, `${viewport.id}-${route.id}.png`), fullPage: false });
    const passed = response?.status() === 200 && errors.length === 0 && pageGeometry.h1Count === 1 && pageGeometry.overflow <= 1
      && (!route.section || initial?.itemCount === 5 && initial?.toggleCount === 1 && /^הצגת כל \d+ המאפיינים$/.test(initial?.toggleText || "")
        && initial?.itemBorder === "none" && initial?.itemBackground === "rgba(0, 0, 0, 0)"
        && expanded?.itemCount > 5 && expanded?.expanded === "true" && expanded?.label === "סגירה")
      && /Heebo|Rubik|Assistant|Arial/.test(pageGeometry.font)
      && (gallery === null || gallery.titleIdCount === 1 && gallery.closeLabel === "סגירת הגלריה" && gallery.videoTabCount === Number(route.video));
    results.push({ viewport: viewport.id, route: route.id, status: response?.status(), initial, expanded, pageGeometry, gallery, errors, passed });
    await context.close();
  }
} finally {
  await browser.close();
}
const report = { base, checkedAt: new Date().toISOString(), results, passed: results.every((result) => result.passed) };
fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
