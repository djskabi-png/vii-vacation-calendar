import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const inventory = JSON.parse(await readFile(new URL("app/data/legacy-redirect-inventory.json", root), "utf8"));
const vacations = JSON.parse(await readFile(new URL("app/data/sergey-public-catalog.json", root), "utf8"));
const rooms = JSON.parse(await readFile(new URL("app/data/sergey-hourly-catalog.json", root), "utf8"));
const spa = JSON.parse(await readFile(new URL("app/data/spaplus-public-catalog.json", root), "utf8").catch(() => "{\"sites\":[]}"));

const timeoutMs = 20_000;
const concurrency = 6;
const deadline = Date.now() + 6 * 60_000;

function normalizedPath(value) {
  const url = new URL(value, "https://www.vii.co.il");
  return (decodeURI(url.pathname).replace(/\/+$/, "") || "/").toLowerCase();
}

function decodeHtml(value = "") {
  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ").replace(/&quot;/gi, '"').replace(/&#039;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ").trim();
}

function attribute(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return "";
}

function localMedia(value) {
  if (!value) return null;
  try {
    const url = new URL(value, "https://www.vii.co.il");
    if (!["vii.co.il", "www.vii.co.il"].includes(url.hostname) || !url.pathname.startsWith("/gallery/")) return null;
    const filename = decodeURIComponent(url.pathname.slice("/gallery/".length));
    return /^[A-Za-z0-9._-]+\.(?:avif|gif|jfif|jpe?g|png|webp)$/i.test(filename)
      ? `/api/vii/media/${encodeURIComponent(filename)}` : null;
  } catch { return null; }
}

function publicTarget(world, supplierId) {
  return world === "events" ? `/events/place/event-${supplierId}` : `/business?id=vacation-${supplierId}`;
}

function activeEntries() {
  const result = [];
  for (const place of vacations.places || []) {
    const supplierId = Number(place.supplierId);
    if (!Number.isSafeInteger(supplierId) || supplierId < 1) continue;
    result.push({ world: place.world === "events" ? "events" : "vacations", supplierId, sourceUrl: place.sourceUrl,
      target: publicTarget(place.world === "events" ? "events" : "vacations", supplierId) });
  }
  for (const place of rooms.places || []) {
    const supplierId = Number(place.supplierId || String(place.id || "").replace(/^hourly-/, ""));
    if (Number.isSafeInteger(supplierId) && supplierId > 0) result.push({ world: "rooms", supplierId, sourceUrl: place.sourceUrl,
      target: `/discover/place/hourly-${supplierId}` });
  }
  for (const site of spa.sites || []) {
    const supplierId = Number(site.id);
    if (Number.isSafeInteger(supplierId) && supplierId > 0 && site.sourceUrl) result.push({ world: "spa", supplierId, sourceUrl: site.sourceUrl,
      target: `/discover/place/spa-${supplierId}` });
  }
  return result;
}

const activeByPath = new Map(activeEntries().filter((row) => row.sourceUrl).map((row) => [normalizedPath(row.sourceUrl), row]));
const sourcePaths = [...new Set((inventory.gone || []).filter((path) => path !== "/"))].sort();
const records = [];
const activeRedirects = {};
const failures = [];
let cursor = 0;

async function recover(path) {
  const active = activeByPath.get(normalizedPath(path));
  if (active) {
    activeRedirects[path] = active.target;
    return;
  }
  const world = normalizedPath(path).startsWith("/events/") ? "events" : "vacations";
  const url = new URL(path, "https://www.vii.co.il").toString();
  const response = await fetch(url, {
    headers: { Accept: "text/html", "User-Agent": "VII inactive-business migration/1.0" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`http_${response.status}`);
  const html = await response.text();
  const primaryId = Number(html.match(/<div\s+id=["']minisite["'][^>]+data-siteid=["'](\d+)["']/i)?.[1]
    || html.match(/\[siteID\]\s*=>\s*(\d+)/i)?.[1]);
  if (!Number.isSafeInteger(primaryId) || primaryId < 1) throw new Error("missing_supplier_identity");
  const activeIdentity = activeEntries().find((entry) => entry.world === world && entry.supplierId === primaryId);
  if (activeIdentity) {
    activeRedirects[path] = activeIdentity.target;
    return;
  }
  const heading = decodeHtml(html.match(/<h1[^>]*class=["'][^"']*minisite-name[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "");
  const siteName = decodeHtml(html.match(/\[siteName\]\s*=>\s*([^\r\n<]+)/i)?.[1] || "");
  const ogTitle = attribute(html, "og:title");
  const name = heading || siteName || ogTitle.replace(/\s+-\s+וי פור ויקיישן.*$/u, "").trim();
  if (!name) throw new Error("missing_business_name");
  const location = decodeHtml(html.match(/itemprop=["']addressLocality["'][^>]*>([\s\S]*?)<\/li>/i)?.[1] || "");
  const crumbs = [...html.matchAll(/<div[^>]+class=["'][^"']*breadCrumbs[^"']*["'][^>]*>[\s\S]*?<\/div>/gi)]
    .flatMap((match) => [...match[0].matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)].map((entry) => decodeHtml(entry[1])))
    .filter(Boolean);
  const areaCandidate = crumbs.map((crumb) => crumb.replace(/^(?:מתחמי נופש|מקומות לאירועים|חדרים לפי שעה|בתי ספא)\s+ב/u, "").trim())
    .find((crumb) => crumb && crumb !== "ראשי" && crumb !== location) || "";
  const description = attribute(html, "og:description") || attribute(html, "description")
    || `עמוד המידע של ${name}. המקום אינו בפרסום פעיל כעת.`;
  const media = [...html.matchAll(/(?:https?:)?\/\/www\.vii\.co\.il\/gallery\/[A-Za-z0-9._-]+\.(?:avif|gif|jfif|jpe?g|png|webp)/gi)]
    .map((match) => localMedia(match[0].startsWith("//") ? `https:${match[0]}` : match[0]))
    .filter(Boolean);
  const ogImage = localMedia(attribute(html, "og:image"));
  const images = [...new Set([ogImage, ...media].filter(Boolean))].slice(0, 24);
  records.push({
    id: `${world}:${primaryId}`,
    world,
    supplierId: primaryId,
    status: "inactive",
    legacyPath: path,
    canonicalPath: publicTarget(world, primaryId),
    sourceUrl: url,
    name,
    description,
    location,
    area: areaCandidate,
    image: images[0] || "",
    images,
    recoveredFrom: "legacy_public_page",
  });
}

async function worker() {
  while (cursor < sourcePaths.length) {
    if (Date.now() > deadline) throw new Error("legacy_inactive_recovery_deadline");
    const path = sourcePaths[cursor++];
    try { await recover(path); }
    catch (error) { failures.push({ path, reason: error instanceof Error ? error.message : "unknown" }); }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, sourcePaths.length || 1) }, () => worker()));
records.sort((left, right) => left.world.localeCompare(right.world) || left.supplierId - right.supplierId || left.legacyPath.localeCompare(right.legacyPath));
const mergedRecords = [];
for (const record of records) {
  const existing = mergedRecords.find((candidate) => candidate.id === record.id);
  if (!existing) {
    mergedRecords.push({ ...record, legacyPaths: [record.legacyPath] });
    continue;
  }
  existing.legacyPaths = [...new Set([...existing.legacyPaths, record.legacyPath])].sort();
  existing.images = [...new Set([...existing.images, ...record.images])].slice(0, 24);
  existing.image ||= record.image;
  existing.description = existing.description.length >= record.description.length ? existing.description : record.description;
  existing.location ||= record.location;
  existing.area ||= record.area;
}
const generatedAt = new Date().toISOString();
const payload = {
  schemaVersion: 1,
  generatedAt,
  source: "https://www.vii.co.il legacy business pages plus current accepted bundled catalogs",
  stats: { requested: sourcePaths.length, inactive: mergedRecords.length, inactiveLegacyPaths: mergedRecords.reduce((count, record) => count + record.legacyPaths.length, 0), activeRedirects: Object.keys(activeRedirects).length, failures: failures.length },
  records: mergedRecords,
  activeRedirects: Object.fromEntries(Object.entries(activeRedirects).sort(([left], [right]) => left.localeCompare(right))),
  failures,
};
payload.sha256 = createHash("sha256").update(JSON.stringify({ records: mergedRecords, activeRedirects: payload.activeRedirects, failures })).digest("hex");
await writeFile(new URL("app/data/inactive-business-archive.generated.json", root), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
await writeFile(new URL("project_knowledge/diagnostics/vii-inactive-business-recovery-20261114.json", root), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...payload.stats, sha256: payload.sha256 }, null, 2));
if (failures.length) process.exitCode = 2;
