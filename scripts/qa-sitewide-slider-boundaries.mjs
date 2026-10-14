import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseURL = (process.env.VII_QA_URL || "http://127.0.0.1:5173").replace(/\/$/, "");
const executablePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await chromium.launch({ executablePath, headless: true });

function route(path) {
  return `${baseURL}${path}`;
}

async function railInventory(page, path, viewport, minimum) {
  await page.setViewportSize(viewport);
  await page.goto(route(path), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await page.waitForFunction(() => [...document.querySelectorAll("[data-slider-controls]")].every((group) => {
    const railId = group.getAttribute("aria-controls");
    const rail = railId
      ? document.getElementById(railId)
      : group.closest(".event-region-carousel")?.querySelector(".event-region-carousel__rail");
    if (!(rail instanceof HTMLElement)) return true;
    const buttons = group.querySelectorAll("button");
    const overflow = rail.scrollWidth > rail.clientWidth + 2;
    return buttons[0]?.disabled === true && buttons[1]?.disabled === !overflow;
  }), null, { timeout: 10_000 });
  const states = await page.evaluate(() => [...document.querySelectorAll("[data-slider-controls]")].map((group) => {
    const railId = group.getAttribute("aria-controls");
    const rail = railId
      ? document.getElementById(railId)
      : group.closest(".event-region-carousel")?.querySelector(".event-region-carousel__rail");
    const buttons = group.querySelectorAll("button");
    return {
      label: group.getAttribute("aria-label"),
      railId,
      direction: getComputedStyle(group).direction,
      overflow: Boolean(rail && rail.scrollWidth > rail.clientWidth + 2),
      scrollLeft: rail?.scrollLeft || 0,
      previousDisabled: buttons[0]?.disabled,
      nextDisabled: buttons[1]?.disabled,
    };
  }));
  assert.ok(states.length >= minimum, `${path}: expected at least ${minimum} slider control groups, found ${states.length}`);
  states.forEach((state) => {
    assert.equal(state.previousDisabled, true, `${path}: ${state.label} previous must start disabled`);
    assert.equal(state.nextDisabled, !state.overflow, `${path}: ${state.label} next must match real overflow`);
  });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true, `${path}: document must not overflow horizontally`);
  return states;
}

async function exerciseFirstOverflowingRail(page, path) {
  const selector = await page.evaluate(() => {
    const groups = [...document.querySelectorAll("[data-slider-controls]")];
    const index = groups.findIndex((group) => {
      const railId = group.getAttribute("aria-controls");
      const rail = railId ? document.getElementById(railId) : group.closest(".event-region-carousel")?.querySelector(".event-region-carousel__rail");
      const next = group.querySelector("button:nth-child(2)");
      return rail && next instanceof HTMLButtonElement && !next.disabled && rail.scrollWidth > rail.clientWidth + 2;
    });
    return index;
  });
  assert.ok(selector >= 0, `${path}: expected an overflowing rail`);
  const group = page.locator("[data-slider-controls]").nth(selector);
  const before = await page.evaluate((index) => {
    const target = document.querySelectorAll("[data-slider-controls]")[index];
    const railId = target?.getAttribute("aria-controls");
    const rail = railId ? document.getElementById(railId) : target?.closest(".event-region-carousel")?.querySelector(".event-region-carousel__rail");
    return rail?.scrollLeft || 0;
  }, selector);
  await group.locator("button").nth(1).click();
  await page.waitForTimeout(650);
  const moved = await page.evaluate((index) => {
    const target = document.querySelectorAll("[data-slider-controls]")[index];
    const railId = target?.getAttribute("aria-controls");
    const rail = railId ? document.getElementById(railId) : target?.closest(".event-region-carousel")?.querySelector(".event-region-carousel__rail");
    return { scrollLeft: rail?.scrollLeft || 0, previousDisabled: target?.querySelector("button")?.disabled };
  }, selector);
  assert.notEqual(moved.scrollLeft, before, `${path}: next must move the rail`);
  assert.equal(moved.previousDisabled, false, `${path}: previous must enable after movement`);

  await page.evaluate((index) => {
    const target = document.querySelectorAll("[data-slider-controls]")[index];
    const railId = target?.getAttribute("aria-controls");
    const rail = railId ? document.getElementById(railId) : target?.closest(".event-region-carousel")?.querySelector(".event-region-carousel__rail");
    if (!(rail instanceof HTMLElement)) return;
    rail.scrollTo({ left: getComputedStyle(rail).direction === "rtl" ? -rail.scrollWidth : rail.scrollWidth, behavior: "instant" });
    rail.dispatchEvent(new Event("scroll"));
  }, selector);
  await page.waitForTimeout(120);
  assert.equal(await group.locator("button").nth(1).isDisabled(), true, `${path}: next must disable at the terminal boundary`);
  return { before, moved };
}

async function exerciseIndexedGallery(page, path, previousSelector, nextSelector, counterSelector) {
  await page.goto(route(path), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  const previous = page.locator(previousSelector).first();
  const next = page.locator(nextSelector).first();
  await previous.waitFor({ state: "attached" });
  assert.equal(await previous.isDisabled(), true, `${path}: indexed gallery previous must start disabled`);
  assert.equal(await next.isDisabled(), false, `${path}: indexed gallery next must start enabled`);
  const before = (await page.locator(counterSelector).first().textContent())?.trim();
  await next.click({ force: true });
  const after = (await page.locator(counterSelector).first().textContent())?.trim();
  assert.notEqual(after, before, `${path}: indexed gallery next must change the image counter`);
  assert.equal(await previous.isDisabled(), false, `${path}: indexed gallery previous must enable after movement`);
  return { before, after };
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: "he-IL" });
  const homeDesktop = await railInventory(page, "/", { width: 1280, height: 900 }, 8);
  const eventsDesktop = await railInventory(page, "/events", { width: 1280, height: 900 }, 3);
  const eventsMove = await exerciseFirstOverflowingRail(page, "/events");
  const searchDesktop = await railInventory(page, "/search", { width: 1280, height: 900 }, 2);
  const searchMove = await exerciseFirstOverflowingRail(page, "/search");
  const homeMobile = await railInventory(page, "/", { width: 390, height: 844 }, 8);
  const eventsMobile = await railInventory(page, "/events", { width: 390, height: 844 }, 3);
  const ltrEvents = await railInventory(page, "/en/events", { width: 1280, height: 900 }, 3);
  assert.ok(ltrEvents.every((state) => state.direction === "ltr"), "English event controls must use LTR direction");

  await page.setViewportSize({ width: 1280, height: 900 });
  const cardGallery = await exerciseIndexedGallery(page, "/search", ".stay-card__gallery-arrow--previous", ".stay-card__gallery-arrow--next", ".stay-card__gallery-count");
  const livePlacePath = await page.locator(".stay-card:has(.stay-card__gallery-arrow--next) .stay-card__surface-link").first().getAttribute("href");
  assert.ok(livePlacePath?.startsWith("/business"), "search must expose a current public vacation detail with a gallery");
  await page.setViewportSize({ width: 390, height: 844 });
  const placeGallery = await exerciseIndexedGallery(page, livePlacePath, ".property-gallery__mobile-arrow--previous", ".property-gallery__mobile-arrow--next", ".property-gallery__mobile-position small");

  await page.close();
  console.log(JSON.stringify({ homeDesktop: homeDesktop.length, eventsDesktop: eventsDesktop.length, searchDesktop: searchDesktop.length, homeMobile: homeMobile.length, eventsMobile: eventsMobile.length, ltrEvents: ltrEvents.length, eventsMove, searchMove, cardGallery, livePlacePath, placeGallery }, null, 2));
} finally {
  await browser.close();
}
