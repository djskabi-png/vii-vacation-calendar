import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const base = process.argv[2] || "http://127.0.0.1:4173";
const output = process.argv[3] || join(process.env.TEMP || ".", "vii-online-catalog-polish-qa");
const routes = [
  ["home", "/"],
  ["vacation-search", "/search"],
  ["vacation-business", "/business?id=vacation-1"],
  ["events", "/events"],
  ["spa", "/spas"],
  ["guides", "/guides"],
  ["guide", "/guides/couples-reset"],
  ["providers", "/providers"],
  ["holidays", "/holidays"],
];
const banned = ["תמונת המחשה", "המחיר, החבילה והשעה יאושרו לפני ההזמנה", "ההצעות מהבדיקה האחרונה"];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = [];
try {
  for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    for (const [name, path] of routes) {
      const page = await context.newPage();
      console.log(`QA ${viewport.name} ${path}`);
      try {
        const response = await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
        await page.locator("main").waitFor({ state: "visible", timeout: 30_000 });
        await page.waitForTimeout(250);
        const evidence = await page.evaluate(({ banned }) => {
        const body = document.body;
        const bodyText = body.innerText;
        const rails = [...document.querySelectorAll("[data-horizontal-rail]")];
        const images = [...document.images].filter(image => {
          const rect = image.getBoundingClientRect();
          return rect.width > 120 && rect.height > 80;
        });
        const roomCards = [...document.querySelectorAll(".room-card")].map(card => {
          const rect = card.getBoundingClientRect();
          const image = card.querySelector(".room-card__image")?.getBoundingClientRect();
          return { width: Math.round(rect.width), height: Math.round(rect.height), imageWidth: Math.round(image?.width || 0), imageHeight: Math.round(image?.height || 0), featureCount: card.querySelectorAll(".room-card__features > span").length };
        });
        const distortedImages = images.flatMap(image => {
          if (!image.naturalWidth || !image.naturalHeight) return [];
          const rect = image.getBoundingClientRect();
          const fit = getComputedStyle(image).objectFit;
          const renderedRatio = rect.width / Math.max(1, rect.height);
          const naturalRatio = image.naturalWidth / image.naturalHeight;
          const distortion = fit === "fill" && Math.abs(renderedRatio / naturalRatio - 1) > .08;
          return distortion ? [{ src: image.currentSrc || image.src, renderedRatio, naturalRatio }] : [];
        });
        return {
          title: document.title,
          bodyOverflow: Math.max(0, body.scrollWidth - document.documentElement.clientWidth),
          clippedRails: rails.filter(rail => {
            const rect = rail.getBoundingClientRect();
            return rect.left < -2 || rect.right > innerWidth + 2;
          }).map(rail => rail.className),
          bannedText: banned.filter(value => bodyText.includes(value)),
          distortedImages,
          roomCards,
        };
        }, { banned });
        const screenshot = join(output, `${name}-${viewport.name}.png`);
        await page.screenshot({ path: screenshot, fullPage: true });
        report.push({ name, path, viewport: viewport.name, status: response?.status() || 0, screenshot, ...evidence });
      } catch (cause) {
        report.push({ name, path, viewport: viewport.name, status: 0, error: cause instanceof Error ? cause.message : String(cause), bodyOverflow: 0, clippedRails: [], bannedText: [], distortedImages: [], roomCards: [] });
      } finally {
        await page.close();
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
const failures = report.filter(item => item.error || item.status >= 400 || item.bodyOverflow > 2 || item.clippedRails.length || item.bannedText.length || item.distortedImages.length);
console.log(JSON.stringify({ output, pages: report.length, failures, roomCards: report.filter(item => item.roomCards.length).map(item => ({ page: `${item.name}-${item.viewport}`, cards: item.roomCards })) }, null, 2));
if (failures.length) process.exitCode = 1;
