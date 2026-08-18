import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../app/platform/platform-explorer.tsx", import.meta.url);
const cssUrl = new URL("../app/platform/platform.module.css", import.meta.url);

async function renderPlatform() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `platform-${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/platform", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("platform blueprint renders the approved database, truth labels and complete worlds", async () => {
  const response = await renderPlatform();
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /AURORA POSTGRESQL/);
  assert.match(html, /האם האתר שכבר בנינו עובד ככה היום\? עדיין לא/);
  assert.match(html, /438/);
  for (const world of ["VACATIONS", "EVENTS", "ROOMS VIP", "SPA", "ATTRACTIONS", "TRIPS", "SUPPLIERS", "MAGAZINE"]) {
    assert.match(html, new RegExp(world));
  }
});

test("platform source preserves decision truth and every required operational lane", async () => {
  const source = await readFile(sourceUrl, "utf8");
  for (const required of [
    "Amazon Aurora PostgreSQL Serverless v2",
    "il-central-1",
    "Workers VPC",
    "35 יום",
    "TRANSLATION PIPELINE",
    "AUTOMATIC BUG DETECTION",
    "BOOKINGS ONLY",
    "כתיבת חוות דעת חזרה לא אושרה",
    "20,000 TO 30,000 LEGACY URLS",
    "תשובת 410",
    "ניטור 90 יום",
    "מערכת הניהול של אדיר",
    "אלה דוגמאות סינתטיות ומדומות, לא נתוני ספק.",
    "$0.14 / GB-MONTH",
    "platform-architecture-v316.avif",
  ]) assert.match(source, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.match(source, /name: "REDIS"[\s\S]*?decision: "open"/);
  assert.match(source, /name: "SEARCH VENDOR"[\s\S]*?decision: "open"/);
  assert.doesNotMatch(source, /name: "POSTGRESQL \+ SQL"/);
  assert.doesNotMatch(source, /name: "OPENSEARCH"/);
});

test("all explanation controls use the no-jump accessible dialog family", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /aria-haspopup="dialog"/);
  assert.match(source, /aria-describedby="platform-modal-description"/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /previousFocusRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /document\.body\.style\.position = "fixed"/);
  assert.match(source, /window\.scrollTo\(0, previousScrollY\)/);
  assert.match(source, /event\.target === event\.currentTarget/);
  assert.doesNotMatch(source, /onMouseDown=/);
});

test("platform mobile controls and typography keep release-safe minimums", async () => {
  const css = await readFile(cssUrl, "utf8");
  assert.match(css, /\.orbitWorld \{[^}]*min-height: 44px;/s);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.orbitWorld \{[^}]*min-height: 44px;/s);
  assert.match(css, /\.modalClose \{[^}]*width: 46px;[^}]*height: 46px;/s);
  assert.match(css, /font-family: Rubik, Heebo, Assistant, Arial, sans-serif;/);
  assert.doesNotMatch(css, /font-family:[^;]*(?:^|[\s,])(?:serif|cursive|fantasy)(?=[,;])/im);
});

test("platform route remains deliberately excluded from indexing", async () => {
  const page = await readFile(new URL("../app/platform/page.tsx", import.meta.url), "utf8");
  assert.match(page, /robots: \{ index: false, follow: false/);
  assert.match(page, /canonical: "\/platform"/);
});

test("Hilat Hanof case study maps verified VII data to a proposed Sergey contract", async () => {
  const source = await readFile(sourceUrl, "utf8");
  for (const required of [
    "הילת הנוף, ממקור נתונים לעמוד אמיתי ב־VII",
    "חוזה סרגיי מוצע",
    "החיבור לסרגיי עדיין אינו פעיל",
    "46 קובצי מדיה",
    "ארבע בקתות ומבנה חדרים",
    "מידע הנגישות עצמו מוצג כיום כטרם אומת",
    "בדיקת עקביות אמיתית",
    "פירוט ארבע היחידות מכיל אחד, אחד, אחד ושניים",
    "/business?id=hilat-hanof",
    "https://www.vii.co.il/hilat_hanof",
    "Idempotency-Key: vii_booking_<stable-id>",
    "מקורם בעמוד ובמאגר VII הנוכחיים",
  ]) assert.match(source, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.match(source, /supplierVenueId: '<Sergey ID to confirm>'/);
  assert.doesNotMatch(source, /supplierVenueId: ['"]11['"]/);
  assert.doesNotMatch(source, /\/discover\/place\/hilat-hanof/);
  assert.match(source, /hilatPageComponents\.map/);
  assert.match(source, /selectInsight\(insight\).*aria-haspopup="dialog" aria-controls="platform-detail-dialog"/s);
});

test("Hilat Hanof visual uses source-backed local media and a responsive mobile composition", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const css = await readFile(cssUrl, "utf8");
  assert.match(source, /\/media\/hilat-hanof\/87686399e3d2342\.jpg/);
  assert.match(source, /\/media\/hilat-hanof\/495f7c268eb4431\.jpeg/);
  assert.match(source, /\/media\/hilat-hanof\/845f7c268dc8ca2\.jpeg/);
  assert.match(css, /\.hilatJourney \{[^}]*grid-template-columns:/s);
  assert.match(css, /@media \(max-width: 1050px\)[\s\S]*?\.hilatJourney \{ grid-template-columns: 1fr; \}/s);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.hilatComponentGrid \{ grid-template-columns: 1fr; \}/s);
  assert.match(css, /\.hilatLiveLink \{[^}]*min-height: 46px;/s);
});
