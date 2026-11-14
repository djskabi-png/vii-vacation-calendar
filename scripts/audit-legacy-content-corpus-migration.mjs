import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const corpusPath = resolve(process.argv[2] || "project_knowledge/legacy-content-snapshot-20261114/legacy-content-corpus.json");
const outputPath = resolve(process.argv[3] || "project_knowledge/legacy-content-snapshot-20261114/legacy-content-migration-ledger.json");
const [corpus, vacation, events, inventory] = await Promise.all([
  readFile(corpusPath, "utf8").then(JSON.parse),
  readFile(resolve(root, "app/data/legacy-search-page-publications.json"), "utf8").then(JSON.parse),
  readFile(resolve(root, "app/data/legacy-event-search-pages.json"), "utf8").then(JSON.parse),
  readFile(resolve(root, "app/data/legacy-redirect-inventory.json"), "utf8").then(JSON.parse),
]);

function normalized(value) {
  const url = new URL(value, "https://www.vii.co.il");
  const pathname = (url.pathname.replace(/\/+$/, "") || "/").toLowerCase();
  const search = new URLSearchParams(url.search); search.sort();
  return `${pathname}${search.size ? `?${search}` : ""}`;
}

const contentBySource = new Map();
for (const page of vacation.pages || []) contentBySource.set(normalized(page.legacySourcePath), { family: "vacation-search", target: page.canonicalPath, id: page.id, page });
for (const alias of vacation.aliases || []) {
  const target = contentBySource.get(normalized(alias.targetSourcePath));
  if (target) contentBySource.set(normalized(alias.sourcePath), { ...target, family: "vacation-search-alias", aliasEvidence: alias.evidence });
}
for (const page of events || []) contentBySource.set(normalized(page.legacySourcePath), { family: "event-search", target: page.canonicalPath, id: page.id, page });

const staticTargets = new Map([
  ["/", "/"], ["/art", "/guides"], ["/art/5", "/guides"], ["/privacy_policy", "/legal/privacy"],
  ["/term_and_conditions", "/legal/terms"], ["/contact", "/join"], ["/about", "/about"],
]);
const redirects = new Map(Object.entries(inventory.redirects || {}).map(([source, target]) => [normalized(source), target]));

function clean(value = "") { return String(value).replace(/\s+/g, " ").replace(/\s+-\s+וי פור ויקיישן$/i, "").trim(); }
function sourceBody(source) {
  const preferred = (source.fragments || []).find((fragment) => /section-text|article-content|post-content|seo-text|content-text/i.test(`${fragment.className} ${fragment.id}`)
    && !/faq|question/i.test(`${fragment.className} ${fragment.id}`));
  const fallback = (source.fragments || []).find((fragment) => !/faq|question/i.test(`${fragment.className} ${fragment.id}`) && fragment.text?.length >= 100);
  return clean(preferred?.text || fallback?.text || "").replace(/^קרא עוד\s+הצג פחות\s*/i, "").trim();
}
function sourceFaq(source) {
  return (source.faq || []).filter((item) => clean(item.question) && clean(item.answer)).slice(0, 20)
    .map((item) => ({ question: clean(item.question), answer: clean(item.answer) }));
}
const rows = corpus.rows.map((source) => {
  const key = normalized(source.sourceUrl);
  const managed = contentBySource.get(key);
  const target = managed?.target || staticTargets.get(key) || redirects.get(key) || null;
  const migrationFamily = managed?.family || (staticTargets.has(key) ? "static-content" : redirects.has(key) ? "redirect-inventory" : null);
  const page = managed?.page;
  const parityPage = managed?.family === "vacation-search-alias" ? null : page;
  const titleParity = parityPage ? [parityPage.title, parityPage.metaTitle, parityPage.h1].some((value) => clean(value) === clean(source.title) || clean(value) === clean(source.headings?.find((item) => item.level === 1)?.text)) : null;
  const descriptionParity = parityPage && source.description ? [parityPage.metaDescription, parityPage.summary].some((value) => clean(value) === clean(source.description)) : null;
  const body = sourceBody(source);
  const faq = sourceFaq(source);
  const bodyParity = parityPage && body ? clean(parityPage.body).replace(/^קרא עוד\s+הצג פחות\s*/i, "").trim() === body : null;
  const faqParity = parityPage && faq.length ? JSON.stringify(parityPage.faq || []) === JSON.stringify(faq) : null;
  return {
    sourceUrl: source.sourceUrl, sourcePath: source.sourcePath, sourceStatus: source.status, routeFamily: source.routeFamily,
    sourceSha256: source.sha256 || null, sourceTitle: source.title || "", sourceDescription: source.description || "",
    sourceBodyCharacters: source.bodyText?.length || 0, sourceFaqCount: source.faq?.length || 0,
    target, migrationFamily, managedId: managed?.id || null,
    adminEditable: Boolean(managed), redirectRegistered: Boolean(target && (managed || staticTargets.has(key) || redirects.has(key))),
    titleParity, descriptionParity, bodyParity, faqParity,
    contentRecovery: page?.contentRecovery || null,
    status: target ? "mapped" : "unmapped",
  };
});

const unique = new Map();
for (const row of rows) {
  const key = normalized(row.sourceUrl);
  const previous = unique.get(key);
  const score = (row.sourceDescription ? 1 : 0) + row.sourceFaqCount * 2 + row.sourceBodyCharacters / 1000;
  const previousScore = previous ? (previous.sourceDescription ? 1 : 0) + previous.sourceFaqCount * 2 + previous.sourceBodyCharacters / 1000 : -1;
  if (!previous || score > previousScore || (previous.sourceStatus !== 200 && row.sourceStatus === 200)) unique.set(key, row);
}
const uniqueRows = [...unique.values()].sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
const inScope = uniqueRows.filter((row) => ["vacation-search", "event-search", "article", "article-index", "static-content", "homepage"].includes(row.routeFamily));
const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceCorpus: corpusPath,
  counts: {
    discoveredAliases: rows.length,
    uniqueInScope: inScope.length,
    mapped: inScope.filter((row) => row.status === "mapped").length,
    unmapped: inScope.filter((row) => row.status === "unmapped").length,
    adminEditable: inScope.filter((row) => row.adminEditable).length,
    source200: inScope.filter((row) => row.sourceStatus === 200).length,
    sourceFailures: inScope.filter((row) => row.sourceStatus !== 200).length,
    exactTitleParity: inScope.filter((row) => row.titleParity === true).length,
    exactDescriptionParity: inScope.filter((row) => row.descriptionParity === true).length,
    sourceManagedBody: inScope.filter((row) => row.bodyParity !== null).length,
    exactBodyParity: inScope.filter((row) => row.bodyParity === true).length,
    sourceManagedFaq: inScope.filter((row) => row.faqParity !== null).length,
    exactFaqParity: inScope.filter((row) => row.faqParity === true).length,
    sourceRecoveredOrGenerated: inScope.filter((row) => row.contentRecovery).length,
  },
  unmapped: inScope.filter((row) => row.status === "unmapped"),
  sourceFailures: inScope.filter((row) => row.sourceStatus !== 200),
  rows: uniqueRows,
};
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ output: outputPath, ...result.counts }, null, 2));
if (result.counts.unmapped || result.counts.sourceFailures
  || result.counts.exactBodyParity !== result.counts.sourceManagedBody
  || result.counts.exactFaqParity !== result.counts.sourceManagedFaq) process.exitCode = 1;
