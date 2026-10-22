import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [, , exportArgument = "project_knowledge/launch/legacy-search-pages-20261015.json",
  publicationsArgument = "app/data/legacy-search-page-publications.json",
  redirectArgument = "app/data/legacy-redirect-inventory.json"] = process.argv;

const root = process.cwd();
const exported = JSON.parse(await readFile(resolve(root, exportArgument), "utf8"));
const inventory = JSON.parse(await readFile(resolve(root, redirectArgument), "utf8"));

function clip(value, limit, ellipsize = true) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  const shortened = text.slice(0, Math.max(0, limit - (ellipsize ? 1 : 0))).replace(/\s+\S*$/, "").trim();
  return ellipsize ? `${shortened}…` : shortened;
}

function stableId(sourcePath) {
  return `legacy-${createHash("sha256").update(sourcePath).digest("hex").slice(0, 24)}`;
}

function modernizeLegacyBrand(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
    .replace(/(?:מיזם\s+)?V(?:ii)?(?=\s|\.|,|$)/gi, "VII")
    .replace(/וי\s+פור\s+ויקיישן/g, "VII")
    .replace(/מתחםי/g, "מתחמי")
    .replace(/\s+ב\s+עם\s+/g, " עם ")
    .replace(/\s+עם\s+מתאים\s+ל/g, " שמתאים ל")
    .replace(/\s+עם\s+ללא\s+/g, " ללא ")
    .replace(/\s+/g, " ").trim();
}

function headingFor(row) {
  const heading = modernizeLegacyBrand(row.h1);
  if (heading.length >= 4) return heading;
  return modernizeLegacyBrand(row.title)
    .replace(/\s*[-|]\s*VII\s*$/i, "")
    .replace(/^[-|\s]+|[-|\s]+$/g, "")
    .trim();
}

function locationFor(row) {
  if (String(row.location || "").trim()) return String(row.location).trim();
  const heading = headingFor(row);
  const knownRegion = ["ירושלים והסביבה", "תל אביב וגוש דן", "חיפה והכרמל", "גליל מערבי", "דרום ונגב", "אילת והערבה", "ים המלח", "תל אביב", "מרכז", "צפון", "כנרת"]
    .find((location) => heading.includes(location));
  if (knownRegion) return knownRegion;
  const afterVacation = heading.match(/נופש ב(.+?)(?:\s+עם|\s+-|$)/)?.[1]?.trim();
  if (afterVacation && !/^(?:מתחמי|וילות|צימרים|סוויטות|דירות|מלונות)/.test(afterVacation)) return afterVacation;
  return "כל הארץ";
}

function effectiveDescription(row) {
  const source = modernizeLegacyBrand(row.metaDescription);
  if (source.length >= 40) return source;
  if (source) return `${source}. תוצאות עדכניות עם פרטים ותמונות.`;
  return `${headingFor(row)}. כאן מוצגים מקומות רלוונטיים עם פרטים, תמונות ואפשרות לבדוק זמינות.`;
}

const vacationTypes = [
  ["מלונות בוטיק", "מלונות בוטיק"], ["דירות נופש", "דירות נופש"], ["בקתות עץ", "בקתות עץ"],
  ["צימרים מאבן", "צימרים מאבן"], ["מתחמי אירוח", "מתחמי אירוח"], ["סוויטות", "סוויטות"],
  ["וילות", "וילות"], ["צימרים", "צימרים"], ["מערות", "מערות"], ["מלונות", "מלונות"],
];
const vacationFeatures = [
  ["נגישות לנכים", "accessible"], ["מקבלים בעלי חיים", "pets"], ["רישיון עסק", "business-license"],
  ["חניה חינם", "free-parking"], ["בריכת שחייה מחוממת ומקורה", "covered-heated-pool"],
  ["בריכת שחייה פרטית", "private-pool"], ["בריכת שחייה מגודרת", "fenced-pool"],
  ["בריכת שחייה מחוממת", "heated-pool"], ["בריכת ילדים", "children-pool"], ["בריכת זרמים", "current-pool"],
  ["פינת מנגל", "barbecue"], ["מטבח מאובזר", "equipped-kitchen"], ["אינטרנט אלחוטי", "wifi"],
  ["מערכת הגברה", "outdoor-sound"], ["חדר משחקים", "games-room"], ["ערבי גיבוש", "team-building"],
  ["הצעות נישואין", "proposals"], ["ימי הולדת", "birthdays"], ["מסיבת רווקות", "bachelorette"],
  ["מסיבת רווקים", "bachelor"], ["שבת חתן", "groom-shabbat"], ["משפחות", "families"],
  ["קבוצות", "groups"], ["זוגות בלבד", "couples-only"], ["זוגות", "couples"],
  ["מתאים לאירועים", "events"], ["מסיבות", "parties"], ["ציבור דתי", "religious"],
  ["חתונות", "weddings"], ["בני נוער", "youth"], ["ימי כיף", "fun-days"],
];

function filtersFor(row) {
  const text = modernizeLegacyBrand(`${row.h1 || ""} ${row.title || ""}`);
  const type = vacationTypes.find(([needle]) => text.includes(needle))?.[1];
  const features = [...new Set(vacationFeatures.filter(([needle]) => text.includes(needle)).map(([, id]) => id))];
  return { ...(type ? { type } : {}), ...(features.length ? { features: features.join(",") } : {}) };
}

function sourceSearchPath(row) {
  const params = new URLSearchParams();
  const location = locationFor(row);
  if (location !== "כל הארץ") params.set("location", location);
  const filters = filtersFor(row);
  if (filters.type) params.set("type", filters.type);
  if (filters.features) params.set("features", filters.features);
  return `/search${params.size ? `?${params}` : ""}`;
}

function bodyFor(row) {
  const recovered = modernizeLegacyBrand(row.body);
  if (recovered.length >= 120) return recovered.slice(0, 8000);
  const first = clip(effectiveDescription(row), 420);
  const second = `בעמוד הזה ריכזנו אפשרויות שמתאימות ל${headingFor(row)}. אפשר לפתוח כל מקום, לבדוק תמונות ופרטים, ולשנות את החיפוש אם תרצו להרחיב את האזור או את סוג המקום.`;
  const third = "מספר התוצאות עשוי להשתנות לפי מקומות שנוספו, עודכנו או הוסרו. לפני הזמנה מומלץ לבדוק בעמוד המקום את הפרטים העדכניים ולוודא זמינות ישירות בתהליך ההזמנה או הפנייה.";
  return [recovered, first, second, third].filter(Boolean).join("\n\n").slice(0, 8000);
}

const readyRows = exported.rows.filter((row) => row.migrationStatus === "content-exported" ||
  (row.sourceStatus === 200 && row.blocker === "missing_required_content" && headingFor(row).length >= 8));
const generatedAt = exported.generatedAt || new Date().toISOString();
const publications = readyRows.map((row) => ({
  id: stableId(row.sourcePath),
  origin: "managed",
  world: "vacation",
  locale: "he",
  location: locationFor(row),
  filters: filtersFor(row),
  sourcePath: sourceSearchPath(row),
  legacySourcePath: row.sourcePath,
  contentRecovery: row.migrationStatus === "content-exported" ? null : "description-derived-from-source-h1",
  proposedPath: row.targetPath,
  suggestedTitle: clip(headingFor(row), 90),
  latestResultCount: Number((row.resultSummary || "").match(/\d+/)?.[0] || 0),
  fallbackMode: "nearby",
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
  title: clip(headingFor(row), 90),
  metaTitle: clip(headingFor(row), 70, false),
  metaDescription: clip(effectiveDescription(row), 180),
  h1: clip(headingFor(row), 100),
  summary: clip(effectiveDescription(row), 420),
  body: bodyFor(row),
  faq: Array.isArray(row.faq) ? row.faq.slice(0, 8).flatMap((item) => {
    const question = clip(modernizeLegacyBrand(item?.question), 180);
    const answer = clip(modernizeLegacyBrand(item?.answer), 600);
    return question && answer ? [{ question, answer }] : [];
  }) : [],
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
  filters: page.filters,
  fallbackMode: page.fallbackMode,
  slug: page.slug,
  title: page.title,
  metaTitle: page.metaTitle,
  metaDescription: page.metaDescription,
  h1: page.h1,
  summary: page.summary,
  body: page.body,
  faq: page.faq,
  canonicalPath: page.canonicalPath,
  latestResultCount: page.latestResultCount,
  updatedAt: page.updatedAt,
}));
await writeFile(resolve(root, publicationsArgument), `${JSON.stringify({ schemaVersion: 3, generatedAt, source: exportArgument.replace(/\\/g, "/"), count: compactPages.length, pages: compactPages })}\n`, "utf8");
await writeFile(resolve(root, redirectArgument), `${JSON.stringify(updatedInventory, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ publications: publications.length, redirects: updatedInventory.stats.redirects, gone: updatedInventory.stats.gone, total: updatedInventory.stats.total }));
