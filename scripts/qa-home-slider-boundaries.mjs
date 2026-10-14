import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseURL = process.env.VII_QA_URL || "http://127.0.0.1:4777";
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });

async function inspect(viewport, name) {
  const page = await browser.newPage({ viewportSize: viewport, locale: "he-IL" });
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#home-destinations-rail");
  await page.waitForFunction(() => {
    const button = document.querySelector('[aria-controls="home-destinations-rail"] button:nth-child(2)');
    return button instanceof HTMLButtonElement && !button.disabled;
  }, null, { timeout: 10_000 });

  const initial = await page.evaluate(() => [...document.querySelectorAll(".home-slider__controls")].map((group) => {
    const railId = group.getAttribute("aria-controls");
    const rail = railId ? document.getElementById(railId) : null;
    const buttons = group.querySelectorAll("button");
    return {
      railId,
      overflow: Boolean(rail && rail.scrollWidth > rail.clientWidth + 2),
      previousDisabled: buttons[0]?.disabled,
      nextDisabled: buttons[1]?.disabled,
    };
  }));

  assert.ok(initial.length >= 8, `${name}: expected the complete homepage slider family`);
  for (const state of initial) {
    assert.equal(state.previousDisabled, true, `${name}: ${state.railId} previous must be disabled initially`);
    assert.equal(state.nextDisabled, !state.overflow, `${name}: ${state.railId} next must reflect real overflow`);
  }

  const next = page.locator('[aria-controls="home-destinations-rail"] button:nth-child(2)');
  await next.click();
  await page.waitForTimeout(650);
  const after = await page.evaluate(() => {
    const rail = document.getElementById("home-destinations-rail");
    const buttons = document.querySelectorAll('[aria-controls="home-destinations-rail"] button');
    return { scrollLeft: rail?.scrollLeft || 0, previousDisabled: buttons[0]?.disabled, nextDisabled: buttons[1]?.disabled };
  });
  assert.notEqual(after.scrollLeft, 0, `${name}: next arrow must move the rail`);
  assert.equal(after.previousDisabled, false, `${name}: previous must enable after moving left`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true, `${name}: no page overflow`);

  await page.close();
  return { name, controlCount: initial.length, initial, after };
}

try {
  const desktop = await inspect({ width: 1280, height: 900 }, "desktop");
  const mobile = await inspect({ width: 390, height: 844 }, "mobile");
  console.log(JSON.stringify({ desktop, mobile }, null, 2));
} finally {
  await browser.close();
}
