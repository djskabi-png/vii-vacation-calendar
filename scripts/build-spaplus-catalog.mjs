import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { parseFragment } from "parse5";
import { assertNoUnreviewedRemovals, compareCatalogCandidate, stageCatalogCandidate } from "./catalog-candidate-guard.mjs";

const destination = new URL("../app/data/spaplus-catalog.json", import.meta.url);
const stageOnly = process.argv.includes("--stage-only");
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
const previousCatalog = JSON.parse(await readFile(destination, "utf8"));
const changes = compareCatalogCandidate("spa", previousCatalog.sites, sites);
const staged = await stageCatalogCandidate("spa", sites, changes);
assertNoUnreviewedRemovals(changes, staged);
const previousAliases = JSON.parse(await readFile(legacyDestination, "utf8"));
const liveIds = new Set(sites.map((site) => `spa-${site.id}`));
const aliases = Object.fromEntries(Object.entries(previousAliases).filter(([, target]) => liveIds.has(target)));
if (!stageOnly) {
  await writeFile(destination, `${JSON.stringify({ generatedAt: new Date().toISOString(), sites }, null, 2)}\n`, "utf8");
  await writeFile(legacyDestination, `${JSON.stringify(aliases, null, 2)}\n`, "utf8");
}
process.stdout.write(`${JSON.stringify({ stageOnly, sites: sites.length, packages: packageCount, aliases: Object.keys(aliases).length, changes, staged })}\n`);
