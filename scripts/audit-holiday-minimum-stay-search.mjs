import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = (process.argv[2] || "http://127.0.0.1:4391").replace(/\/$/, "");
const output = path.resolve(process.argv[3] || "project_knowledge/release_evidence/holiday-minimum-stay-search");
const executable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const requestPath = "/search/?location=%D7%9B%D7%9C+%D7%94%D7%90%D7%A8%D7%A5&from=2026-12-31&till=2027-01-01&guests=2";
const holidays = [{ id: 116, name: "סילבסטר", from: "2026-12-31", till: "2027-01-01", nights: 1, windowSearch: false }];
const deals = [
  { siteID: 1605, from: "2026-12-31", till: "2027-01-01", nights: 1, total: 1700, priceGuests: 2, onlineBooking: true, roomID: 11 },
  { siteID: 877, from: "2026-12-31", till: "2027-01-02", nights: 2, total: 5500, priceGuests: 2, onlineBooking: true, roomID: 12 },
  { siteID: 2436, from: "2026-12-31", till: "2027-01-03", nights: 3, total: 3600, priceGuests: 2, onlineBooking: true, roomID: 13 },
  { siteID: 1342, from: "2026-12-31", till: "2027-01-04", nights: 4, total: 10000, priceGuests: 2, onlineBooking: true, roomID: 14 },
  { siteID: 1093, from: "2026-12-31", till: "2027-01-02", nights: 2, total: 3000, priceGuests: 2, onlineBooking: true, roomID: 15 },
];

fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: executable });
const results = [];
try {
  for (const viewport of [{ id: "mobile", width: 390, height: 844 }, { id: "desktop", width: 1440, height: 900 }]) {
    const context = await browser.newContext({ viewport, locale: "he-IL", serviceWorkers: "block" });
    const page = await context.newPage();
    const exactSearchCalls = [];
    const holidayDealCalls = [];
    const relevantRequests = [];
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (request.url().includes("/api/vii/")) relevantRequests.push(request.url());
      if (request.url().includes("/api/vii/live-search")) exactSearchCalls.push(request.url());
    });
    await page.route(/\/api\/vii\/home-holiday-deals(?:\?|$)/, (route) => {
      const requestUrl = new URL(route.request().url());
      holidayDealCalls.push(requestUrl.toString());
      const refreshing = holidayDealCalls.length === 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ holiday: holidays[0], deals: refreshing ? [] : deals,
        stayPlan: { minNights: 1, maxNights: 4 }, checkedAt: "2026-11-11T17:00:00.000Z", availabilityStatus: refreshing ? "refreshing" : "verified" }) });
    });
    const response = await page.goto(`${base}${requestPath}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(250);
    const intermediate = await page.evaluate(() => ({
      cardCount: document.querySelectorAll(".stay-card").length,
      text: document.body.innerText,
    }));
    await page.screenshot({ path: path.join(output, `${viewport.id}-loading.png`), fullPage: false });
    try {
      await page.locator(".availability-demo-summary--live").waitFor({ state: "visible", timeout: 30_000 });
    } catch (error) {
      const diagnostic = await page.evaluate(() => ({
        text: document.body.innerText.slice(0, 2_000),
        url: location.href,
        summaries: document.querySelectorAll(".availability-demo-summary--live").length,
        cards: document.querySelectorAll(".stay-card").length,
      }));
      await page.screenshot({ path: path.join(output, `${viewport.id}-failure.png`), fullPage: false });
      console.error(JSON.stringify({ viewport: viewport.id, diagnostic, relevantRequests, exactSearchCalls, errors }, null, 2));
      throw error;
    }
    await page.waitForFunction(() => document.querySelectorAll(".stay-card").length >= 5, undefined, { timeout: 30_000 });
    const cardCount = await page.locator(".stay-card").count();
    for (let index = 0; index < Math.min(5, cardCount); index += 1) {
      await page.evaluate((targetIndex) => document.querySelectorAll(".stay-card")[targetIndex]?.scrollIntoView({ block: "center" }), index);
      await page.waitForTimeout(60);
    }
    await page.waitForFunction(() => [...document.querySelectorAll(".stay-card img")].filter((image) => image.complete && image.naturalWidth > 0).length >= 5, undefined, { timeout: 30_000 });
    const state = await page.evaluate(() => ({
      heading: document.querySelector(".availability-demo-summary--live strong")?.textContent?.trim() || "",
      explanation: document.querySelector(".availability-demo-summary--live span")?.textContent?.trim() || "",
      cardCount: document.querySelectorAll(".stay-card").length,
      dates: [...document.querySelectorAll(".stay-card__selected-dates span")].slice(0, 5).map((node) => node.textContent?.trim()),
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
      h1Count: document.querySelectorAll("h1").length,
      loadedImages: [...document.querySelectorAll(".stay-card img")].filter((image) => image.complete && image.naturalWidth > 0).length,
    }));
    await page.screenshot({ path: path.join(output, `${viewport.id}.png`), fullPage: false });
    const matchedAtomically = holidayDealCalls.length >= 2 && holidayDealCalls.every((value) => {
      const url = new URL(value);
      return url.searchParams.get("matchFrom") === "2026-12-31" && url.searchParams.get("matchTill") === "2027-01-01" && !url.searchParams.has("id");
    });
    const passed = response?.status() === 200 && state.heading === "מקומות פנויים לחג"
      && state.explanation.includes("מינימום של שני לילות ומעלה") && state.cardCount >= 5
      && state.dates.some((value) => value?.includes("2 בינו׳"))
      && state.dates.some((value) => value?.includes("4 בינו׳"))
      && state.overflow <= 1 && state.h1Count === 1 && state.loadedImages >= 5 && exactSearchCalls.length === 0 && errors.length === 0
      && intermediate.cardCount === 0 && !intermediate.text.includes("14 מתחמים") && matchedAtomically;
    results.push({ viewport: viewport.id, status: response?.status(), state, intermediate: { cardCount: intermediate.cardCount, showedOneNightFallback: intermediate.text.includes("14 מתחמים") }, relevantRequests, exactSearchCalls, holidayDealCalls, matchedAtomically, errors, passed });
    await context.close();
  }
} finally {
  await browser.close();
}

const report = { base, requestPath, checkedAt: new Date().toISOString(), results, passed: results.every((result) => result.passed) };
fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
