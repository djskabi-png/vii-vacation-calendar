import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:4177").replace(/\/$/, "");
const reportPath = resolve(process.env.QA_REPORT || "artifacts/near-me-search/report.json");
const screenshotDirectory = dirname(reportPath);
const systemChrome = process.platform === "win32" && existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")
  ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  : undefined;
const geography = {
  nodes: [
    { key: "area:center", level: "area", parentKey: null, title: "מרכז", titleEn: "Center", slug: "center", featured: true, gpsLat: 32.08, gpsLong: 34.8, unassigned: false },
    { key: "city:tel-aviv", level: "city", parentKey: "area:center", title: "תל אביב", titleEn: "Tel Aviv", slug: "tel-aviv-city", featured: true, gpsLat: 32.0853, gpsLong: 34.7818, unassigned: false },
    { key: "city:haifa", level: "city", parentKey: null, title: "חיפה", titleEn: "Haifa", slug: "haifa-city", featured: true, gpsLat: 32.794, gpsLong: 34.9896, unassigned: false },
  ],
};

mkdirSync(dirname(reportPath), { recursive: true });
const browser = await chromium.launch({ headless: true, ...(systemChrome ? { executablePath: systemChrome } : {}) });
const report = { baseUrl, generatedAt: new Date().toISOString(), allowed: {}, denied: {}, mobile: {}, sharedWorlds: {}, pageErrors: [], status: "failed" };

async function prepare(page, fallbackLocation = "חיפה") {
  await page.route("**/api/vii/geography", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(geography) }));
  await page.route("**/api/vii/nearby-location", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ location: fallbackLocation, precision: "city" }) }));
  page.on("pageerror", error => report.pageErrors.push(error.message.slice(0, 500)));
  const response = await page.goto(`${baseUrl}/search`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  if (!response || response.status() >= 400) throw new Error(`search_http_${response?.status() || 0}`);
  await page.waitForSelector('html[data-vii-hydrated="true"]', { timeout: 25_000 });
  const cookie = page.locator(".cookie-card .button.subtle").first();
  if (await cookie.count()) await cookie.click({ force: true });
}

async function openNearby(page) {
  await page.locator(".search-step--location > .search-field").first().click();
  await page.locator(".location-nearby:visible").waitFor({ timeout: 8_000 });
  await page.locator(".location-nearby:visible").click();
}

try {
  const allowedContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "he-IL", geolocation: { latitude: 32.081, longitude: 34.79 }, permissions: ["geolocation"] });
  const allowed = await allowedContext.newPage();
  await prepare(allowed);
  await openNearby(allowed);
  await allowed.waitForURL(url => decodeURIComponent(url.href).includes("tel-aviv") || decodeURIComponent(url.href).includes("תל אביב"), { timeout: 12_000 });
  report.allowed.url = decodeURIComponent(allowed.url());
  report.allowed.selectedPreciseCity = report.allowed.url.includes("tel-aviv") || report.allowed.url.includes("תל אביב");
  report.allowed.screenshot = resolve(screenshotDirectory, "desktop-precise-city.png");
  await allowed.screenshot({ path: report.allowed.screenshot, fullPage: false });
  await allowedContext.close();

  const deniedContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "he-IL" });
  const denied = await deniedContext.newPage();
  await prepare(denied, "חיפה");
  await openNearby(denied);
  await denied.waitForURL(url => decodeURIComponent(url.href).includes("haifa") || decodeURIComponent(url.href).includes("חיפה"), { timeout: 12_000 });
  report.denied.url = decodeURIComponent(denied.url());
  report.denied.fallbackRecovered = report.denied.url.includes("haifa") || report.denied.url.includes("חיפה");
  await deniedContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "he-IL", geolocation: { latitude: 32.081, longitude: 34.79 }, permissions: ["geolocation"] });
  const mobile = await mobileContext.newPage();
  await prepare(mobile);
  await mobile.locator(".search-mobile-summary").click();
  await openNearby(mobile);
  await mobile.locator(".search-box.mobile-step-dates").waitFor({ timeout: 12_000 });
  report.mobile.locationValue = (await mobile.locator(".search-step--location .search-field strong").innerText()).trim();
  report.mobile.advancedToDates = await mobile.locator(".search-box.mobile-step-dates").isVisible();
  report.mobile.screenshot = resolve(screenshotDirectory, "mobile-next-step.png");
  await mobile.screenshot({ path: report.mobile.screenshot, fullPage: false });
  await mobileContext.close();

  const sharedContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "he-IL" });
  const shared = await sharedContext.newPage();
  await shared.route("**/api/vii/geography", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(geography) }));
  for (const [world, path] of Object.entries({ vacation: "/search", events: "/events/search", spa: "/spas", hourly: "/hourly" })) {
    await shared.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await shared.waitForSelector('html[data-vii-hydrated="true"]', { timeout: 25_000 });
    const field = shared.locator(".search-step--location > .search-field").first();
    await field.click();
    report.sharedWorlds[world] = await shared.locator(".location-nearby:visible").count() === 1;
  }
  await sharedContext.close();

  if (!report.allowed.selectedPreciseCity) throw new Error("precise_city_not_selected");
  if (!report.denied.fallbackRecovered) throw new Error("denied_permission_did_not_recover");
  if (report.mobile.locationValue !== "תל אביב" || !report.mobile.advancedToDates) throw new Error(`mobile_transition_failed_${JSON.stringify(report.mobile)}`);
  if (Object.values(report.sharedWorlds).some(value => !value)) throw new Error(`shared_world_missing_${JSON.stringify(report.sharedWorlds)}`);
  if (report.pageErrors.length) throw new Error(`page_errors_${report.pageErrors.length}`);
  report.status = "passed";
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
