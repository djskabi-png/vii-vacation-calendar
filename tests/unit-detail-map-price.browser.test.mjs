import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright";

const baseUrl = process.env.VII_LOCAL_BASE_URL;
const browserExecutable = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  chromium.executablePath(),
].find((candidate) => candidate && fs.existsSync(candidate));

test("unit sleeping, full details and map action remain usable across responsive transitions", async (t) => {
  if (!baseUrl) return t.skip("VII_LOCAL_BASE_URL is required for the rendered route check");
  if (!browserExecutable) return t.skip("No Chromium-family browser is available");

  const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, locale: "he-IL" });
  try {
    await page.goto(`${baseUrl}/business?id=vacation-2210`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const sleepingToggle = page.getByRole("button", { name: /הצגת 2 חדרי שינה נוספים/ });
    await sleepingToggle.waitFor({ state: "visible", timeout: 20_000 });
    await sleepingToggle.scrollIntoViewIfNeeded();

    const collapsedRows = page.locator(".room-card__sleeping-list > div");
    assert.equal(await collapsedRows.count(), 2);
    await page.waitForTimeout(500);
    await sleepingToggle.evaluate((button) => button.click());
    await page.waitForFunction(() => document.querySelector(".room-card__sleeping-toggle")?.getAttribute("aria-expanded") === "true");
    assert.match(await page.locator(".room-card__sleeping-list").innerText(), /חדר שינה 4/);
    await page.locator(".room-card__sleeping-toggle").evaluate((button) => button.click());
    assert.equal(await collapsedRows.count(), 2);

    await page.getByRole("button", { name: "כל פרטי היחידה" }).click();
    const dialog = page.getByRole("dialog");
    await assert.doesNotReject(() => dialog.waitFor({ state: "visible" }));
    assert.match(await dialog.innerText(), /מחיר הבסיס עד\s+\d+\s+אורחים/);
    assert.match(await dialog.innerText(), /חדר שינה/);
    await page.getByRole("button", { name: "סגירת פרטי היחידה" }).click();

    await page.getByRole("button", { name: /פתיחת מפת המקום/ }).click();
    await page.locator("#location .listing-map").waitFor({ state: "visible" });
    const mapTop = await page.locator("#location").evaluate((node) => node.getBoundingClientRect().top);
    assert.ok(mapTop < 420, `map section should be scrolled into view, got top=${mapTop}`);

    for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 960 }]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(120);
      const geometry = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        mapButtonVisible: Boolean(document.querySelector(".property-location-action")?.getBoundingClientRect().width),
      }));
      assert.equal(geometry.scrollWidth, geometry.viewport, `horizontal overflow at ${viewport.width}x${viewport.height}`);
      assert.equal(geometry.mapButtonVisible, true);
    }
  } finally {
    await browser.close();
  }
});
