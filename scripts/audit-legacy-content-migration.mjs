import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const [, , outputArgument = "project_knowledge/release_evidence/vii-legacy-content-redirects-20261022/legacy-content-migration-audit.json",
  csvArgument = "project_knowledge/release_evidence/vii-legacy-content-redirects-20261022/remaining-non-place-issues.csv"] = process.argv;
const root = process.cwd();
const publications = JSON.parse(await readFile(resolve(root, "app/data/legacy-search-page-publications.json"), "utf8"));
const inventory = JSON.parse(await readFile(resolve(root, "app/data/legacy-redirect-inventory.json"), "utf8"));
const exported = JSON.parse(await readFile(resolve(root, "project_knowledge/launch/legacy-search-pages-complete-merged-20261022.json"), "utf8"));

const asciiPath = (value) => !/[\u0590-\u05ff]/.test(String(value || ""));
const searchPath = (value) => /^\/s(?:\/|\?|$)/.test(value);
const exportBySource = new Map(exported.rows.map((row) => [row.sourcePath, row]));
const staticPages = [
  { oldPath: "/term_and_conditions", newPath: "/legal/terms", type: "legal" },
  { oldPath: "/privacy_policy", newPath: "/legal/privacy", type: "legal" },
  { oldPath: "/%d7%91%d7%99%d7%98%d7%95%d7%9c_%d7%94%d7%96%d7%9e%d7%a0%d7%94", newPath: "/legal/cancellation", type: "legal" },
  { oldPath: "/%d7%a6%d7%95%d7%a8_%d7%a7%d7%a9%d7%a8", newPath: "/join", type: "contact" },
];

const remainingNonPlaceIssues = inventory.gone.filter(searchPath).map((oldPath) => {
  const row = exportBySource.get(oldPath);
  return {
    oldUrl: `https://www.vii.co.il${oldPath}`,
    oldPath,
    sourceStatus: row?.sourceStatus ?? null,
    issue: row?.sourceStatus === 200
      ? "העמוד הישן מחזיר מעטפת ריקה ללא כותרת, תיאור או תוכן שאפשר להעביר בבטחה"
      : `מקור ישן לא זמין${row?.sourceStatus ? `, HTTP ${row.sourceStatus}` : ""}`,
    action: "נשאר 410 עד שיימצא מקור תוכן אמין או כוונת חיפוש מזוהה",
  };
});

const failures = [];
for (const page of publications.pages) {
  if (!asciiPath(page.canonicalPath)) failures.push(`hebrew_target:${page.canonicalPath}`);
  if (inventory.redirects[page.legacySourcePath] !== page.canonicalPath) failures.push(`redirect_mismatch:${page.legacySourcePath}`);
  if (page.body.length < 120) failures.push(`thin_body:${page.legacySourcePath}`);
}
for (const page of staticPages) {
  if (inventory.redirects[page.oldPath] !== page.newPath) failures.push(`static_redirect_mismatch:${page.oldPath}`);
}
for (const [source, target] of Object.entries(inventory.redirects)) {
  if (!asciiPath(target)) failures.push(`hebrew_redirect_target:${source}`);
}

const audit = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  scope: "Known legacy URL union: current legacy sitemap plus stored Search Console export. Place-detail URLs are excluded from the non-place migration requirement.",
  sourceCoverage: {
    knownLegacyUrls: inventory.stats.total,
    currentLegacySitemapUrls: inventory.sourceSnapshots.legacySitemapUrlCount,
    storedSearchConsoleUrls: inventory.sourceSnapshots.searchConsoleUrlCount,
  },
  nonPlace: {
    migratedSearchPages: publications.count,
    migratedSearchAliases: publications.aliases?.length || 0,
    migratedSearchUrls: publications.count + (publications.aliases?.length || 0),
    migratedStaticPages: staticPages.length,
    pagesWithRecoveredFaq: publications.pages.filter((page) => page.faq.length > 0).length,
    pagesWithCompleteBody: publications.pages.filter((page) => page.body.length >= 120).length,
    remainingIssues: remainingNonPlaceIssues.length,
  },
  excludedPlacePages: inventory.gone.length - remainingNonPlaceIssues.length,
  redirectInventory: inventory.stats,
  urlPolicy: {
    approvedCanonicalPathsAsciiOnly: publications.pages.every((page) => asciiPath(page.canonicalPath)),
    redirectTargetsAsciiOnly: Object.values(inventory.redirects).every(asciiPath),
  },
  staticPages,
  remainingNonPlaceIssues,
  failures,
  passed: failures.length === 0,
};

const csvCell = (value) => /[",\r\n]/.test(String(value ?? "")) ? `"${String(value ?? "").replace(/"/g, '""')}"` : String(value ?? "");
const output = resolve(root, outputArgument);
const csvOutput = resolve(root, csvArgument);
await mkdir(dirname(output), { recursive: true });
await mkdir(dirname(csvOutput), { recursive: true });
await writeFile(output, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
const columns = ["oldUrl", "sourceStatus", "issue", "action"];
await writeFile(csvOutput, `${columns.join(",")}\n${remainingNonPlaceIssues.map((row) => columns.map((column) => csvCell(row[column])).join(",")).join("\n")}\n`, "utf8");
console.log(JSON.stringify({ passed: audit.passed, migratedSearchPages: audit.nonPlace.migratedSearchPages, remainingNonPlaceIssues: audit.nonPlace.remainingIssues, excludedPlacePages: audit.excludedPlacePages, output, csvOutput }));
if (!audit.passed) process.exitCode = 1;
