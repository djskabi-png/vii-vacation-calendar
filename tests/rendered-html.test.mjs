import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/", init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${pathname}-${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${pathname}`, { ...init, headers: { accept: "text/html", ...(init.headers || {}) } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
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
  ["/activities", /בוחרים איך לבלות את היום/],
  ["/trails", /יוצאים מהצימר. נכנסים לישראל היפה/],
  ["/trails/snir-hatzbani", /נחל שניר, חצבאני/],
  ["/discover/place", /ספא בוטיק תל אביב/],
  ["/join", /מביאים את העסק שלכם/],
  ["/contact", /יצירת קשר/],
  ["/accessibility", /הצהרת נגישות/],
]) {
  test(`server renders ${pathname}`, async () => {
    const response = await render(pathname);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    assert.match(await response.text(), expected);
  });
}

test("uses the live production subdomain for public metadata", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /metadataBase: new URL\("https:\/\/vii\.spaplus\.co\/"\)/);
  assert.doesNotMatch(layout, /new\.vii\.co\.il/);
});

test("query-driven detail pages render the requested content on the server", async () => {
  for (const [pathname, expected, unexpected] of [
    ["/business?id=perfumes-villa", /וילת הבשמים/, /אקווה ריזורט/],
    ["/events/place?id=black-loft", /בלאק לופט/, /לופט פארטי טיים/],
    ["/discover/place?id=cassia-jerusalem", /קסיה וולנס וספא/, /ספא בוטיק תל אביב/],
    ["/guides/article?id=family-villa-guide", /איך בוחרים מקום שבאמת מתאים להרכב שלכם/, /אירוע במקום פרטי/],
  ]) {
    const response = await render(pathname);
    const html = await response.text();
    const firstHeading = (html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "").replace(/<[^>]+>/g, "");
    assert.equal(response.status, 200, pathname);
    assert.match(firstHeading, expected, pathname);
    assert.doesNotMatch(firstHeading, unexpected, pathname);
  }
});

test("lead proxy handles bot submissions locally without contacting the lead system", async () => {
  const response = await render("/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ honey: "bot", submissionId: "qa", name: "qa", phone: "000", privacyAccepted: true }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
});

test("keeps calendar contexts, real listing ids and maps", async () => {
  const [calendar, searchBox, business, sleeping, search, eventsPage, eventSearch, eventPlace, data, worldData, worldSwitcher, map, contactActions, homeShowcase, magazineData, magazinePage, articlePage, styles] = await Promise.all([
    readFile(new URL("../app/calendar-demo.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/search-box.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/sleeping-arrangements.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/search/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/events/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/events/search/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/events/place/client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/site-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/data/world-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/world-switcher.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/listing-map.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/contact-actions.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/home-showcase.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/magazine-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/guides/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/guides/article/client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(calendar, /mode === "home"/);
  assert.match(calendar, /mode === "business"/);
  assert.match(searchBox, /mode="home"/);
  assert.match(business, /businessKind=\{property\.scenario\}/);
  assert.match(business, /<SearchBox compact \/>/);
  assert.match(business, /initialSlug/);
  assert.doesNotMatch(business, /URLSearchParams\(location\.search\)/);
  assert.match(search, /setPool/);
  assert.match(eventSearch, /setEventType/);
  assert.equal((data.match(/liveUrl: "https:\/\/www\.vii\.co\.il\//g) || []).length, 20);
  assert.equal((data.match(/roomOptions:/g) || []).length, 10);
  assert.equal((data.match(/name: "(?:אקווה ריזורט, וילת החוף|יחידת סטודיו שני|יחידת סטודיו העמק|סוויטה משפחתית וואנדרפול|יחידת עכו|סוויטות 1\+2|סוויטה משפחתית"|א\.ר סוויטות|סוויטה [1-4]"|חדר שינה"|סוויטת (?:מירון|גאיה|אליה|נועה|יובל|חרמון)|וילת הבשמים|אחוזת השושנים בוטיק)/g) || []).length >= 20, true);
  assert.match(business, /property\.roomOptions\.map/);
  assert.match(business, /סוויטות ויחידות/);
  assert.match(business, /property\.sleepingArrangements/);
  assert.doesNotMatch(business, /property\.roomOptions\?\.length && !property\.sleepingArrangements/);
  assert.match(business, /room-card__sleeping/);
  assert.match(business, /חדרי השינה בתוך היחידה/);
  assert.match(business, /לצפייה בפירוט החדרים, המיטות והתמונות/);
  assert.doesNotMatch(business, /href=\{property\.liveUrl\}/);
  assert.doesNotMatch(eventPlace, /href=\{place\.liveUrl\}/);
  assert.doesNotMatch(business, /לכל פרטי המקום|לצפייה בעמוד המקור/);
  assert.doesNotMatch(eventPlace, /מעבר לעמוד המקור|צפייה בפרטים באתר הקיים/);
  const legalPages = (await Promise.all([
    readFile(new URL("../app/legal/cancellation/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/legal/privacy/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/legal/terms/page.tsx", import.meta.url), "utf8"),
  ])).join("\n");
  assert.doesNotMatch(legalPages, /href=["']https:\/\/www\.vii\.co\.il/);
  assert.match(sleeping, /איפה ישנים\?/);
  assert.match(sleeping, /כל כרטיס מייצג חדר שינה ולא יחידת אירוח/);
  assert.match(sleeping, /alt=\{`\$\{arrangement\.name\} ב\$\{placeName\}`\}/);
  assert.equal((data.match(/name: "חדר שינה [1-9]"/g) || []).length, 9);
  assert.equal((data.match(/galleryImage: "https:\/\/www\.vii\.co\.il\/gallery\/thumb\/600\//g) || []).length, 9);
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
  assert.match(searchBox, /בחרו כמות משתתפים/);
  assert.doesNotMatch(searchBox, /mode === "events" \? 40/);
  assert.match(eventsPage, /<SearchBox mode="events" showWorlds \/>/);
  assert.match(map, /basemaps\.cartocdn\.com/);
  assert.match(map, /World_Imagery/);
  assert.match(map, /map-preview-image/);
  assert.match(map, /if \(!enabled\)/);
  assert.match(map, /autoLoad/);
  assert.match(search, /<ListingMap listings=\{filtered\} autoLoad \/>/);
  assert.match(search, /האזור שמוצג במפה/);
  assert.match(eventSearch, /mode="events" autoLoad/);
  assert.match(eventSearch, /const \[guests, setGuests\] = useState\(0\)/);
  assert.match(eventSearch, /ללא סינון לפי כמות/);
  assert.match(eventPlace, /fetch\("\/api\/leads\/"/);
  assert.match(eventPlace, /privacyAccepted/);
  assert.doesNotMatch(eventPlace, /defaultValue=\{Math\.min\(40/);
  assert.equal((magazineData.match(/slug: "/g) || []).length, 10);
  assert.equal((magazineData.match(/checklist: \[/g) || []).length, 10);
  assert.match(magazinePage, /vii-magazine-saved/);
  assert.match(magazinePage, /quizOptions/);
  assert.match(articlePage, /reading-progress/);
  assert.match(articlePage, /vii-magazine-checklist/);
  assert.match(homeShowcase, /מומלצים שכדאי להכיר/);
  assert.match(homeShowcase, /ספונטניים לרגע האחרון/);
  assert.match(homeShowcase, /כל סיבה טובה הופכת כאן לאירוע/);
  assert.match(homeShowcase, /spaPlaces\.slice/);
  assert.match(homeShowcase, /hourlyPlaces\.slice/);
  assert.match(homeShowcase, /המחיר והזמינות הסופיים יאומתו/);
});

test("footer destinations and lead forms have real destinations", async () => {
  const [footer, form, contact, join, cookieConsent] = await Promise.all([
    readFile(new URL("../app/components/site-footer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/lead-intake-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/contact/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/join/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/cookie-consent.tsx", import.meta.url), "utf8"),
  ]);
  for (const href of ["/search/", "/events/", "/spas/", "/hourly/", "/providers/", "/activities/", "/trails/", "/join/", "/contact/", "/guides/", "/accessibility/", "/legal/terms/", "/legal/privacy/", "/legal/cancellation/"]) {
    assert.match(footer, new RegExp(`href=["']${href.replaceAll("/", "\\/")}`));
  }
  assert.match(form, /const endpoint = "\/api\/leads\/"/);
  const leadRoute = await readFile(new URL("../app/api/leads/route.ts", import.meta.url), "utf8");
  assert.match(leadRoute, /https:\/\/app\.spaplus\.co\/api\/integrations\/vii-leads/);
  assert.match(leadRoute, /sourceSite: "vii\.co\.il"/);
  assert.match(form, /privacyAccepted/);
  assert.match(form, /crypto\.randomUUID\(\)/);
  assert.match(form, /state === "success"/);
  assert.match(contact, /LeadIntakeForm purpose="contact"/);
  assert.match(join, /LeadIntakeForm purpose="join"/);
  assert.match(cookieConsent, /SETTINGS_HASH = "#privacy-settings"/);
  assert.match(cookieConsent, /window\.addEventListener\("hashchange", openFromHash\)/);
  assert.match(cookieConsent, /href=\{SETTINGS_HASH\}/);
});

test("independent trails are sourced, filterable and connected to stays", async () => {
  const [data, listing, detail, activities, home, business, header, footer, styles] = await Promise.all([
    readFile(new URL("../app/data/trail-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/trails/trails-explorer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/trails/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/activities/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/home-showcase.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/site-header.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/site-footer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.equal((data.match(/officialSource: "https:\/\/www\.parks\.org\.il\//g) || []).length, 13);
  assert.equal((data.match(/sourceName: "רשות הטבע והגנים"/g) || []).length, 13);
  assert.equal((data.match(/difficulty: "/g) || []).length, 13);
  assert.equal((data.match(/duration: "/g) || []).length, 13);
  assert.equal((data.match(/safety: \[/g) || []).length, 13);
  assert.match(listing, /סינון מסלולי טיול/);
  assert.match(listing, /setDifficulty/);
  assert.match(listing, /setNature/);
  assert.match(detail, /המידע אינו אישור שהמסלול פתוח כרגע/);
  assert.match(detail, /officialSource/);
  assert.match(detail, /פתיחת נקודת ההתחלה במפה/);
  assert.match(activities, /מסלולי טיול עצמאיים/);
  assert.match(activities, /אטרקציות בתשלום/);
  assert.match(home, /מסלולים ליד החופשה/);
  assert.match(business, /nearbyTrails/);
  assert.match(business, /מסלולים באזור/);
  assert.match(header, /href="\/trails\/"/);
  assert.match(footer, /href="\/trails\/"/);
  assert.match(styles, /\.trail-filters/);
  assert.match(styles, /\.trail-detail__layout/);
});

test("all trail guides render as public pages", async () => {
  const slugs = ["snir-hatzbani", "banias-middle", "el-al-waterfalls", "tel-dan-short", "ein-afek-wetland", "dor-habonim-coast", "jordan-river-bridges", "har-kfir", "tzur-natan", "ein-prat", "nahal-masor", "mamshit-stream", "nahal-sfunim"];
  for (const slug of slugs) {
    const response = await render(`/trails/${slug}`);
    assert.equal(response.status, 200, slug);
    const html = await response.text();
    assert.match(html, /מקור רשמי ומבזקים/, slug);
    assert.match(html, /application\/ld\+json/, slug);
  }
});

test("includes the accessibility system and honest place disclosures", async () => {
  const [widget, statement, data, listing, header, footer, propertyCard, searchPage, business, eventSearch, eventPlace, discoveryCard, discoveryPlace, styles] = await Promise.all([
    readFile(new URL("../app/components/accessibility-widget.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/accessibility/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/accessibility-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/listing-accessibility.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/site-header.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/site-footer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/property-card.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/search/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/events/search/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/events/place/client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/discovery-card.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/discover/place/client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(widget, /vii-accessibility-settings/);
  assert.match(widget, /aria-modal="true"/);
  assert.match(widget, /event\.key === "Escape"/);
  assert.match(widget, /a11y-high-contrast/);
  assert.match(widget, /a11y-pause-motion/);
  assert.match(widget, /a11y-visible-focus/);
  assert.match(statement, /תקן הישראלי 5568/);
  assert.match(statement, /WCAG 2\.0/);
  assert.match(statement, /פרטי רכז הנגישות טרם נמסרו/);
  assert.match(statement, /נמצאת בתהליך השלמה/);
  assert.equal((data.match(/"(?:aqua-resort|kesem-harimon|ahuzat-or|ar-suites|sol-gilgal|infinity-suites|magic-garden-gefen|anael-estate|perfumes-villa|rose-estate|party-time|black-loft|sani-loft|360-events|loft-117|fiesta|details-events|star-loft|puzzle-club|paphos-events)"/g) || []).length, 20);
  assert.match(data, /status: "unknown"/);
  assert.match(listing, /האם המקום נגיש/);
  assert.match(header, /<AccessibilityWidget/);
  assert.match(footer, /href="\/accessibility\/"/);
  assert.doesNotMatch(propertyCard, /ListingAccessibility/);
  assert.match(searchPage, /נגישות מלאה ומאומתת/);
  assert.match(business, /ListingAccessibility slug=\{property\.slug\}/);
  assert.doesNotMatch(eventSearch, /ListingAccessibility/);
  assert.match(eventSearch, /נגישות מלאה ומאומתת/);
  assert.match(eventPlace, /ListingAccessibility slug=\{place\.slug\}/);
  assert.doesNotMatch(discoveryCard, /ListingAccessibility/);
  assert.match(discoveryPlace, /ListingAccessibility slug=\{item\.id\}/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /accessibility-status-explainer/);
});
