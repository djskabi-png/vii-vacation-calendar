import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "parse5";

const root = process.cwd();
const catalogPath = resolve(root, "app/data/sergey-public-catalog.json");
const outputPath = resolve(root, "app/data/legacy-place-feature-groups.json");
const concurrency = Math.max(1, Math.min(12, Number(process.env.VII_MIGRATION_CONCURRENCY) || 8));

function nodeClass(node) {
  return node.attrs?.find((attribute) => attribute.name === "class")?.value.split(/\s+/).filter(Boolean) ?? [];
}

function descendants(node, predicate) {
  const found = [];
  for (const child of node.childNodes ?? []) {
    if (predicate(child)) found.push(child);
    found.push(...descendants(child, predicate));
  }
  return found;
}

function nodeText(node) {
  if (node.nodeName === "#text") return node.value ?? "";
  return (node.childNodes ?? []).map(nodeText).join(" ").replace(/\s+/g, " ").trim();
}

function amenityGroups(html) {
  const document = parse(html);
  const section = descendants(document, (node) => nodeClass(node).includes("minisite-properties"))[0];
  const inner = section && descendants(section, (node) => nodeClass(node).includes("inner"))[0];
  if (!inner) return [];
  return descendants(inner, (node) => nodeClass(node).includes("item")).flatMap((item) => {
    const titleNode = descendants(item, (node) => nodeClass(node).includes("title"))[0];
    const listNode = descendants(item, (node) => node.nodeName === "ul")[0];
    const title = titleNode ? nodeText(titleNode).replace(/^\s*מידע\s*$/u, "מידע") : "";
    const items = listNode ? [...new Set(descendants(listNode, (node) => node.nodeName === "li").map(nodeText).filter(Boolean))] : [];
    return title && items.length ? [{ title, items }] : [];
  });
}

async function fetchPage(place) {
  const response = await fetch(place.sourceUrl, {
    headers: { accept: "text/html", "user-agent": "VII-Legacy-Migration/1.0" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`http_${response.status}`);
  const groups = amenityGroups(await response.text());
  if (!groups.length) throw new Error("amenity_groups_missing");
  return [place.slug, groups];
}

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const places = catalog.places.filter((place) => place.world === "vacations" && /^https:\/\/(?:www\.)?vii\.co\.il\//i.test(place.sourceUrl || ""));
const output = {};
const failures = [];
let cursor = 0;

async function worker() {
  while (cursor < places.length) {
    const place = places[cursor++];
    try {
      const [slug, groups] = await fetchPage(place);
      output[slug] = groups;
    } catch (error) {
      failures.push({ slug: place.slug, sourceUrl: place.sourceUrl, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
const payload = {
  schemaVersion: 1,
  migratedAt: new Date().toISOString(),
  source: "former-public-vii-place-pages",
  placeCount: places.length,
  migratedCount: Object.keys(output).length,
  failureCount: failures.length,
  failures,
  groups: Object.fromEntries(Object.entries(output).sort(([a], [b]) => a.localeCompare(b, "en"))),
};
await writeFile(outputPath, `${JSON.stringify(payload)}\n`, "utf8");
console.log(JSON.stringify({ placeCount: places.length, migratedCount: payload.migratedCount, failureCount: failures.length, outputPath }));
if (failures.length) process.exitCode = 2;
