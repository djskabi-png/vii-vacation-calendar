import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseUrl = (process.env.BASE_URL || "https://vii.spaplus.co").replace(/\/$/, "");
const catalog = JSON.parse(await readFile(new URL("../app/data/sergey-public-catalog.json", import.meta.url)));
const accepted = JSON.parse(await readFile(new URL("../app/data/accepted-runtime-catalog-state.json", import.meta.url)));
const report = { baseUrl, checkedAt: new Date().toISOString(), worlds: [], status: "passed" };

for (const world of ["vacations", "events"]) {
  const response = await fetch(`${baseUrl}/api/catalog?world=${world}`, {
    headers: { accept: "application/json", "user-agent": "VII QQQAAA catalog fallback parity" },
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  assert.equal(response.status, 200, `${world}: public catalog HTTP ${response.status}`);
  const payload = await response.json();
  assert.equal(payload.world, world, `${world}: wrong catalog world`);
  assert.ok(Array.isArray(payload.entries), `${world}: entries missing`);
  const state = accepted.worlds[world];
  assert.ok(state && Array.isArray(state.ids) && Array.isArray(state.additions), `${world}: accepted snapshot state missing`);
  const activeIds = new Set(state.ids.map(Number));
  const fallbackIds = new Set([
    ...catalog.places.filter((entry) => entry.world === world && activeIds.has(Number(entry.supplierId))).map((entry) => Number(entry.supplierId)),
    ...state.additions.map((entry) => Number(entry.supplierId)),
  ]);
  const liveIds = payload.entries.map((entry) => Number(entry.supplierId));
  const missing = liveIds.filter((id) => Number.isSafeInteger(id) && !fallbackIds.has(id));
  const liveIdSet = new Set(liveIds);
  const stale = [...fallbackIds].filter((id) => !liveIdSet.has(id));
  report.worlds.push({ world, live: liveIds.length, fallback: fallbackIds.size, missing, stale });
  assert.deepEqual(missing, [], `${world}: accepted public IDs missing from the emergency snapshot`);
  assert.deepEqual(stale, [], `${world}: withdrawn public IDs remain in the emergency snapshot`);
}

console.log(JSON.stringify(report, null, 2));
