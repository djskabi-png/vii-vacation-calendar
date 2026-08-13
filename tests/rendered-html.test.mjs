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
  ["/events/place/black-loft", /בלאק לופט/],
  ["/favorites", /המקומות שאהבתי/],
  ["/guides", /החופשה הטובה מתחילה ברעיון טוב/],
  ["/guides/choose-the-right-place", /איך בוחרים מקום שבאמת מתאים/],
  ["/guides/private-event-checklist", /אירוע במקום פרטי/],
  ["/spas", /מוצאים את הספא שמתאים/],
  ["/hourly", /חדרים לפי שעה/],
  ["/providers", /ספקים לאירוח ולאירועים/],
  ["/activities", /בוחרים איך לבלות את היום/],
  ["/trails", /יוצאים מהצימר. נכנסים לישראל היפה/],
  ["/trails/snir-hatzbani", /נחל שניר, חצבאני/],
  ["/discover/place/spa-butik-tlv", /ספא בוטיק תל אביב/],
  ["/join", /מצטרפים בדרך שמתאימה בדיוק לעסק שלכם/],
  ["/gift-card", /גיפט קארד אחד/],
  ["/corporate", /כל מה שצריך כדי לעשות טוב לאנשים שלכם/],
  ["/accessibility", /הצהרת נגישות/],
]) {
  test(`server renders ${pathname}`, async () => {
    const response = await render(pathname);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    assert.match(await response.text(), expected);
  });
}

test("homepage hero keeps one focused message and compact local spacing", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /<h1>כל החופשה, במקום אחד<\/h1>/);
  assert.match(page, /<p>נופש, ספא, אירועים וכל מה שעושים מסביב\.<\/p>/);
  assert.doesNotMatch(page, /<span className="eyebrow">נופש, אירועים, ספא וחוויות<\/span>/);
  assert.match(css, /\.home-hero \{[^}]*min-height: 470px;[^}]*padding: 52px 0 42px;/);
  assert.match(css, /\.home-recommended \{[^}]*padding-block: 64px;/);
});

test("retired contact route redirects to site enrollment", async () => {
  const response = await render("/contact");
  assert.equal(response.status, 308);
  assert.equal(new URL(response.headers.get("location")).pathname, "/join");
});

test("uses the live production subdomain for public metadata", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /metadataBase: new URL\("https:\/\/vii\.spaplus\.co\/"\)/);
  assert.doesNotMatch(layout, /new\.vii\.co\.il/);
});

test("language control uses the branded accessible menu instead of a native select", async () => {
  const response = await render("/");
  const html = await response.text();
  assert.match(html, /class="language-trigger"/);
  assert.match(html, /role="menuitemradio"/);
  assert.match(html, />Français</);
  assert.doesNotMatch(html, /<select[^>]*aria-label="שפה"/);
});

test("language routes use real path prefixes and keep the Hebrew homepage canonical", async () => {
  const [provider, routing, config, layout] = await Promise.all([
    readFile(new URL("../app/i18n/locale-provider.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n/locale-routing.ts", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(config, /:locale\(en\|ru\|fr\)/);
  assert.match(provider, /window\.location\.assign\(destination\)/);
  assert.match(provider, /preserveLanguageOnInternalNavigation/);
  assert.match(provider, /document\.addEventListener\("click", preserveLanguageOnInternalNavigation, true\)/);
  assert.match(provider, /language === "he" && destination === href/);
  assert.match(provider, /window\.history\.pushState =/);
  assert.match(provider, /window\.history\.replaceState =/);
  assert.match(provider, /languageFromPathname\(window\.location\.pathname\)/);
  assert.doesNotMatch(provider, /url\.searchParams\.set\("lang"/);
  assert.match(routing, /language === "he" \? basePath/);
  assert.match(layout, /location\.pathname\.match/);
  const searchBox = await readFile(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");
  const searchPage = await readFile(new URL("../app/search/page.tsx", import.meta.url), "utf8");
  assert.match(searchBox, /const target = localizedPath\(destination, language\)/);
  assert.match(searchBox, /router\.push\(target\)/);
  assert.match(searchPage, /router\.replace\(localizedPath/);
  for (const path of ["/en", "/en/search?guests=2", "/ru/guides", "/fr/spas"]) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
  }
});

test("query-driven detail pages render the requested content on the server", async () => {
  for (const [pathname, expected, unexpected] of [
    ["/business?id=perfumes-villa", /וילת הבשמים/, /אקווה ריזורט/],
    ["/events/place/black-loft", /בלאק לופט/, /לופט פארטי טיים/],
    ["/discover/place/cassia-jerusalem", /קסיה וולנס וספא/, /ספא בוטיק תל אביב/],
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
  assert.match(html, /מקומות נמצאו/);
  assert.match(html, /מחיר לשעתיים עד/);
  assert.match(html, /כניסה עצמאית/);
  assert.match(html, /תצוגה על מפה/);
  assert.doesNotMatch(html, /בחרו תאריכים/);
});

test("unknown detail IDs do not silently show another place", async () => {
  for (const pathname of ["/discover/place/not-real", "/events/place/not-real", "/guides/article?id=not-real"]) {
    assert.equal((await render(pathname)).status, 404, pathname);
  }
});

test("vacation search keeps a complete Airbnb-style party breakdown", async () => {
  const searchBox = await readFile(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");
  for (const label of ["מבוגרים", "ילדים", "תינוקות", "חיות מחמד", "חדרים"]) {
    assert.match(searchBox, new RegExp(`label: "${label}"`));
  }
  assert.match(searchBox, /params\.set\("adults", String\(vacationParty\.adults\)\)/);
  assert.match(searchBox, /params\.set\("children", String\(vacationParty\.children\)\)/);
  assert.match(searchBox, /params\.set\("infants", String\(vacationParty\.infants\)\)/);
  assert.match(searchBox, /params\.set\("pets", String\(vacationParty\.pets\)\)/);
  assert.match(searchBox, /params\.set\("rooms", String\(vacationParty\.rooms\)\)/);
  assert.match(searchBox, /mode === "vacation"/);
});

test("search result bars preserve the submitted criteria", async () => {
  const [vacationResponse, eventResponse, spaResponse, hourlyResponse] = await Promise.all([
    render("/search?location=אילת&dates=10%20באוג׳%20עד%2012%20באוג׳&guests=4"),
    render("/events/search?location=מרכז&dates=15%20באוג׳&guests=80&from=2026-08-15&to=2026-08-15"),
    render("/spas?location=תל%20אביב&dates=18%20באוג׳&guests=2&spaFor=couple&date=2026-08-18&withoutDate=0"),
    render("/hourly?location=חיפה"),
  ]);
  const [vacationHtml, eventHtml, spaHtml, hourlyHtml] = await Promise.all([
    vacationResponse.text(),
    eventResponse.text(),
    spaResponse.text(),
    hourlyResponse.text(),
  ]);

  assert.match(vacationHtml, /אילת/);
  assert.match(vacationHtml, /10 באוג׳ עד 12 באוג׳/);
  assert.match(vacationHtml, /4 אורחים/);
  assert.match(eventHtml, /מרכז/);
  assert.match(eventHtml, /15 באוג׳/);
  assert.match(eventHtml, /80 משתתפים/);
  assert.match(spaHtml, /תל אביב/);
  assert.match(spaHtml, /18 באוג׳/);
  assert.match(spaHtml, /זוגי/);
  assert.match(hourlyHtml, /חיפה/);
});

test("vacation search uses a curated geography and descriptive breadcrumbs", async () => {
  const [response, cleanResponse] = await Promise.all([
    render("/search?location=%D7%9E%D7%A8%D7%9B%D7%96&guests=2"),
    render("/vacations/center"),
  ]);
  const taxonomy = await readFile(new URL("../app/data/search-taxonomy.ts", import.meta.url), "utf8");
  const html = await response.text();
  const cleanHtml = await cleanResponse.text();
  assert.equal(response.status, 200);
  assert.equal(cleanResponse.status, 200);
  assert.match(html, /aria-label="פירורי לחם"/);
  assert.match(html, /נופש במרכז/);
  assert.match(html, />נופש</);
  assert.match(cleanHtml, /נופש במרכז/);
  assert.match(cleanHtml, /BreadcrumbList/);
  assert.doesNotMatch(taxonomy, /וילה 8 חדרים עד 30 אורחים/);
  assert.doesNotMatch(taxonomy, /4 יחידות לזוגות ומשפחות/);
});

test("search submissions navigate to the selected result set without a document reload", async () => {
  const [source, feedback, shell, styles] = await Promise.all([
    readFile(new URL("../app/components/search-box.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/global-action-feedback.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/page-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(source, /router\.push\(target\)/);
  assert.doesNotMatch(source, /window\.location\.assign\(target\)/);
  assert.match(source, /isSearching/);
  assert.match(source, /מחפשים\.\.\./);
  assert.match(source, /aria-busy=\{isSearching\}/);
  assert.match(feedback, /showIfStillWaiting/);
  assert.match(feedback, /delay = 500/);
  assert.doesNotMatch(feedback, /copy\.page/);
  assert.doesNotMatch(feedback, /destination\.origin/);
  assert.match(feedback, /dataset\.globalFeedback/);
  assert.doesNotMatch(feedback, /טוענים את העמוד\.\.\./);
  assert.match(feedback, /document\.addEventListener\("click", onClick, true\)/);
  assert.match(shell, /<GlobalActionFeedback \/>/);
  assert.match(styles, /\.global-action-feedback\.is-visible/);
  assert.match(styles, /\.search-submit__icon > i/);
});

test("one business can serve several worlds without duplicate public pages", async () => {
  const [businessResponse, eventSearchResponse, sitemapResponse, legacyEventResponse, businessSource] = await Promise.all([
    render("/business?id=sol-gilgal&mode=events"),
    render("/events/search"),
    render("/sitemap.xml", { headers: { accept: "application/xml" } }),
    render("/events/place/sol-gilgal"),
    readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8"),
  ]);
  const [businessHtml, eventSearchHtml, sitemapXml] = await Promise.all([
    businessResponse.text(),
    eventSearchResponse.text(),
    sitemapResponse.text(),
  ]);

  assert.match(businessHtml, /מה תרצו לעשות במקום/);
  assert.match(businessHtml, /בדיקת התאמה לאירוע/);
  assert.match(businessHtml, /אירועים קטנים/);
  assert.match(businessHtml, /rel="canonical" href="https:\/\/vii\.spaplus\.co\/business\?id=sol-gilgal"/);
  assert.match(businessHtml, /"maximumAttendeeCapacity":26/);
  assert.match(eventSearchHtml, /business\?id=sol-gilgal(?:&amp;|&)mode=events/);
  assert.match(sitemapXml, /business\?id=sol-gilgal/);
  assert.doesNotMatch(sitemapXml, /events\/place\/sol-gilgal/);
  assert.ok([307, 308].includes(legacyEventResponse.status));
  assert.match(legacyEventResponse.headers.get("location") || "", /\/business\?id=sol-gilgal(?:&|%26)mode=events/);
  assert.match(businessSource, /worldSelection\?\.slug === property\.slug/);
  assert.match(businessSource, /setWorldSelection\(\{ slug: property\.slug, world \}\)/);
});

test("spa, hourly, event and attraction worlds expose interactive maps", async () => {
  const [spaResponse, hourlyResponse, eventResponse, attractionResponse, spaDetailResponse] = await Promise.all([
    render("/spas"),
    render("/hourly"),
    render("/events/search"),
    render("/attractions"),
    render("/discover/place/spa-butik-tlv"),
  ]);
  for (const response of [spaResponse, hourlyResponse, eventResponse, attractionResponse, spaDetailResponse]) assert.equal(response.status, 200);
  assert.match(await spaResponse.text(), /תצוגה על מפה/);
  assert.match(await hourlyResponse.text(), /תצוגה על מפה/);
  assert.match(await eventResponse.text(), /תצוגה על מפה/);
  assert.match(await attractionResponse.text(), /תצוגה על מפה/);
  const detail = await spaDetailResponse.text();
  assert.match(detail, /המקום על המפה/);

  const [mapSource, worldData, hourlyResults, worldResults, attractionResults, searchResults, eventResults, styles] = await Promise.all([
    readFile(new URL("../app/components/listing-map.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/world-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/hourly-results.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/world-map-results.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/attractions/attractions-explorer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/search/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/events/search/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(mapSource, /scrollWheelZoom: true/);
  assert.doesNotMatch(mapSource, /addEventListener\("wheel"/);
  assert.doesNotMatch(mapSource, /map\.flyTo\(/);
  assert.match(mapSource, /touchZoom: true/);
  assert.match(mapSource, /basemaps\.cartocdn\.com\/rastertiles\/voyager/);
  assert.match(mapSource, /openstreetmap\.org\/copyright/);
  assert.match(mapSource, /מפה בעברית/);
  assert.match(mapSource, /map\.getBounds\(\)\.pad/);
  assert.match(mapSource, /visibleCountCallback\.current/);
  assert.match(mapSource, /clusters\.find/);
  assert.match(mapSource, /is-cluster/);
  assert.match(mapSource, /initialPlaceIds/);
  assert.match(mapSource, /MapTone = "vacation" \| "events" \| "spa" \| "hourly" \| "activities"/);
  assert.match(mapSource, /map-tone--\$\{tone\}/);
  assert.ok((worldData.match(/mapPrecision: "area"/g) || []).length >= 20);
  assert.match(hourlyResults, /<DeferredDiscoveryMap items=\{filtered\} tone="hourly" autoLoad onClose=/);
  assert.match(worldResults, /<DeferredDiscoveryMap items=\{items\} tone=\{world\} autoLoad onClose=/);
  assert.match(attractionResults, /<DeferredDiscoveryMap items=\{filtered\} tone="activities" autoLoad onClose=/);
  for (const source of [hourlyResults, worldResults, attractionResults, searchResults, eventResults]) assert.match(source, /mobile-map-fab/);
  assert.match(styles, /\.mobile-map-fab \{/);
  assert.match(styles, /bottom: calc\(18px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(styles, /min-height: 44px !important/);
  assert.match(styles, /\.mobile-map-fab\.active \{ display: none; \}/);
  assert.match(styles, /body:has\(\.mobile-map-fab:not\(\.active\)\) \.world-dock/);
  assert.match(styles, /left: 50%/);
  assert.match(styles, /transform: translateX\(-50%\)/);
  assert.match(styles, /body:has\(\.map-results-experience\) \.mobile-map-fab/);
  assert.match(styles, /body:has\(\.map-results-experience\) \.smart-concierge/);
  assert.match(mapSource, /map-results-experience/);
  assert.doesNotMatch(mapSource, /map-results-side|map-results-list/);
  assert.match(mapSource, /setSelectedId\(id\)/);
});

test("map markers use the rich synchronized place card instead of legacy text tooltips", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("../app/components/listing-map.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(source, /bindTooltip/);
  assert.doesNotMatch(styles, /\.vii-map-tooltip/);
  assert.doesNotMatch(source, /\.on\("mouseover", \(\) => setSelectedId/);
  assert.doesNotMatch(source, /\.on\("focus", \(\) => setSelectedId/);
  assert.doesNotMatch(source, /title: entry\.name|title: clustered \?/);
  assert.match(source, /marker\.on\("click", \(\) => selectPlace/);
  assert.match(source, /const initialSelectedId = single \?/);
  assert.match(source, /basemaps\.cartocdn\.com\/rastertiles\/voyager/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /map-selection-card__media/);
  assert.match(source, /map-selection-card__body/);
  assert.match(source, /map-selection-card__close/);
  assert.match(source, /View details/);
  assert.match(source, /Voir les détails/);
  assert.match(styles, /\.map-selection-card \{ position: absolute/);
  assert.match(styles, /grid-template-rows: 178px auto/);
  assert.match(styles, /backdrop-filter: blur\(20px\)/);
  assert.match(styles, /-webkit-line-clamp: 2/);
  assert.match(styles, /\.map-selection-card__close[^}]*width: 40px[^}]*height: 40px/);
  assert.match(styles, /grid-template-columns: 112px minmax\(0,1fr\)/);
  assert.doesNotMatch(styles, /\.map-selection-card strong[^}]*white-space: nowrap/);
});

test("shared map markers use modern icon markers and visible active list controls", async () => {
  const mapSource = await readFile("app/components/listing-map.tsx", "utf8");
  const worldSwitcherSource = await readFile("app/components/world-switcher.tsx", "utf8");
  const css = await readFile("app/globals.css", "utf8");
  assert.match(mapSource, /function markerIcon\(tone: MapTone\)/);
  assert.match(mapSource, /vii-map-marker__icon/);
  assert.match(mapSource, /const markerContent = clustered[\s\S]+vii-map-marker__icon[\s\S]+vii-map-marker__label/);
  assert.match(mapSource, /m3\.5 10\.6 8\.5-6\.8 8\.5 6\.8/);
  assert.match(worldSwitcherSource, /M8\.6 14\.8c\.9 1\.1 2 1\.6 3\.4 1\.6s2\.5-\.5 3\.4-1\.6/);
  assert.match(mapSource, /M12 20\.5c4\.3-2\.3/);
  assert.match(mapSource, /M12 5\.2c\.7 3\.6/);
  assert.match(mapSource, /M12 7\.3v5l3\.3 2/);
  assert.doesNotMatch(mapSource, /<b>\$\{/);
  assert.match(css, /\.listing-map-shell[^}]+font-family:\s*Rubik, Heebo, Assistant, Arial, sans-serif/);
  assert.match(css, /\.map-button\.active[^}]+color:\s*#fff\s*!important/);
  assert.match(css, /\.map-button\.active \.map-button__desktop-label/);
  assert.match(css, /\.vii-map-marker-wrap\.is-icon \.vii-map-marker/);
  assert.match(css, /\.vii-map-marker-wrap\.is-text:not\(\.is-cluster\) \.vii-map-marker[^}]+grid-template-columns:\s*20px auto/);
  assert.match(css, /\.vii-map-marker-wrap\.is-text:not\(\.is-cluster\) \.vii-map-marker__icon svg[^}]+width:\s*18px/);
  assert.match(css, /\.vii-map-marker__icon svg[^}]+stroke-width:\s*1\.75/);
  assert.match(css, /\.vii-map-marker-wrap:not\(\.is-cluster\)\.is-active \.vii-map-marker[\s\S]+background: #0b5964/);
  assert.match(css, /\.vii-map-marker-wrap\.is-cluster \.vii-map-marker[\s\S]+#087e8b[\s\S]+#168fbd/);
});

test("commercial discovery stays inside VII", async () => {
  const responses = await Promise.all([
    render("/discover/place/spa-butik-tlv"),
    render("/discover/place/gentleman-haifa"),
    render("/business?id=perfumes-villa"),
    render("/events/place/black-loft"),
  ]);
  const pages = (await Promise.all(responses.map((response) => response.text()))).join("\n");
  assert.doesNotMatch(pages.replaceAll('href="https://www.spaplus.co.il/club/?src=vii"', ""), /href=["'][^"']*(?:roomsvip\.com|spaplus\.co\.il)/i);
  assert.doesNotMatch(pages, /פתיחה במפה מלאה/);
  assert.match(pages, /לכל פרטי השהייה/);
  assert.match(pages, /מגדילים, מקטינים ומזיזים את המפה כאן בעמוד/);
});

test("gift cards, corporate experiences and MASU form one internal journey", async () => {
  const [giftResponse, corporateResponse, masuResponse, homeResponse, sitemapResponse, worldData, businessSource, eventSource, discoverySource, translations] = await Promise.all([
    render("/gift-card"),
    render("/corporate"),
    render("/discover/place/masu-home-wellness"),
    render("/"),
    render("/sitemap.xml", { headers: { accept: "application/xml" } }),
    readFile(new URL("../app/data/world-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/events/place/client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/discover/place/client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n/translations.generated.json", import.meta.url), "utf8"),
  ]);
  const [giftHtml, corporateHtml, masuHtml, homeHtml, sitemapXml] = await Promise.all([
    giftResponse.text(), corporateResponse.text(), masuResponse.text(), homeResponse.text(), sitemapResponse.text(),
  ]);
  assert.match(giftHtml, /gift-card-art/);
  assert.match(giftHtml, /gift-checkout__steps/);
  assert.match(giftHtml, /gift-designs/);
  assert.match(corporateHtml, /למנהלות רווחה, משאבי אנוש ומועדוני צרכנות/);
  assert.match(corporateHtml, /מועדוני צרכנות וארגונים/);
  assert.match(corporateHtml, /חבילות מלאות שקל להתחיל מהן/);
  assert.match(corporateHtml, /ללא אשראי וללא התחייבות/);
  assert.match(masuHtml, /מאסו/);
  assert.match(masuHtml, /עיסוי עד הבית/);
  assert.match(masuHtml, /href=["']https:\/\/masu\.co\.il\/partners\/\?page=product&amp;lang=he["']/i);
  assert.match(masuHtml, /href=["']https:\/\/masu\.co\.il\/partners\/\?page=skincare&amp;lang=he["']/i);
  assert.match(masuHtml, /href=["']https:\/\/masu\.co\.il\/your-office-massage\/["']/i);
  assert.match(masuHtml, /href=["']https:\/\/masu\.co\.il\/your-pamper-party\/["']/i);
  assert.match(masuHtml, /target=["']_blank["']/i);
  assert.match(masuHtml, /rel=["']noopener noreferrer["']/i);
  for (const html of [giftHtml, corporateHtml]) {
    assert.match(html, /href=["']\/discover\/place\/masu-home-wellness["']/i);
    assert.match(html, />כניסה<\/a>/);
    assert.doesNotMatch(html, /href=["']https:\/\/masu\.co\.il/i);
  }
  assert.match(homeHtml, /masu-experience--stay/);
  assert.match(sitemapXml, /\/gift-card</);
  assert.match(sitemapXml, /\/corporate</);
  assert.match(sitemapXml, /masu-home-wellness/);
  assert.match(worldData, /id: "masu-home-wellness"/);
  assert.doesNotMatch(worldData, /id: "masu-home-wellness"[^\n]*rating:/);
  assert.match(businessSource, /<MasuExperience/);
  assert.match(eventSource, /<MasuExperience context="event"/);
  assert.match(discoverySource, /<MasuExperience context=/);
  const dictionaries = JSON.parse(translations);
  for (const language of ["en", "ru", "fr"]) {
    assert.ok(dictionaries[language]["גיפט קארד אחד."]);
    assert.ok(dictionaries[language]["מאסו לעובדים ולארגונים"]);
  }
});

test("checkout journeys include legal consent and requests without card collection", async () => {
  const [giftResponse, bookingResponse, giftSource, bookingSource] = await Promise.all([
    render("/gift-card"),
    render("/booking"),
    readFile(new URL("../app/gift-card/gift-card-builder.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/booking/client-page.tsx", import.meta.url), "utf8"),
  ]);
  const [giftHtml, bookingHtml] = await Promise.all([giftResponse.text(), bookingResponse.text()]);
  assert.match(giftHtml, /gift-checkout__steps/);
  assert.match(giftHtml, /gift-designs/);
  assert.doesNotMatch(giftSource, /type="date"/);
  assert.doesNotMatch(giftSource, /type="time"/);
  assert.match(giftSource, /gift-schedule-picker/);
  assert.match(giftSource, /gift-voucher/);
  assert.match(giftSource, /gift-notification-previews/);
  assert.doesNotMatch(giftSource, /<DemoPaymentFields/);
  assert.doesNotMatch(bookingSource, /DemoPaymentFields/);
  assert.doesNotMatch(bookingHtml, /demo-payment/);
  assert.match(bookingSource, /שליחת בקשת הזמנה/);
  assert.doesNotMatch(giftSource, /4242 4242 4242 4242/);
  assert.doesNotMatch(bookingSource, /demoCardNumber/);
  assert.doesNotMatch(giftSource, /demoCardNumber\s*:/);
  assert.doesNotMatch(bookingSource, /demoCardNumber\s*:/);
  for (const source of [giftSource, bookingSource]) {
    assert.match(source, /href="\/legal\/terms"/);
    assert.match(source, /href="\/legal\/privacy"/);
    assert.match(source, /legal-consent/);
  }
});

test("attraction booking follows the supplier conversion mode", async () => {
  const response = await render("/discover/place/kfar-blum-kayaks");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /איך מזמינים את האטרקציה/);
  assert.match(html, /הזמנה דרך האתר/);
  assert.match(html, /offer=activity-order/);
  assert.doesNotMatch(html.replaceAll('href="https://www.spaplus.co.il/club/?src=vii"', ""), /href=["'][^"']*(?:roomsvip\.com|spaplus\.co\.il)/i);
  assert.doesNotMatch(html, /חיוג למקום/);
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
  const [calendar, searchBox, business, detailDock, sleeping, search, eventsPage, eventSearch, eventPlace, data, worldData, worldSwitcher, map, homeShowcase, magazineData, magazinePage, articlePage, styles] = await Promise.all([
    readFile(new URL("../app/calendar-demo.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/search-box.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/detail-sticky-dock.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/sleeping-arrangements.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/search/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/events/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/events/search/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/events/place/client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/site-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/data/world-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/world-switcher.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/listing-map.tsx", import.meta.url), "utf8"),
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
  assert.match(business, /<DetailStickyDock/);
  assert.doesNotMatch(business, /sticky-property-search/);
  assert.match(detailDock, /onlineHref/);
  assert.match(detailDock, /phone/);
  assert.match(detailDock, /ניווט בתוך עמוד המקום/);
  assert.match(business, /initialSlug/);
  assert.doesNotMatch(business, /URLSearchParams\(location\.search\)/);
  assert.match(search, /setPool/);
  assert.match(eventSearch, /setEventType/);
  assert.doesNotMatch(data, /liveUrl|https:\/\/www\.vii\.co\.il\//);
  assert.equal((data.match(/roomOptions:/g) || []).length, 11);
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
  assert.equal((data.match(/name: "חדר שינה [1-9]"/g) || []).length, 12);
  assert.equal((data.match(/galleryImage: "\/media\/[a-f0-9]{16}\.(?:jpe?g|png)"/g) || []).length, 9);
  assert.match(business, /מה אפשר לעשות מסביב/);
  assert.match(business, /complementaryItems/);
  assert.match(eventPlace, /ספקים שיכולים להשלים את החגיגה/);
  assert.match(eventPlace, /הפרטים מבוססים על מידע ציבורי/);
  assert.equal((data.match(/contact: \{ phone:/g) || []).length, 17);
  assert.equal((data.match(/whatsapp:/g) || []).length, 8);
  assert.match(business, /bookingQuery/);
  assert.match(business, /world: activeWorld/);
  assert.match(business, /initialFrom/);
  assert.doesNotMatch(business, /contact-actions/);
  assert.match(business, /<WhatsAppLeadButton/);
  assert.doesNotMatch(business, /wa\.me/);
  assert.match(business, /booking-summary/);
  assert.match(business, /שליחת בקשת זמינות בוואטסאפ/);
  assert.match(business, /<FavoriteButton compact=\{false\}/);
  assert.match(eventPlace, /<FavoriteButton compact=\{false\}/);
  assert.match(styles, /\.universal-favorite\.is-saved/);
  assert.equal((worldData.match(/sourceName: "ספא פלוס"/g) || []).length, 10);
  assert.equal((worldData.match(/sourceName: "חדרים וי־איי־פי"/g) || []).length, 10);
  assert.match(worldSwitcher, /בחירת עולם/);
  assert.match(worldSwitcher, /מה מחפשים\?/);
  assert.match(worldSwitcher, /aria-current/);
  assert.match(worldSwitcher, /primaryWorlds = \["vacation", "spa", "events", "hourly"\]/);
  assert.match(worldSwitcher, /search-world-tabs__more/);
  assert.match(calendar, /id: "month", label: ".+", nights: 30/);
  assert.match(calendar, /aria-pressed/);
  assert.match(styles, /\.flexible-section/);
  assert.match(searchBox, /SearchWorldTabs/);
  assert.match(searchBox, /בחרו כמות משתתפים/);
  assert.doesNotMatch(searchBox, /mode === "events" \? 40/);
  assert.match(eventsPage, /<SearchBox mode="events" showWorlds \/>/);
  assert.match(map, /basemaps\.cartocdn\.com/);
  assert.match(map, /World_Imagery/);
  assert.match(map, /map-preview-image/);
  assert.match(map, /if \(!enabled\)/);
  assert.match(map, /autoLoad/);
  assert.match(search, /<DeferredListingMap listings=\{mapCandidates\} initialListings=\{filtered\} autoLoad/);
  assert.match(search, /onVisibleCountChange=\{setVisibleMapCount\}/);
  assert.doesNotMatch(search, /מתוך \$\{properties\.length\}/);
  assert.match(map, /listing\.bedrooms/);
  assert.match(map, /typeof listing\.price === "number"/);
  assert.match(data, /readVerifiedCount\(item\.location/);
  assert.match(search, /האזור שמוצג במפה/);
  assert.match(eventSearch, /mode="events" autoLoad/);
  assert.match(eventSearch, /const \[guests, setGuests\] = useState\(/);
  assert.match(eventSearch, /initialGuests/);
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
  assert.match(homeShowcase, /כל הדילים במקום אחד/);
  assert.match(homeShowcase, /דילים ברגע האחרון/);
  assert.match(homeShowcase, /דילים לתקופות מבוקשות/);
  assert.match(homeShowcase, /כל סיבה טובה הופכת כאן לאירוע/);
  assert.match(homeShowcase, /spaPlaces\.slice/);
  assert.match(homeShowcase, /hourlyPlaces\.slice/);
  assert.doesNotMatch(homeShowcase, /המחיר והזמינות הסופיים יאומתו/);
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

test("footer destinations and booking forms have real destinations", async () => {
  const [footer, form, contact, join, onboarding, cookieConsent] = await Promise.all([
    readFile(new URL("../app/components/site-footer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/lead-intake-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/contact/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/join/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/join/partner-onboarding.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/cookie-consent.tsx", import.meta.url), "utf8"),
  ]);
  for (const href of ["/search", "/events", "/spas", "/hourly", "/providers", "/trails", "/attractions", "/booking", "/guides", "/accessibility", "/legal/terms", "/legal/privacy", "/legal/cancellation"]) {
    assert.match(footer, new RegExp(`href=["']${href.replaceAll("/", "\\/")}`));
  }
  assert.match(footer, /href=\{`\/join\/\$\{variant\}`\}/);
  assert.match(form, /const endpoint = "\/api\/leads\/"/);
  const leadRoute = await readFile(new URL("../app/api/leads/route.ts", import.meta.url), "utf8");
  assert.match(leadRoute, /https:\/\/app\.spaplus\.co\/api\/integrations\/vii-leads/);
  assert.match(leadRoute, /sourceSite: "vii\.co\.il"/);
  assert.match(form, /privacyAccepted/);
  assert.match(form, /crypto\.randomUUID\(\)/);
  assert.match(form, /state === "success"/);
  assert.match(contact, /permanentRedirect\("\/join"\)/);
  assert.match(form, /type Purpose = "join" \| "booking" \| "accessibility"/);
  assert.match(join, /PartnerOnboarding/);
  assert.match(onboarding, /LeadIntakeForm purpose="join"/);
  assert.match(onboarding, /מחירון ודרך הצטרפות לפי תחום/);
  assert.match(onboarding, /התחייבות שנתית משתלמת משמעותית/);
  assert.match(form, /רישום ראשוני והעברה לנציג מומחה/);
  assert.match(onboarding, /fixedWorld="providers"/);
  assert.doesNotMatch(onboarding, /DemoPaymentFields/);
  assert.match(onboarding, /אישור ושליחת הבקשה/);
  assert.match(onboarding, /selectedPackage=\{selectionLabel\}/);
  assert.match(cookieConsent, /SETTINGS_HASH = "#privacy-settings"/);
  assert.match(cookieConsent, /window\.addEventListener\("hashchange", openFromHash\)/);
  assert.match(cookieConsent, /href=\{SETTINGS_HASH\}/);
});

test("independent trails are sourced, filterable and connected to stays", async () => {
  const [data, listing, detail, activities, home, homepage, business, header, footer, styles] = await Promise.all([
    readFile(new URL("../app/data/trail-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/trails/trails-explorer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/trails/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/activities/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/home-showcase.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/site-header.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/site-footer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.equal((data.match(/officialSource: "https:\/\/www\.parks\.org\.il\//g) || []).length, 31);
  assert.equal((data.match(/sourceName: "רשות הטבע והגנים"/g) || []).length, 31);
  assert.equal((data.match(/difficulty: "/g) || []).length, 48);
  assert.equal((data.match(/duration: "/g) || []).length, 48);
  assert.equal((data.match(/safety: \[/g) || []).length, 23);
  assert.match(listing, /סינון מסלולי טיול/);
  assert.match(listing, /setDifficulty/);
  assert.match(listing, /setNature/);
  assert.match(detail, /המידע אינו אישור שהמסלול פתוח כרגע/);
  assert.match(detail, /sourceName/);
  assert.match(detail, /נקודת התחלה לחיפוש במפה/);
  assert.doesNotMatch(detail, /href=\{trail\.officialSource\}/);
  assert.match(activities, /מסלולי טיול עצמאיים/);
  assert.match(activities, /אטרקציות בתשלום/);
  assert.match(home, /מסלולים ליד החופשה/);
  assert.match(home, /ספא ורוגע, כחלק מהחופשה/);
  assert.match(home, /חדרים לכמה שעות/);
  assert.ok(homepage.indexOf("<HomeTrails />") > homepage.indexOf("רעיונות שממשיכים את החופשה"));
  assert.match(business, /nearbyTrails/);
  assert.match(business, /מסלולים באזור/);
  assert.match(header, /publicWorldNavigation\.map/);
  assert.match(header, /<WorldSwitcher active=\{variant\}/);
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
    assert.match(html, /מקור המידע שנבדק/, slug);
    assert.match(html, /נקודת התחלה לחיפוש במפה/, slug);
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
  assert.match(header, /<AccessibilityWidget placement="menu" \/>/);
  assert.match(header, /<LanguageSwitcher compact/);
  assert.match(footer, /href="\/accessibility"/);
  assert.match(footer, /<AccessibilityWidget placement="footer" \/>/);
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

test("ships a favicon, four languages and no dependency on the retired site", async () => {
  const [layout, locale, localeRouting, translations, header, footer, data, worldData, styles, favicon] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n/locale-provider.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n/locale-routing.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n/translations.generated.json", import.meta.url), "utf8"),
    readFile(new URL("../app/site-header.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/site-footer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/site-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/data/world-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/favicon.ico", import.meta.url)),
  ]);
  const dictionaries = JSON.parse(translations);
  assert.match(layout, /icons:\s*\{\s*icon:/);
  assert.equal(favicon.length > 0, true);
  assert.match(layout, /<LocaleProvider>/);
  assert.match(localeRouting, /"he" \| "en" \| "ru" \| "fr"/);
  assert.match(locale, /document\.documentElement\.dir/);
  assert.equal(Object.keys(dictionaries.en).length >= 2000, true);
  assert.equal(Object.keys(dictionaries.ru).length >= 2000, true);
  assert.equal(Object.keys(dictionaries.fr).length >= 2000, true);
  assert.match(header, /<LanguageSwitcher compact/);
  assert.match(header, /<AccessibilityWidget placement="menu" \/>/);
  assert.match(header, /className="menu-panel__join" href="\/join\/providers"/);
  assert.match(header, /className="menu-panel__eyebrow"/);
  assert.equal((header.match(/href="\/join\/providers"/g) || []).length, 1);
  assert.equal((header.match(/translate\("פרסום והצטרפות לאתר"\)/g) || []).length, 1);
  assert.doesNotMatch(header, /הצטרפות כספק/);
  assert.match(styles, /\.menu-panel__main > a \{[^}]*border: 1px solid #d8e9eb/);
  assert.match(styles, /\.menu-panel__join \{[^}]*border: 2px solid/);
  assert.match(styles, /scroll-padding-bottom:\s*calc\(36px \+ env\(safe-area-inset-bottom/);
  assert.match(styles, /\.menu-panel \{ width: 100%; max-width: 100%;/);
  assert.match(footer, /<LanguageSwitcher compact/);
  assert.match(footer, /<AccessibilityWidget placement="footer" \/>/);
  assert.doesNotMatch([header, footer, data, worldData].join("\n"), /https:\/\/www\.vii\.co\.il/);
  const response = await render("/");
  const html = await response.text();
  assert.match(html, /vii-logo\.png/);
});

test("keeps each world cross-sell relevant to the page the visitor is viewing", async () => {
  const landing = await readFile(new URL("../app/components/world-landing.tsx", import.meta.url), "utf8");

  assert.match(landing, /hourly:[\s\S]*משהייה קצרה לחופשה או ליום של פינוק/);
  assert.match(landing, /spa:[\s\S]*הופכים את הטיפול ליום שלם/);
  assert.match(landing, /providers:[\s\S]*מוצאים מקום שמתאים לספק שבחרתם/);
  assert.doesNotMatch(landing, /בכל דף מקום יוצגו בהמשך/);
});

test("keeps the footer foundation fixed while adapting discovery links to each world and curated topic", async () => {
  const [footer, footerContext, shell, search, providers, trails] = await Promise.all([
    readFile(new URL("../app/components/site-footer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/footer-context.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/page-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/search/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/provider-results.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/trails/trails-explorer.tsx", import.meta.url), "utf8"),
  ]);

  for (const world of ["vacation", "events", "spa", "hourly", "providers", "activities"]) assert.match(footerContext, new RegExp(`${world}:`));
  assert.match(footer, /העולמות שלנו/);
  assert.match(footer, /מידע ושירות/);
  assert.match(footerContext, /בתי ספא לפי אזור/);
  assert.match(footerContext, /מקומות לאירועים לפי אזור/);
  assert.match(footerContext, /חדרים לפי שעה לפי אזור/);
  assert.match(footerContext, /סוויטות יוקרה לפי אזור/);
  assert.match(footerContext, /footerTopicForPropertyType/);
  assert.doesNotMatch(footerContext, /עולם הספא/);
  assert.match(footer, /LanguageSwitcher/);
  assert.match(footer, /AccessibilityWidget/);
  assert.match(shell, /<SiteFooter variant=\{variant\} topic=\{footerTopic\} \/>/);
  assert.match(search, /footerTopicForPropertyType\(selectedTypes\[0\] \|\| "הכל"\)/);
  assert.match(providers, /searchParams\.get\("category"\)/);
  assert.match(trails, /searchParams\.get\("area"\)/);
});

test("ships the immersive media, review and concierge experiences", async () => {
  const [gallery, reviews, concierge, shell, business, eventPlace, discoveryPlace, trailPlace, home, data, styles] = await Promise.all([
    readFile(new URL("../app/components/gallery-experience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/guest-review-studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/smart-concierge.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/page-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/events/place/client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/discover/place/client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/trails/[slug]/page.tsx", import.meta.url), "utf8"),
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
  assert.match(reviews, /כל תוכן חדש עובר בדיקה לפני שהוא מוצג לציבור/);
  assert.match(reviews, /תגובות מטיילים על המסלול/);
  assert.match(reviews, /ממתינה לאישור/);
  assert.match(reviews, /צירוף אסמכתה לביקור/);
  assert.match(reviews, /אינו מוצג לגולשים אחרים/);
  assert.match(concierge, /נציג החופשה של וי/);
  assert.match(concierge, /serviceWhatsappNumber = "972542298986"/);
  assert.match(concierge, /conversationSummary/);
  assert.match(concierge, /useSiteLanguage/);
  assert.match(concierge, /smart-concierge__trigger-icon/);
  assert.match(concierge, /אירוע או חגיגה/);
  assert.match(concierge, /מעבר לוואטסאפ/);
  assert.doesNotMatch(concierge, /המחשה מקומית/);
  assert.match(shell, /<SmartConcierge/);
  assert.match(business, /<GalleryExperience/);
  assert.match(business, /<GuestReviewStudio/);
  assert.match(eventPlace, /<GalleryExperience/);
  assert.match(eventPlace, /<GuestReviewStudio/);
  assert.match(discoveryPlace, /<GuestReviewStudio/);
  assert.match(trailPlace, /subjectType="trail"/);
  assert.match(home, /home-last-minute__tabs/);
  assert.match(home, /href=\{lastMinuteHref\(period\)\}/);
  assert.match(home, /tracks\.current\[group\.id\]/);
  assert.match(styles, /\.home-last-minute__cards \{[^}]*direction: rtl/);
  assert.doesNotMatch(home, /home-last-minute__selection/);
  assert.match(home, /from=/);
  assert.match(home, /till=/);
  assert.match(home, /דילים לתקופות מבוקשות/);
  assert.equal((data.match(/src: "\/media\/tours\//g) || []).length, 11);
  assert.match(styles, /story-gallery__progress/);
  assert.match(styles, /\.smart-concierge__trigger \{ position: relative; width: 72px/);
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
  assert.ok(urls.length >= 132);
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
    ["/spas", ["CollectionPage", "ItemList", "BreadcrumbList"]],
    ["/hourly", ["CollectionPage", "ItemList", "BreadcrumbList"]],
    ["/attractions", ["CollectionPage", "ItemList", "BreadcrumbList"]],
    ["/business?id=perfumes-villa", ["LodgingBusiness", "BreadcrumbList", "FAQPage"]],
    ["/events/place/black-loft", ["EventVenue", "BreadcrumbList"]],
    ["/guides/private-event-checklist", ["Article", "BreadcrumbList"]],
    ["/trails/snir-hatzbani", ["Article", "TouristTrip", "BreadcrumbList"]],
    ["/questions", ["FAQPage", "BreadcrumbList"]],
  ]) {
    const response = await render(pathname);
    const html = await response.text();
    for (const expected of expectedTypes) assert.match(html, new RegExp(`\\"@type\\":\\"${expected}\\"`), `${pathname}: ${expected}`);
  }

  for (const pathname of ["/favorites", "/providers", "/handoff", "/booking"]) {
    const response = await render(pathname);
    assert.match(await response.text(), /<meta (?:name="robots" content="noindex|content="noindex" name="robots")/);
  }

  const notFound = await render("/release-qa-missing-page");
  const notFoundHtml = await notFound.text();
  assert.equal(notFound.status, 404);
  assert.equal((notFoundHtml.match(/<meta (?:name="robots" content="noindex|content="noindex" name="robots")/g) || []).length, 1);
  assert.doesNotMatch(notFoundHtml, /<meta (?:name="robots" content="index, follow|content="index, follow" name="robots")/);
});

test("every discovery card has stable media and every new world has a full detail page", async () => {
  const worldData = await readFile(new URL("../app/data/world-data.ts", import.meta.url), "utf8");
  const itemLines = worldData.split("\n").filter((line) => line.includes("world:") && line.includes(" id: "));
  assert.equal(itemLines.length, 51);
  for (const line of itemLines) {
    assert.match(line, /image: "\/media\//);
    assert.doesNotMatch(line, /demo: true/);
  }

  for (const [pathname, expected] of [
    ["/discover/place/gentleman-haifa", /אפשרויות שהייה/],
    ["/discover/place/timna-park", /איך מזמינים את האטרקציה/],
    ["/discover/place/kfar-blum-kayaks", /איך מזמינים את האטרקציה/],
    ["/discover/place/assemblage-spa", /חבילות הספא/],
    ["/discover/place/amit-mitrani-magic-man", /שירותים וחבילות להזמנה/],
    ["/discover/place/hagit-designed-events", /שירותים וחבילות להזמנה/],
    ["/discover/place/aae-event-design", /שירותים וחבילות להזמנה/],
    ["/discover/place/argaman-events", /שירותים וחבילות להזמנה/],
  ]) {
    const response = await render(pathname);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, expected);
    assert.match(html, /שאלות נפוצות/);
    assert.doesNotMatch(html, /פרופיל הדגמה/);
  }
});

test("attraction result cards use only approved photographic cover media", async () => {
  const [response, worldData, styles] = await Promise.all([
    render("/attractions"),
    readFile(new URL("../app/data/world-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const html = await response.text();
  const approved = [
    "kfar-blum-kayaks-3.jpg",
    "hamat-gader-3.jpg",
    "luna-park-tel-aviv-3.jpg",
    "superland-3.webp",
    "tel-aviv-museum-4.jpg",
    "timna-park-2.jpg",
  ];
  for (const image of approved) {
    assert.match(worldData, new RegExp(image.replaceAll(".", "\\.")));
    assert.match(html, new RegExp(image.replaceAll(".", "\\.")));
  }
  for (const rejected of ["haifa-museums-2.jpg", "madatech-haifa-3.png", "steinhardt-museum-1.png", "carasso-science-park-1.png"]) {
    assert.doesNotMatch(html, new RegExp(rejected.replaceAll(".", "\\.")));
  }
  assert.match(styles, /\.attraction-grid \.discovery-card__visual \{ aspect-ratio: 16 \/ 10; min-height: 0; \}/);
  assert.match(styles, /\.attraction-grid \.discovery-card__visual img \{ width: 100%; height: 100%; \}/);
});

test("activities hub separates trails from paid attractions and every main trail area has six routes", async () => {
  const [hubResponse, trailsResponse, attractionsResponse, trailSource] = await Promise.all([
    render("/activities"),
    render("/trails"),
    render("/attractions"),
    readFile(new URL("../app/data/trail-data.ts", import.meta.url), "utf8"),
  ]);
  const [hubHtml, trailsHtml, attractionsHtml] = await Promise.all([hubResponse.text(), trailsResponse.text(), attractionsResponse.text()]);

  assert.match(hubHtml, /href="\/trails"[^>]*><strong>מסלולי טיולים/);
  assert.match(hubHtml, /href="\/attractions"[^>]*><strong>אטרקציות בתשלום/);
  assert.match(attractionsHtml, /אטרקציות בתשלום בישראל/);
  assert.match(attractionsHtml, /aria-label="סינון אטרקציות בתשלום"/);
  assert.match(attractionsHtml, /מידע מאומת/);
  assert.match(trailsHtml, /"numberOfItems":48/);

  for (const area of ["צפון", "כנרת", "חיפה", "מרכז", "תל אביב", "דרום ונגב", "ירושלים", "אילת והסביבה"]) {
    const directCount = [...trailSource.matchAll(new RegExp(`mainArea: "${area}"`, "g"))].length;
    const mappedCount = [...trailSource.matchAll(new RegExp(`^\\s+"[^"]+": "${area}",$`, "gm"))].length;
    const count = directCount + mappedCount;
    assert.equal(count, 6, `${area} source coverage`);
  }
});

test("world selection stays in the header and no longer competes with floating actions", async () => {
  const [css, worldSwitcher] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/components/world-switcher.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(css, /\.world-dock__backdrop \{ position: fixed/);
  assert.match(worldSwitcher, /className="world-dock__backdrop"/);
  assert.match(worldSwitcher, /event\.key === "Escape"/);
  assert.match(css, /\/\* Compact world selector in the global header zone \*\/[\s\S]*\.header-actions \.world-dock \{[\s\S]*position: relative;[\s\S]*inset: auto;/);
  assert.match(css, /@media \(max-width: 960px\) \{[\s\S]*\.world-dock > button \{[\s\S]*width: 40px;[\s\S]*border-radius: 50%;/);
});

test("every business depth template exposes an internal gallery", async () => {
  for (const [pathname, name] of [
    ["/business?id=perfumes-villa", "וילת הבשמים"],
    ["/events/place/black-loft", "בלאק לופט"],
    ["/discover/place/spa-butik-tlv", "ספא בוטיק תל אביב"],
    ["/discover/place/gentleman-haifa", "ג׳נטלמן חיפה"],
    ["/discover/place/masu-home-wellness", "מאסו"],
    ["/discover/place/timna-park", "פארק תמנע"],
  ]) {
    const response = await render(pathname);
    const html = await response.text();
    assert.equal(response.status, 200, pathname);
    assert.match(html, new RegExp(`aria-label="פתיחת (?:גלריית|הגלריה של|תמונה \\d+ של) ${name}`), pathname);
  }

  const discoveryClient = await readFile(new URL("../app/discover/place/client-page.tsx", import.meta.url), "utf8");
  assert.match(discoveryClient, /<GalleryExperience/);
  assert.match(discoveryClient, /discovery-detail__gallery-launch/);
});

test("spa results expose working place and amenity filters before the result list", async () => {
  const response = await render("/spas?location=כל%20הארץ");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /aria-label="סינון תוצאות ספא"/);
  for (const label of ["ספא בבית מלון", "ספא בוטיק או פרטי", "בריכה", "ג׳קוזי", "סאונה", "חדר כושר", "חבילה זוגית", "יום כיף", "חבילה עם ארוחה"]) {
    assert.match(html, new RegExp(label));
  }

  const source = await readFile(new URL("../app/components/world-map-results.tsx", import.meta.url), "utf8");
  assert.match(source, /selectedFilters\.every/);
  assert.match(source, /<DeferredDiscoveryMap items=\{amenityFiltered\} initialItems=\{filtered\}/);
  assert.match(source, /onVisibleCountChange=\{setVisibleMapCount\}/);
  assert.match(source, /displayed\.map\(\(item\)/);

  const worldData = await readFile(new URL("../app/data/world-data.ts", import.meta.url), "utf8");
  assert.match(worldData, /function areaMapCoordinates/);
  assert.match(worldData, /const spaAreaCoordinates/);
  assert.match(worldData, /"חיפה": \{ lat: 32\.794, lng: 34\.989 \}/);
  assert.match(worldData, /"טבריה": \{ lat: 32\.794, lng: 35\.532 \}/);
  assert.match(worldData, /"ירושלים": \{ lat: 31\.778, lng: 35\.223 \}/);
  assert.match(worldData, /mapPrecision: "area"/);
});

test("provider pages demonstrate tracked WhatsApp and full-site booking modes", async () => {
  const [whatsappResponse, fullResponse, source, leadFlow, details, styles] = await Promise.all([
    render("/discover/place/maor-natan"),
    render("/discover/place/nissan-mukhtar"),
    readFile(new URL("../app/discover/place/client-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/whatsapp-lead-button.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/provider-details.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const [whatsappHtml, fullHtml] = await Promise.all([whatsappResponse.text(), fullResponse.text()]);

  assert.match(whatsappHtml, /הזמנה בוואטסאפ/);
  assert.match(whatsappHtml, /הצגת מספר/);
  assert.doesNotMatch(whatsappHtml, />050-786-7711</);
  assert.match(fullHtml, /התחלת הזמנה/);
  assert.match(fullHtml, /\/booking\?world=providers&amp;place=nissan-mukhtar/);
  assert.match(source, /<WhatsAppLeadButton/);
  assert.doesNotMatch(source, /https:\/\/wa\.me/);
  assert.match(leadFlow, /https:\/\/wa\.me\/\$\{whatsappNumber\(businessPhone\)\}/);
  assert.match(leadFlow, /role="dialog" aria-modal="true"/);
  assert.match(details, /"maor-natan":[\s\S]*bookingMode: "whatsapp"/);
  assert.match(details, /"nissan-mukhtar":[\s\S]*bookingMode: "full"/);
  assert.match(styles, /\.discovery-detail--providers \.provider-occasions \{ padding-block: 44px 40px; \}/);
  assert.match(styles, /\.discovery-detail--providers \.provider-process-section/);
});

test("all public sorting and filtering controls use the branded modern selector", async () => {
  const sourcePaths = [
    "../app/search/page.tsx",
    "../app/events/search/page.tsx",
    "../app/components/hourly-results.tsx",
    "../app/components/world-map-results.tsx",
    "../app/attractions/attractions-explorer.tsx",
    "../app/trails/trails-explorer.tsx",
    "../app/components/lead-intake-form.tsx",
    "../app/business/client-page.tsx",
    "../app/events/place/client-page.tsx",
  ];
  const sources = await Promise.all(sourcePaths.map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  for (const [index, source] of sources.entries()) {
    assert.doesNotMatch(source, /<select\b/, sourcePaths[index]);
  }

  const [component, styles] = await Promise.all([
    readFile(new URL("../app/components/modern-select.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /aria-haspopup="listbox"/);
  assert.match(component, /role="option"/);
  assert.match(component, /event\.key === "Escape"/);
  assert.match(styles, /\.modern-select__menu/);
  assert.match(styles, /\.filter-panel input\[type="checkbox"\]:checked/);
});

test("mobile result filtering and sorting use the single quick-filter entry", async () => {
  const [styles, vacationSearch, eventSearch] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/search/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/events/search/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(styles, /Mobile results use one compact app-style entry/);
  assert.match(styles, /\.results-toolbar\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*flex-start;[^}]*min-height:\s*0;[^}]*height:\s*0/s);
  assert.match(vacationSearch, /className="search-quick-filters"/);
  assert.match(vacationSearch, /className=\{activeFilters\.length \? "primary-filter active" : "primary-filter"\}/);
  assert.doesNotMatch(vacationSearch, /mobile-filter--compact/);
  assert.doesNotMatch(eventSearch, /mobile-filter--compact/);
  assert.match(styles, /\.results-toolbar__actions\s*\{[^}]*width:\s*auto;[^}]*min-width:\s*0;/s);
  assert.match(styles, /\.results-toolbar > \.results-toolbar__sort\s*\{[^}]*display:\s*none;/s);
  assert.match(styles, /\.filter-panel__mobile-sort\s*\{[^}]*display:\s*block;/s);
});

test("favorites span every world and bookings continue into the personal account", async () => {
  const favoriteButton = await readFile(new URL("../app/components/favorite-button.tsx", import.meta.url), "utf8");
  const savedItems = await readFile(new URL("../app/lib/saved-items.ts", import.meta.url), "utf8");
  const favoritesPage = await readFile(new URL("../app/favorites/page.tsx", import.meta.url), "utf8");
  const accountPage = await readFile(new URL("../app/account/page.tsx", import.meta.url), "utf8");
  const bookingPage = await readFile(new URL("../app/booking/client-page.tsx", import.meta.url), "utf8");
  const discoveryCard = await readFile(new URL("../app/components/discovery-card.tsx", import.meta.url), "utf8");
  const trailCard = await readFile(new URL("../app/components/trail-card.tsx", import.meta.url), "utf8");
  const eventSearch = await readFile(new URL("../app/events/search/page.tsx", import.meta.url), "utf8");
  const corporatePage = await readFile(new URL("../app/corporate/page.tsx", import.meta.url), "utf8");

  for (const world of ["vacation", "events", "corporate", "spa", "hourly", "providers", "activities", "trails"]) assert.match(favoritesPage, new RegExp(`${world}:`));
  assert.match(savedItems, /vii-saved-items-v2/);
  assert.match(favoriteButton, /readSavedItems/);
  assert.match(discoveryCard, /FavoriteButton/);
  assert.match(trailCard, /FavoriteButton/);
  assert.match(eventSearch, /FavoriteButton/);
  assert.match(corporatePage, /world="corporate"/);
  assert.match(corporatePage, /href="\/corporate"/);
  assert.match(accountPage, /ההזמנות שלי/);
  assert.match(accountPage, /פריטים שאהבתי/);
  assert.match(bookingPage, /saveBooking/);
  assert.match(bookingPage, /לצפייה בהזמנות שלי/);
});

test("favorites empty-state navigation uses encoding-safe symbols", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const favoritesPage = await readFile(new URL("../app/favorites/page.tsx", import.meta.url), "utf8");
  assert.match(styles, /\.favorites-empty__link-arrow\s*\{/);
  assert.doesNotMatch(styles, /\.favorites-empty__links a::after/);
  assert.match(favoritesPage, /className="favorites-empty__link-arrow" aria-hidden="true"/);
  assert.match(favoritesPage, /language === "he" \? "\\u2190" : "\\u2192"/);
  for (const broken of ["ג†", "ג“", "גˆ’", "ג™¿", "ג€÷", "ג€¹", "ֲ·"]) {
    assert.doesNotMatch(`${styles}\n${favoritesPage}`, new RegExp(broken));
  }
});

test("saved favorites normalize legacy routes to canonical detail pages", async () => {
  const savedItems = await readFile(new URL("../app/lib/saved-items.ts", import.meta.url), "utf8");
  const legacyDiscoveryRoute = await readFile(new URL("../app/discover/place/legacy-place-redirect.tsx", import.meta.url), "utf8");

  assert.match(savedItems, /canonicalSavedItemHref/);
  assert.match(savedItems, /return `\/discover\/place\/\$\{encodeURIComponent\(item\.id\)\}`/);
  assert.match(savedItems, /return `\/business\?id=\$\{encodeURIComponent\(item\.id\)\}`/);
  assert.match(savedItems, /if \(item\.world === "corporate"\) return "\/corporate"/);
  assert.match(savedItems, /`\/events\/place\/\$\{encodeURIComponent\(item\.id\)\}`/);
  assert.match(savedItems, /return `\/trails\/\$\{encodeURIComponent\(item\.id\)\}`/);
  assert.match(legacyDiscoveryRoute, /router\.replace\(`\/discover\/place\/\$\{encodeURIComponent\(item\.id\)\}`\)/);
});

test("business depth pages always fill nearby experiences and trails", async () => {
  const response = await render("/business?id=perfumes-villa");
  const html = await response.text();
  const discoveryCards = html.match(/class="discovery-card discovery-card--/g) || [];
  const trailCards = html.match(/class="trail-card trail-card--compact"/g) || [];
  const trailData = await readFile(new URL("../app/data/trail-data.ts", import.meta.url), "utf8");
  const businessPage = await readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");

  assert.ok(discoveryCards.length >= 6, `expected at least 6 nearby experiences, received ${discoveryCards.length}`);
  assert.ok(trailCards.length >= 6, `expected at least 6 nearby trails, received ${trailCards.length}`);
  assert.match(trailData, /limit = 6/);
  assert.match(trailData, /\.\.\.exact, \.\.\.fallback, \.\.\.trails/);
  assert.match(businessPage, /\.slice\(0, 6\)/);
});

test("all depth recommendation sections stay full", async () => {
  const [discoveryResponse, trailResponse] = await Promise.all([
    render("/discover/place/cassia-jerusalem"),
    render("/trails/snir-hatzbani"),
  ]);
  const [discoveryHtml, trailHtml] = await Promise.all([discoveryResponse.text(), trailResponse.text()]);
  const discoveryCards = discoveryHtml.match(/class="discovery-card discovery-card--/g) || [];
  const trailCards = trailHtml.match(/class="trail-card trail-card--compact"/g) || [];

  assert.ok(discoveryCards.length >= 6, `expected at least 6 related discoveries, received ${discoveryCards.length}`);
  assert.ok(trailCards.length >= 6, `expected at least 6 related trails, received ${trailCards.length}`);
});

test("unavailable vacation places and unavailable-image cards never reach public results", async () => {
  const [searchResponse, businessResponse, sitemapResponse, siteData] = await Promise.all([
    render("/search?location=%D7%90%D7%99%D7%9C%D7%AA&guests=4"),
    render("/business?id=ar-suites"),
    render("/sitemap.xml"),
    readFile(new URL("../app/data/site-data.ts", import.meta.url), "utf8"),
  ]);
  const [searchHtml, businessHtml, sitemapXml] = await Promise.all([
    searchResponse.text(),
    businessResponse.text(),
    sitemapResponse.text(),
  ]);

  assert.match(siteData, /slug: "ar-suites",\s*active: false/);
  assert.match(siteData, /unavailablePropertyImages/);
  assert.match(siteData, /\.filter\(isPublicProperty\)/);
  for (const output of [searchHtml, businessHtml, sitemapXml]) {
    assert.doesNotMatch(output, /c3a6274bfd08091a\.jpeg/);
    assert.doesNotMatch(output, /business\?id=ar-suites/);
  }
});

test("vacation results heading stays concise without a redundant status eyebrow", async () => {
  const source = await readFile(new URL("../app/search/page.tsx", import.meta.url), "utf8");
  const redundantEyebrow = "\u05de\u05e7\u05d5\u05de\u05d5\u05ea \u05e4\u05e2\u05d9\u05dc\u05d9\u05dd \u05e9\u05e0\u05d1\u05d3\u05e7\u05d5";

  assert.doesNotMatch(source, new RegExp(redundantEyebrow));
  assert.match(source, /<section className="results-heading">/);
  assert.match(source, /<h1>/);
  assert.match(source, /<p>/);
});

test("homepage keeps vacation discovery strips between last minute deals and spa", async () => {
  const source = await readFile(new URL("../app/components/home-showcase.tsx", import.meta.url), "utf8");
  const lastMinute = source.indexOf('className="section home-last-minute"');
  const vacationDiscovery = source.indexOf('className="section home-vacation-discovery"');
  const spa = source.indexOf('className="section home-spa-strip"');

  assert.ok(lastMinute >= 0 && vacationDiscovery > lastMinute && spa > vacationDiscovery);
  assert.match(source, /יעדים מומלצים לנופש/);
  assert.match(source, /חיפושים נפוצים/);
  assert.match(source, /סוגים וסגנונות אירוח/);
  assert.match(source, /\/search\?location=/);
  assert.match(source, /pool=1/);
  assert.match(source, /href: "\/villas"/);
});

test("villa discovery uses a clean landing route and delayed navigation feedback", async () => {
  const [home, showcase, feedback] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/home-showcase.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/global-action-feedback.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(home, /href="\/villas"[^>]*data-global-feedback="true"/);
  assert.match(showcase, /href: "\/villas"/);
  assert.match(feedback, /showIfStillWaiting\(element\.dataset\.loadingLabel[^,]*, 320\)/);
});

test("regional villa filters resolve to a clean landing with inventory counts", async () => {
  const [response, searchBox, landings] = await Promise.all([
    render("/villas/center"),
    readFile(new URL("../app/components/search-box.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/accommodation-landings.ts", import.meta.url), "utf8"),
  ]);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /וילות נופש במרכז/);
  assert.match(html, /(?:מתחם אחד|\d+ מתחמים), (?:יחידת נופש אחת|\d+ יחידות נופש)/);
  assert.match(html, /BreadcrumbList/);
  assert.match(html, /canonical[^>]+\/villas\/center/);
  assert.match(searchBox, /mode === "vacation" && cleanVacationRoute/);
  assert.match(searchBox, /destination = query \? `\$\{route\}\?\$\{query\}` : route/);
  assert.match(landings, /const minimumRegionalListings = 1/);
});

test("discovery rating and favorite controls use opposite logical corners", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /\.rating-badge \{ inset-inline-start: 14px;/);
  assert.match(styles, /\.discovery-card > \.universal-favorite[^\n]+inset-inline-end: 14px;/);
  assert.doesNotMatch(styles, /\.rating-badge \{ left: 14px;/);
});

test("mobile filters reserve their actions by hiding the floating concierge", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /body:has\(\.filter-panel\.open\) \.smart-concierge \{ display: none; \}/);
});

test("mobile maps fit filtered results tightly and wait for tiles before appearing", async () => {
  const map = await readFile(new URL("../app/components/listing-map.tsx", import.meta.url), "utf8");

  assert.match(map, /compactViewport \? \[22, 22\] : \[56, 56\]/);
  assert.match(map, /compactViewport \? 0\.04 : 0\.12/);
  assert.match(map, /compactViewport && map\.getZoom\(\) < 7/);
  assert.match(map, /className=\{`listing-map \$\{mapReady \? "is-ready" : ""\}`\}/);
  assert.match(map, /const initialSelectedId = single \? initialPlaceIds\?\.find/);
  assert.doesNotMatch(map, /mapReady \|\| autoLoad \? "is-ready"/);
});
