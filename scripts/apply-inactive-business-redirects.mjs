import { readFile, writeFile } from "node:fs/promises";

const inventoryUrl = new URL("../app/data/legacy-redirect-inventory.json", import.meta.url);
const archiveUrl = new URL("../app/data/inactive-business-archive.generated.json", import.meta.url);
const inventory = JSON.parse(await readFile(inventoryUrl, "utf8"));
const archive = JSON.parse(await readFile(archiveUrl, "utf8"));
const recovered = {};
for (const record of archive.records || []) {
  for (const path of record.legacyPaths || [record.legacyPath].filter(Boolean)) recovered[path] = record.canonicalPath;
}
Object.assign(recovered, archive.activeRedirects || {});
// These are not recoverable business-detail identities. Keep their actual
// semantic old-site behavior instead of fabricating an inactive supplier.
recovered["/art"] = "/magazine";
recovered["/villa_nis"] = "/vacations/eilat";
recovered["/villa_nis?from=2025-09-06&till=2025-09-07"] = "/vacations/eilat";

inventory.redirects = Object.fromEntries([...Object.entries({ ...(inventory.redirects || {}), ...recovered })]
  .sort(([left], [right]) => left.localeCompare(right, "en")));
const redirected = new Set(Object.keys(recovered));
inventory.gone = (inventory.gone || []).filter((path) => !redirected.has(path)).sort((left, right) => left.localeCompare(right, "en"));
inventory.generatedAt = new Date().toISOString();
inventory.sourceSnapshots = { ...(inventory.sourceSnapshots || {}), inactiveBusinessArchive: "app/data/inactive-business-archive.generated.json",
  inactiveBusinessArchiveSha256: archive.sha256 };
inventory.stats = { ...(inventory.stats || {}), total: Object.keys(inventory.redirects).length + inventory.gone.length,
  redirects: Object.keys(inventory.redirects).length, gone: inventory.gone.length,
  inactiveBusinessRedirects: Object.keys(recovered).length };
await writeFile(inventoryUrl, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ inactiveBusinessRedirects: Object.keys(recovered).length, remainingGone: inventory.gone.length }, null, 2));
