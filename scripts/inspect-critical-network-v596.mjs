import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const baseUrl = "https://vii.spaplus.co";
const executablePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const output = join(process.cwd(), "qa-reports", "v596-full-qa", "critical-network.json");
const routes = [
  ["home", "/"],
  ["vacations-north", "/vacations/north"],
  ["events-north", "/events/search/north"],
  ["hanukkah", "/holidays/hanukkah"],
];

await mkdir(join(process.cwd(), "qa-reports", "v596-full-qa"), { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });
const report = { release: 596, startedAt: new Date().toISOString(), routes: [] };

for (const [id, path] of routes) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "he-IL" });
  const page = await context.newPage();
  const entry = { id, path, responses: [], console: [], timeline: [] };
  page.on("console", (message) => { if (message.type() === "error") entry.console.push(message.text()); });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    entry.responses.push({ status: response.status(), url: response.url(), method: response.request().method(), resourceType: response.request().resourceType() });
  });
  try {
    const response = await page.goto(`${baseUrl}${path}${path.includes("?") ? "&" : "?"}qa=critical-network-596`, { waitUntil: "domcontentloaded", timeout: 25_000 });
    entry.documentStatus = response?.status() ?? null;
    for (let second = 0; second <= 12; second += 2) {
      if (second) await page.waitForTimeout(2_000);
      entry.timeline.push(await page.evaluate((elapsed) => ({
        elapsed,
        bodyLength: document.body.innerText.length,
        title: document.title,
        busy: [...document.querySelectorAll('[aria-busy="true"]')].filter((node) => { const rect = node.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; }).map((node) => ({ id: node.id || null, text: node.textContent?.replace(/\s+/g, " ").trim().slice(0, 120) || "" })),
        loadingCopy: (document.body.innerText.match(/בודקים זמינות ומחירים/g) || []).length,
        retryCopy: (document.body.innerText.match(/לנסות שוב|נסה שוב/g) || []).length,
        liveDealCards: document.querySelectorAll('.home-live-deals__item').length,
        eventCards: document.querySelectorAll('.event-list > article, #event-last-minute-results article, #home-event-deals-results article').length,
      }), second));
    }
  } catch (error) {
    entry.runtimeError = error instanceof Error ? error.message : String(error);
  }
  report.routes.push(entry);
  await context.close();
}

report.finishedAt = new Date().toISOString();
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
await browser.close();
