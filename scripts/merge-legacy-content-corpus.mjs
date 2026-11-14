import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { canonicalGeneratedLegacyTarget } from "./lib/legacy-generated-target.mjs";

const root = process.cwd();
const corpusPath = resolve(process.argv[2] || "project_knowledge/legacy-content-snapshot-20261114/legacy-content-corpus.json");
const corpus = JSON.parse(await readFile(corpusPath, "utf8"));
const vacationPath = resolve(root, "app/data/legacy-search-page-publications.json");
const eventPath = resolve(root, "app/data/legacy-event-search-pages.json");
const redirectPath = resolve(root, "app/data/legacy-redirect-inventory.json");
function baselineJson(repoPath, fallbackPath) {
  try {
    return JSON.parse(execFileSync("git", ["show", `HEAD:${repoPath}`], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
  } catch {
    return JSON.parse(execFileSync(process.execPath, ["-e", `process.stdout.write(require('fs').readFileSync(${JSON.stringify(fallbackPath)},'utf8'))`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
  }
}

// Always rebuild from the reviewed pre-migration corpus. This keeps the merge
// idempotent and prevents a second run from treating generated recovery pages
// as curated source pages.
const vacation = baselineJson("app/data/legacy-search-page-publications.json", vacationPath);
const events = baselineJson("app/data/legacy-event-search-pages.json", eventPath);
const redirectInventory = baselineJson("app/data/legacy-redirect-inventory.json", redirectPath);

function normalized(value) {
  const url = new URL(value, "https://www.vii.co.il");
  const pathname = (url.pathname.replace(/\/+$/, "") || "/").toLowerCase();
  const search = new URLSearchParams(url.search); search.sort();
  return `${pathname}${search.size ? `?${search}` : ""}`;
}

function clean(value = "") {
  return String(value).replace(/\s+/g, " ").replace(/^קרא עוד\s+הצג פחות\s*/i, "").trim();
}

function clip(value, limit) {
  const text = clean(value);
  if (text.length <= limit) return text;
  return text.slice(0, limit).replace(/\s+\S*$/, "").trim();
}

function publicationCopy(value, fallbackTitle, event) {
  const title = clip(value.title || fallbackTitle, 90);
  const h1 = clip(value.h1 || title, 100);
  const originalDescription = clean(value.metaDescription || value.summary);
  const description = clip(originalDescription
    || `${h1}. בעמוד זה מרוכזים מקומות רלוונטיים עם מידע, תמונות ואפשרות לבדוק את פרטי המקום.`, 180);
  const originalBody = clean(value.body);
  const body = originalBody
    || `${description}\n\nהעמוד מרכז אפשרויות המתאימות לחיפוש ${h1}. אפשר לעבור בין המקומות, להשוות את המידע המוצג ולבדוק פרטים עדכניים לפני פנייה או הזמנה.`;
  return {
    ...value,
    title,
    h1,
    metaTitle: clip(value.metaTitle || title, 70),
    metaDescription: description,
    summary: clip(clean(value.summary) || description, 420),
    body: body.slice(0, 100_000),
    ...(event && value.recoveryEvidence === "live-owned-content-snapshot-20261114"
      ? { sourcePath: `/events/search?legacyPage=${stableHash(value.legacySourcePath, 12)}${value.location && value.location !== "כל הארץ" ? `&location=${encodeURIComponent(value.location)}` : ""}` }
      : !event && value.recoveryEvidence === "live-owned-content-snapshot-20261114"
        ? { sourcePath: `/search?legacyPage=${stableHash(value.legacySourcePath, 12)}${value.location && value.location !== "כל הארץ" ? `&location=${encodeURIComponent(value.location)}` : ""}` }
        : {}),
  };
}

const bySource = new Map();
const aliasesBySource = new Map();
for (const row of corpus.rows || []) {
  if (row.status !== 200) continue;
  const key = normalized(row.sourceUrl);
  const aliases = aliasesBySource.get(key) || new Set();
  aliases.add(row.sourcePath);
  aliasesBySource.set(key, aliases);
  const previous = bySource.get(key);
  const score = (row.description ? 1 : 0) + (row.faq?.length || 0) * 2 + (row.bodyText?.length || 0) / 1000;
  if (!previous || score > previous.score) bySource.set(key, { row, score });
}

function stableHash(value, length = 24) {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

function sourceMeta(row) {
  const body = sourceBody(row);
  const h1 = sourceH1(row) || clean(row.title).replace(/\s+-\s+(?:וי פור ויקיישן|V for Events)$/i, "");
  const metaTitle = clean(row.title).replace(/\s+-\s+(?:וי פור ויקיישן|V for Events)$/i, "");
  const metaDescription = clean(row.description);
  const faq = Array.isArray(row.faq) ? row.faq.filter((item) => clean(item.question) && clean(item.answer)).slice(0, 20)
    .map((item) => ({ question: clean(item.question), answer: clean(item.answer) })) : [];
  return { body, h1, metaTitle, metaDescription, faq };
}

function inferredLocation(row) {
  const heading = sourceH1(row) || clean(row.title);
  const match = row.routeFamily === "event-search"
    ? heading.match(/(?:אירועים|אירוח)\s+ב([^:|]+?)(?:\s+עם|\s*[:|]|$)/)
    : heading.match(/נופש\s+ב([^:|]+?)(?:\s+עם|\s+ללא|\s+שמתאים|\s+עד|\s*[:|]|$)/);
  const location = clean(match?.[1] || "");
  return location && location.length <= 60 ? location : "כל הארץ";
}

function newManagedPage(row) {
  const key = normalized(row.sourceUrl);
  const hash = stableHash(key);
  const event = row.routeFamily === "event-search";
  const prefix = event ? "legacy-event" : "legacy-search";
  const world = event ? "events" : "vacations";
  const slug = `${prefix}-${hash.slice(0, 8)}`;
  const location = inferredLocation(row);
  const { body, h1, metaTitle, metaDescription, faq } = sourceMeta(row);
  const description = metaDescription || h1;
  return publicationCopy({
    id: `${prefix}-${hash}`,
    legacySourcePath: row.sourcePath,
    contentRecovery: body.length >= 100 || faq.length ? "live-source-content-20261114" : "live-source-metadata-20261114",
    recoveryEvidence: "live-owned-content-snapshot-20261114",
    sourcePath: `${event ? "/events/search" : "/search"}${location !== "כל הארץ" ? `?location=${encodeURIComponent(location)}` : ""}`,
    location,
    filters: {},
    ...(event ? { sourceFilterLabels: {} } : { fallbackMode: "nearby" }),
    slug,
    title: h1,
    metaTitle: metaTitle || h1,
    metaDescription: description,
    h1,
    summary: description,
    body: body || description,
    faq,
    canonicalPath: `/search/${world}/${slug}`,
    latestResultCount: 0,
    updatedAt: row.fetchedAt || corpus.generatedAt,
    legacySnapshot: {
      sourceUrl: row.sourceUrl, finalUrl: row.finalUrl, fetchedAt: row.fetchedAt, sha256: row.sha256,
      faqCount: faq.length, bodyCharacters: body.length,
    },
  }, h1, event);
}

function sourceBody(row) {
  const preferred = (row.fragments || []).find((fragment) => /section-text|article-content|post-content|seo-text|content-text/i.test(`${fragment.className} ${fragment.id}`)
    && !/faq|question/i.test(`${fragment.className} ${fragment.id}`));
  const fallback = (row.fragments || []).find((fragment) => !/faq|question/i.test(`${fragment.className} ${fragment.id}`) && fragment.text?.length >= 100);
  return clean(preferred?.text || fallback?.text || "");
}

function sourceH1(row) {
  return clean((row.headings || []).find((heading) => heading.level === 1)?.text || "");
}

function merge(page) {
  const source = bySource.get(normalized(page.legacySourcePath))?.row;
  if (!source) return { page, changed: false, reason: "source_missing" };
  const body = sourceBody(source);
  const h1 = sourceH1(source);
  const metaTitle = clean(source.title).replace(/\s+-\s+וי פור ויקיישן$/i, "");
  const metaDescription = clean(source.description);
  const faq = Array.isArray(source.faq) ? source.faq.filter((item) => clean(item.question) && clean(item.answer)).slice(0, 20)
    .map((item) => ({ question: clean(item.question), answer: clean(item.answer) })) : [];
  const next = publicationCopy({
    ...page,
    ...(h1 ? { title: h1, h1 } : {}),
    ...(metaTitle ? { metaTitle } : {}),
    ...(metaDescription ? { metaDescription, summary: metaDescription } : {}),
    ...(body.length >= 100 ? { body } : {}),
    ...(faq.length ? { faq } : {}),
    contentRecovery: body.length >= 100 || faq.length ? "live-source-content-20261114" : page.contentRecovery,
    legacySnapshot: {
      sourceUrl: source.sourceUrl,
      finalUrl: source.finalUrl,
      fetchedAt: source.fetchedAt,
      sha256: source.sha256,
      faqCount: faq.length,
      bodyCharacters: body.length,
    },
    updatedAt: source.fetchedAt || page.updatedAt,
  }, h1 || page.h1 || page.title, page.canonicalPath?.startsWith("/search/events/") || false);
  return { page: next, changed: JSON.stringify(next) !== JSON.stringify(page), reason: body.length >= 100 || faq.length ? "source_content_merged" : "metadata_only" };
}

const aliasSourceKeys = new Set((vacation.aliases || []).map((alias) => normalized(alias.sourcePath)));
const vacationResults = (vacation.pages || []).filter((page) => !aliasSourceKeys.has(normalized(page.legacySourcePath))).map(merge);
const eventResults = events.map(merge);
const managedSourceKeys = new Set([...vacationResults, ...eventResults].map((result) => normalized(result.page.legacySourcePath)));
const discoveredPages = [...bySource.entries()].flatMap(([key, value]) => {
  if (managedSourceKeys.has(key) || aliasSourceKeys.has(key) || key === "/s" || key === "/events/s") return [];
  if (!['vacation-search', 'event-search'].includes(value.row.routeFamily)) return [];
  return [newManagedPage(value.row)];
});
const addedVacation = discoveredPages.filter((page) => page.canonicalPath.startsWith("/search/vacations/"));
const addedEvents = discoveredPages.filter((page) => page.canonicalPath.startsWith("/search/events/"));
const mergedVacationPages = [...vacationResults.map((result) => result.page), ...addedVacation];
const mergedEventPages = [...eventResults.map((result) => result.page), ...addedEvents];
const duplicateCanonicalPaths = [...mergedVacationPages, ...mergedEventPages].length
  - new Set([...mergedVacationPages, ...mergedEventPages].map((page) => page.canonicalPath)).size;
if (duplicateCanonicalPaths) throw new Error(`legacy_content_canonical_collision count=${duplicateCanonicalPaths}`);
const nextVacation = { ...vacation, generatedAt: corpus.generatedAt, source: corpusPath, count: mergedVacationPages.length, pages: mergedVacationPages };
await writeFile(vacationPath, `${JSON.stringify(nextVacation, null, 2)}\n`);
await writeFile(eventPath, `${JSON.stringify(mergedEventPages, null, 2)}\n`);

const targetBySource = new Map([...mergedVacationPages, ...mergedEventPages].map((page) => [normalized(page.legacySourcePath), page.canonicalPath]));
const redirects = { ...(redirectInventory.redirects || {}) };
for (const [key, aliases] of aliasesBySource) {
  const target = targetBySource.get(key);
  if (!target) continue;
  // An existing reviewed redirect is semantic evidence and wins over a newly
  // inferred recovery page. New aliases fill gaps only.
  for (const sourcePath of aliases) if (!redirects[sourcePath]) redirects[sourcePath] = target;
}
const promotedCategoryLandings = {
  "/s/israel/16094": "/wood-cabins",
  "/s/israel/16095": "/villas",
  "/s/israel/16096": "/zimmers",
  "/s/israel/16097": "/vacation-caves",
  "/s/israel/16101": "/suite-complexes",
  "/s/israel/20158": "/stone-zimmers",
  "/s/israel/55578": "/vacation-apartments",
};
Object.assign(redirects, promotedCategoryLandings);
for (const alias of vacation.aliases || []) {
  const target = targetBySource.get(normalized(alias.targetSourcePath));
  if (!target) throw new Error(`legacy_alias_target_missing ${alias.sourcePath} -> ${alias.targetSourcePath}`);
  redirects[alias.sourcePath] = target;
}
redirects["/s"] = "/vacations";
redirects["/events/s"] = "/events";
const gone = new Set(redirectInventory.gone || []);
for (const sourcePath of Object.keys(redirects)) gone.delete(sourcePath);
const orderedRedirects = Object.fromEntries(Object.entries(redirects)
  .map(([source, target]) => [source, canonicalGeneratedLegacyTarget(source, target)])
  .sort(([left], [right]) => left.localeCompare(right, "en")));
const nextRedirectInventory = {
  ...redirectInventory,
  generatedAt: new Date().toISOString(),
  sourceSnapshots: {
    ...(redirectInventory.sourceSnapshots || {}),
    liveOwnedContentCorpus: "project_knowledge/legacy-content-snapshot-20261114/legacy-content-corpus.json",
    liveOwnedContentCorpusCount: corpus.rows?.length || 0,
  },
  stats: {
    ...(redirectInventory.stats || {}),
    total: Object.keys(orderedRedirects).length + gone.size,
    redirects: Object.keys(orderedRedirects).length,
    gone: gone.size,
    managedSearchRedirects: mergedVacationPages.length + (vacation.aliases?.length || 0),
    managedEventSearchRedirects: mergedEventPages.length,
    managedContentRedirects: mergedVacationPages.length + mergedEventPages.length,
  },
  redirects: orderedRedirects,
  gone: [...gone].sort((left, right) => left.localeCompare(right, "en")),
};
await writeFile(redirectPath, `${JSON.stringify(nextRedirectInventory, null, 2)}\n`);
const summary = {
  generatedAt: new Date().toISOString(), sourceCorpus: corpusPath,
  vacation: { total: vacationResults.length, changed: vacationResults.filter((result) => result.changed).length,
    added: addedVacation.length, final: mergedVacationPages.length,
    sourceMissing: vacationResults.filter((result) => result.reason === "source_missing").map((result) => result.page.legacySourcePath) },
  events: { total: eventResults.length, changed: eventResults.filter((result) => result.changed).length,
    added: addedEvents.length, final: mergedEventPages.length,
    sourceMissing: eventResults.filter((result) => result.reason === "source_missing").map((result) => result.page.legacySourcePath) },
  redirects: { final: Object.keys(orderedRedirects).length, aliasesFromCorpus: [...aliasesBySource.values()].reduce((sum, aliases) => sum + aliases.size, 0) },
};
await writeFile(resolve(root, "project_knowledge/legacy-content-snapshot-20261114/legacy-content-merge-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
if (summary.vacation.sourceMissing.length || summary.events.sourceMissing.length) process.exitCode = 1;
