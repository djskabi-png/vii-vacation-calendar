import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:4175").replace(/\/$/, "");
const reportPath = resolve(process.env.QA_REPORT || "artifacts/desktop-map-price-controls/report.json");
const systemChrome = process.platform === "win32" && existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")
  ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  : undefined;

mkdirSync(dirname(reportPath), { recursive: true });
const browser = await chromium.launch({ headless: true, ...(systemChrome ? { executablePath: systemChrome } : {}) });
const report = { baseUrl, generatedAt: new Date().toISOString(), desktop: {}, mobile: {}, pageErrors: [], localHttpFailures: [], status: "failed" };

async function prepare(page) {
  await page.route("**/api/vii/starting-prices?world=vacations", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      world: "vacations",
      prices: {
        "vacation-164": { startPriceWinter: 1250, startPriceSummer: 1750 },
        "vacation-1701": { startPriceWinter: 2400, startPriceSummer: 3100 },
      },
    }),
  }));
  page.on("pageerror", error => report.pageErrors.push(error.message.slice(0, 500)));
  page.on("response", response => {
    if (response.status() >= 400) report.localHttpFailures.push({ status: response.status(), url: response.url().slice(0, 500) });
  });
  const response = await page.goto(`${baseUrl}/search`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  if (!response || response.status() >= 400) throw new Error(`search_http_${response?.status() || 0}`);
  await page.waitForSelector('html[data-vii-hydrated="true"]', { timeout: 25_000 });
  const cookie = page.locator(".cookie-card .button.subtle").first();
  if (await cookie.count()) await cookie.click({ force: true });
  await page.locator('.mobile-map-fab[data-map-interactive="true"]:not([disabled])').waitFor({ timeout: 25_000 });
}

try {
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "he-IL", timezoneId: "Asia/Jerusalem", reducedMotion: "reduce" });
  const desktop = await desktopContext.newPage();
  await prepare(desktop);
  const mapStartedAt = Date.now();
  await desktop.locator('.mobile-map-fab[data-map-interactive="true"]').click();
  await desktop.locator(".listing-map.is-ready").waitFor({ timeout: 25_000 });
  await desktop.locator(".map-location-control").waitFor({ timeout: 5_000 });
  report.desktop.mapReadyMs = Date.now() - mapStartedAt;
  report.desktop.geometry = await desktop.evaluate(() => {
    const results = document.querySelector(".airbnb-map-split__results")?.getBoundingClientRect();
    const map = document.querySelector(".airbnb-map-split__map")?.getBoundingClientRect();
    return {
      mountedCards: document.querySelectorAll(".airbnb-map-split__results .stay-card").length,
      markers: document.querySelectorAll(".vii-map-marker-wrap").length,
      resultsWidth: results?.width || 0,
      mapWidth: map?.width || 0,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  if (report.desktop.geometry.mountedCards > 18) throw new Error(`unbounded_map_cards_${report.desktop.geometry.mountedCards}`);
  if (report.desktop.geometry.resultsWidth < 400 || report.desktop.geometry.mapWidth < 400) throw new Error(`invalid_split_geometry_${JSON.stringify(report.desktop.geometry)}`);
  if (report.desktop.geometry.horizontalOverflow > 2) throw new Error(`desktop_horizontal_overflow_${report.desktop.geometry.horizontalOverflow}`);

  report.desktop.locationControl = (await desktop.locator(".map-location-control").innerText()).replace(/\s+/g, " ").trim();
  await desktop.locator(".map-location-control").click();
  await desktop.locator(".location-list:visible").waitFor({ timeout: 8_000 });
  report.desktop.destinationPickerOpened = true;
  await desktop.locator(".location-list__close:visible").click();

  await desktop.getByRole("button", { name: "טווח מחיר" }).click();
  const minimum = desktop.getByRole("spinbutton", { name: "מחיר מינימום בשקלים" });
  const maximum = desktop.getByRole("spinbutton", { name: "מחיר מקסימום בשקלים" });
  await minimum.fill("1250");
  await maximum.fill("3750");
  await maximum.press("Enter");
  report.desktop.typedPrices = { minimum: await minimum.inputValue(), maximum: await maximum.inputValue() };
  if (report.desktop.typedPrices.minimum !== "1250" || report.desktop.typedPrices.maximum !== "3750") throw new Error(`price_typing_failed_${JSON.stringify(report.desktop.typedPrices)}`);
  await desktop.locator(".filter-apply").click();
  await desktop.waitForFunction(() => new URL(location.href).searchParams.get("minPrice") === "1250" && new URL(location.href).searchParams.get("maxPrice") === "3750", null, { timeout: 8_000 });
  report.desktop.priceUrl = desktop.url();
  await desktopContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "he-IL", timezoneId: "Asia/Jerusalem", reducedMotion: "reduce" });
  const mobile = await mobileContext.newPage();
  await prepare(mobile);
  await mobile.locator('.mobile-map-fab[data-map-interactive="true"]').click();
  await mobile.locator(".listing-map.is-ready").waitFor({ timeout: 25_000 });
  report.mobile.geometry = await mobile.evaluate(() => {
    const shell = document.querySelector(".listing-map-shell")?.getBoundingClientRect();
    const toolbar = document.querySelector(".map-pane-toolbar");
    return {
      toolbarVisible: Boolean(toolbar && getComputedStyle(toolbar).display !== "none" && toolbar.getBoundingClientRect().width > 0),
      shellWidth: shell?.width || 0,
      shellHeight: shell?.height || 0,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  if (report.mobile.geometry.toolbarVisible) throw new Error("desktop_map_toolbar_visible_on_mobile");
  if (report.mobile.geometry.shellWidth < 386 || report.mobile.geometry.shellHeight < 760) throw new Error(`mobile_map_not_full_screen_${JSON.stringify(report.mobile.geometry)}`);
  if (report.mobile.geometry.horizontalOverflow > 2) throw new Error(`mobile_horizontal_overflow_${report.mobile.geometry.horizontalOverflow}`);
  await mobileContext.close();
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
