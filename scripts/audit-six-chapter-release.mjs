import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const base = process.argv[2] || "http://127.0.0.1:4173";
const output = process.argv[3] || path.resolve("project_knowledge/release_evidence/vii-six-chapter-completion-20261020/local-qa");
const routes = ["/", "/events", "/spas", "/search", "/en", "/fr/events", "/ru/spas", "/accessibility"];
const viewports = [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const results = [];
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    for (const route of routes) {
      const page = await context.newPage();
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForFunction(() => {
        const heading = document.querySelector("h1");
        if (!heading) return false;
        const style = getComputedStyle(heading); const rect = heading.getBoundingClientRect();
        return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
      }, undefined, { timeout: 20_000 });
      await page.waitForFunction(() => !document.documentElement.hasAttribute("data-locale-pending"), undefined, { timeout: 20_000 });
      await page.waitForTimeout(1_200);
      const structure = await page.evaluate(() => {
        const visible = (element) => { const style = getComputedStyle(element); const rect = element.getBoundingClientRect(); return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0; };
        const tinyTargets = [...document.querySelectorAll('button,input,select,summary,[role="button"],a.button,a[class*="button"],a[class*="action"],a[class*="trigger"]')].filter(visible).map((element) => {
          const rect = element.getBoundingClientRect(); return { tag: element.tagName, label: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 80) || "", width: Math.round(rect.width), height: Math.round(rect.height) };
        }).filter((item) => item.width < 24 || item.height < 24);
        return { lang: document.documentElement.lang, dir: document.documentElement.dir,
          h1: [...document.querySelectorAll("h1")].filter(visible).length,
          horizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
          tinyTargets };
      });
      await page.keyboard.press("Tab");
      const keyboardFocus = await page.evaluate(() => ({ tag: document.activeElement?.tagName || "", label: document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent?.trim().slice(0, 80) || "" }));
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const serious = axe.violations.filter((violation) => ["serious", "critical"].includes(violation.impact || ""))
        .map((violation) => ({ id: violation.id, impact: violation.impact, help: violation.help, nodes: violation.nodes.length,
          targets: violation.nodes.slice(0, 5).map((node) => node.target.join(" ")),
          details: violation.nodes.slice(0, 5).map((node) => ({ html: node.html, failureSummary: node.failureSummary })) }));
      const slug = route === "/" ? "home" : route.slice(1).replaceAll("/", "-");
      await page.screenshot({ path: path.join(output, `${viewport.name}-${slug}.png`), fullPage: false });
      results.push({ viewport: viewport.name, route, url: page.url(), title: await page.title(), structure, keyboardFocus, serious, pageErrors });
      await page.close();
    }
    await context.close();
  }
  const manifestResponse = await fetch(base + "/manifest.webmanifest");
  const manifest = await manifestResponse.json();
  const workerResponse = await fetch(base + "/sw.js");
  const worker = await workerResponse.text();
  const summary = {
    base, checkedAt: new Date().toISOString(), results,
    pwa: { manifestStatus: manifestResponse.status, id: manifest.id, scope: manifest.scope, display: manifest.display,
      iconPurposes: manifest.icons?.map((icon) => icon.purpose), workerStatus: workerResponse.status,
      offlineFallback: worker.includes('caches.match(OFFLINE)'), privateExclusions: ["/api/", "/admin", "/auth", "/account", "/booking", "/favorites", "/checkout"].every((value) => worker.includes(`"${value}"`)) },
  };
  summary.failures = results.flatMap((result) => [
    ...(result.structure.h1 < 1 ? [`${result.viewport} ${result.route}: no visible H1`] : []),
    ...(result.structure.horizontalOverflow > 1 ? [`${result.viewport} ${result.route}: horizontal overflow ${result.structure.horizontalOverflow}px`] : []),
    ...(result.structure.tinyTargets.length ? [`${result.viewport} ${result.route}: ${result.structure.tinyTargets.length} targets below 24px`] : []),
    ...(result.keyboardFocus.tag === "BODY" || !result.keyboardFocus.tag ? [`${result.viewport} ${result.route}: keyboard focus did not enter page`] : []),
    ...result.serious.map((violation) => `${result.viewport} ${result.route}: axe ${violation.id} (${violation.nodes})`),
    ...result.pageErrors.map((error) => `${result.viewport} ${result.route}: ${error}`),
  ]);
  if (manifestResponse.status !== 200 || workerResponse.status !== 200 || manifest.scope !== "/" || manifest.display !== "standalone" || !summary.pwa.offlineFallback || !summary.pwa.privateExclusions) summary.failures.push("PWA contract failed");
  await writeFile(path.join(output, "audit.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ pages: results.length, failures: summary.failures, pwa: summary.pwa }, null, 2));
  if (summary.failures.length) process.exitCode = 1;
} finally { await browser.close(); }
