import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
const drafts = [];
const activity = [];
await page.route("**/api/admin/discovery-promotions**", async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  if (request.method() === "GET" && url.searchParams.has("id")) {
    return route.fulfill({ status: 200, json: { world: url.searchParams.get("world"),
      supplierId: Number(url.searchParams.get("id")), name: "מקום בדיקה" } });
  }
  if (request.method() === "POST") {
    const body = request.postDataJSON();
    const row = { ...body, eventId: body.requestId, campaignId: body.campaignId || crypto.randomUUID(),
      version: (body.expectedVersion || 0) + 1, placeName: "מקום בדיקה",
      actorEmail: "admin@vii.co.il", savedAt: new Date().toISOString() };
    drafts.unshift(row); activity.unshift(row);
    return route.fulfill({ status: 200, json: row });
  }
  return route.fulfill({ status: 200, json: { drafts, activity, publicRankingEnabled: false } });
});

try {
  const response = await page.goto("http://localhost:4224/admin/discovery-promotions", { waitUntil: "domcontentloaded" });
  assert.equal(response.status(), 200);
  await page.getByText("עדיין אין טיוטות קידום.").waitFor();
  await page.getByLabel("מזהה ספק").fill("389");
  await page.getByRole("button", { name: "בדיקת מקום" }).click();
  await page.getByText("מקום בדיקה").waitFor();
  await page.getByLabel("מתאריך").fill("2026-10-13");
  await page.getByLabel("עד תאריך").fill("2026-10-20");
  await page.getByRole("button", { name: "שמירת טיוטה" }).click();
  await page.getByText("הטיוטה נשמרה. היא אינה משנה את תוצאות האתר.").waitFor();
  assert.equal(await page.getByRole("row").filter({ hasText: "מקום בדיקה" }).count(), 2);
  await page.screenshot({ path: "tmp/promotion-admin-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("מקום בדיקה").first().waitFor();
  const width = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.equal(width, 0);
  await page.screenshot({ path: "tmp/promotion-admin-mobile.png", fullPage: true });
  console.log(JSON.stringify({ savedDrafts: drafts.length, auditEvents: activity.length, mobileOverflow: width }));
} finally {
  await browser.close();
}
