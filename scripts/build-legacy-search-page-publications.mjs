import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [, , exportArgument = "project_knowledge/launch/legacy-search-pages-20261015.json",
  publicationsArgument = "app/data/legacy-search-page-publications.json",
  redirectArgument = "app/data/legacy-redirect-inventory.json"] = process.argv;

const root = process.cwd();
const exported = JSON.parse(await readFile(resolve(root, exportArgument), "utf8"));
const inventory = JSON.parse(await readFile(resolve(root, redirectArgument), "utf8"));

function clip(value, limit) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length <= limit ? text : `${text.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function stableId(sourcePath) {
  return `legacy-${createHash("sha256").update(sourcePath).digest("hex").slice(0, 24)}`;
}

function effectiveDescription(row) {
  const source = String(row.metaDescription || "").trim();
  if (source.length >= 40) return source;
  if (source) return `${source}. תוצאות עדכניות מהקטלוג הפעיל של VII, עם פרטים ותמונות.`;
  return `${row.h1}. כאן מוצגים מקומות רלוונטיים מתוך הקטלוג הפעיל של VII, עם פרטים, תמונות ואפשרות לבדוק זמינות.`;
}

function sourceSearchPath(row) {
  const params = new URLSearchParams();
  if (row.location) params.set("location", row.location);
  return `/search${params.size ? `?${params}` : ""}`;
}

function bodyFor(row) {
  const first = clip(effectiveDescription(row), 420);
  const second = `בעמוד הזה מוצגות תוצאות עדכניות מהקטלוג הפעיל של VII עבור ${row.h1}. אפשר לפתוח כל מקום, לבדוק תמונות ופרטים, ולשנות את החיפוש אם תרצו להרחיב את האזור או את סוג המקום.`;
  const third = "מספר התוצאות עשוי להשתנות לפי מקומות שנוספו, עודכנו או הוסרו. לפני הזמנה מומלץ לבדוק בעמוד המקום את הפרטים העדכניים ולוודא זמינות ישירות בתהליך ההזמנה או הפנייה.";
  return [first, second, third].filter(Boolean).join("\n\n").slice(0, 8000);
}

const readyRows = exported.rows.filter((row) => row.migrationStatus === "content-exported" ||
  (row.sourceStatus === 200 && row.blocker === "missing_required_content" && String(row.h1 || "").trim().length >= 4));
const generatedAt = exported.generatedAt || new Date().toISOString();
const publications = readyRows.map((row) => ({
  id: stableId(row.sourcePath),
  origin: "managed",
  world: "vacation",
  locale: "he",
  location: row.location || "כל הארץ",
  filters: {},
  sourcePath: sourceSearchPath(row),
  legacySourcePath: row.sourcePath,
  contentRecovery: row.migrationStatus === "content-exported" ? null : "description-derived-from-source-h1",
  proposedPath: row.targetPath,
  suggestedTitle: clip(row.h1 || row.title, 90),
  latestResultCount: Number((row.resultSummary || "").match(/\d+/)?.[0] || 0),
  firstSeenAt: generatedAt,
  lastSeenAt: generatedAt,
  searches: 0,
  uniqueSessions: 0,
  internalSearches: 0,
  internalUniqueSessions: 0,
  internalOnly: false,
  zeroResults: 0,
  status: "published",
  assignee: null,
  title: clip(row.h1 || row.title, 90),
  metaTitle: clip(row.title || row.h1, 70),
  metaDescription: clip(effectiveDescription(row), 180),
  h1: clip(row.h1 || row.title, 100),
  summary: clip(effectiveDescription(row), 420),
  body: bodyFor(row),
  faq: [],
  slug: row.slug,
  canonicalPath: row.targetPath,
  robotsIndex: true,
  scheduledAt: null,
  publishedAt: generatedAt,
  version: 1,
  updatedAt: generatedAt,
  updatedBy: "system-legacy-migration",
  readiness: 100,
  priority: 0,
}));

const duplicateIds = publications.length - new Set(publications.map((row) => row.id)).size;
const duplicatePaths = publications.length - new Set(publications.map((row) => row.canonicalPath)).size;
if (duplicateIds || duplicatePaths) throw new Error(`legacy_publication_collision ids=${duplicateIds} paths=${duplicatePaths}`);
for (const row of publications) {
  if (row.title.length < 8 || row.metaTitle.length < 8 || row.metaDescription.length < 40 || row.h1.length < 8 || row.summary.length < 30 || row.body.length < 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug)) {
    throw new Error(`legacy_publication_not_ready ${row.legacySourcePath}`);
  }
}

const redirects = { ...inventory.redirects };
const gone = new Set(inventory.gone || []);
for (const row of publications) {
  redirects[row.legacySourcePath] = row.canonicalPath;
  gone.delete(row.legacySourcePath);
}
const orderedRedirects = Object.fromEntries(Object.entries(redirects).sort(([left], [right]) => left.localeCompare(right, "en")));
const orderedGone = [...gone].sort((left, right) => left.localeCompare(right, "en"));
const updatedInventory = {
  ...inventory,
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  sourceSnapshots: {
    ...inventory.sourceSnapshots,
    legacySearchPageExport: exportArgument.replace(/\\/g, "/"),
    legacySearchPageCount: exported.legacySearchUrlCount,
    migratedLegacySearchPageCount: publications.length,
    blockedLegacySearchPageCount: exported.legacySearchUrlCount - publications.length,
  },
  stats: {
    total: Object.keys(orderedRedirects).length + orderedGone.length,
    redirects: Object.keys(orderedRedirects).length,
    gone: orderedGone.length,
    managedSearchRedirects: publications.length,
  },
  redirects: orderedRedirects,
  gone: orderedGone,
};

const compactPages = publications.map((page) => ({
  id: page.id,
  legacySourcePath: page.legacySourcePath,
  contentRecovery: page.contentRecovery,
  sourcePath: page.sourcePath,
  location: page.location,
  slug: page.slug,
  title: page.title,
  metaTitle: page.metaTitle,
  metaDescription: page.metaDescription,
  h1: page.h1,
  summary: page.summary,
  canonicalPath: page.canonicalPath,
  latestResultCount: page.latestResultCount,
  updatedAt: page.updatedAt,
}));
const bodyTemplate = [
  "{{metaDescription}}",
  "בעמוד הזה מוצגות תוצאות עדכניות מהקטלוג הפעיל של VII עבור {{h1}}. אפשר לפתוח כל מקום, לבדוק תמונות ופרטים, ולשנות את החיפוש אם תרצו להרחיב את האזור או את סוג המקום.",
  "מספר התוצאות עשוי להשתנות לפי מקומות שנוספו, עודכנו או הוסרו. לפני הזמנה מומלץ לבדוק בעמוד המקום את הפרטים העדכניים ולוודא זמינות ישירות בתהליך ההזמנה או הפנייה."
];
await writeFile(resolve(root, publicationsArgument), `${JSON.stringify({ schemaVersion: 2, generatedAt, source: exportArgument.replace(/\\/g, "/"), count: compactPages.length, bodyTemplate, pages: compactPages })}\n`, "utf8");
await writeFile(resolve(root, redirectArgument), `${JSON.stringify(updatedInventory, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ publications: publications.length, redirects: updatedInventory.stats.redirects, gone: updatedInventory.stats.gone, total: updatedInventory.stats.total }));
