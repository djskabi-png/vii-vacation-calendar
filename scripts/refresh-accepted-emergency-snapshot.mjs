#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const baseUrl = (process.env.BASE_URL || "https://vii.spaplus.co").replace(/\/$/, "");
const catalogUrl = new URL("../app/data/sergey-public-catalog.json", import.meta.url);
const acceptedUrl = new URL("../app/data/accepted-runtime-catalog-state.json", import.meta.url);
const eventAmenityUrl = new URL("../app/data/legacy-event-amenity-search-index.json", import.meta.url);
const catalog = JSON.parse(await readFile(catalogUrl, "utf8"));
const accepted = JSON.parse(await readFile(acceptedUrl, "utf8"));
const eventAmenity = JSON.parse(await readFile(eventAmenityUrl, "utf8"));
const bundledIds = new Set(catalog.places.map((entry) => `${entry.world}:${Number(entry.supplierId)}`));

for (const world of ["vacations", "events"]) {
  const response = await fetch(`${baseUrl}/api/catalog?world=${world}`, {
    headers: { accept: "application/json", "user-agent": "VII accepted emergency snapshot refresh" },
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  assert.equal(response.status, 200, `${world}: catalog HTTP ${response.status}`);
  const payload = await response.json();
  assert.equal(payload.world, world, `${world}: wrong catalog world`);
  assert.ok(Array.isArray(payload.entries) && payload.entries.length > 0, `${world}: entries missing`);

  const projected = payload.entries.map((entry) => {
    const summary = entry?.summary;
    assert.ok(summary && Number(summary.supplierId) === Number(entry.supplierId), `${world}: invalid summary for ${entry?.supplierId}`);
    assert.equal(summary.world, world, `${world}: wrong summary world for ${entry.supplierId}`);
    assert.ok(summary.name && summary.slug && summary.image, `${world}: incomplete summary for ${entry.supplierId}`);
    return summary;
  });
  const ids = projected.map((entry) => Number(entry.supplierId));
  assert.equal(new Set(ids).size, ids.length, `${world}: duplicate supplier IDs`);
  accepted.worlds[world] = {
    fetchedAt: new Date().toISOString(),
    ids,
    additions: projected.filter((entry) => !bundledIds.has(`${world}:${Number(entry.supplierId)}`)),
  };
  if (world === "events") {
    for (const entry of projected) {
      if (eventAmenity.entries[entry.slug]) continue;
      const filterIds = Array.isArray(entry.searchFilterIds) ? entry.searchFilterIds : [];
      eventAmenity.entries[entry.slug] = {
        supplierId: Number(entry.supplierId),
        semantic: filterIds.filter((id) => !/^amenity-\d+$/.test(id)),
        observedAmenityIds: filterIds.flatMap((id) => {
          const match = /^amenity-(\d+)$/.exec(id);
          return match ? [Number(match[1])] : [];
        }),
        accessibility: [],
      };
    }
    eventAmenity.sourceGeneration = new Date().toISOString();
  }
}

accepted.source = "accepted-runtime-catalog-state";
await writeFile(acceptedUrl, `${JSON.stringify(accepted)}\n`, "utf8");
await writeFile(eventAmenityUrl, `${JSON.stringify(eventAmenity, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  source: baseUrl,
  worlds: Object.fromEntries(Object.entries(accepted.worlds).map(([world, state]) => [world, { ids: state.ids.length, additions: state.additions.length }])),
}, null, 2));
