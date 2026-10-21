import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const base = (process.argv[2] || "https://vii.spaplus.co").replace(/\/$/, "");
const output = process.argv[3] || path.resolve("project_knowledge/release_evidence/runtime-distribution");
const samples = Math.max(3, Math.min(9, Number(process.env.VII_PERF_SAMPLES || 5)));
const routes = ["/", "/search", "/events", "/spas", "/hourly", "/providers", "/attractions", "/en"];
await mkdir(output, { recursive: true });

const percentile = (values, p) => values.slice().sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * p) - 1)];
async function measure(route, mode, index) {
  const url = new URL(route, base);
  if (mode === "cold") url.searchParams.set("vii_audit", `${Date.now()}-${index}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  const started = performance.now();
  try {
    const response = await fetch(url, { headers: { "user-agent": "VII bounded runtime distribution audit", ...(mode === "cold" ? { "cache-control": "no-cache" } : {}) }, signal: controller.signal });
    const body = await response.text();
    return { ok: response.status === 200 && /<h1(?:\s|>)/i.test(body), status: response.status, elapsedMs: Math.round(performance.now() - started), cache: response.headers.get("x-vii-page-cache"), layer: response.headers.get("x-vii-cache-layer"), origin: response.headers.get("x-vii-data-origin"), bytes: Buffer.byteLength(body) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), elapsedMs: Math.round(performance.now() - started) };
  } finally { clearTimeout(timer); }
}

const rows = [];
for (const route of routes) {
  for (const mode of ["cold", "warm"]) {
    const observations = [];
    for (let index = 0; index < samples; index += 1) observations.push(await measure(route, mode, index));
    const times = observations.filter(item => item.ok).map(item => item.elapsedMs);
    rows.push({ route, mode, samples: observations, summary: times.length ? { count: times.length, p50: percentile(times, .5), p95: percentile(times, .95), max: Math.max(...times), min: Math.min(...times) } : null });
  }
}
const failures = rows.flatMap(row => {
  const errors = row.samples.filter(item => !item.ok);
  const repeatedSevere = row.samples.filter(item => item.elapsedMs > 8_000).length >= 2;
  return errors.length || repeatedSevere ? [{ route: row.route, mode: row.mode, errors, repeatedSevere, summary: row.summary }] : [];
});
const report = { base, checkedAt: new Date().toISOString(), requestedSamples: samples, rows, failures, status: failures.length ? "failed" : "passed" };
await writeFile(path.join(output, "runtime-distribution.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, summaries: rows.map(({ route, mode, summary }) => ({ route, mode, ...summary })), failures }, null, 2));
if (failures.length) process.exitCode = 1;
