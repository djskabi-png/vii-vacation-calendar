import approvedLocations from "../app/data/approved-world-locations.json" with { type: "json" };

const localOrigin = process.env.VII_AUDIT_ORIGIN || "http://127.0.0.1:4313";
const publicOrigin = "https://vii.spaplus.co";
const sections = {
  vacations: "/vacations/search/",
  events: "/events/search/",
  spas: "/spas/search/",
  hourly: "/hourly/search/",
};
const queryRoutes = {
  vacation: ["/search", "/vacations/search/"],
  events: ["/events/search", "/events/search/"],
  spa: ["/spas", "/spas/search/"],
  hourly: ["/hourly", "/hourly/search/"],
};

function xmlLocations(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

async function fetchText(path, options) {
  const response = await fetch(new URL(path, localOrigin), options);
  return { response, text: await response.text() };
}

async function mapLimit(values, limit, worker) {
  const results = new Array(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await worker(values[index], index);
    }
  }));
  return results;
}

const failures = [];
const pageCounts = {};
const allPaths = [];
for (const [section, prefix] of Object.entries(sections)) {
  const { response, text } = await fetchText(`/sitemaps/${section}/1.xml`);
  if (response.status !== 200) failures.push({ section, issue: `sitemap ${response.status}` });
  const paths = xmlLocations(text).map((value) => new URL(value).pathname).filter((path) => path.startsWith(prefix));
  pageCounts[section] = paths.length;
  allPaths.push(...paths);
}

const duplicates = allPaths.filter((path, index) => allPaths.indexOf(path) !== index);
if (duplicates.length) failures.push({ issue: "duplicate canonical paths", paths: [...new Set(duplicates)] });
for (const path of allPaths) {
  if (!/^\/[a-z0-9/_-]+$/.test(path)) failures.push({ path, issue: "non ASCII path" });
}

await mapLimit(allPaths, 10, async (path) => {
  const { response, text } = await fetchText(path, { redirect: "manual" });
  const expectedCanonical = `${publicOrigin}${path}`;
  const canonical = text.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
  if (response.status !== 200) failures.push({ path, issue: `status ${response.status}` });
  if (canonical !== expectedCanonical) failures.push({ path, issue: "canonical mismatch", canonical, expectedCanonical });
  if (!/<h1[\s>]/i.test(text)) failures.push({ path, issue: "missing h1" });
  if (!/<meta name="description" content="[^"]+"/i.test(text)) failures.push({ path, issue: "missing description" });
});

let redirectCount = 0;
for (const [world, labels] of Object.entries(approvedLocations)) {
  const [source, targetPrefix] = queryRoutes[world];
  await mapLimit(labels, 10, async (label) => {
    const response = await fetch(new URL(`${source}?location=${encodeURIComponent(label)}`, localOrigin), { redirect: "manual" });
    redirectCount += 1;
    const location = response.headers.get("location");
    if (response.status !== 301) failures.push({ world, label, issue: `redirect status ${response.status}` });
    if (!location || !new URL(location, localOrigin).pathname.startsWith(targetPrefix)) failures.push({ world, label, issue: "redirect target mismatch", location });
  });
}

const unknown = await fetch(new URL(`/hourly?location=${encodeURIComponent("לא קיים")}`, localOrigin), { redirect: "manual" });
if (unknown.status !== 200) failures.push({ issue: "unknown location must remain editable", status: unknown.status });

const result = {
  origin: localOrigin,
  pageCounts,
  totalLocationPages: allPaths.length,
  redirectCount,
  duplicateCount: duplicates.length,
  failures,
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
