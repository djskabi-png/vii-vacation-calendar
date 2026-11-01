import { chromium } from "playwright";

const base = process.env.QA_BASE_URL || "http://127.0.0.1:3222";
const browser = await chromium.launch({ headless: true });
const results = [];

async function check({ id, source, link }) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "he-IL" });
  const page = await context.newPage();
  await page.goto(`${base}${source}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.locator(".navigation-progress").waitFor({ state: "attached", timeout: 10_000 });
  await page.waitForFunction(() => document.documentElement.dataset.navigationProgressReady === "true", null, { timeout: 10_000 });
  const candidates = page.locator(link);
  const count = await candidates.count();
  let candidate = candidates.first();
  for (let index = 0; index < count; index += 1) {
    if (await candidates.nth(index).isVisible()) { candidate = candidates.nth(index); break; }
  }
  await candidate.waitFor({ state: "visible", timeout: 30_000 });
  const target = await candidate.getAttribute("href");
  const targetMode = await candidate.getAttribute("target");
  const started = performance.now();
  const click = candidate.click({ noWaitAfter: true });
  const loading = page.locator(".place-page-loading");
  const progress = page.locator(".navigation-progress.is-active");
  const feedbackVisible = await Promise.race([
    loading.waitFor({ state: "visible", timeout: 1_000 }).then(() => "skeleton"),
    progress.waitFor({ state: "visible", timeout: 1_000 }).then(() => "progress"),
  ]).catch(() => false);
  await click;
  const feedbackMs = Math.round(performance.now() - started);
  await page.waitForURL((url) => target ? `${url.pathname}${url.search}${url.hash}` === target : false, { timeout: 15_000 });
  await page.locator("h1").first().waitFor({ state: "visible", timeout: 30_000 });
  const readyMs = Math.round(performance.now() - started);
  const snapshot = { id, source, target, targetMode, pages: context.pages().length, feedbackVisible, feedbackMs, readyMs, h1: (await page.locator("h1").first().innerText()).trim() };
  results.push(snapshot);
  await context.close();
}

try {
  await check({ id: "vacation", source: "/search", link: '.stay-card__body h3 a[href^="/business?id="]' });
  await check({ id: "event", source: "/events", link: '.place-preview-card__body[href^="/events/place/"]' });
  await check({ id: "spa", source: "/spas", link: 'a[href^="/discover/place/spa-"]' });
} finally {
  await browser.close();
}

const failed = results.filter((item) => item.targetMode === "_blank" || item.pages !== 1 || !item.feedbackVisible || item.feedbackMs > 1_000 || !item.h1);
console.log(JSON.stringify({ passed: failed.length === 0, results, failed }, null, 2));
if (failed.length) process.exitCode = 1;
