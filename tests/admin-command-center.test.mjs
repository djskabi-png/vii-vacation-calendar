import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("administration shell exposes command search, growth center and mobile-safe navigation", async () => {
  const [layout, navigation, commandBar, styles] = await Promise.all([
    read("app/admin/layout.tsx"), read("app/admin/admin-nav.tsx"), read("app/admin/admin-command-bar.tsx"), read("app/admin/admin.module.css"),
  ]);
  assert.match(layout, /<AdminCommandBar \/>/);
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
  const page = await read("app/admin/business-performance/page.tsx");
  for (const behavior of ["exportCsv", "כניסה מתוך חשיפה", "פעולה מתוך כניסה", "לידי WhatsApp שנשמרו", "אינם מציגים פתיחת WhatsApp כשיחה שנשלחה"]) assert.match(page, new RegExp(behavior));
  assert.match(page, /data-label="עסק"/);
  assert.match(page, /text\/csv/);
});

test("growth center reports verified local capabilities and honest external connection state", async () => {
  const page = await read("app/admin/growth/page.tsx");
  assert.match(page, /\/sitemap\.xml/);
  assert.match(page, /\/robots\.txt/);
  assert.match(page, /Google Search Console/);
  assert.match(page, /Google Analytics 4/);
  assert.match(page, /לא הוכח חיבור פעיל/);
  assert.match(page, /לא אומת/);
});

test("content queue retains demand, readiness, priority and direct editing", async () => {
  const page = await read("app/admin/content-queue/page.tsx");
  for (const behavior of ["חיפושים מצטברים", "מוכנות ממוצעת", "העדיפות משלבת ביקוש", "חיפושים", "ייחודיים", "תוצאות", "פתיחה ועריכה"]) assert.match(page, new RegExp(behavior));
  assert.match(page, /\/admin\/search-pages\?id=/);
});
