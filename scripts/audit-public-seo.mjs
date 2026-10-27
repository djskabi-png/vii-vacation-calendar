const base = (process.argv[2] || "http://127.0.0.1:4272").replace(/\/$/, "");
const requestedLimit = Number(process.argv[3] || 0);
const requestedRoutePattern = process.argv[4] ? new RegExp(process.argv[4]) : null;
const supportedLocales = ["he", "en", "ru", "fr"];
const vacationWorldNames = {
  he: ["נופש"],
  en: ["Stays"],
  ru: ["Отдых"],
  fr: ["Séjours"],
};
const placeWorldNames = {
  he: ["נופש", "אירועים", "בתי ספא", "חדרים לפי שעה"],
  en: ["Stays", "Events", "Spa", "Hourly stays"],
  ru: ["Отдых", "Мероприятия", "Спа", "Почасовой отдых"],
  fr: ["Séjours", "Événements", "Spa", "Séjours à l'heure"],
};

function xmlUrls(xml) {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1].replaceAll("&amp;", "&"));
}

function routeFor(url) {
  const parsed = new URL(url, base);
  const pathname = parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/+$/, "");
  return `${pathname}${parsed.search}`;
}

async function fetchAtBase(url, init = {}) {
  const target = `${base}${routeFor(url)}`;
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await fetch(target, { signal: AbortSignal.timeout(30_000), ...init });
    } catch (error) {
      lastError = error;
      const retryable = error instanceof Error && ["TimeoutError", "AbortError", "TypeError"].includes(error.name);
      if (!retryable || attempt === 2) throw error;
      // One bounded, isolated retry protects the full sitemap audit from a
      // single transient edge/network timeout without accepting bad content.
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError;
}

const indexResponse = await fetchAtBase("/sitemap.xml");
if (!indexResponse.ok) throw new Error(`sitemap_index_${indexResponse.status}`);
const sitemapIndex = await indexResponse.text();
const childSitemaps = xmlUrls(sitemapIndex);
if (!childSitemaps.length) throw new Error("sitemap_children_missing");

const sitemapDocuments = await Promise.all(childSitemaps.map(async (url) => {
  try {
    const response = await fetchAtBase(url);
    if (!response.ok) return { url, urls: [], error: `HTTP ${response.status}` };
    const body = await response.text();
    if (!/application\/xml/i.test(response.headers.get("content-type") || "")) return { url, urls: [], error: "content_type" };
    return { url, urls: xmlUrls(body), error: "" };
  } catch (error) {
    return { url, urls: [], error: `request_failed:${error instanceof Error ? error.name : "unknown"}` };
  }
}));

const sitemapFailures = sitemapDocuments.filter((document) => document.error)
  .map((document) => ({ path: routeFor(document.url), error: document.error }));

const allUrls = sitemapDocuments.flatMap((document) => document.urls);
const duplicateUrls = allUrls.length - new Set(allUrls).size;
const completeUrls = [...new Set(allUrls)];
const matchingUrls = requestedRoutePattern
  ? completeUrls.filter((url) => requestedRoutePattern.test(routeFor(url)))
  : completeUrls;
const urls = requestedLimit > 0 ? matchingUrls.slice(0, requestedLimit) : matchingUrls;

async function inspect(path) {
  const route = routeFor(path);
  let response;
  let html;
  try {
    response = await fetchAtBase(path, { redirect: "follow" });
    html = await response.text();
  } catch (error) {
    return { path: route, errors: [`request_failed:${error instanceof Error ? error.name : "unknown"}`], names: [], canonical: "", language: "" };
  }
  const schemas = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .flatMap((match) => {
      try { return [JSON.parse(match[1])]; } catch { return []; }
    });
  const schemaTypes = schemas.flatMap((schema) => schema["@graph"]?.map((node) => node["@type"]) || [schema["@type"]]);
  const breadcrumb = schemas.find((schema) => schema["@type"] === "BreadcrumbList");
  const names = breadcrumb?.itemListElement?.map((item) => item.name) || [];
  const h1Count = (html.match(/<h1(?:\s|>)/g) || []).length;
  const canonical = /<link[^>]+rel="canonical"[^>]+href="[^"]+"/.test(html) || /<link[^>]+href="[^"]+"[^>]+rel="canonical"/.test(html);
  const canonicalHref = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1]
    || html.match(/<link[^>]+href="([^"]+)"[^>]+rel="canonical"/i)?.[1]
    || "";
  const htmlLanguage = html.match(/<html[^>]+lang="([^"]+)"/i)?.[1] || "";
  const expectedLocale = route.match(/^\/(en|ru|fr)(?=\/|\?|$)/)?.[1] || "he";
  const alternates = [...html.matchAll(/<link[^>]+rel="alternate"[^>]+hreflang="([^"]+)"[^>]+href="([^"]+)"/gi)]
    .map((match) => ({ locale: match[1], href: match[2] }));
  const visibleBreadcrumb = /aria-label="פירורי לחם"/.test(html);
  const localeFreeRoute = route.replace(/^\/(en|ru|fr)(?=\/|\?|$)/, "") || "/";
  const vacationPath = /^\/(search|vacations|villas|luxury-suites|suite-complexes|vacation-apartments)(\/|\?|$)/.test(localeFreeRoute);
  const errors = [];
  if (!response.ok) errors.push(`HTTP ${response.status}`);
  if (h1Count !== 1) errors.push(`H1=${h1Count}`);
  if (!canonical) errors.push("canonical חסר");
  if (canonicalHref && routeFor(canonicalHref) !== route) errors.push(`canonical לא עצמי: ${canonicalHref}`);
  if (htmlLanguage !== expectedLocale) errors.push(`lang=${htmlLanguage || "missing"}, expected=${expectedLocale}`);
  // A page must advertise its own approved language and an x-default. Content
  // pages may intentionally omit languages whose supplier/CMS translation is
  // not approved; requiring every locale would reward fabricated translations.
  const expectedHreflang = expectedLocale === "he" ? "he-IL" : expectedLocale;
  if (!alternates.some((entry) => entry.locale === expectedHreflang)) errors.push(`hreflang ${expectedHreflang} חסר`);
  if (!alternates.some((entry) => entry.locale === "x-default")) errors.push("hreflang x-default חסר");
  if (!/^\/(?:en|ru|fr)?$/.test(route) && !visibleBreadcrumb) errors.push("פירורים נראים חסרים");
  if (!/^\/(?:en|ru|fr)?$/.test(route) && !schemaTypes.includes("BreadcrumbList")) errors.push("סכמת פירורים חסרה");
  if (vacationPath && !names.some((name) => vacationWorldNames[expectedLocale].includes(name))) errors.push("היררכיית נופש חסרה בסכמה");
  if (localeFreeRoute.startsWith("/business?") && !names.some((name) => placeWorldNames[expectedLocale].includes(name))) errors.push("עולם תוכן חסר בדף מקום");
  if (localeFreeRoute.startsWith("/business?") && !schemaTypes.some((type) => ["LodgingBusiness", "Hotel", "VacationRental"].includes(type))) errors.push("סכמת מקום אירוח חסרה");
  if (localeFreeRoute.startsWith("/events/place?") && !schemaTypes.includes("EventVenue")) errors.push("סכמת מתחם אירועים חסרה");
  if (localeFreeRoute.startsWith("/guides/") && localeFreeRoute !== "/guides/" && !schemaTypes.includes("Article")) errors.push("סכמת כתבה חסרה");
  if (/^\/trails\/explore\/[^/?]+$/.test(localeFreeRoute) && (!schemaTypes.includes("CollectionPage") || !schemaTypes.includes("ItemList"))) errors.push("סכמת אוסף מסלולים חסרה");
  if (/^\/trails\/(?!explore\/)[^/?]+$/.test(localeFreeRoute) && !schemaTypes.includes("TouristTrip")) errors.push("סכמת מסלול חסרה");
  if (breadcrumb && breadcrumb.itemListElement.some((item, index) => item.position !== index + 1 || !item.name || !item.item?.startsWith("http"))) errors.push("סכמת פירורים לא תקינה");
  return { path: route, errors, names, canonical: canonicalHref, language: htmlLanguage };
}

const results = [];
for (let index = 0; index < urls.length; index += 12) {
  results.push(...await Promise.all(urls.slice(index, index + 12).map(inspect)));
}

const failures = results.filter((result) => result.errors.length);
const report = {
  base,
  sitemapChildren: childSitemaps.length,
  sitemapUrls: completeUrls.length,
  audited: results.length,
  limited: requestedLimit > 0,
  routePattern: requestedRoutePattern?.source || "",
  duplicateUrls,
  sitemapFailures,
  passed: results.length - failures.length,
  failed: failures.length,
  failures: failures.slice(0, 200),
};
console.log(JSON.stringify(report, null, 2));
if (failures.length || duplicateUrls || sitemapFailures.length) process.exitCode = 1;
