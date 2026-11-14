import fs from "node:fs";
import { chromium } from "playwright";

const base = (process.argv.find((value) => value.startsWith("--base="))?.slice(7) || "http://127.0.0.1:4191").replace(/\/$/, "");
const repeats = Math.max(1, Math.min(5, Number(process.argv.find((value) => value.startsWith("--repeats="))?.slice(10) || 2)));
const routes = [
  { id: "home", path: "/", expected: /נופש|חיפושים פופולריים/ },
  { id: "vacations", path: "/vacations/north", expected: /נופש|צפון/ },
  { id: "events", path: "/events", expected: /אירועים/ },
  { id: "spas", path: "/spas", expected: /ספא/ },
  { id: "hourly", path: "/hourly", expected: /חדרים|שעה/ },
  { id: "business", path: "/business?id=vacation-164", expected: /אחוזת הספא|פרטי הלינה במקום|על המקום/ },
  { id: "event-place", path: "/events/place/event-680", expected: /אירוע|מתחם/ },
  { id: "spa-place", path: "/discover/place/spa-6", expected: /ספא/ },
  { id: "hourly-place", path: "/discover/place/hourly-475", expected: /חדר|שעה/ },
];
const profiles = [
  { id: "desktop", viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false },
  { id: "mobile", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];
const blockedText = /העמוד לא נטען במלואו|לא הצלחנו להשלים את הטעינה|500 Internal server error|This site ran into a problem/;
const executable = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  chromium.executablePath(),
].find((candidate) => candidate && fs.existsSync(candidate));
const browser = await chromium.launch({ headless: true, executablePath: executable });
const results = [];

try {
  for (const profile of profiles) {
    const context = await browser.newContext({ ...profile, serviceWorkers: "allow", locale: "he-IL" });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error" || (message.type() === "warning" && /same key|hydration|uncaught/i.test(message.text()))) {
        const location = message.location();
        errors.push(`console:${message.type()}:${message.text()}:${location.url || "unknown-source"}`);
      }
    });
    page.on("pageerror", (error) => errors.push(`pageerror:${error.message}`));
    page.on("response", (response) => { if (response.status() >= 400) errors.push(`http:${response.status()}:${response.request().resourceType()}:${response.url()}`); });
    for (let pass = 1; pass <= repeats; pass += 1) {
      for (const route of routes) {
        const started = Date.now();
        const response = await page.goto(`${base}${route.path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
        const body = await page.locator("body").innerText();
        const title = await page.title();
        const routeErrors = errors.splice(0);
        if (!response || response.status() >= 500) routeErrors.push(`document:${response?.status() ?? "missing"}`);
        if (blockedText.test(body) || blockedText.test(title)) routeErrors.push("shared-error-boundary-visible");
        if (!route.expected.test(body)) routeErrors.push("expected-content-missing");
        if (!await page.locator("main").count()) routeErrors.push("main-landmark-missing");
        results.push({ profile: profile.id, pass, route: route.id, status: response?.status() ?? null, ms: Date.now() - started, errors: routeErrors });
      }
      const reloadErrors = errors.splice(0);
      let reloadBody = "";
      try {
        await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
        reloadBody = await page.locator("body").innerText();
      } catch (error) {
        reloadErrors.push(`reload:${error instanceof Error ? error.message.split("\n")[0] : "failed"}`);
      }
      if (blockedText.test(reloadBody)) reloadErrors.push("shared-error-boundary-visible-after-reload");
      results.push({ profile: profile.id, pass, route: "business-reload", status: null, ms: null, errors: reloadErrors });
    }
    await context.close();
  }
} finally {
  await browser.close();
}

const failed = results.filter((result) => result.errors.length);
console.log(JSON.stringify({ base, repeats, checks: results.length, failed: failed.length, results }, null, 2));
if (failed.length) process.exitCode = 1;
