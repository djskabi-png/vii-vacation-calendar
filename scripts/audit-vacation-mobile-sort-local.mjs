import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:4177";
const outputDir = new URL("../artifacts/mobile-sort/", import.meta.url);
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 844 }, deviceScaleFactor: 1 });
const browserErrors = [];
page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
page.on("pageerror", (error) => browserErrors.push(error.message));
try {
  await page.goto(`${baseUrl}/search?guests=4&sort=price-asc`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(2_500);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".results-toolbar__sort .modern-select__trigger").waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(500);
  const sort = page.locator(".results-toolbar__sort");
  if (!(await sort.isVisible())) throw new Error("Mobile results sort is not visible");
  const sortBox = await sort.boundingBox();
  const trigger = sort.locator(".modern-select__trigger");
  const triggerBox = await trigger.boundingBox();
  if (!sortBox || sortBox.x < 0 || sortBox.x + sortBox.width > 390) throw new Error(`Mobile sort is clipped: ${JSON.stringify(sortBox)}`);
  if (!triggerBox || triggerBox.x < 0 || triggerBox.x + triggerBox.width > 390 || triggerBox.height < 44) throw new Error(`Mobile sort trigger is clipped or too small: ${JSON.stringify(triggerBox)}`);
  await page.screenshot({ path: fileURLToPath(new URL("vacation-price-sort-390.png", outputDir)), fullPage: true });

  await trigger.click();
  try {
    await page.waitForFunction((element) => element?.getAttribute("aria-expanded") === "true", await trigger.elementHandle(), { timeout: 5_000 });
  } catch (error) {
    throw new Error(`Mobile sort trigger did not open after hydration. Browser errors: ${browserErrors.join(" | ") || "none"}`, { cause: error });
  }
  await page.locator(".results-toolbar__sort .modern-select__menu button", { hasText: "מחיר מהגבוה לנמוך" }).click();
  await page.waitForURL((url) => url.searchParams.get("sort") === "price-desc", { timeout: 15_000 });
  const updatedUrl = new URL(page.url());
  if (updatedUrl.searchParams.get("guests") !== "4") throw new Error(`Changing sort lost the guest filter: ${updatedUrl}`);
  if (!(await sort.locator(".modern-select__trigger").getByText("מחיר מהגבוה לנמוך").isVisible())) throw new Error("Mobile sort did not update its selected label");

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const loadMore = page.getByRole("button", { name: /טוענים עוד מקומות|הצגת עוד מקומות/ });
    if (!(await loadMore.count()) || !(await loadMore.first().isVisible())) break;
    await loadMore.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(450);
  }

  const prices = await page.locator(".stay-card").evaluateAll((cards) => cards.flatMap((card) => {
    const price = card.querySelector(".stay-card__commercial-summary bdi, .catalog-starting-price bdi")?.textContent || "";
    const amount = Number(price.replace(/[^0-9.]/g, ""));
    return Number.isFinite(amount) && amount > 0 ? [amount] : [];
  }));
  if (prices.some((price, index) => index > 0 && price > prices[index - 1])) {
    throw new Error(`Descending prices are not monotonic: ${prices.join(",")}`);
  }
  process.stdout.write(`${JSON.stringify({ sortBox, triggerBox, selectedSort: updatedUrl.searchParams.get("sort"), preservedGuests: updatedUrl.searchParams.get("guests"), knownPriceCount: prices.length, prices }, null, 2)}\n`);
} finally {
  await browser.close();
}
