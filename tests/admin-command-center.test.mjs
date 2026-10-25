import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("administration shell exposes command search, growth center and mobile-safe navigation", async () => {
  const [rootLayout, layout, navigation, commandBar, styles] = await Promise.all([
    read("app/layout.tsx"), read("app/admin/layout.tsx"), read("app/admin/admin-nav.tsx"), read("app/admin/admin-command-bar.tsx"), read("app/admin/admin.module.css"),
  ]);
  assert.match(rootLayout, /font-family: "VII Heebo", Arial, sans-serif !important/);
  assert.match(rootLayout, /heebo-hebrew-v28\.woff2/);
  assert.match(rootLayout, /heebo-latin-v28\.woff2/);
  assert.match(rootLayout, /data-vii-surface=\{isAdmin \? "admin" : "public"\}/);
  assert.match(rootLayout, /vii-admin-font-critical/);
  assert.match(layout, /<AdminCommandBar access=\{access\} \/>/);
  assert.match(layout, /adminRouteAllowed\(access, pathname\)/);
  assert.match(layout, /<AdminAccessProvider access=\{access\}>/);
  assert.match(navigation, /\/admin\/growth/);
  assert.match(commandBar, /Ctrl K/);
  assert.match(commandBar, /חיפוש כלי, דוח או פעולה/);
  assert.match(commandBar, /\/api\/auth\/logout/);
  assert.match(commandBar, /method: "POST"/);
  assert.match(commandBar, /window\.location\.replace\("\/account\?loggedOut=1"\)/);
  assert.match(commandBar, /aria-busy=\{logoutState === "loading"\}/);
  assert.match(commandBar, /role="alert"/);
  assert.match(commandBar, /pageshow/);
  assert.match(styles, /\.logoutButton/);
  assert.match(styles, /\.logoutError/);
  assert.match(styles, /@media\(max-width:760px\)/);
  assert.match(styles, /\.commandBackdrop/);
  assert.match(styles, /position:fixed/);
});

test("overview is an operational command center with truthful funnel labels", async () => {
  const [page, route] = await Promise.all([read("app/admin/page.tsx"), read("app/api/admin/overview/route.ts")]);
  for (const label of ["מה כדאי לעשות עכשיו", "חשיפות לעסקים", "כניסות מתוך חשיפה", "פעולה מתוך כניסה", "מרכזי העבודה", "בריאות הקטלוגים", "זרם הפעילות"]) assert.match(page, new RegExp(label));
  assert.match(page, /לא אומדן של אנשים/);
  assert.match(route, /vii_search_demand_events/);
  assert.match(route, /vii_business_events/);
  assert.match(route, /internal = 0/);
});

test("business performance provides filters, explicit funnel ratios and local export", async () => {
  const [page, route] = await Promise.all([read("app/admin/business-performance/page.tsx"), read("app/api/admin/business-performance/route.ts")]);
  for (const behavior of ["exportCsv", "כניסה מתוך חשיפה", "פעולה מתוך כניסה", "מעברים ל-WhatsApp", "ואינן מופיעות כאן כשיחה", "הזמנות מ־VII", "הזמנות מ־Biz", "תאריך הגעה", "משפחת עסקים", "businessReportScopes", "canonicalBusinessReportScope", "conversionFamilySupported", "אין עסקים עם נתוני VII במשפחה ובתקופה שנבחרו", "מקור ההמרות של Biz תומך כרגע", "כל שיחות מסקיו", "כל פניות WhatsApp", "תמונת מצב לתקופה", "פניות והזמנות לפי עסק", "נמצאה הזמנה", "לא נמצאה הזמנה", "פרטי דואר והודעות חופשיות אינם מועברים לדפדפן"]) assert.match(page, new RegExp(behavior));
  assert.match(page, /data-label="עסק"/);
  assert.match(page, /text\/csv/);
  assert.match(route, /upstreamStatus:\s*error\.status/);
  assert.match(route, /SUM\(CASE WHEN name = 'impression' THEN 1 ELSE 0 END\)/);
  assert.match(route, /name = 'phone_click'/);
  assert.match(route, /name = 'whatsapp_handoff'/);
  assert.match(route, /export async function POST/);
  assert.match(route, /body\.targets\.length > 4/);
  assert.match(route, /Promise\.all\(targets\.map/);
  assert.match(route, /sectionOnly: true/);
  assert.match(route, /includeContacts/);
  assert.match(route, /supportedInventory/);
  assert.match(route, /publicCatalogSummaries/);
  assert.match(route, /publicCatalogSummaries<InventoryPlace>\("spa"\)/);
  assert.match(page, /useState\(today\)/);
  assert.match(page, /לא נתמך ב־Biz/);
  assert.match(page, /details: "1"/);
  assert.match(page, /params\.set\("source", contactSource\)/);
  assert.match(page, /params\.set\("converted", contactConverted\)/);
  assert.doesNotMatch(route, /contacts:\s*conversions\.contacts/);
  assert.match(page, /נתוני Biz מאומתים/);
  assert.match(page, /startBizBatch/);
  assert.match(page, /נתונים שכבר נמשכו נשמרים בשרת/);
  assert.match(page, /רענון כפוי מ־Biz/);
  assert.match(page, /stopBizBatch/);
  assert.match(page, /לא נטען/);
  assert.match(page, /נעצרו/);
  assert.doesNotMatch(page, /setBizBatchProgress\(\{ loaded: 0, total: supportedRows\.length/);
  assert.match(page, /bizByPlace\[row\.placeId\]/);
  assert.doesNotMatch(route, /SUM\(name\s*=/);
  assert.doesNotMatch(route, /response\.text\(|response\.json\(\).*console/);
});

test("admin booking status lookup is read-only, private and excludes guest details", async () => {
  const route = await read("app/api/admin/booking-status/route.ts");
  assert.match(route, /authorizedAdminSession/);
  assert.match(route, /method:\s*"GET"|fetch\(`/);
  assert.match(route, /found:\s*false/);
  assert.match(route, /Cache-Control":\s*"private, no-store"/);
  assert.doesNotMatch(route, /guest|phone|email|remarks|response\.text\(/i);
});

test("growth center reports verified local capabilities and honest external connection state", async () => {
  const [page, sitemapDetails, sitemapRoute] = await Promise.all([read("app/admin/growth/page.tsx"), read("app/admin/growth/sitemap-details.tsx"), read("app/api/admin/sitemap/route.ts")]);
  assert.match(page, /\/sitemap\.xml/);
  assert.match(page, /\/robots\.txt/);
  assert.match(page, /Google Search Console/);
  assert.match(page, /Google Analytics 4/);
  assert.match(page, /G-6DMS0FKGYK/);
  assert.match(page, /GTM-WG8VXDB/);
  assert.match(page, /מחובר בהסכמה/);
  assert.match(sitemapDetails, /מה יש בכל קובץ מפת אתר/);
  assert.match(sitemapDetails, /ממגבלת Google/);
  assert.match(sitemapDetails, /דוגמאות לכתובות/);
  assert.match(sitemapRoute, /sitemapAdminReport/);
});

test("content queue retains demand, readiness, priority and direct editing", async () => {
  const page = await read("app/admin/content-queue/page.tsx");
  for (const behavior of ["חיפושים מצטברים", "מוכנות ממוצעת", "העדיפות משלבת ביקוש", "חיפושים", "ייחודיים", "תוצאות", "פתיחה ועריכה"]) assert.match(page, new RegExp(behavior));
  assert.match(page, /\/admin\/search-pages\?id=/);
});
