import { chromium } from "playwright";
import { existsSync } from "node:fs";

const baseUrl = process.argv[2] || "http://127.0.0.1:4175";
const profiles = [
  { name: "desktop", viewport: { width: 1440, height: 900 }, mobile: false },
  { name: "mobile", viewport: { width: 390, height: 844 }, mobile: true },
];
const routes = ["/", "/search", "/spas", "/events", "/holidays", "/business"];
const results = [];

const systemChrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await chromium.launch({ headless: true, ...(existsSync(systemChrome) ? { executablePath: systemChrome } : {}) });
try {
  for (const profile of profiles) {
    const context = await browser.newContext({ viewport: profile.viewport, isMobile: profile.mobile, hasTouch: profile.mobile, locale: "he-IL" });
    for (const route of routes) {
      const page = await context.newPage();
      await page.addInitScript(() => {
        globalThis.__viiMetrics = { lcp: 0, shifts: 0, longTasks: [] };
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) globalThis.__viiMetrics.lcp = entry.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) globalThis.__viiMetrics.shifts += entry.value;
        }).observe({ type: "layout-shift", buffered: true });
        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) globalThis.__viiMetrics.longTasks.push(entry.duration);
          }).observe({ type: "longtask", buffered: true });
        } catch {}
      });
      const started = performance.now();
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForTimeout(1_200);
      const record = await page.evaluate(({ profileName, routeName, status, elapsed }) => {
        const navigation = performance.getEntriesByType("navigation")[0];
        const metrics = globalThis.__viiMetrics;
        const bodyText = document.body.innerText.trim();
        return {
          profile: profileName,
          route: routeName,
          status,
          elapsedMs: Math.round(elapsed),
          responseStartMs: Math.round(navigation?.responseStart || 0),
          domContentLoadedMs: Math.round(navigation?.domContentLoadedEventEnd || 0),
          lcpMs: Math.round(metrics?.lcp || 0),
          cls: Number((metrics?.shifts || 0).toFixed(4)),
          maxLongTaskMs: Math.round(Math.max(0, ...(metrics?.longTasks || []))),
          bodyTextLength: bodyText.length,
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          fontFamily: getComputedStyle(document.querySelector("h1, h2, button") || document.body).fontFamily,
        };
      }, { profileName: profile.name, routeName: route, status: response?.status() || 0, elapsed: performance.now() - started });
      results.push(record);
      await page.close();
    }

    const page = await context.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    const navigationLink = page.locator('a[href="/events"], a[href$="/events"]').first();
    if (await navigationLink.count()) {
      await navigationLink.hover();
      await page.waitForTimeout(120);
      await page.evaluate(() => {
        globalThis.__viiBlankFrames = 0;
        globalThis.__viiFrameSamples = 0;
        const sample = () => {
          globalThis.__viiFrameSamples += 1;
          const main = document.querySelector("main");
          if (!main || main.getBoundingClientRect().height < 80 || (main.textContent || "").trim().length < 20) globalThis.__viiBlankFrames += 1;
          if (globalThis.__viiFrameSamples < 120) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      const clickStart = performance.now();
      await navigationLink.click();
      await page.waitForURL(/\/events(?:[?#/]|$)/, { timeout: 15_000 });
      await page.waitForTimeout(500);
      const transition = await page.evaluate(({ profileName, elapsed }) => ({
        profile: profileName,
        route: "home-to-events",
        transitionMs: Math.round(elapsed),
        blankFrames: globalThis.__viiBlankFrames || 0,
        sampledFrames: globalThis.__viiFrameSamples || 0,
        meaningfulText: (document.querySelector("main")?.textContent || "").trim().length > 20,
      }), { profileName: profile.name, elapsed: performance.now() - clickStart });
      results.push(transition);
    }
    await page.close();
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ baseUrl, measuredAt: new Date().toISOString(), results }, null, 2));
