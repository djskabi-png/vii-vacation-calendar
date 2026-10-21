import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const base = process.argv[2] || "https://vii.spaplus.co";
const output = process.argv[3] || path.resolve("project_knowledge/release_evidence/public-isolated-audit");
const routes = ["/", "/events", "/spas", "/search", "/en", "/fr/events", "/ru/spas", "/accessibility"];
const viewports = [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const results = [];
try {
  for (const viewport of viewports) for (const route of routes) {
    const context = await browser.newContext({ viewport, serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const response = await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForFunction(() => document.querySelector("h1") && !document.documentElement.hasAttribute("data-locale-pending"), undefined, { timeout: 20_000 });
    await page.waitForTimeout(1_500);
    const structure = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      h1: document.querySelectorAll("h1").length,
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
    }));
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = axe.violations.filter(item => ["serious", "critical"].includes(item.impact || "")).map(item => `${item.id}:${item.nodes.length}`);
    const slug = route === "/" ? "home" : route.slice(1).replaceAll("/", "-");
    await page.screenshot({ path: path.join(output, `${viewport.name}-${slug}.png`), fullPage: false });
    results.push({ viewport: viewport.name, route, status: response?.status(), title: await page.title(), structure, serious, errors });
    await context.close();
  }
  const failures = results.flatMap(result => [
    ...(result.status !== 200 ? [`${result.viewport} ${result.route}: HTTP ${result.status}`] : []),
    ...(result.structure.h1 < 1 ? [`${result.viewport} ${result.route}: no H1`] : []),
    ...(result.structure.overflow > 1 ? [`${result.viewport} ${result.route}: overflow ${result.structure.overflow}`] : []),
    ...result.serious.map(item => `${result.viewport} ${result.route}: axe ${item}`),
    ...result.errors.map(item => `${result.viewport} ${result.route}: ${item}`),
  ]);
  const report = { base, checkedAt: new Date().toISOString(), results, failures };
  await writeFile(path.join(output, "audit.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pages: results.length, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
}
