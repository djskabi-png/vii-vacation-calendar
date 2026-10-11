import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { parseFragment } from "parse5";

const destination = new URL("../app/data/spaplus-catalog.json", import.meta.url);
const legacyDestination = new URL("../app/data/spaplus-legacy-aliases.json", import.meta.url);
const imageField = "CONCAT('https://www.spaplus.co.il/gallery/',picture)";

function plainText(html) {
  const parts = [];
  function walk(node) {
    if (node.nodeName === "#text") parts.push(node.value);
    if (["br", "p", "div", "li"].includes(node.nodeName)) parts.push("\n");
    for (const child of node.childNodes || []) walk(child);
    if (["p", "div", "li"].includes(node.nodeName)) parts.push("\n");
  }
  walk(parseFragment(String(html || "")));
  return parts.join("").replace(/\u00a0/g, " ").split(/\n+/).map((part) => part.replace(/\s+/g, " ").trim()).filter(Boolean);
}

function safeSpaPlusUrl(value) {
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "www.spaplus.co.il") throw new Error(`Unexpected Spa Plus URL host: ${url.hostname}`);
  return url.href;
}

const rl = createInterface({ input: process.stdin, terminal: false });
const key = await new Promise((resolve) => rl.once("line", resolve));
rl.close();
if (!key) throw new Error("Spa Plus API key is required on stdin");

const endpoint = new URL("https://www.spaplus.co.il/vii/");
endpoint.searchParams.set("key", key);
endpoint.searchParams.set("action", "sites");
const response = await fetch(endpoint, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Spa Plus API returned HTTP ${response.status}`);
const payload = await response.json();
if (payload.status !== "ok" || !payload.sites || Array.isArray(payload.sites)) throw new Error("Unexpected Spa Plus API response");

const sites = Object.entries(payload.sites).map(([key, site]) => {
  if (Number(key) !== Number(site.siteid) || !site.title) throw new Error(`Invalid Spa Plus site ${key}`);
  const packages = Object.values(site.packages || {}).map((pack) => {
    if (!pack.MainPageID || !pack.idPack || !pack.MainPageTitle || !Number.isFinite(Number(pack.price)) || Number(pack.price) <= 0) {
      throw new Error(`Invalid package at Spa Plus site ${key}`);
    }
    return {
      id: Number(pack.MainPageID),
      supplierPackageId: Number(pack.idPack),
      title: String(pack.MainPageTitle).trim(),
      price: Number(pack.price),
      durationMinutes: Number(pack.treatmentDuration) || null,
      people: Number(pack.packPeoples) || null,
      group: Boolean(Number(pack.isGroupPackage)),
      image: safeSpaPlusUrl(pack[imageField]),
      bookingUrl: safeSpaPlusUrl(pack.iframeurl),
    };
  });
  return {
    id: Number(site.siteid),
    title: String(site.title).trim(),
    titleEN: String(site.titleEN || "").trim(),
    address: String(site.address || "").trim(),
    city: String(site.city || "").trim(),
    shortDescription: String(site.short_desc || "").trim(),
    about: plainText(site.about),
    phone: String(site.phone || "").trim(),
    image: safeSpaPlusUrl(site[imageField]),
    opening: Array.isArray(site.opening) ? site.opening.map(String) : [],
    bookingUrl: safeSpaPlusUrl(site.iframeurl),
    packages,
  };
});
const packageCount = sites.reduce((sum, site) => sum + site.packages.length, 0);
if (sites.length < 100 || packageCount < 500 || new Set(sites.map((site) => site.id)).size !== sites.length) {
  throw new Error(`Incomplete Spa Plus catalog: ${sites.length} sites, ${packageCount} packages`);
}
const previous = JSON.parse(await readFile(new URL("../app/data/verified-catalog.json", import.meta.url), "utf8"));
const curatedLegacyPaths = {
  "spa-butik-tlv": "spa_butik_tlv",
  "cassia-jerusalem": "spa_Cassia_Jerusalem",
  "assemblage-spa": "assemblage_spa",
  "urban-spa-tlv": "urban_spa_tlv",
  "david-intercontinental": "the_spa",
  "horizon-spa": "horizon_spa",
  "debrah-spa": "Debrah_hotel_spa",
  "bobo-spa": "bobo_tlv_spa",
  "leonardo-plaza-jerusalem": "leonardo_plaza_jerusalem_spa",
  "playa-spa": "spa_OpolSky",
};
const legacySources = [
  ...previous.spa.map((place) => [place.id, new URL(place.sourceUrl).pathname]),
  ...Object.entries(curatedLegacyPaths).map(([id, path]) => [id, `/${path}`]),
];
const aliases = {};
for (const [oldId, oldPath] of legacySources) {
  const prefix = `${oldPath.replace(/\/$/, "").toLowerCase()}/`;
  const matches = sites.filter((site) => site.packages.some((pack) => pack.bookingUrl && new URL(pack.bookingUrl).pathname.toLowerCase().startsWith(prefix)));
  if (matches.length === 1) aliases[oldId] = `spa-${matches[0].id}`;
}
await writeFile(destination, `${JSON.stringify({ generatedAt: new Date().toISOString(), sites }, null, 2)}\n`, "utf8");
await writeFile(legacyDestination, `${JSON.stringify(aliases, null, 2)}\n`, "utf8");
process.stdout.write(`Spa Plus catalog: ${sites.length} sites, ${packageCount} packages, ${Object.keys(aliases).length} verified legacy redirects\n`);
