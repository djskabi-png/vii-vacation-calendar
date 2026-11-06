import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const input = JSON.parse(await readFile(".qa-output/legacy-events-search-pages-current.json", "utf8"));
const slug = (row) => {
  const source = row.sourcePath.replace(/^https?:\/\/[^/]+/, "").replace(/^\/events\/s\//i, "").replace(/\/\d+$/, "");
  const ascii = decodeURIComponent(source).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "israel";
  return `${ascii}-${createHash("sha256").update(row.sourcePath).digest("hex").slice(0, 8)}`;
};
const rows = input.rows.filter(row => row.h1 && row.resultIds?.length).map(row => {
  const filters = { ...(row.filters || {}) };
  const labels = row.filterLabels || {};
  const type = Array.isArray(labels["roomTypes[]"]) ? labels["roomTypes[]"][0] : labels["roomTypes[]"];
  if (type) filters.type = type;
  const attributeIds = Object.entries(row.filters || {})
    .filter(([key]) => key === "attr[]" || key === "attributes[]" || key === "features[]")
    .flatMap(([, value]) => Array.isArray(value) ? value : [value])
    .filter(value => /^\d+$/.test(String(value)))
    .map(value => `amenity-${value}`);
  if (attributeIds.length) filters.features = [...new Set(attributeIds)].join(",");
  delete filters["roomTypes[]"]; delete filters["attr[]"]; delete filters["attributes[]"]; delete filters["features[]"];
  delete filters.location; delete filters.locationType; delete filters.locationId; delete filters.freeSearchParam; delete filters.freeSearchType;
  const params = new URLSearchParams(); if (row.location) params.set("location", row.location); if (typeof filters.type === "string") params.set("type", filters.type); if (typeof filters.features === "string") params.set("features", filters.features);
  return { id: `legacy-event-${createHash("sha256").update(row.sourcePath).digest("hex").slice(0, 12)}`, legacySourcePath: row.sourcePath, sourcePath: `/events/search${params.size ? `?${params}` : ""}`, location: row.location || "כל הארץ", filters, sourceFilterLabels: labels, slug: slug(row), title: row.h1, metaTitle: row.title.replace(/\s+-\s+V for Events$/i, ""), metaDescription: row.description, h1: row.h1, summary: row.description, canonicalPath: `/search/events/${slug(row)}`, latestResultCount: row.resultIds.length, updatedAt: row.fetchedAt, body: row.description, faq: [], sourceSha256: row.sha256 };
});
await writeFile("app/data/legacy-event-search-pages.json", JSON.stringify(rows, null, 2) + "\n"); console.log(JSON.stringify({ count: rows.length }));
