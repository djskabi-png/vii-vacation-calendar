import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const baseUrl = "https://vii.spaplus.co";
const executablePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outputDir = join(process.cwd(), "qa-reports", "v596-full-qa");
const routes = [
  ["home", "/"],
  ["vacations-north", "/vacations/north"],
  ["events-home", "/events"],
  ["events-region", "/events/search/north"],
  ["spas-home", "/spas"],
  ["spas-region", "/spas/search/north"],
  ["hourly-home", "/hourly"],
];
const viewports = [
  ["desktop", { width: 1440, height: 1000, isMobile: false, hasTouch: false }],
  ["mobile", { width: 390, height: 844, isMobile: true, hasTouch: true }],
];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });
const report = { release: 596, startedAt: new Date().toISOString(), routes: [] };

for (const [viewportId, viewport] of viewports) {
  for (const [id, path] of routes) {
    const context = await browser.newContext({ viewport, locale: "he-IL" });
    const page = await context.newPage();
    const entry = { id, path, viewport: viewportId, tabs: [], rails: [], errors: [] };
    page.on("console", (message) => { if (message.type() === "error") entry.errors.push(message.text()); });
    page.on("pageerror", (error) => entry.errors.push(error.message));
    try {
      const response = await page.goto(`${baseUrl}${path}${path.includes("?") ? "&" : "?"}qa=slider-596`, { waitUntil: "domcontentloaded", timeout: 20_000 });
      entry.status = response?.status() ?? null;
      await page.waitForTimeout(1200);
      const bodyBefore = await page.locator("body").innerText().catch(() => "");
      entry.bodyBefore = bodyBefore.length;
      const tablists = page.locator('[role="tablist"]');
      for (let listIndex = 0; listIndex < await tablists.count(); listIndex += 1) {
        const list = tablists.nth(listIndex);
        if (!(await list.isVisible().catch(() => false))) continue;
        const group = { label: await list.getAttribute("aria-label"), tabs: [] };
        const tabs = list.locator('[role="tab"]');
        for (let tabIndex = 0; tabIndex < await tabs.count(); tabIndex += 1) {
          const tab = tabs.nth(tabIndex);
          const name = (await tab.innerText().catch(() => "")).replace(/\s+/g, " ").trim();
          const controls = await tab.getAttribute("aria-controls");
          const visible = await tab.isVisible().catch(() => false);
          let clicked = false;
          if (visible) {
            clicked = await tab.click({ timeout: 3_000 }).then(() => true).catch(() => false);
            await page.waitForTimeout(450);
          }
          const panel = controls ? page.locator(`#${controls}`) : null;
          group.tabs.push({
            name,
            visible,
            clicked,
            selected: await tab.getAttribute("aria-selected").catch(() => null),
            controls,
            busy: panel && await panel.count() ? await panel.getAttribute("aria-busy").catch(() => null) : null,
            panelText: panel && await panel.count() ? (await panel.innerText().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 160) : null,
            cards: panel && await panel.count() ? await panel.locator("article, .home-live-deals__item, .holiday-deals__item, .event-list > article, .stay-card, .discovery-card").count() : null,
          });
        }
        group.tabs = group.tabs.filter((tab) => tab.name);
        if (group.tabs.length) entry.tabs.push(group);
      }
      entry.rails = await page.locator("[data-horizontal-rail]").evaluateAll(async (rails) => {
        const rows = [];
        for (const rail of rails.filter((item) => { const rect = item.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; })) {
          const before = rail.scrollLeft;
          const overflowing = rail.scrollWidth > rail.clientWidth + 2;
          let moved = null;
          if (overflowing) {
            for (const delta of [-Math.max(200, rail.clientWidth * .7), Math.max(200, rail.clientWidth * .7)]) {
              rail.scrollBy({ left: delta, behavior: "instant" });
              await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
              if (Math.abs(rail.scrollLeft - before) > 1) { moved = true; break; }
            }
            if (moved !== true) moved = false;
            rail.scrollLeft = before;
          }
          const controls = rail.id ? document.querySelector(`[data-slider-controls][aria-controls="${CSS.escape(rail.id)}"]`) : null;
          rows.push({ id: rail.id || null, label: rail.getAttribute("aria-label") || controls?.getAttribute("aria-label") || null, items: rail.children.length, clientWidth: rail.clientWidth, scrollWidth: rail.scrollWidth, overflowing, moved, controls: Boolean(controls), enabledButtons: controls ? [...controls.querySelectorAll("button")].filter((button) => !button.disabled).length : 0 });
        }
        return rows;
      }).catch(() => []);
      await page.waitForTimeout(1500);
      entry.bodyAfter = await page.locator("body").innerText().then((text) => text.length).catch(() => 0);
    } catch (error) {
      entry.runtimeError = error instanceof Error ? error.message : String(error);
    }
    report.routes.push(entry);
    await context.close();
  }
}

report.finishedAt = new Date().toISOString();
report.summary = {
  routes: report.routes.length,
  blankAfter: report.routes.filter((item) => item.bodyBefore > 100 && item.bodyAfter < 100).map((item) => ({ id: item.id, viewport: item.viewport, errors: item.errors.slice(0, 2) })),
  stuckTabs: report.routes.flatMap((item) => item.tabs.flatMap((group) => group.tabs.filter((tab) => tab.clicked && (tab.busy === "true" || !tab.panelText)).map((tab) => ({ id: item.id, viewport: item.viewport, group: group.label, tab })) )),
  unclickableTabs: report.routes.flatMap((item) => item.tabs.flatMap((group) => group.tabs.filter((tab) => tab.visible && !tab.clicked).map((tab) => ({ id: item.id, viewport: item.viewport, group: group.label, tab: tab.name })) )),
  stuckRails: report.routes.flatMap((item) => item.rails.filter((rail) => rail.overflowing && rail.moved === false).map((rail) => ({ id: item.id, viewport: item.viewport, rail }))),
};
await writeFile(join(outputDir, "slider-inspection.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.summary, null, 2));
await browser.close();
