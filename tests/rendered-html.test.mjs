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
  ["/events/place", /בלאק לופט/],
  ["/favorites", /המקומות שאהבתי/],
  ["/guides", /החופשה הטובה מתחילה ברעיון טוב/],
  ["/guides/article", /איך בוחרים מקום שבאמת מתאים/],
  ["/guides/private-event-checklist", /אירוע במקום פרטי/],
  ["/spas", /מוצאים את הספא שמתאים/],
  ["/hourly", /חדר לכמה שעות/],
  ["/providers", /מוצאים ספק שמתאים בדיוק לאירוע/],
  ["/activities", /בוחרים איך לבלות את היום/],
  ["/trails", /יוצאים מהצימר. נכנסים לישראל היפה/],
  ["/trails/snir-hatzbani", /נחל שניר, חצבאני/],
  ["/discover/place", /ספא בוטיק תל אביב/],
  ["/join", /העמוד של העסק שלכם יכול להתחיל לעלות כבר עכשיו/],
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

test("removed places stay out of the public catalogs and magazine", async () => {
  const [searchResponse, eventSearchResponse, guidesResponse, sitemapResponse, removedResponse] = await Promise.all([
    render("/search"),
    render("/events/search"),
    render("/guides"),
    render("/sitemap.xml", { headers: { accept: "application/xml" } }),
    render("/business?id=infinity-suites"),
  ]);
  const [searchHtml, eventSearchHtml, guidesHtml, sitemapXml] = await Promise.all([
    searchResponse.text(),
    eventSearchResponse.text(),
    guidesResponse.text(),
    sitemapResponse.text(),
  ]);
  assert.doesNotMatch(searchHtml, /infinity-suites|e65d757e686fda64/i);
  assert.doesNotMatch(eventSearchHtml, /party-time|לופט פארטי טיים|95d6a4d598adae11/i);
  assert.doesNotMatch(guidesHtml, /e65d757e686fda64/i);
  assert.doesNotMatch(sitemapXml, /infinity-suites/i);
  assert.equal(removedResponse.status, 404);
});

test("hourly search starts with location and exposes filters only with the results", async () => {
  const response = await render("/hourly?location=מרכז");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /חיפוש חדרים לפי שעה/);
  assert.match(html, /עיר או אזור/);
  assert.match(html, /סינון התוצאות/);
  assert.match(html, /מחיר התחלתי עד/);
  assert.match(html, /כניסה עצמאית/);
  assert.match(html, /תצוגה על מפה/);
  assert.doesNotMatch(html, /בחרו תאריכים/);
});

test("spa, hourly and event worlds expose interactive maps", async () => {
  const [spaResponse, hourlyResponse, eventResponse, spaDetailResponse] = await Promise.all([
    render("/spas"),
    render("/hourly"),
    render("/events/search"),
    render("/discover/place?id=spa-butik-tlv"),
  ]);
  for (const response of [spaResponse, hourlyResponse, eventResponse, spaDetailResponse]) assert.equal(response.status, 200);
  assert.match(await spaResponse.text(), /תצוגה על מפה/);
  assert.match(await hourlyResponse.text(), /תצוגה על מפה/);
  assert.match(await eventResponse.text(), /תצוגה על מפה/);
  const detail = await spaDetailResponse.text();
  assert.match(detail, /המקום על המפה/);
  assert.match(detail, /פתיחת המפה/);

  const [mapSource, worldData, hourlyResults, worldResults] = await Promise.all([
    readFile(new URL("../app/components/listing-map.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/world-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/hourly-results.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/world-map-results.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(mapSource, /scrollWheelZoom: true/);
  assert.match(mapSource, /touchZoom: true/);
  assert.match(mapSource, /MapTone = "vacation" \| "events" \| "spa" \| "hourly"/);
  assert.match(mapSource, /map-tone--\$\{tone\}/);
  assert.equal((worldData.match(/mapPrecision: "area"/g) || []).length, 20);
  assert.match(hourlyResults, /<DiscoveryMap items=\{filtered\} tone="hourly" autoLoad \/>/);
  assert.match(worldResults, /<DiscoveryMap items=\{items\} tone=\{world\} autoLoad \/>/);
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
  assert.doesNotMatch(data, /liveUrl|https:\/\/www\.vii\.co\.il\//);
  assert.equal((data.match(/roomOptions:/g) || []).length, 10);
  assert.equal((data.match(/name: "(?:אקווה ריזורט, וילת החוף|יחידת סטודיו שני|יחידת סטודיו העמק|סוויטה משפחתית וואנדרפול|יחידת עכו|סוויטות 1\+2|סוויטה משפחתית"|א\.ר סוויטות|סוויטה [1-4]"|חדר שינה"|סוויטת (?:מירון|גאיה|אליה|נועה|יובל|חרמון)|וילת הבשמים|אחוזת השושנים בוטיק)/g) || []).length >= 20, true);
  assert.match(business, /property\.roomOptions\.map/);
  assert.match(business, /סוויטות ויחידות/);
  assert.match(business, /property\.sleepingArrangements/);
  assert.doesNotMatch(business, /property\.roomOptions\?\.length && !property\.sleepingArrangements/);
  assert.match(business, /room-card__sleeping/);
  assert.match(business, /חדרי השינה בתוך היחידה/);
  assert.match(business, /לצפייה בפירוט החדרים, המיטות והתמונות/);
  assert.doesNotMatch(business, /www\.vii\.co\.il/);
  assert.doesNotMatch(eventPlace, /www\.vii\.co\.il/);
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
  assert.equal((data.match(/galleryImage: "\/media\/[a-f0-9]{16}\.(?:jpe?g|png)"/g) || []).length, 9);
  assert.match(business, /מה אפשר לעשות מסביב/);
  assert.match(business, /complementaryItems/);
  assert.match(eventPlace, /ספקים שיכולים להשלים את החגיגה/);
  assert.match(eventPlace, /הפרטים מבוססים על מידע ציבורי/);
  assert.equal((data.match(/contact: \{ phone:/g) || []).length, 17);
  assert.equal((data.match(/whatsapp:/g) || []).length, 8);
  assert.match(contactActions, /הצג מספר/);
  assert.match(contactActions, /https:\/\/wa\.me\//);
  assert.match(business, /aria-pressed=\{saved\}/);
  assert.match(eventPlace, /aria-pressed=\{saved\}/);
  assert.match(styles, /\.property-title__actions svg\.filled/);
  assert.equal((worldData.match(/sourceName: "ספא פלוס"/g) || []).length, 10);
  assert.equal((worldData.match(/sourceName: "חדרים וי־איי־פי"/g) || []).length, 10);
  assert.match(worldSwitcher, /בחירת עולם/);
  assert.match(worldSwitcher, /מה מחפשים\?/);
  assert.match(worldSwitcher, /aria-current/);
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

test("keeps every date dialog above the site header with a reachable close action", async () => {
  const [vacationCalendar, eventCalendar, spaCalendar, styles] = await Promise.all([
    readFile(new URL("../app/calendar-demo.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/event-date-picker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/spa-date-picker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  for (const calendar of [vacationCalendar, eventCalendar, spaCalendar]) {
    assert.match(calendar, /createPortal\(/);
    assert.match(calendar, /document\.body/);
    assert.match(calendar, /dialog-close/);
  }

  assert.match(styles, /\.calendar-overlay\s*\{[^}]*z-index:\s*10000/s);
  assert.match(styles, /\.calendar-dialog-header\s*\{[^}]*position:\s*sticky/s);
});

test("footer destinations and lead forms have real destinations", async () => {
  const [footer, form, contact, join, onboarding, cookieConsent] = await Promise.all([
    readFile(new URL("../app/components/site-footer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/lead-intake-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/contact/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/join/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/join/partner-onboarding.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/cookie-consent.tsx", import.meta.url), "utf8"),
  ]);
  for (const href of ["/search", "/events", "/spas", "/hourly", "/providers", "/activities", "/trails", "/join", "/contact", "/guides", "/accessibility", "/legal/terms", "/legal/privacy", "/legal/cancellation"]) {
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
  assert.match(join, /PartnerOnboarding/);
  assert.match(onboarding, /LeadIntakeForm purpose="join"/);
  assert.match(onboarding, /selectedPackage=\{selectionLabel\}/);
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
  assert.match(header, /href="\/trails"/);
  assert.match(footer, /href="\/trails"/);
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
  assert.equal((data.match(/"(?:aqua-resort|kesem-harimon|ahuzat-or|ar-suites|sol-gilgal|magic-garden-gefen|anael-estate|perfumes-villa|rose-estate|party-time|black-loft|sani-loft|360-events|loft-117|fiesta|details-events|star-loft|puzzle-club|paphos-events)"/g) || []).length, 19);
  assert.match(data, /status: "unknown"/);
  assert.match(listing, /האם המקום נגיש/);
  assert.doesNotMatch(header, /<AccessibilityWidget/);
  assert.match(header, /<LanguageSwitcher compact/);
  assert.match(footer, /href="\/accessibility"/);
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

test("ships a favicon, three languages and no dependency on the retired site", async () => {
  const [layout, locale, translations, header, footer, contactActions, data, worldData, favicon] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n/locale-provider.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n/translations.generated.json", import.meta.url), "utf8"),
    readFile(new URL("../app/site-header.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/site-footer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/contact-actions.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/site-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/data/world-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/favicon.ico", import.meta.url)),
  ]);
  const dictionaries = JSON.parse(translations);
  assert.match(layout, /icons:\s*\{\s*icon:/);
  assert.equal(favicon.length > 0, true);
  assert.match(layout, /<LocaleProvider>/);
  assert.match(locale, /"he" \| "en" \| "ru"/);
  assert.match(locale, /document\.documentElement\.dir/);
  assert.equal(Object.keys(dictionaries.en).length >= 2000, true);
  assert.equal(Object.keys(dictionaries.ru).length >= 2000, true);
  assert.match(header, /<LanguageSwitcher compact/);
  assert.doesNotMatch(header, /<AccessibilityWidget/);
  assert.match(footer, /<LanguageSwitcher compact/);
  assert.doesNotMatch([header, footer, contactActions, data, worldData].join("\n"), /https:\/\/www\.vii\.co\.il/);
  const response = await render("/");
  const html = await response.text();
  assert.match(html, /vii-logo\.png/);
});

test("ships the immersive media, review and concierge experiences", async () => {
  const [gallery, reviews, concierge, shell, business, eventPlace, home, data, styles] = await Promise.all([
    readFile(new URL("../app/components/gallery-experience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/guest-review-studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/smart-concierge.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/page-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/events/place/client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/home-showcase.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/site-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(gallery, /המקום והמתקנים/);
  assert.match(gallery, /יחידות האירוח/);
  assert.match(gallery, /חדרי השינה/);
  assert.match(gallery, /onTouchStart/);
  assert.match(gallery, /<video controls playsInline/);
  assert.match(data, /אינו צילום וידאו רציף/);
  assert.match(reviews, /תמונות אורחים מאומתות/);
  assert.match(reviews, /צירוף אסמכתה לביקור/);
  assert.match(reviews, /אינה נשמרת במערכת/);
  assert.match(concierge, /נציג החופשה של וי/);
  assert.match(concierge, /serviceWhatsappNumber = "972542298986"/);
  assert.match(concierge, /conversationSummary/);
  assert.match(concierge, /useSiteLanguage/);
  assert.match(concierge, /אירוע או חגיגה/);
  assert.match(concierge, /מעבר לוואטסאפ/);
  assert.doesNotMatch(concierge, /המחשה מקומית/);
  assert.match(shell, /<SmartConcierge/);
  assert.match(business, /<GalleryExperience/);
  assert.match(business, /<GuestReviewStudio/);
  assert.match(eventPlace, /<GalleryExperience/);
  assert.match(home, /home-last-minute__tabs/);
  assert.match(home, /הכרטיסים אינם מציגים זמינות חיה/);
  assert.equal((data.match(/src: "\/media\/tours\//g) || []).length, 11);
  assert.match(styles, /story-gallery__progress/);
  assert.match(styles, /smart-concierge__panel/);
});

test("publishes crawler guidance, answer-engine guidance and an RSS feed", async () => {
  const robots = await render("/robots.txt", { headers: { accept: "text/plain" } });
  const robotsText = await robots.text();
  assert.equal(robots.status, 200);
  assert.match(robotsText, /User-Agent: OAI-SearchBot/);
  assert.match(robotsText, /User-Agent: GPTBot/);
  assert.match(robotsText, /Sitemap: https:\/\/vii\.spaplus\.co\/sitemap\.xml/);
  assert.match(robotsText, /Disallow: \/favorites\//);

  const feed = await render("/feed.xml", { headers: { accept: "application/rss+xml" } });
  const feedText = await feed.text();
  assert.equal(feed.status, 200);
  assert.match(feed.headers.get("content-type") ?? "", /application\/rss\+xml/);
  assert.equal((feedText.match(/<item>/g) || []).length, 10);

  const [llms, llmsFull, seo, sitemapSource, questions, key] = await Promise.all([
    readFile(new URL("../public/llms.txt", import.meta.url), "utf8"),
    readFile(new URL("../public/llms-full.txt", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/seo.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/questions/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/e7daf03f62b014067d8e10bb84098faa444d71d61f0d851d32013a07fe2502d3.txt", import.meta.url), "utf8"),
  ]);
  assert.match(llms, /https:\/\/vii\.spaplus\.co\/questions\//);
  assert.match(llmsFull, /מידע שלא מופיע בפרטי המקום אינו נחשב מאומת/);
  assert.match(seo, /"@type": "BreadcrumbList"/);
  assert.match(seo, /"@type": "FAQPage"/);
  assert.match(seo, /"@type": "LodgingBusiness"/);
  assert.match(seo, /"@type": "EventVenue"/);
  assert.match(seo, /"@type": "TouristTrip"/);
  assert.doesNotMatch(seo, /numberOfAccommodationUnits/);
  assert.match(sitemapSource, /place\.indexable !== false/);
  assert.match(questions, /faqSchema\(allQuestions\)/);
  assert.equal(key.trim(), "e7daf03f62b014067d8e10bb84098faa444d71d61f0d851d32013a07fe2502d3");
});

test("every canonical URL in the sitemap has complete crawlable HTML", async () => {
  const sitemapResponse = await render("/sitemap.xml", { headers: { accept: "application/xml" } });
  const sitemapXml = await sitemapResponse.text();
  assert.equal(sitemapResponse.status, 200);
  const urls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].replaceAll("&amp;", "&"));
  assert.equal(urls.length, 84);
  assert.equal(urls.some((url) => url.includes("party-time")), false);
  assert.equal(new Set(urls).size, urls.length);

  for (const absolute of urls) {
    const target = new URL(absolute);
    const response = await render(`${target.pathname}${target.search}`);
    const html = await response.text();
    assert.equal(response.status, 200, absolute);
    assert.match(html, /<title>[^<]+<\/title>/, absolute);
    assert.match(html, /<meta name="description" content="[^"]+"\s*\/?>/, absolute);
    assert.match(html, /<link rel="canonical" href="https:\/\/vii\.spaplus\.co\/[^"]*"\s*\/?>/, absolute);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, absolute);
    assert.doesNotMatch(html, /<meta name="robots" content="noindex/, absolute);
    for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      assert.doesNotThrow(() => JSON.parse(match[1]), absolute);
    }
  }
});

test("key page types emit matching structured data and private pages stay out of the index", async () => {
  for (const [pathname, expectedTypes] of [
    ["/", ["Organization", "WebSite", "SearchAction"]],
    ["/search", ["CollectionPage", "ItemList", "BreadcrumbList"]],
    ["/business?id=perfumes-villa", ["LodgingBusiness", "BreadcrumbList", "FAQPage"]],
    ["/events/place?id=black-loft", ["EventVenue", "BreadcrumbList"]],
    ["/guides/private-event-checklist", ["Article", "BreadcrumbList"]],
    ["/trails/snir-hatzbani", ["Article", "TouristTrip", "BreadcrumbList"]],
    ["/questions", ["FAQPage", "BreadcrumbList"]],
  ]) {
    const response = await render(pathname);
    const html = await response.text();
    for (const expected of expectedTypes) assert.match(html, new RegExp(`\\"@type\\":\\"${expected}\\"`), `${pathname}: ${expected}`);
  }

  for (const pathname of ["/favorites", "/providers", "/handoff", "/discover/place?id=maor-natan"]) {
    const response = await render(pathname);
    assert.match(await response.text(), /<meta name="robots" content="noindex/);
  }
});

test("every discovery card has stable media and every new world has a full detail page", async () => {
  const worldData = await readFile(new URL("../app/data/world-data.ts", import.meta.url), "utf8");
  const itemLines = worldData.split("\n").filter((line) => line.includes("world:") && line.includes(" id: "));
  assert.equal(itemLines.length, 38);
  for (const line of itemLines) {
    assert.match(line, /image: "\/media\//);
    assert.doesNotMatch(line, /demo: true/);
  }

  for (const [pathname, expected] of [
    ["/discover/place?id=gentleman-haifa", /אפשרויות שהייה/],
    ["/discover/place?id=eilat-sunset", /תוכנית מוצעת/],
    ["/discover/place?id=horseback-idea", /כך מתאימים את החוויה/],
    ["/discover/place?id=assemblage-spa", /מסלולי בקשה/],
  ]) {
    const response = await render(pathname);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, expected);
    assert.match(html, /שאלות נפוצות/);
    assert.doesNotMatch(html, /פרופיל הדגמה/);
  }
});
