import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${pathname}-${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

for (const [pathname, expected] of [
  ["/", /כל החופשה, במקום אחד/],
  ["/search", /נופש ברחבי הארץ/],
  ["/business", /אקווה ריזורט/],
  ["/events", /מוצאים מקום לחגוג בו/],
  ["/events/search", /מקומות לאירועים/],
  ["/events/place", /לופט פארטי טיים/],
  ["/favorites", /המקומות שאהבתי/],
  ["/guides", /החופשה הטובה מתחילה ברעיון טוב/],
  ["/guides/article", /איך בוחרים מקום שבאמת מתאים/],
  ["/guides/private-event-checklist", /אירוע במקום פרטי/],
  ["/spas", /מוצאים את הספא שמתאים/],
  ["/hourly", /חדר לכמה שעות/],
  ["/providers", /האנשים שהופכים אירוח לחוויה/],
  ["/activities", /רעיונות טובים ממש ליד החופשה/],
  ["/discover/place", /ספא בוטיק תל אביב/],
]) {
  test(`server renders ${pathname}`, async () => {
    const response = await render(pathname);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    assert.match(await response.text(), expected);
  });
}

test("keeps calendar contexts, real listing ids and maps", async () => {
  const [calendar, searchBox, business, search, eventSearch, eventPlace, data, worldData, worldSwitcher, map, contactActions, magazineData, magazinePage, articlePage, styles] = await Promise.all([
    readFile(new URL("../app/calendar-demo.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/search-box.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/business/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/search/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/events/search/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/events/place/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/site-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/data/world-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/world-switcher.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/listing-map.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/contact-actions.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/magazine-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/guides/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/guides/article/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(calendar, /mode === "home"/);
  assert.match(calendar, /mode === "business"/);
  assert.match(searchBox, /mode="home"/);
  assert.match(business, /businessKind=\{property\.scenario\}/);
  assert.match(business, /URLSearchParams\(location\.search\)\.get\("id"\)/);
  assert.match(search, /setPool/);
  assert.match(eventSearch, /setEventType/);
  assert.equal((data.match(/liveUrl: "https:\/\/www\.vii\.co\.il\//g) || []).length, 20);
  assert.equal((data.match(/roomOptions:/g) || []).length, 10);
  assert.equal((data.match(/name: "(?:אקווה ריזורט, וילת החוף|יחידת סטודיו שני|יחידת סטודיו העמק|סוויטה משפחתית וואנדרפול|יחידת עכו|סוויטות 1\+2|סוויטה משפחתית"|א\.ר סוויטות|סוויטה [1-4]"|חדר שינה"|סוויטת (?:מירון|גאיה|אליה|נועה|יובל|חרמון)|וילת הבשמים|אחוזת השושנים בוטיק)/g) || []).length >= 20, true);
  assert.match(business, /property\.roomOptions\.map/);
  assert.match(business, /חדרים ויחידות/);
  assert.match(business, /מה אפשר לעשות מסביב/);
  assert.match(business, /complementaryItems/);
  assert.match(eventPlace, /ספקים שיכולים להשלים את החגיגה/);
  assert.match(eventPlace, /פרופילים בשלב הזה הם דוגמאות/);
  assert.equal((data.match(/contact: \{ phone:/g) || []).length, 17);
  assert.equal((data.match(/whatsapp:/g) || []).length, 8);
  assert.match(contactActions, /הצג מספר/);
  assert.match(contactActions, /https:\/\/wa\.me\//);
  assert.match(business, /aria-pressed=\{saved\}/);
  assert.match(eventPlace, /aria-pressed=\{saved\}/);
  assert.match(styles, /\.property-title__actions svg\.filled/);
  assert.equal((worldData.match(/sourceName: "ספא פלוס"/g) || []).length, 10);
  assert.equal((worldData.match(/sourceName: "חדרים וי־איי־פי"/g) || []).length, 10);
  assert.match(worldSwitcher, /עוברים עולם/);
  assert.match(searchBox, /SearchWorldTabs/);
  assert.match(map, /basemaps\.cartocdn\.com/);
  assert.match(map, /World_Imagery/);
  assert.match(map, /map-preview-image/);
  assert.match(map, /if \(!enabled\)/);
  assert.equal((magazineData.match(/slug: "/g) || []).length, 10);
  assert.equal((magazineData.match(/checklist: \[/g) || []).length, 10);
  assert.match(magazinePage, /vii-magazine-saved/);
  assert.match(magazinePage, /quizOptions/);
  assert.match(articlePage, /reading-progress/);
  assert.match(articlePage, /vii-magazine-checklist/);
});
