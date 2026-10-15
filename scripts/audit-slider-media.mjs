import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.VII_QA_BASE_URL || "http://127.0.0.1:5173";
const outputDir = path.resolve("qa-reports/sitewide-slider-media");
const routes = ["/", "/search", "/events", "/events/search", "/spas", "/hourly", "/providers", "/activities", "/business?id=vacation-1", "/discover/place/spa-6"];
const bannedToken = "c3a6274bfd08091a";

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.VII_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const results = [];

for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  for (const route of routes) {
    await page.goto(new URL(route, baseUrl).href, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.locator("body").waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForTimeout(900);
    await page.locator("vite-error-overlay").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
    await page.evaluate(async () => {
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise((resolve) => setTimeout(resolve, 250));
      window.scrollTo(0, 0);
    });
    const media = await page.locator("[data-horizontal-rail] img").evaluateAll((images) => images.map((image) => ({
      src: image.currentSrc || image.src,
      alt: image.getAttribute("alt") || "",
      width: image.getBoundingClientRect().width,
      height: image.getBoundingClientRect().height,
    })));
    const bad = media.filter((image) => image.src.includes(bannedToken));
    const broken = media.filter((image) => image.width <= 1 || image.height <= 1);
    if (bad.length || broken.length) throw new Error(`${viewport.name} ${route}: bad=${bad.length}, broken=${broken.length}`);
    const slug = route === "/" ? "home" : route.slice(1).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    const screenshot = path.join(outputDir, `${viewport.name}-${slug}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    const focusSelectors = route === "/" ? ["#home-city-rail-track", "#home-type-rail-track"] : route === "/events" ? ["#event-quick-searches-rail"] : [];
    const focusedScreenshots = [];
    for (const selector of focusSelectors) {
      const target = page.locator(selector);
      if (await target.count()) {
        const focusPath = path.join(outputDir, `${viewport.name}-${slug}-${selector.slice(1)}.png`);
        await target.screenshot({ path: focusPath });
        focusedScreenshots.push(focusPath);
      }
    }
    results.push({ viewport: viewport.name, route, sliderImages: media.length, media, screenshot, focusedScreenshots });
  }
  await context.close();
}

await browser.close();
const report = { baseUrl, bannedToken, results };
await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
