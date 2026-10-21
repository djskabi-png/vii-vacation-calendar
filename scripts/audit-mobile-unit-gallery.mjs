import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const baseUrl = process.argv[2] || process.env.VII_AUDIT_BASE_URL || "http://127.0.0.1:4187";
const evidenceDir = process.argv[3]
  ? new URL(`file:///${process.argv[3].replaceAll("\\", "/").replace(/^\//, "")}/`)
  : new URL("../project_knowledge/release_evidence/vii-unit-gallery-mobile-20261021/", import.meta.url);
const iterations = Math.max(1, Math.min(4, Number(process.env.VII_GALLERY_ITERATIONS || 2)));
await mkdir(evidenceDir, { recursive: true });
const evidencePath = (name) => fileURLToPath(new URL(name, evidenceDir));

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
try {
for (let iteration = 1; iteration <= iterations; iteration += 1) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, serviceWorkers: "block" });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem("vii-cookie-choice", "essential"));
try {
  await page.goto(`${baseUrl}/business?id=vacation-2356`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => document.querySelector(".room-card__image") instanceof HTMLButtonElement && document.querySelector(".site-header") !== null);
  await page.locator(".room-card__image").first().evaluate(element => element.scrollIntoView({ block: "center", inline: "nearest" }));
  const roomTriggers = page.locator(".room-card__image");
  assert.ok(await roomTriggers.count() > 1, "Expected more than one unit gallery trigger");
  const firstRoomLabel = await roomTriggers.first().getAttribute("aria-label");
  const pageScrollBefore = await page.evaluate(() => window.scrollY);
  await roomTriggers.first().click();

  const gallery = page.locator(".story-gallery");
  const stage = page.locator(".story-gallery__mobile-stage");
  const tour = page.locator(".story-gallery__mobile-tour");
  await gallery.waitFor({ state: "visible" });
  assert.equal(await stage.isVisible(), true, "Focused mobile viewer should be visible for a unit gallery");
  assert.equal(await tour.isVisible(), false, "All-images grid should not overlap the focused viewer");
  const firstGalleryTitle = await page.locator("#story-gallery-title").innerText();
  assert.match(firstGalleryTitle, /·/, "Unit and property context should both be visible");

  const previous = page.locator(".story-gallery__mobile-stage .story-gallery__tap--previous");
  const next = page.locator(".story-gallery__mobile-stage .story-gallery__tap--next");
  const previousBox = await previous.boundingBox();
  const nextBox = await next.boundingBox();
  assert.ok(previousBox && previousBox.width >= 44 && previousBox.height >= 44, "Previous control must be touch-sized");
  assert.ok(nextBox && nextBox.width >= 44 && nextBox.height >= 44, "Next control must be touch-sized");
  assert.equal(await previous.getAttribute("disabled") !== null, true, "Previous control should be disabled at the first image");
  assert.equal(await next.isVisible(), true, "Next arrow should be visibly present");
  assert.equal(await next.locator(".story-gallery__tap-icon").innerText(), "›");
  const firstPosition = await page.locator(".story-gallery__mobile-position").innerText();
  assert.match(firstPosition, /^1\/\d+$/);
  await page.screenshot({ path: evidencePath(`unit-gallery-viewer-390-run-${iteration}.png`), fullPage: false });

  await next.click();
  assert.match(await page.locator(".story-gallery__mobile-position").innerText(), /^2\/\d+$/);
  const positionBeforeVertical = await page.locator(".story-gallery__mobile-position").innerText();
  await stage.dispatchEvent("pointerdown", { pointerType: "touch", pointerId: 41, clientX: 210, clientY: 220, bubbles: true });
  await stage.dispatchEvent("pointerup", { pointerType: "touch", pointerId: 41, clientX: 260, clientY: 390, bubbles: true });
  assert.equal(await page.locator(".story-gallery__mobile-position").innerText(), positionBeforeVertical, "Vertical gesture must not change the image");
  await stage.dispatchEvent("pointerdown", { pointerType: "touch", pointerId: 42, clientX: 310, clientY: 280, bubbles: true });
  await stage.dispatchEvent("pointerup", { pointerType: "touch", pointerId: 42, clientX: 190, clientY: 288, bubbles: true });
  assert.match(await page.locator(".story-gallery__mobile-position").innerText(), /^3\/\d+$/, "Horizontal swipe should advance exactly one image");

  await page.getByRole("button", { name: "חזרה לכל התמונות" }).click();
  assert.equal(await tour.isVisible(), true, "All-images grid should become visible");
  assert.equal(await stage.isVisible(), false, "Focused viewer should be hidden in all-images mode");
  assert.equal(await tour.locator("button").count() > 1, true, "Unit grid should include its complete gallery");
  await page.screenshot({ path: evidencePath(`unit-gallery-grid-390-run-${iteration}.png`), fullPage: false });

  await tour.locator("button").nth(1).click();
  assert.match(await page.locator(".story-gallery__mobile-position").innerText(), /^2\/\d+$/, "Choosing a thumbnail should reopen its exact index");
  await page.getByRole("button", { name: "סגירת הגלריה" }).click();
  assert.equal(await gallery.count(), 0);
  const pageScrollAfter = await page.evaluate(() => window.scrollY);
  assert.ok(Math.abs(pageScrollAfter - pageScrollBefore) <= 2, "Closing should preserve page scroll position");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), firstRoomLabel, "Focus should return to the opening unit");

  await roomTriggers.nth(1).click();
  assert.notEqual(await page.locator("#story-gallery-title").innerText(), firstGalleryTitle, "A second unit must receive fresh gallery context");
  await page.evaluate(() => { document.documentElement.dir = "ltr"; });
  const ltrPrevious = await previous.boundingBox();
  const ltrNext = await next.boundingBox();
  assert.ok(ltrPrevious && ltrNext && ltrPrevious.x < ltrNext.x, "LTR previous arrow should move to the left side");
  await page.evaluate(() => { document.documentElement.dir = "rtl"; });
  const rtlPrevious = await previous.boundingBox();
  const rtlNext = await next.boundingBox();
  assert.ok(rtlPrevious && rtlNext && rtlPrevious.x > rtlNext.x, "RTL previous arrow should move to the right side");
  await page.setViewportSize({ width: 390, height: 640 });
  const lowStageBox = await stage.boundingBox();
  assert.ok(lowStageBox && lowStageBox.height <= 520, "Low-height mobile viewer should remain inside the available viewport");
  await page.setViewportSize({ width: 1280, height: 900 });
  assert.equal(await gallery.isVisible(), true);
  assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await stage.isVisible(), true);
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => document.body.style.overflow), "");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "Mobile gallery must not create horizontal overflow");

  const mainGalleryTrigger = page.locator(".property-gallery [data-gallery-trigger]").first();
  await mainGalleryTrigger.evaluate(element => element.scrollIntoView({ block: "center", inline: "nearest" }));
  await mainGalleryTrigger.click();
  assert.equal(await gallery.isVisible(), true, "Main property gallery should still open after the shared repair");
  assert.equal((await page.locator("#story-gallery-title").innerText()).includes("·"), false, "Main gallery should not inherit a stale unit topic");
  await page.keyboard.press("Escape");

  const result = {
    status: "passed",
    route: `${baseUrl}/business?id=vacation-2356`,
    viewport: "390x844",
    roomTriggers: await roomTriggers.count(),
    checks: ["visible logical arrows", "horizontal and vertical gestures", "all-images grid", "exact-index return", "scroll and focus return", "second-unit reset", "RTL and LTR", "low-height", "responsive transition", "Escape", "main gallery"],
    iteration,
    screenshots: [`unit-gallery-viewer-390-run-${iteration}.png`, `unit-gallery-grid-390-run-${iteration}.png`],
  };
  await writeFile(evidencePath(`audit-run-${iteration}.json`), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result));
} finally {
  await context.close();
}
}
} finally {
  await browser.close();
}
