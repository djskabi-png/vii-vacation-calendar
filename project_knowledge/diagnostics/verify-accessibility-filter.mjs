import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

const baseUrl = "http://127.0.0.1:4186/search?accessible=1";
// Expectations must come from an independently verified supplier generation,
// never from the same compact payload under test or a fixed four-card list.
if (!process.env.VII_ACCESSIBILITY_EXPECTATIONS_PATH) throw new Error("Independent supplier accessibility expectations required");
const expectations = JSON.parse(await readFile(process.env.VII_ACCESSIBILITY_EXPECTATIONS_PATH, "utf8"));
if (!expectations.sourceGeneration || !Array.isArray(expectations.places) || !expectations.places.length
  || expectations.places.some((place) => !Number.isSafeInteger(place.supplierId) || !place.name)) {
  throw new Error("Invalid independent accessibility expectations");
}
const expectedNames = expectations.places.map((place) => place.name);
const browser = await chromium.launch({ headless: true });

try {
  for (const target of [
    { name: "desktop", viewport: { width: 1440, height: 1000 } },
    { name: "mobile", viewport: { width: 390, height: 844 } },
  ]) {
    const page = await browser.newPage({ viewport: target.viewport });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator(".stay-card").first().waitFor({ timeout: 30_000 });
    const cards = await page.locator(".stay-card h3").allTextContents();
    const names = cards.map((value) => value.trim()).filter(Boolean);
    for (const expected of expectedNames) {
      if (!names.includes(expected)) throw new Error(`${target.name}: missing ${expected}`);
    }
    if (names.length !== expectedNames.length) throw new Error(`${target.name}: expected 4 cards, got ${names.length}`);
    const pressed = await page.getByRole("button", { name: "נגישות", exact: true }).getAttribute("aria-pressed");
    if (pressed !== "true") throw new Error(`${target.name}: accessibility filter is not pressed`);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".stay-card").first().waitFor({ timeout: 30_000 });
    if (await page.locator(".stay-card").count() !== expectedNames.length) {
      throw new Error(`${target.name}: result set did not persist after reload`);
    }
    await page.screenshot({
      path: `project_knowledge/diagnostics/vii-accessibility-filter-${target.name}-20261103.png`,
      fullPage: false,
    });
    console.log(JSON.stringify({ target: target.name, cards: names, persisted: true }));
    await page.close();
  }

  const draftPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await draftPage.goto("http://127.0.0.1:4186/search", { waitUntil: "networkidle" });
  await draftPage.locator(".stay-card").first().waitFor({ timeout: 30_000 });
  await draftPage.getByRole("button", { name: /מסננים/ }).click();
  await draftPage.locator(".filter-panel.open").waitFor();
  await draftPage.getByRole("button", { name: "מחיר ומאפיינים", exact: true }).click();
  await draftPage.getByRole("checkbox", { name: "נגישות לנכים", exact: true }).check();
  const draftLabel = (await draftPage.locator(".filter-apply").textContent())?.trim() || "";
  if (!draftLabel.includes("4")) throw new Error(`mobile draft: expected 4 accessible places, got ${draftLabel}`);
  const draftStartUrl = draftPage.url();
  await draftPage.locator(".filter-apply").click();
  await draftPage.waitForURL((url) => url.href !== draftStartUrl);
  await draftPage.locator(".managed-place-results article").first().waitFor({ timeout: 30_000 });
  if (await draftPage.locator(".managed-place-results article").count() !== expectedNames.length) {
    throw new Error("mobile draft: applying the filter did not keep the four verified places");
  }
  console.log(JSON.stringify({ target: "mobile-draft", label: draftLabel, applied: true }));
  await draftPage.close();
} finally {
  await browser.close();
}
