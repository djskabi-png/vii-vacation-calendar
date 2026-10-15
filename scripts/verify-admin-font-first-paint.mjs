import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createSignedValue } from "../app/lib/google-auth.ts";

const baseUrl = process.env.VII_QA_BASE_URL || "http://127.0.0.1:4175";
const outputDir = path.resolve("project_knowledge/task_contracts/admin-font-first-paint");
const approvedStack = '"VII Heebo", Arial, sans-serif';
const probeText = "מרכז הניהול, פרויקט חדש, הוספת משימה";

await mkdir(outputDir, { recursive: true });
const token = await createSignedValue({
  sub: "local-font-qa",
  name: "Font QA",
  email: "owner@example.test",
  provider: "google",
  exp: Math.floor(Date.now() / 1000) + 3600,
}, process.env.VII_AUTH_SECRET);

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.VII_QA_BROWSER_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});
const evidence = [];

for (const viewport of [{ name: "desktop", width: 1280, height: 800 }, { name: "mobile", width: 390, height: 844 }]) {
  const fallbackContext = await browser.newContext({ viewport });
  await fallbackContext.addCookies([{ name: "vii_session", value: token, url: baseUrl }]);
  await fallbackContext.route("**/fonts/heebo/*.woff2", (route) => route.abort("failed"));
  const fallbackPage = await fallbackContext.newPage();
  await fallbackPage.goto(`${baseUrl}/admin/catalog-sync`, { waitUntil: "domcontentloaded" });
  await fallbackPage.locator("h1").waitFor({ state: "visible" });
  const fallback = await fallbackPage.evaluate(({ approvedStack }) => {
    const h1 = document.querySelector("h1");
    return {
      fontsStatus: document.fonts.status,
      heeboLoaded: document.fonts.check('16px "VII Heebo"', "מרכז הניהול"),
      h1Font: h1 ? getComputedStyle(h1).fontFamily : null,
      approvedStack,
    };
  }, { approvedStack });
  assert.equal(fallback.heeboLoaded, false);
  assert.equal(fallback.h1Font, approvedStack);
  await fallbackPage.screenshot({ path: path.join(outputDir, `${viewport.name}-font-blocked-safe-fallback.png`), fullPage: false });
  evidence.push({ viewport, cacheState: "font-blocked-safe-fallback", fallback });
  await fallbackContext.close();

  const context = await browser.newContext({ viewport });
  await context.addCookies([{ name: "vii_session", value: token, url: baseUrl }]);

  for (const cacheState of ["cold", "warm"]) {
    const page = await context.newPage();
    if (cacheState === "cold") {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.clearBrowserCache");
      await cdp.detach();
    }
    await page.goto(`${baseUrl}/admin/catalog-sync`, { waitUntil: "domcontentloaded" });
    await page.locator("h1").waitFor({ state: "visible" });

    const initial = await page.evaluate(({ approvedStack, probeText }) => {
      const h1 = document.querySelector("h1");
      const button = document.querySelector("button");
      const critical = document.querySelector("#vii-admin-font-critical");
      const body = document.body;
      return {
        probeText,
        bodySurface: body.dataset.viiSurface,
        criticalStylePresent: Boolean(critical),
        fontsStatus: document.fonts.status,
        h1Text: h1?.textContent?.trim(),
        h1Font: h1 ? getComputedStyle(h1).fontFamily : null,
        buttonFont: button ? getComputedStyle(button).fontFamily : null,
        bodyFont: getComputedStyle(body).fontFamily,
        approvedStack,
      };
    }, { approvedStack, probeText });

    assert.equal(initial.bodySurface, "admin");
    assert.equal(initial.criticalStylePresent, true);
    assert.equal(initial.h1Font, approvedStack);
    assert.equal(initial.buttonFont, approvedStack);
    assert.equal(initial.bodyFont, approvedStack);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-${cacheState}-initial.png`), fullPage: false });

    await page.evaluate(() => document.fonts.ready);
    const loaded = await page.evaluate(({ approvedStack }) => {
      const h1 = document.querySelector("h1");
      return {
        fontsStatus: document.fonts.status,
        heeboLoaded: document.fonts.check('16px "VII Heebo"', "מרכז הניהול"),
        h1Font: h1 ? getComputedStyle(h1).fontFamily : null,
        approvedStack,
      };
    }, { approvedStack });
    assert.equal(loaded.fontsStatus, "loaded");
    assert.equal(loaded.heeboLoaded, true);
    assert.equal(loaded.h1Font, approvedStack);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-${cacheState}-loaded.png`), fullPage: false });
    evidence.push({
      viewport,
      cacheState,
      cachePreparation: cacheState === "cold"
        ? "Chrome browser cache explicitly cleared through CDP before navigation"
        : "Same browser context reused after the completed cold navigation without clearing its cache",
      initial,
      loaded,
    });
    await page.close();
  }
  await context.close();
}

await browser.close();
console.log(JSON.stringify({ status: "ADMIN_FONT_FIRST_PAINT_QA_PASSED", evidence }, null, 2));
