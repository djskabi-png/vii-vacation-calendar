import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseURL = process.argv[2] || "http://127.0.0.1:4317";
const output = process.argv[3] || "project_knowledge/release_evidence/vii-holiday-hub-ui-finish-20261020/local-qa";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.VII_QA_BROWSER || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const reports = [];

for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const routes = ["/holidays", "/holidays/hanukkah?audience=couple&part=middle", "/spas", "/events", "/search", "/guides"];
  for (const route of routes) {
    const response = await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle", timeout: 45_000 });
    await page.waitForTimeout(800);
    const name = route.replace(/[?&=\/]+/g, "-").replace(/^-|-$/g, "") || "home";
    const evidence = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const images = [...document.images].filter((image) => image.getBoundingClientRect().width > 100 && image.getBoundingClientRect().height > 70).map((image) => ({
        src: image.currentSrc || image.src,
        natural: [image.naturalWidth, image.naturalHeight],
        rendered: [Math.round(image.getBoundingClientRect().width), Math.round(image.getBoundingClientRect().height)],
        fit: getComputedStyle(image).objectFit,
      }));
      return {
        title: document.title,
        h1: document.querySelector("h1")?.textContent?.trim() || "",
        statusText: bodyText.slice(0, 180),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        forbidden: ["תמונת המחשה", "תמונות המחשה", "המחיר, החבילה והשעה יאושרו לפני ההזמנה."].filter((text) => bodyText.includes(text)),
        images,
      };
    });
    reports.push({ viewport: viewport.name, route, status: response?.status(), url: page.url(), ...evidence });
    await page.screenshot({ path: path.join(output, `${viewport.name}-${name}.png`), fullPage: true });
  }
  const guideHref = await page.locator('a[href^="/guides/"]').first().getAttribute("href").catch(() => null);
  if (guideHref) {
    await page.goto(`${baseURL}${guideHref}`, { waitUntil: "networkidle", timeout: 45_000 });
    await page.waitForTimeout(500);
    reports.push({ viewport: viewport.name, route: guideHref, status: 200, url: page.url(), forbidden: await page.evaluate(() => ["תמונת המחשה", "תמונות המחשה"].filter((text) => document.body.innerText.includes(text))), overflow: await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) });
    await page.screenshot({ path: path.join(output, `${viewport.name}-guide-article.png`), fullPage: true });
  }
  await context.close();
}

await browser.close();
await writeFile(path.join(output, "report.json"), JSON.stringify({ baseURL, createdAt: new Date().toISOString(), reports }, null, 2));
const failures = reports.filter((report) => report.status !== 200 || report.overflow > 1 || report.forbidden?.length);
console.log(JSON.stringify({ pages: reports.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
