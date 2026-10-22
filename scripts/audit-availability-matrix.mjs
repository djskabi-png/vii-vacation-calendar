#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

function argument(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const baseUrl = argument("base-url", "https://vii.spaplus.co").replace(/\/$/, "");
const reportFile = argument("report-file", "");
const version = argument("version", "unversioned");
const timeoutMs = 30_000;
const israelDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" });
const plusDays = (days) => { const date = new Date(); date.setUTCDate(date.getUTCDate() + days); return israelDay.format(date); };
const from = plusDays(14);
const till = plusDays(16);

async function request(path, init = {}) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`, { ...init, redirect: "manual", signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "application/json, text/html", ...(init.headers || {}) } });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* HTML route. */ }
  return { status: response.status, headers: Object.fromEntries(response.headers), text, json, durationMs: Math.round(performance.now() - started) };
}

const cases = [
  {
    id: "TC-01", name: "undated online capability cache",
    run: async () => { const response = await request("/api/vii/online-capabilities"); const capabilities = response.json?.capabilities; return { response, observations: { capabilityCount: capabilities && typeof capabilities === "object" ? Object.keys(capabilities).length : 0 }, failures: [response.status !== 200 ? `http-${response.status}` : null, !capabilities || typeof capabilities !== "object" || !Object.keys(capabilities).length ? "empty-capability-cache" : null].filter(Boolean) }; },
  },
  {
    id: "TC-02", name: "dated vacation authority",
    run: async () => { const response = await request("/api/vii/live-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ world: "vacations", from, till, guests: 2, rooms: [{ adults: 2 }], discoverySearch: true }) }); const results = response.json?.results; const available = Array.isArray(results) ? results.filter((item) => item?.available === true && Number(item?.total) > 0) : []; const unavailable = Array.isArray(results) ? results.filter((item) => item?.available === false) : []; const unknown = Array.isArray(results) ? results.filter((item) => item?.available === null && typeof item?.reason === "string" && item.reason.length > 0) : []; const malformed = Array.isArray(results) ? results.filter((item) => !Number.isSafeInteger(item?.siteID) || !(item?.available === true || item?.available === false || item?.available === null) || item?.available === null && (typeof item?.reason !== "string" || !item.reason)) : []; return { response, observations: { from, till, resultCount: Array.isArray(results) ? results.length : null, availableCount: available.length, unavailableCount: unavailable.length, unknownCount: unknown.length, cache: response.json?.cache || null }, failures: [response.status !== 200 ? `http-${response.status}` : null, !Array.isArray(results) ? "missing-results-array" : null, Array.isArray(results) && !available.length ? "no-confirmed-available-result" : null, malformed.length ? "malformed-availability-result" : null].filter(Boolean) }; },
  },
  {
    id: "TC-03", name: "hourly Haifa recovery route",
    run: async () => { const paths = ["/hourly?location=%D7%97%D7%99%D7%A4%D7%94", "/hourly?location=%D7%97%D7%99%D7%A4%D7%94+%D7%95%D7%94%D7%9B%D7%A8%D7%9E%D7%9C"]; const responses = await Promise.all(paths.map((path) => request(path))); return { responses, observations: responses.map((response, index) => ({ path: paths[index], status: response.status, hasHeading: /<h1\b/i.test(response.text), bodyBytes: response.text.length })), failures: responses.flatMap((response, index) => [response.status !== 200 ? `${paths[index]}:http-${response.status}` : null, !/<h1\b/i.test(response.text) ? `${paths[index]}:missing-h1` : null].filter(Boolean)) }; },
  },
  {
    id: "TC-04", name: "accepted discovery period fallback",
    run: async () => { const periods = ["tomorrow", "weekend", "friday-weekend"]; const responses = await Promise.all(periods.map((period) => request(`/api/vii/home-deals?period=${period}&locale=he`))); const usable = responses.filter((response) => response.status === 200 && Array.isArray(response.json?.deals) && response.json.deals.length); return { responses, observations: responses.map((response, index) => ({ period: periods[index], status: response.status, deals: Array.isArray(response.json?.deals) ? response.json.deals.length : 0, cache: response.headers["x-vii-discovery-cache"] || null })), failures: usable.length ? [] : ["no-usable-accepted-period"] }; },
  },
  {
    id: "TC-05", name: "cross-world route contract",
    run: async () => { const paths = ["/search?location=%D7%9B%D7%9C+%D7%94%D7%90%D7%A8%D7%A5&online=1", "/events/search", "/spas", "/hourly"]; const responses = await Promise.all(paths.map((path) => request(path))); return { responses, observations: responses.map((response, index) => ({ path: paths[index], status: response.status, hasHeading: /<h1\b/i.test(response.text), origin: response.headers["x-vii-data-origin"] || null })), failures: responses.flatMap((response, index) => [response.status !== 200 ? `${paths[index]}:http-${response.status}` : null, !/<h1\b/i.test(response.text) ? `${paths[index]}:missing-h1` : null].filter(Boolean)) }; },
  },
  {
    id: "TC-07", name: "conversion report authorization",
    run: async () => { const response = await request(`/api/admin/business-performance?mode=conversions&placeId=vacation-2566&world=vacation&from=${plusDays(-29)}&till=${plusDays(0)}`); return { response, observations: { status: response.status, cacheControl: response.headers["cache-control"] || null }, failures: [response.status !== 403 ? `expected-403-got-${response.status}` : null, /contacts|phone|email|authorization|bearer/i.test(response.text) ? "sensitive-response-shape" : null].filter(Boolean) }; },
  },
  {
    id: "TC-10", name: "invalid dated request fails closed",
    run: async () => { const response = await request("/api/vii/live-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ world: "vacations", from: "invalid", till: "invalid", guests: 2 }) }); return { response, observations: { status: response.status, error: response.json?.error || null }, failures: [response.status !== 400 ? `expected-400-got-${response.status}` : null, response.json?.error !== "invalid_search" ? "wrong-error-contract" : null].filter(Boolean) }; },
  },
];

const reports = [];
for (const testCase of cases) {
  try { reports.push({ id: testCase.id, name: testCase.name, ...(await testCase.run()) }); }
  catch (error) { reports.push({ id: testCase.id, name: testCase.name, failures: [error instanceof Error ? error.message : String(error)] }); }
}

const failures = reports.flatMap((item) => item.failures.map((failure) => `${item.id}:${failure}`));
const report = { schemaVersion: 1, target: baseUrl, version, observedAt: new Date().toISOString(), from, till, passed: failures.length === 0, failures, reports };
if (reportFile) { await mkdir(dirname(reportFile), { recursive: true }); await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`); }
console.log(JSON.stringify(report, null, 2));
process.exitCode = failures.length ? 1 : 0;
