#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseDocument } from "parse5";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = path.join(root, ".qa-output");
const read = async (f) => JSON.parse(await fs.readFile(path.join(root, f), "utf8"));
const source = await read("app/data/sergey-public-catalog.json");
const taxonomy = await read("app/data/vacation-amenity-taxonomy.json");
const accepted = await read("app/data/accepted-runtime-catalog-state.json");
const eventIds = new Set(accepted.worlds.events.ids);
const places = [...source.places, ...(accepted.worlds.events.additions || [])].filter((p) => p.world === "events" && eventIds.has(Number(p.supplierId)));
if (places.length !== eventIds.size || new Set(places.map(p=>p.supplierId)).size !== eventIds.size) throw new Error("event_catalog_identity_mismatch");
await fs.mkdir(out, { recursive: true });
const timeout = 8000;
async function fetchPage(url) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), timeout);
  try { const r = await fetch(url, { signal: c.signal }); const b = await r.text(); return { status: r.status, body: b.slice(0, 2 * 1024 * 1024) }; }
  catch (e) { return { status: null, error: e.name === "AbortError" ? "timeout" : "fetch_error" }; }
  finally { clearTimeout(t); }
}
const norm = (v) => String(v || "").normalize("NFKC").replace(/[׳’‘]/g, "'").replace(/\s+/g, " ").trim();
function parse(page, expectedId) {
  if (!page.body) return { ids: [], labels: [], accessibility: [], error: page.error || `http_${page.status}` };
  const root = parseDocument(page.body);
  const pairs = [];
  let identityVerified = false;
  const text = (node) => node.nodeName === "#text" ? node.value || "" : (node.childNodes || []).map(text).join(" ");
  const walk = (node, inProperties = false) => {
    const attrs = Object.fromEntries((node.attrs || []).map((a) => [a.name.toLowerCase(), a.value]));
    const cls = String(attrs.class || "");
    if (attrs.id === "minisite" && Number(attrs["data-siteid"]) === expectedId) identityVerified = true;
    const inside = inProperties || /(?:^|\s)minisite-properties(?:\s|$)/i.test(cls);
    if (inside && node.nodeName === "li") {
      const id = Number(attrs["data-id"] || attrs["data-amenity-id"]);
      const label = norm(text(node));
      if (Number.isSafeInteger(id) && id > 0 && label) pairs.push({ id, label });
    }
    for (const child of node.childNodes || []) walk(child, inside);
  };
  walk(root);
  if (!identityVerified) return { ids: [], labels: [], accessibility: [], error: "source_identity_mismatch" };
  const labels = [...new Map(pairs.map((x) => [`${x.id}:${x.label}`, x])).values()];
  const accessibility = labels.filter((x) => /נגיש/i.test(x.label)).map((x) => x.label);
  const semantic = new Set();
  for (const label of labels.map((x) => x.label)) {
    const base = norm(label).split(/\s+[-–—]\s+/u)[0];
    for (const item of taxonomy.items) if (norm(item.title) === base) semantic.add(item.filterId);
  }
  return { identityVerified, ids: [...new Set(labels.map((x) => x.id))], labels, accessibility, semantic: [...semantic] };
}
const rows = []; const queue = [...places];
async function worker() { while (queue.length) { const place = queue.shift(); const page = await fetchPage(place.sourceUrl); const parsed = parse(page, Number(place.supplierId)); rows.push({ supplierId: Number(place.supplierId), slug: place.slug, sourceUrl: place.sourceUrl, status: page.status, observedAt: new Date().toISOString(), ...parsed }); await fs.writeFile(path.join(out, "event-amenity-crawl-progress.json"), JSON.stringify({ rows }, null, 2)); } }
await Promise.all([worker(), worker(), worker()]);
const failures = rows.filter((r) => r.status !== 200 || r.error || (r.ids.length === 0 && r.labels.length === 0));
if (failures.length === 0 && rows.length === places.length) {
  const entries = Object.fromEntries(rows.map((r) => [r.slug, { supplierId: r.supplierId, semantic: r.semantic, observedAmenityIds: r.ids, accessibility: r.accessibility }]));
  await fs.writeFile(path.join(root, "app/data/legacy-event-amenity-search-index.json"), JSON.stringify({ schemaVersion: 1, source: "legacy-event-minisite-properties", sourceGeneration: new Date().toISOString(), entries }, null, 2));
}
await fs.writeFile(path.join(root, "project_knowledge/diagnoses/EVENT_AMENITY_CRAWL_20261105.json"), JSON.stringify({ generatedAt: new Date().toISOString(), expected: places.length, completed: rows.length, identityVerified: rows.filter(r=>r.identityVerified).length, failed: failures.length, failedSupplierIds: failures.map((r) => r.supplierId), indexWritten: failures.length === 0 && rows.length === places.length }, null, 2));
console.log(JSON.stringify({ expected: places.length, completed: rows.length, identityVerified: rows.filter(r=>r.identityVerified).length, failed: failures.length, indexWritten: failures.length === 0 && rows.length === places.length }));
