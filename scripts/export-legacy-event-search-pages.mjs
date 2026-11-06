import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { parse } from "parse5";

const links = JSON.parse(await (await import("node:fs/promises")).readFile(".qa-output/legacy-events-search-links-current.json", "utf8"));
const base = "https://www.vii.co.il";
const concurrency = 4;
const deadlineMs = 20_000;
function attrs(node) { return Object.fromEntries((node.attrs || []).map(({ name, value }) => [name.toLowerCase(), value])); }
function clean(value = "") { return value.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(); }
function text(node) { if (!node) return ""; if (node.nodeName === "#text") return node.value || ""; if (["script", "style", "svg", "noscript"].includes(node.nodeName)) return ""; return (node.childNodes || []).map(text).join(" "); }
function visit(node, fn) { fn(node); for (const child of node.childNodes || []) visit(child, fn); }
function extract(html) {
  const doc = parse(html); const row = { title: "", h1: "", description: "", location: "", locationType: "", locationId: "", resultIds: [], resultNames: [], filters: {} };
  visit(doc, node => { const a = attrs(node); const classes = (a.class || "").split(/\s+/);
    if (node.nodeName === "title" && !row.title) row.title = clean(text(node));
    if (node.nodeName === "h1" && !row.h1) row.h1 = clean(text(node));
    if (node.nodeName === "meta" && a.name?.toLowerCase() === "description") row.description = clean(a.content);
    if (a.id === "freeInput") row.location = clean(a.value);
    if (a.id === "freeSearchType") row.locationType = clean(a.value);
    if (a.id === "freeSearchParam") row.locationId = clean(a.value);
    if (a["data-siteid"] && a["data-sitename"] && a["data-link"]) { row.resultIds.push(a["data-siteid"]); row.resultNames.push(clean(a["data-sitename"])); }
    if (a.name && a.value && /^(location|type|roomtypes|marea|area|sett|guests|eventtype|feature|features|from|till|date)/i.test(a.name)) row.filters[a.name] = a.value;
    if (classes.includes("selected") && a["data-name"] && a["data-free-type"]) row.filters[a["data-free-type"]] = clean(a["data-name"]);
  });
  row.resultIds = [...new Set(row.resultIds)]; row.resultNames = [...new Set(row.resultNames)];
  if (row.location) row.filters.location = row.location;
  if (row.locationType) row.filters.locationType = row.locationType;
  if (row.locationId) row.filters.locationId = row.locationId;
  return row;
}
const rows = new Array(links.length); let cursor = 0;
async function worker() { while (cursor < links.length) { const index = cursor++; const sourcePath = links[index]; const url = new URL(sourcePath, base); const started = Date.now(); try {
  const response = await fetch(url, { redirect: "follow", headers: { Accept: "text/html", "User-Agent": "VII event search inventory/1.0" }, signal: AbortSignal.timeout(deadlineMs) }); const html = await response.text(); const body = response.ok ? extract(html) : { title: "", h1: "", description: "", location: "", locationType: "", locationId: "", resultIds: [], resultNames: [], filters: {} }; rows[index] = { sourcePath, sourceUrl: url.toString(), finalUrl: response.url, status: response.status, sha256: createHash("sha256").update(html).digest("hex"), fetchedAt: new Date().toISOString(), elapsedMs: Date.now() - started, ...body };
 } catch (error) { rows[index] = { sourcePath, sourceUrl: url.toString(), status: null, finalUrl: null, sha256: null, fetchedAt: new Date().toISOString(), elapsedMs: Date.now() - started, error: error instanceof Error ? error.message : String(error), title: "", h1: "", description: "", location: "", locationType: "", locationId: "", resultIds: [], resultNames: [], filters: {} }; } } }
await Promise.all(Array.from({ length: concurrency }, worker));
const output = ".qa-output/legacy-events-search-pages-current.json"; await mkdir(".qa-output", { recursive: true }); await writeFile(output, JSON.stringify({ schemaVersion: 1, source: base, checkedAt: new Date().toISOString(), concurrency, count: rows.length, rows }, null, 2) + "\n"); console.log(JSON.stringify({ output, count: rows.length, ok: rows.filter(row => row.status === 200).length, failures: rows.filter(row => row.status !== 200).length }));
