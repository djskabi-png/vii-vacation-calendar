import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const base = process.env.QA_BASE_URL || "http://127.0.0.1:3221";
const output = path.resolve("project_knowledge/release_evidence/contextual-deal-landings-local");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const routes = [
  { id: "events-last-minute", path: "/events/last-minute", h1: "אירועים ברגע האחרון" },
  { id: "spa-today", path: "/spas/today", h1: "ספא להיום" },
  { id: "spa-tomorrow", path: "/spas/tomorrow", h1: "ספא למחר" },
];
const results = [];
try {
  for (const viewport of [{ id: "desktop", width: 1440, height: 1000 }, { id: "mobile", width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    for (const route of routes) {
      const response = await page.goto(`${base}${route.path}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.locator("h1").waitFor({ state: "visible" });
      await page.waitForTimeout(1_000);
      const metrics = await page.evaluate(() => ({
        h1: document.querySelector("h1")?.textContent?.trim() || "",
        lang: document.documentElement.lang,
        dir: document.documentElement.dir,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        mainHeight: document.querySelector("main")?.getBoundingClientRect().height || 0,
        cards: document.querySelectorAll(".event-deals--grid .event-rail-card, .spa-package-deals--grid .spa-deal-card").length,
        empty: document.querySelector(".event-rail-status")?.textContent?.trim() || "",
        font: getComputedStyle(document.querySelector("h1")).fontFamily,
      }));
      const screenshot = path.join(output, `${route.id}-${viewport.id}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      results.push({ ...route, viewport: viewport.id, status: response?.status(), screenshot, ...metrics });
      if (response?.status() !== 200 || metrics.h1 !== route.h1 || metrics.overflow > 1 || metrics.mainHeight < viewport.height * .75 || metrics.lang !== "he" || metrics.dir !== "rtl") throw new Error(`failed ${route.id} ${viewport.id}: ${JSON.stringify(metrics)}`);
    }
    await page.goto(`${base}/events`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.locator('#event-last-minute-title').waitFor({ state: "visible" });
    const eventHref = await page.locator('#event-last-minute-title').locator('xpath=ancestor::section[1]').locator('a').first().getAttribute('href');
    if (eventHref !== "/events/last-minute") throw new Error(`event landing href mismatch: ${eventHref}`);
    await page.goto(`${base}/spas`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.locator('#spa-world-package-deals').waitFor({ state: "visible" });
    const spaSection = page.locator('#spa-world-package-deals');
    const todayHref = await spaSection.locator('.section-head a').getAttribute('href');
    if (todayHref !== "/spas/today") throw new Error(`spa today href mismatch: ${todayHref}`);
    const tomorrow = spaSection.locator('.spa-package-deals__days button').filter({ hasText: "מחר" }).first();
    if (await tomorrow.count()) {
      await tomorrow.click();
      await page.waitForTimeout(250);
      const tomorrowHref = await spaSection.locator('.section-head a').getAttribute('href');
      if (tomorrowHref !== "/spas/tomorrow") throw new Error(`spa tomorrow href mismatch: ${tomorrowHref}`);
    }
    await context.close();
  }
  await writeFile(path.join(output, "report.json"), JSON.stringify({ base, passed: true, results }, null, 2));
  console.log(JSON.stringify({ passed: true, routes: results.length, output }, null, 2));
} finally {
  await browser.close();
}
