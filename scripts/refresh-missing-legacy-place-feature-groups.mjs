import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "parse5";

const root = process.cwd();
const snapshotPath = resolve(root, ".qa-output/qa844-liran-1450/active-source-snapshot.ndjson");
const outputPath = resolve(root, "app/data/legacy-place-feature-groups.json");
const concurrency = 4;

const classes = (node) => node.attrs?.find((a) => a.name === "class")?.value.split(/\s+/).filter(Boolean) ?? [];
const descendants = (node, predicate) => (node.childNodes ?? []).flatMap((child) => [
  ...(predicate(child) ? [child] : []),
  ...descendants(child, predicate),
]);
const text = (node) => node.nodeName === "#text" ? node.value ?? "" : (node.childNodes ?? []).map(text).join(" ").replace(/\s+/g, " ").trim();
function amenityGroups(html) {
  const document = parse(html);
  const section = descendants(document, (node) => classes(node).includes("minisite-properties"))[0];
  const inner = section && descendants(section, (node) => classes(node).includes("inner"))[0];
  if (!inner) return [];
  return descendants(inner, (node) => classes(node).includes("item")).flatMap((item) => {
    const titleNode = descendants(item, (node) => classes(node).includes("title"))[0];
    const listNode = descendants(item, (node) => node.nodeName === "ul")[0];
    const title = titleNode ? text(titleNode).replace(/^\s*מידע\s*$/u, "מידע") : "";
    const items = listNode ? [...new Set(descendants(listNode, (node) => node.nodeName === "li").map(text).filter(Boolean))] : [];
    return title && items.length ? [{ title, items }] : [];
  });
}
const parseMaybe = (value) => { try { return typeof value === "string" ? JSON.parse(value) : value; } catch { return null; } };
const rows = (await readFile(snapshotPath, "utf8")).split(/\r?\n/).filter(Boolean).map(JSON.parse).filter((x) => x.type === "entry");
const sourcePlaces = rows.map((row) => ({ row, summary: parseMaybe(row.summary) })).filter(({ row, summary }) => row.world === "vacations" && /^https:\/\/(?:www\.)?vii\.co\.il\//i.test(summary?.sourceUrl || ""));
const existing = JSON.parse(await readFile(outputPath, "utf8"));
const groups = { ...(existing.groups || {}) };
const candidates = sourcePlaces.filter(({ summary }) => !groups[summary.slug]);
const failures = [];
let cursor = 0;
async function worker() {
  while (cursor < candidates.length) {
    const { summary } = candidates[cursor++];
    try {
      const response = await fetch(summary.sourceUrl, { headers: { accept: "text/html", "user-agent": "VII-Legacy-Migration/1.0" }, signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`http_${response.status}`);
      const parsed = amenityGroups(await response.text());
      if (!parsed.length) throw new Error("amenity_groups_missing");
      groups[summary.slug] = parsed;
    } catch (error) {
      failures.push({ slug: summary.slug, sourceUrl: summary.sourceUrl, error: error instanceof Error ? error.message : String(error) });
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));
const payload = {
  ...existing,
  schemaVersion: Math.max(2, Number(existing.schemaVersion) || 1),
  migratedAt: existing.migratedAt,
  refreshedAt: new Date().toISOString(),
  source: "former-public-vii-place-pages",
  placeCount: Math.max(Number(existing.placeCount) || 0, sourcePlaces.length),
  migratedCount: Object.keys(groups).length,
  refreshCandidateCount: candidates.length,
  refreshFailureCount: failures.length,
  refreshFailures: failures,
  groups: Object.fromEntries(Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, "en"))),
};
await writeFile(outputPath, `${JSON.stringify(payload)}\n`, "utf8");
console.log(JSON.stringify({ sourcePlaces: sourcePlaces.length, candidates: candidates.length, added: candidates.length - failures.length, failures: failures.length, target: "vacation-2728", targetAdded: Boolean(groups["vacation-2728"]), outputPath }));
if (failures.length) process.exitCode = 2;
