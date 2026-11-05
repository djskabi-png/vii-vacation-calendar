#!/usr/bin/env node
import fs from "node:fs/promises";
import { searchLocationSlug } from "../app/data/world-search-landings.ts";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const outDir = path.join(root, ".qa-output");
const inventory = JSON.parse(await fs.readFile(path.join(root, "app/data/legacy-redirect-inventory.json"), "utf8"));
const entries = Object.entries(inventory.redirects).filter(([source]) => /^\/s(?:\?|\/)/.test(source)).slice(0, 10);
const dates = { from: "2026-11-26", till: "2026-11-28", guests: "2", children: "1", rooms: "1", minPrice: "200", maxPrice: "2000", sort: "price-asc" };
const origin = process.env.ORIGIN || "https://vii.spaplus.co";

async function get(url) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 15000);
  try { const r = await fetch(url, { redirect: "manual", signal: c.signal }); return { status: r.status, url: r.url, location: r.headers.get("location") }; }
  catch (e) { return { status: null, error: e.name === "AbortError" ? "timeout" : "fetch_error" }; }
  finally { clearTimeout(t); }
}
async function follow(url, limit = 4) {
  const chain = [];
  let current = url;
  for (let i = 0; i < limit; i++) { const result = await get(current); chain.push({ status: result.status, location: result.location || null }); if (![301, 302, 303, 307, 308].includes(result.status) || !result.location) return { final: result, chain }; current = new URL(result.location, current).href.replace("https://vii.spaplus.co", origin); }
  return { final: { status: null, error: "redirect_chain_limit" }, chain };
}
function withIntent(source, dated) {
  const u = new URL(source, "https://www.vii.co.il");
  if (dated) for (const [k, v] of Object.entries(dates)) u.searchParams.set(k, v);
  return u;
}
const jobs = entries.flatMap(([source, target]) => [false, true].map((dated) => ({ source, target, dated })));
async function runJob({ source, target, dated }) {
  const oldUrl = withIntent(source, dated);
  const targetUrl = new URL(target, "https://vii.spaplus.co");
  for (const [k, v] of oldUrl.searchParams) if (["from", "till", "guests", "rooms", "sort", "minPrice", "maxPrice", "children"].includes(k)) targetUrl.searchParams.set(k, v);
  const chain = await follow(`${origin}${oldUrl.pathname}${oldUrl.search}`);
  const redirect = chain.chain[0] || {};
  const final = chain.final;
  const redirected = redirect.location ? new URL(redirect.location, origin) : null;
  const finalUrl = final.url ? new URL(final.url) : null;
  const intentPreserved = [...targetUrl.searchParams].every(([k,v])=>redirected?.searchParams.get(k)===v && (finalUrl?.searchParams.get(k)===v || k === "location" && finalUrl?.pathname.split("/").includes(searchLocationSlug(v))));
  const targetMatched = redirected?.pathname === targetUrl.pathname;
  return { intentPreserved, targetMatched, source, mode: dated ? "dated" : "undated", oldIntent: Object.fromEntries(oldUrl.searchParams), inventoryTarget: target, redirectStatus: redirect.status, redirectLocation: redirect.location, redirectChain: chain.chain, finalStatus: final.status, finalLocation: final.location || null, expectedPath: targetUrl.pathname, preservedQuery: Object.fromEntries(targetUrl.searchParams), status: redirect.status === 301 && final.status === 200 && intentPreserved && targetMatched ? "pass" : "not_verified" };
}
const rows = [];
for (let i = 0; i < jobs.length; i += 3) rows.push(...await Promise.all(jobs.slice(i, i + 3).map(runJob)));
await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(root, process.env.REPORT || ".qa-output/comprehensive-search20.json"), JSON.stringify({ generatedAt: new Date().toISOString(), count: rows.length, rows }, null, 2));
console.log(JSON.stringify({ count: rows.length, pass: rows.filter((r) => r.status === "pass").length, notVerified: rows.filter((r) => r.status !== "pass").length }));

if(rows.some(r=>r.status!=="pass")) process.exitCode=1;
