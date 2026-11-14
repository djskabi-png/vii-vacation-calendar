import fs from "node:fs";
import { chromium } from "playwright";

const base = (process.argv.find((value) => value.startsWith("--base="))?.slice(7) || "http://127.0.0.1:4191").replace(/\/$/, "");
const repeats = Math.max(1, Math.min(5, Number(process.argv.find((value) => value.startsWith("--repeats="))?.slice(10) || 2)));
const routes = [
  { id: "home", path: "/", expected: /נופש|חיפושים פופולריים/ },
  { id: "vacations", path: "/vacations/north", expected: /נופש|צפון/ },
  { id: "vacation-search", path: "/search?location=צפון", expected: /נופש|צפון|מקומות/ },
  { id: "vacation-dated-online", path: "/search/?location=%D7%9B%D7%9C+%D7%94%D7%90%D7%A8%D7%A5&from=2026-11-27&till=2026-11-28&guests=2&online=1", expected: /נופש|מקומות|זמינות/ },
  { id: "vacation-period", path: "/weekend/friday-to-sunday", expected: /נופש|שישי|ראשון/ },
  { id: "events", path: "/events", expected: /אירועים/ },
  { id: "event-search", path: "/events/search/center", expected: /אירועים|מרכז/ },
  { id: "spas", path: "/spas", expected: /ספא/ },
  { id: "spa-search", path: "/spas/search/center", expected: /ספא|מרכז/ },
  { id: "hourly", path: "/hourly", expected: /חדרים|שעה/ },
  { id: "hourly-search", path: "/hourly/search/center", expected: /חדרים|שעה|מרכז/ },
  { id: "business", path: "/business?id=vacation-164", expected: /אחוזת הספא|פרטי הלינה במקום|על המקום/ },
  { id: "event-place", path: "/events/place/event-680", expected: /אירוע|מתחם/ },
  { id: "spa-place", path: "/discover/place/spa-6", expected: /ספא/ },
  { id: "hourly-place", path: "/discover/place/hourly-475", expected: /חדר|שעה/ },
  { id: "holidays", path: "/holidays", expected: /חגים|תקופות|נופש/ },
  { id: "holiday", path: "/holidays/new-years-eve", expected: /סילבסטר|נופש|2026/ },
  { id: "guides", path: "/guides", expected: /מדריכים|כתבות|מגזין/ },
  { id: "guide", path: "/guides/vacations-family-planning", expected: /נופש|משפחה|חופשה/ },
  { id: "attractions", path: "/attractions", expected: /אטרקציות|פעילויות/ },
  { id: "trails", path: "/trails", expected: /טיולים|מסלולים/ },
  { id: "providers", path: "/providers", expected: /ספקים|אירועים/ },
  { id: "gift-card", path: "/gift-card", expected: /גיפט|מתנה|שובר/ },
  { id: "favorites", path: "/favorites", expected: /אהבתי|צפיתי|המקומות/ },
  { id: "account", path: "/account", expected: /חשבון|כניסה|פרופיל/ },
  { id: "contact", path: "/contact", expected: /פרסום|הצטרפות|שיתוף פעולה|פרטי קשר/ },
  { id: "legal", path: "/legal/privacy", expected: /פרטיות|מדיניות/ },
  { id: "admin-login", path: "/admin/login", expected: /כניסה|ניהול|מנהל/ },
  { id: "not-found", path: "/qa-route-that-does-not-exist", expected: /לא נמצא|404|חזרה/ },
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
    let activeRouteId = "";
    page.on("console", (message) => {
      if (activeRouteId === "not-found" && message.type() === "error" && (/qa-route-that-does-not-exist/.test(message.text()) || /Failed to load resource/.test(message.text()))) return;
      if (message.type() === "error" || (message.type() === "warning" && /same key|hydration|uncaught/i.test(message.text()))) {
        const location = message.location();
        errors.push(`console:${message.type()}:${message.text()}:${location.url || "unknown-source"}`);
      }
    });
    page.on("pageerror", (error) => errors.push(`pageerror:${error.message}`));
    page.on("response", (response) => {
      const expectedNotFound = activeRouteId === "not-found" && response.status() === 404 && response.request().resourceType() === "document";
      if (response.status() >= 400 && !expectedNotFound) errors.push(`http:${response.status()}:${response.request().resourceType()}:${response.url()}`);
    });
    for (let pass = 1; pass <= repeats; pass += 1) {
      for (const route of routes) {
        activeRouteId = route.id;
        const started = Date.now();
        let response;
        let body = "";
        let title = "";
        const routeErrors = errors.splice(0);
        try {
          response = await page.goto(`${base}${route.path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
          // A discovery page can legitimately keep background refreshes alive.
          // Give visible runtime failures a bounded observation window without
          // serially waiting fifteen seconds for an idle state that may never
          // exist on every route.
          await page.waitForLoadState("networkidle", { timeout: 4_000 }).catch(() => undefined);
          await page.waitForTimeout(500);
          body = await page.locator("body").innerText();
          title = await page.title();
        } catch (error) {
          routeErrors.push(`navigation:${error instanceof Error ? error.message.split("\n")[0] : "failed"}`);
        }
        routeErrors.push(...errors.splice(0));
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
