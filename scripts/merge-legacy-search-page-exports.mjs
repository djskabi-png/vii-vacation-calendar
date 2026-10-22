import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [, , historicalArgument, currentArgument, outputArgument] = process.argv;
if (!historicalArgument || !currentArgument || !outputArgument) {
  throw new Error("Usage: node scripts/merge-legacy-search-page-exports.mjs <historical.json> <current.json> <output.json>");
}

const root = process.cwd();
const historical = JSON.parse(await readFile(resolve(root, historicalArgument), "utf8"));
const current = JSON.parse(await readFile(resolve(root, currentArgument), "utf8"));
const bySource = new Map((historical.rows || []).map((row) => [row.sourcePath, { ...row, sourceSnapshots: [historical.generatedAt] }]));

for (const row of current.rows || []) {
  const prior = bySource.get(row.sourcePath);
  bySource.set(row.sourcePath, {
    ...prior,
    ...row,
    body: row.body || prior?.body || "",
    faq: Array.isArray(row.faq) && row.faq.length ? row.faq : prior?.faq || [],
    sourceSnapshots: [...new Set([...(prior?.sourceSnapshots || []), current.generatedAt])],
  });
}

const rows = [...bySource.values()].sort((left, right) => left.sourcePath.localeCompare(right.sourcePath, "en"));
const output = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  source: [historicalArgument.replace(/\\/g, "/"), currentArgument.replace(/\\/g, "/")],
  sourceCounts: { historical: historical.rows?.length || 0, current: current.rows?.length || 0 },
  legacyUrlCount: Math.max(historical.legacyUrlCount || 0, current.legacyUrlCount || 0),
  legacySearchUrlCount: rows.length,
  exportedCount: rows.filter((row) => row.migrationStatus === "content-exported").length,
  blockedCount: rows.filter((row) => row.migrationStatus === "blocked").length,
  historicalOnlyCount: rows.filter((row) => !row.sourceSnapshots?.includes(current.generatedAt)).length,
  duplicateTargetCount: rows.length - new Set(rows.map((row) => row.targetPath)).size,
  rows,
};

await writeFile(resolve(root, outputArgument), `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ legacySearchUrlCount: output.legacySearchUrlCount, exportedCount: output.exportedCount,
  blockedCount: output.blockedCount, historicalOnlyCount: output.historicalOnlyCount, duplicateTargetCount: output.duplicateTargetCount }));
