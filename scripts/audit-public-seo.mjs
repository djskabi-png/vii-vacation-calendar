const base = (process.argv[2] || "http://127.0.0.1:4272").replace(/\/$/, "");

const sitemap = await fetch(`${base}/sitemap.xml`).then((response) => response.text());
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => new URL(match[1]).pathname + new URL(match[1]).search);

async function inspect(path) {
  const response = await fetch(`${base}${path}`, { redirect: "follow" });
  const html = await response.text();
  const schemas = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .flatMap((match) => {
      try { return [JSON.parse(match[1])]; } catch { return []; }
    });
  const schemaTypes = schemas.flatMap((schema) => schema["@graph"]?.map((node) => node["@type"]) || [schema["@type"]]);
  const breadcrumb = schemas.find((schema) => schema["@type"] === "BreadcrumbList");
  const names = breadcrumb?.itemListElement?.map((item) => item.name) || [];
  const h1Count = (html.match(/<h1(?:\s|>)/g) || []).length;
  const canonical = /<link[^>]+rel="canonical"[^>]+href="[^"]+"/.test(html) || /<link[^>]+href="[^"]+"[^>]+rel="canonical"/.test(html);
  const visibleBreadcrumb = /aria-label="פירורי לחם"/.test(html);
  const vacationPath = /^\/(search|vacations|villas|luxury-suites|suite-complexes|vacation-apartments)(\/|\?|$)/.test(path);
  const errors = [];
  if (!response.ok) errors.push(`HTTP ${response.status}`);
  if (h1Count !== 1) errors.push(`H1=${h1Count}`);
  if (!canonical) errors.push("canonical חסר");
  if (path !== "/" && !visibleBreadcrumb) errors.push("פירורים נראים חסרים");
  if (path !== "/" && !schemaTypes.includes("BreadcrumbList")) errors.push("סכמת פירורים חסרה");
  if (vacationPath && !names.includes("נופש")) errors.push("היררכיית נופש חסרה בסכמה");
  if (path.startsWith("/business?") && !names.some((name) => ["נופש", "אירועים", "בתי ספא", "חדרים לפי שעה"].includes(name))) errors.push("עולם תוכן חסר בדף מקום");
  if (path.startsWith("/business?") && !schemaTypes.some((type) => ["LodgingBusiness", "Hotel", "VacationRental"].includes(type))) errors.push("סכמת מקום אירוח חסרה");
  if (path.startsWith("/events/place?") && !schemaTypes.includes("EventVenue")) errors.push("סכמת מתחם אירועים חסרה");
  if (path.startsWith("/guides/") && path !== "/guides/" && !schemaTypes.includes("Article")) errors.push("סכמת כתבה חסרה");
  if (path.startsWith("/trails/") && path !== "/trails/" && !schemaTypes.includes("TouristTrip")) errors.push("סכמת מסלול חסרה");
  if (breadcrumb && breadcrumb.itemListElement.some((item, index) => item.position !== index + 1 || !item.name || !item.item?.startsWith("http"))) errors.push("סכמת פירורים לא תקינה");
  return { path, errors, names };
}

const results = [];
for (let index = 0; index < urls.length; index += 12) {
  results.push(...await Promise.all(urls.slice(index, index + 12).map(inspect)));
}

const failures = results.filter((result) => result.errors.length);
console.log(JSON.stringify({ audited: results.length, passed: results.length - failures.length, failed: failures.length, failures: failures.slice(0, 80) }, null, 2));
if (failures.length) process.exitCode = 1;
