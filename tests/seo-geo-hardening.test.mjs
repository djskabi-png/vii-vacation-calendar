import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import edgeWorker from "../services/vii-edge-delivery/src/index.ts";

test("event metadata keeps the verified venue identity when no approved translation exists", async () => {
  const source = await readFile(new URL("../app/i18n/localized-event-place.ts", import.meta.url), "utf8");
  assert.match(source, /latinBusinessAlias\(place\.name\) \|\| place\.name/);
  assert.doesNotMatch(source, /latinBusinessAlias\(place\.name\) \|\| fallback\.name/);
});

test("organization and website schemas expose a factual answer-engine entity graph", async () => {
  const source = await readFile(new URL("../app/lib/seo.ts", import.meta.url), "utf8");
  assert.match(source, /areaServed:[\s\S]*name: "Israel"/);
  assert.match(source, /hasOfferCatalog:[\s\S]*OfferCatalog/);
  assert.match(source, /about: \{ "@id": ORGANIZATION_ID \}/);
  assert.match(source, /publisher: \{ "@id": ORGANIZATION_ID \}/);
});

test("AI discovery copy describes verified availability instead of an obsolete disconnected state", async () => {
  const [short, full] = await Promise.all([
    readFile(new URL("../public/llms.txt", import.meta.url), "utf8"),
    readFile(new URL("../public/llms-full.txt", import.meta.url), "utf8"),
  ]);
  assert.match(short, /ממטמון מאומת שעדיין בתוקף/);
  assert.match(full, /בודק אותם מחדש לפני הזמנה/);
  assert.doesNotMatch(full, /לפני השלמת החיבור למערכת הניהול/);
});

test("visible control names remain part of their accessible names", async () => {
  const [worlds, locale, accessibility] = await Promise.all([
    readFile(new URL("../app/components/world-switcher.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n/locale-provider.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/accessibility-widget.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(worlds, /aria-label=\{`\$\{translate\("עוד"\)\}, \$\{translate\("עולמות נוספים"\)\}`\}/);
  assert.match(locale, /aria-label=\{`\$\{labels\[language\]\}, \$\{chooserLabels\[language\]\}`\}/);
  assert.match(accessibility, /triggerLabel = `\$\{placement === "icon" \? "" : "כלי נגישות, "\}פתיחת כלי הנגישות`/);
});

test("edge delivery applies compatible public security headers", async () => {
  const edge = await readFile(new URL("../services/vii-edge-delivery/src/index.ts", import.meta.url), "utf8");
  for (const header of ["X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Strict-Transport-Security"])
    assert.match(edge, new RegExp(header));
  assert.match(edge, /publicSecurityHeaders\(await serve\(request, env, ctx\), request\)/);
});

test("managed event landing pages render their own breadcrumb and collection schemas", async () => {
  const source = await readFile(new URL("../app/events/search/page.tsx", import.meta.url), "utf8");
  assert.match(source, /managedPath \? <>[\s\S]*breadcrumbSchema/);
  assert.match(source, /landingTitle \|\| eventHeading/);
  assert.match(source, /localizedPath\(managedPath, language\)/);
  assert.match(source, /collectionSchema\(/);
});

test("SEO audit does not classify managed event routes as vacation pages", async () => {
  const source = await readFile(new URL("../scripts/audit-public-seo.mjs", import.meta.url), "utf8");
  assert.match(source, /!localeFreeRoute\.startsWith\("\/search\/events\/"\)/);
});

test("edge security headers are present on the actual browser-facing response", async () => {
  const previousFetch = globalThis.fetch;
  const previousCaches = globalThis.caches;
  globalThis.caches = { default: { async match() { return undefined; }, async put() {} } };
  globalThis.fetch = async () => new Response("<html>ok</html>", { status: 200, headers: {
    "Content-Type": "text/html; charset=utf-8",
    "X-VII-Cache-Build": "test-build",
    "X-VII-Cache-Until": String(Date.now() + 60_000),
  } });
  try {
    const response = await edgeWorker.fetch(
      new Request("https://vii.spaplus.co/search", { headers: { Accept: "text/html" } }),
      { ORIGIN: "https://vii-vacation-calendar.adir-naor-7510.chatgpt.site", EXPECTED_BUILD: "test-build" },
      { waitUntil() {} },
    );
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(response.headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
    assert.equal(response.headers.get("Permissions-Policy"), "camera=(), microphone=(), payment=(), usb=()");
    assert.match(response.headers.get("Strict-Transport-Security"), /max-age=31536000/);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.caches = previousCaches;
  }
});
