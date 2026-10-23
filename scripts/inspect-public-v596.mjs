import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const baseUrl = process.env.QA_BASE_URL || "https://vii.spaplus.co";
const release = process.env.QA_RELEASE || "candidate";
const outputDir = join(process.cwd(), "qa-reports", process.env.QA_OUTPUT || `v${release}-full-qa`);
const screenshotDir = join(outputDir, "screens");
const executablePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const dateQuery = "from=2026-11-06&till=2026-11-08&adults=2";

const routes = [
  { id: "home", path: "/", deep: true, sliders: true, tabs: true },
  { id: "vacation-search-dated", path: `/search?location=${encodeURIComponent("כל הארץ")}&${dateQuery}`, deep: true },
  { id: "vacation-search-sparse", path: `/search?location=${encodeURIComponent("משמר הירדן")}`, deep: true },
  { id: "vacation-region-north", path: "/vacations/north", deep: true, sliders: true, tabs: true },
  { id: "vacation-region-jerusalem", path: "/vacations/jerusalem", sliders: true, tabs: true },
  { id: "villas-north", path: "/villas/north" },
  { id: "luxury-suites-north", path: "/luxury-suites/north" },
  { id: "suite-complexes-north", path: "/suite-complexes/north" },
  { id: "vacation-apartments-north", path: "/vacation-apartments/north" },
  { id: "vacation-place", path: "/business?id=vacation-116", deep: true, sliders: true },
  { id: "vacation-place-rooms", path: "/business?id=vacation-2566", deep: true, sliders: true },
  { id: "hourly-home", path: "/hourly", deep: true, sliders: true },
  { id: "hourly-haifa", path: `/hourly?location=${encodeURIComponent("חיפה")}`, deep: true },
  { id: "hourly-place", path: "/discover/place/hourly-475", deep: true, sliders: true },
  { id: "events-home", path: "/events", deep: true, sliders: true, tabs: true },
  { id: "events-search", path: "/events/search", deep: true },
  { id: "events-region", path: "/events/search/north", deep: true, sliders: true, tabs: true },
  { id: "event-place", path: "/events/place/event-1000", deep: true, sliders: true },
  { id: "spas-home", path: "/spas", deep: true, sliders: true, tabs: true },
  { id: "spas-region", path: "/spas/search/north", deep: true, sliders: true, tabs: true },
  { id: "spa-place", path: "/discover/place/spa-151", deep: true, sliders: true },
  { id: "activities", path: "/activities", deep: true, sliders: true },
  { id: "attractions", path: "/attractions", deep: true, sliders: true },
  { id: "trails", path: "/trails", deep: true, sliders: true },
  { id: "providers", path: "/providers", deep: true, sliders: true },
  { id: "holidays", path: "/holidays", deep: true },
  { id: "holiday-hanukkah", path: "/holidays/hanukkah", deep: true, tabs: true },
  { id: "guides", path: "/guides", deep: true },
  { id: "destinations", path: "/destinations" },
  { id: "corporate", path: "/corporate" },
  { id: "gift-card", path: "/gift-card" },
  { id: "favorites", path: "/favorites" },
  { id: "account", path: "/account" },
  { id: "join", path: "/join" },
  { id: "contact", path: "/contact" },
  { id: "questions", path: "/questions" },
  { id: "privacy", path: "/legal/privacy" },
  { id: "terms", path: "/legal/terms" },
  { id: "cancellation", path: "/legal/cancellation" },
  { id: "booking-entry", path: "/booking" },
  { id: "not-found", path: "/qa-route-that-must-not-exist-596" },
];

const viewports = [
  { id: "desktop", width: 1440, height: 1000, isMobile: false, hasTouch: false },
  { id: "mobile", width: 390, height: 844, isMobile: true, hasTouch: true },
];

await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });
const report = { schemaVersion: 1, baseUrl, release, startedAt: new Date().toISOString(), scopeExclusions: ["accessibility", "typography"], pages: [], consoleErrors: [] };

function meaningfulText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function waitForSettled(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(350);
  await page.waitForFunction(() => ![...document.querySelectorAll('[aria-busy="true"]')].some((node) => {
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }), undefined, { timeout: 6_000 }).catch(() => null);
  await page.waitForTimeout(150);
}

async function inspectRails(page) {
  return page.evaluate(async () => {
    const rails = [...document.querySelectorAll("[data-horizontal-rail]")].filter((rail) => {
      const rect = rail.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const results = [];
    for (const rail of rails) {
      const overflowing = rail.scrollWidth > rail.clientWidth + 2;
      let moved = null;
      if (overflowing) {
        const controls = rail.id ? document.querySelector(`[data-slider-controls][aria-controls="${CSS.escape(rail.id)}"]`) : null;
        const buttons = controls ? [...controls.querySelectorAll("button")].filter((button) => !button.disabled) : [];
        for (const button of buttons) {
          const before = rail.scrollLeft;
          button.click();
          await new Promise((resolve) => setTimeout(resolve, 350));
          if (Math.abs(rail.scrollLeft - before) > 1) { moved = true; break; }
        }
        if (moved !== true) {
          const before = rail.scrollLeft;
          rail.dispatchEvent(new WheelEvent("wheel", { deltaX: 240, bubbles: true }));
          await new Promise((resolve) => setTimeout(resolve, 120));
          moved = Math.abs(rail.scrollLeft - before) > 1;
        }
      }
      const controls = rail.id ? document.querySelector(`[data-slider-controls][aria-controls="${CSS.escape(rail.id)}"]`) : null;
      results.push({
        id: rail.id || null,
        label: rail.getAttribute("aria-label") || controls?.getAttribute("aria-label") || null,
        itemCount: rail.children.length,
        clientWidth: rail.clientWidth,
        scrollWidth: rail.scrollWidth,
        overflowing,
        moved,
        controlsPresent: Boolean(controls),
        enabledControlCount: controls ? [...controls.querySelectorAll("button")].filter((button) => !button.disabled).length : 0,
      });
    }
    return results;
  });
}

async function inspectTabs(page) {
  const tablists = page.locator('[role="tablist"]');
  const count = await tablists.count();
  const results = [];
  for (let i = 0; i < count; i += 1) {
    const list = tablists.nth(i);
    if (!(await list.isVisible().catch(() => false))) continue;
    const label = meaningfulText(await list.getAttribute("aria-label"));
    const tabs = list.locator('[role="tab"]');
    const tabCount = await tabs.count();
    const tabResult = { label, tabCount, tabs: [] };
    for (let j = 0; j < tabCount; j += 1) {
      const tab = tabs.nth(j);
      const name = meaningfulText(await tab.innerText().catch(() => ""));
      const controls = await tab.getAttribute("aria-controls");
      await tab.click({ timeout: 8_000 }).catch(() => null);
      if (controls) {
        await page.waitForFunction((id) => document.getElementById(id)?.getAttribute("aria-busy") !== "true", controls, { timeout: 8_000 }).catch(() => null);
      }
      await page.waitForTimeout(120);
      const selected = await tab.getAttribute("aria-selected");
      const panel = controls ? page.locator(`#${controls}`) : null;
      const panelText = panel && await panel.count() ? meaningfulText(await panel.innerText().catch(() => "")) : "";
      const cards = panel && await panel.count() ? await panel.locator("article, .home-live-deals__item, .holiday-deals__item, .event-list > article, .stay-card, .discovery-card").count() : null;
      tabResult.tabs.push({ name, controls, selected, panelTextLength: panelText.length, cards });
    }
    results.push(tabResult);
  }
  return results;
}

async function inspectPage(page, route, viewport) {
  const url = `${baseUrl}${route.path}${route.path.includes("?") ? "&" : "?"}qa=596`;
  const started = performance.now();
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await waitForSettled(page);
  const loadMs = Math.round(performance.now() - started);
  if (route.deep) {
    await page.evaluate(async () => {
      const distance = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      for (let y = 0; y <= distance; y += Math.max(500, innerHeight * .7)) {
        scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
      scrollTo(0, 0);
    });
    await page.waitForTimeout(200);
  }
  const state = await page.evaluate(() => {
    const visible = (node) => { const rect = node.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; };
    const images = [...document.images].filter(visible);
    const bodyText = document.body.innerText.replace(/\s+/g, " ").trim();
    const missingCopy = ["תמונה לא זמינה", "image unavailable", "לא הצלחנו", "שגיאה", "אירעה תקלה"].filter((copy) => bodyText.toLowerCase().includes(copy.toLowerCase()));
    const phoneLinks = [...document.querySelectorAll('a[href^="tel:"]')].filter(visible);
    const whatsappLinks = [...document.querySelectorAll('a[href*="wa.me"],a[href*="whatsapp"]')].filter(visible);
    const floating = [...document.querySelectorAll('[class*="floating"], [class*="sticky"]')].filter((node) => visible(node) && /טלפון|וואטסאפ|חיוג/.test(node.textContent || ""));
    return {
      title: document.title,
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      h1: [...document.querySelectorAll("h1")].map((node) => node.textContent.replace(/\s+/g, " ").trim()).filter(Boolean),
      canonical: document.querySelector('link[rel="canonical"]')?.href || null,
      description: document.querySelector('meta[name="description"]')?.content || null,
      breadcrumbs: [...document.querySelectorAll('.breadcrumb-trail a, .breadcrumb-trail span, nav[aria-label*="פירורי"] a, nav[aria-label*="פירורי"] span')].map((node) => node.textContent.replace(/\s+/g, " ").trim()).filter(Boolean),
      bodyTextLength: bodyText.length,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      scrollHeight: document.documentElement.scrollHeight,
      visibleImages: images.length,
      brokenVisibleImages: images.filter((image) => image.complete && image.naturalWidth === 0).map((image) => image.currentSrc || image.src).slice(0, 10),
      missingCopy,
      phoneLinkCount: phoneLinks.length,
      whatsappLinkCount: whatsappLinks.length,
      floatingContactCount: floating.length,
      buttons: [...document.querySelectorAll("button")].filter(visible).length,
      links: [...document.querySelectorAll("a[href]")].filter(visible).length,
      busyVisible: [...document.querySelectorAll('[aria-busy="true"]')].filter(visible).length,
      retryVisible: [...document.querySelectorAll("button")].filter((button) => visible(button) && /לנסות שוב|נסה שוב/.test(button.textContent || "")).length,
      mapImageCount: [...document.querySelectorAll('img[src*="map-snapshot"], img[alt*="מפה"]')].filter(visible).length,
      iframeCount: [...document.querySelectorAll("iframe")].filter(visible).length,
    };
  });
  const rails = route.sliders ? await inspectRails(page) : [];
  const tabs = route.tabs ? await inspectTabs(page) : [];
  const screenshot = join(screenshotDir, `${route.id}-${viewport.id}.png`);
  if (route.deep || route.id === "home") await page.screenshot({ path: screenshot, fullPage: true });
  return { id: route.id, path: route.path, viewport: viewport.id, status: response?.status() ?? null, finalUrl: page.url(), loadMs, state, rails, tabs, screenshot: route.deep || route.id === "home" ? screenshot : null };
}

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.isMobile, hasTouch: viewport.hasTouch, locale: "he-IL" });
  for (const route of routes) {
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push({ route: route.id, viewport: viewport.id, url: page.url(), text: message.text() }); });
    page.on("pageerror", (error) => report.consoleErrors.push({ route: route.id, viewport: viewport.id, url: page.url(), text: error.message }));
    try {
      report.pages.push(await inspectPage(page, route, viewport));
    } catch (error) {
      report.pages.push({ id: route.id, path: route.path, viewport: viewport.id, error: error instanceof Error ? error.message : String(error) });
    }
    await page.close();
  }
  await context.close();
}

report.finishedAt = new Date().toISOString();
report.summary = {
  inspected: report.pages.length,
  errors: report.pages.filter((item) => item.error).length,
  non200: report.pages.filter((item) => !item.error && item.id !== "not-found" && item.status !== 200).map((item) => ({ id: item.id, viewport: item.viewport, status: item.status })),
  blank: report.pages.filter((item) => item.state && item.state.bodyTextLength < 100).map((item) => ({ id: item.id, viewport: item.viewport })),
  overflow: report.pages.filter((item) => item.state?.horizontalOverflow).map((item) => ({ id: item.id, viewport: item.viewport })),
  brokenImages: report.pages.filter((item) => item.state?.brokenVisibleImages?.length).map((item) => ({ id: item.id, viewport: item.viewport, images: item.state.brokenVisibleImages })),
  stuckBusy: report.pages.filter((item) => item.state?.busyVisible).map((item) => ({ id: item.id, viewport: item.viewport, count: item.state.busyVisible })),
  stuckRails: report.pages.flatMap((item) => item.rails?.filter((rail) => rail.overflowing && rail.moved === false).map((rail) => ({ id: item.id, viewport: item.viewport, rail })) || []),
};

await writeFile(join(outputDir, "public-inspection.json"), `${JSON.stringify(report, null, 2)}\n`);
await browser.close();
console.log(JSON.stringify(report.summary, null, 2));
