import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parse } from "parse5";

const outputArgument = process.argv[2] || "project_knowledge/launch/legacy-search-pages-20261015.json";
const csvArgument = process.argv[3] || "project_knowledge/launch/legacy-search-pages-20261015.csv";
const concurrency = Math.max(1, Math.min(16, Number(process.env.VII_LEGACY_CRAWL_CONCURRENCY || 10)));
const deadlineMs = Math.max(5_000, Math.min(60_000, Number(process.env.VII_LEGACY_CRAWL_TIMEOUT_MS || 25_000)));

function decoded(value = "") {
  return value.replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/g, "'").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
}

function clean(value = "") {
  return decoded(value).replace(/\s+/g, " ").trim();
}

function attrs(node) {
  return Object.fromEntries((node.attrs || []).map(({ name, value }) => [name.toLowerCase(), value]));
}

function textContent(node) {
  if (!node) return "";
  if (node.nodeName === "#text") return node.value || "";
  if (["script", "style", "svg", "noscript", "template"].includes(node.nodeName)) return "";
  return (node.childNodes || []).map(textContent).join(" ");
}

function visit(node, callback) {
  callback(node);
  for (const child of node.childNodes || []) visit(child, callback);
}

function extract(html) {
  const document = parse(html);
  const found = { title: "", h1: "", metaDescription: "", robots: "", canonical: "", resultSummary: "", location: "", locationType: "", locationId: "" };
  visit(document, (node) => {
    const attribute = attrs(node);
    const classNames = (attribute.class || "").split(/\s+/);
    if (node.nodeName === "title" && !found.title) found.title = clean(textContent(node));
    if (node.nodeName === "h1" && !found.h1) found.h1 = clean(textContent(node));
    if (node.nodeName === "meta" && attribute.name?.toLowerCase() === "description") found.metaDescription = clean(attribute.content);
    if (node.nodeName === "meta" && attribute.name?.toLowerCase() === "robots") found.robots = clean(attribute.content).toLowerCase();
    if (node.nodeName === "link" && attribute.rel?.toLowerCase().split(/\s+/).includes("canonical")) found.canonical = attribute.href || "";
    if (classNames.includes("count-res") && !found.resultSummary) found.resultSummary = clean(textContent(node));
    if (attribute.id === "freeInput") found.location = clean(attribute.value);
    if (attribute.id === "freeSearchType") found.locationType = clean(attribute.value);
    if (attribute.id === "freeSearchParam") found.locationId = clean(attribute.value);
  });
  return found;
}

function normalizedPath(value) {
  const url = new URL(value);
  return (url.pathname.replace(/\/+$/, "") || "/").toLowerCase();
}

function asciiSlug(sourceUrl) {
  const segments = new URL(sourceUrl).pathname.split("/").filter(Boolean).slice(1).map((segment) => decodeURIComponent(segment));
  const base = segments.join("-").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const suffix = createHash("sha256").update(normalizedPath(sourceUrl)).digest("hex").slice(0, 8);
  return `${base || "legacy-search"}-${suffix}`.slice(0, 120).replace(/-+$/g, "");
}

async function fetchText(url) {
  const response = await fetch(url, { redirect: "follow", headers: { Accept: "text/html,application/xml;q=0.9,*/*;q=0.8", "User-Agent": "VII migration inventory/1.0" }, signal: AbortSignal.timeout(deadlineMs) });
  const body = await response.text();
  return { response, body };
}

async function legacySitemapUrls() {
  const { response, body } = await fetchText("https://www.vii.co.il/sitemap.php");
  if (!response.ok) throw new Error(`legacy_sitemap_index_${response.status}`);
  const children = [...body.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => clean(match[1]));
  if (!children.length) throw new Error("legacy_sitemap_children_missing");
  const urls = [];
  for (const child of children) {
    const result = await fetchText(child);
    if (!result.response.ok) throw new Error(`legacy_sitemap_child_${result.response.status}_${child}`);
    urls.push(...[...result.body.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => clean(match[1])));
  }
  return [...new Set(urls)];
}

function csvCell(value) {
  const string = value == null ? "" : String(value);
  return /[",\r\n]/.test(string) ? `"${string.replace(/"/g, '""')}"` : string;
}

const allLegacyUrls = await legacySitemapUrls();
const searchUrls = allLegacyUrls.filter((value) => /^\/s(?:\/|$)/i.test(new URL(value).pathname));
const rows = new Array(searchUrls.length);
let cursor = 0;

async function worker() {
  while (cursor < searchUrls.length) {
    const index = cursor++;
    const sourceUrl = searchUrls[index];
    const sourcePath = normalizedPath(sourceUrl);
    const started = Date.now();
    try {
      const { response, body } = await fetchText(sourceUrl);
      const extracted = response.ok ? extract(body) : { title: "", h1: "", metaDescription: "", robots: "", canonical: "", resultSummary: "", location: "", locationType: "", locationId: "" };
      const slug = asciiSlug(sourceUrl);
      const targetPath = `/search/vacations/${slug}`;
      const ready = response.ok && extracted.h1.length >= 4 && extracted.metaDescription.length >= 30;
      rows[index] = { sourceUrl, sourcePath, sourceStatus: response.status, finalSourceUrl: response.url, ...extracted,
        slug, targetPath, migrationStatus: ready ? "content-exported" : "blocked", blocker: ready ? null : !response.ok ? `source_http_${response.status}` : "missing_required_content",
        fetchedAt: new Date().toISOString(), elapsedMs: Date.now() - started };
    } catch (error) {
      const slug = asciiSlug(sourceUrl);
      rows[index] = { sourceUrl, sourcePath, sourceStatus: null, finalSourceUrl: null, title: "", h1: "", metaDescription: "", robots: "", canonical: "", resultSummary: "", location: "", locationType: "", locationId: "",
        slug, targetPath: `/search/vacations/${slug}`, migrationStatus: "blocked", blocker: error instanceof Error ? error.message : String(error), fetchedAt: new Date().toISOString(), elapsedMs: Date.now() - started };
    }
    if ((index + 1) % 100 === 0) process.stderr.write(`exported ${index + 1}/${searchUrls.length}\n`);
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, searchUrls.length || 1) }, worker));

const summary = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: "https://www.vii.co.il/sitemap.php",
  legacyUrlCount: allLegacyUrls.length,
  legacySearchUrlCount: searchUrls.length,
  exportedCount: rows.filter((row) => row?.migrationStatus === "content-exported").length,
  blockedCount: rows.filter((row) => row?.migrationStatus === "blocked").length,
  duplicateTargetCount: rows.length - new Set(rows.map((row) => row.targetPath)).size,
  rows,
};

const output = resolve(process.cwd(), outputArgument);
const csvOutput = resolve(process.cwd(), csvArgument);
await mkdir(dirname(output), { recursive: true });
await mkdir(dirname(csvOutput), { recursive: true });
await writeFile(output, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
const columns = ["sourceUrl", "sourcePath", "sourceStatus", "finalSourceUrl", "title", "h1", "metaDescription", "robots", "canonical", "resultSummary", "location", "locationType", "locationId", "slug", "targetPath", "migrationStatus", "blocker", "fetchedAt", "elapsedMs"];
await writeFile(csvOutput, `${columns.join(",")}\n${rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")).join("\n")}\n`, "utf8");
console.log(JSON.stringify({ legacyUrlCount: summary.legacyUrlCount, legacySearchUrlCount: summary.legacySearchUrlCount, exportedCount: summary.exportedCount, blockedCount: summary.blockedCount, duplicateTargetCount: summary.duplicateTargetCount, output, csvOutput }));
