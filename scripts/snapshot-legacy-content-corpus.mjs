import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parse, serialize } from "parse5";

const ROOT = resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1)));
const LEGACY_ORIGIN = "https://www.vii.co.il";
const outputArgument = process.argv[2] || "project_knowledge/legacy-content-snapshot-20261114/legacy-content-corpus.json";
const OUTPUT = resolve(ROOT, outputArgument);
const SUMMARY = OUTPUT.replace(/\.json$/i, "-summary.json");
const CHECKPOINT = OUTPUT.replace(/\.json$/i, "-checkpoint.json");
const RESUME_CORPUS = process.env.RESUME_CORPUS ? resolve(ROOT, process.env.RESUME_CORPUS) : null;
const CONCURRENCY = Math.max(1, Math.min(8, Number(process.env.CONCURRENCY || 4)));
const REQUEST_TIMEOUT_MS = 20_000;
const REQUEST_DELAY_MS = Math.max(0, Number(process.env.REQUEST_DELAY_MS || 80));
const USER_AGENT = "VII owned-content preservation/1.0 (+https://vii.spaplus.co)";

const exactStaticPaths = new Set([
  "/", "/art", "/art/", "/privacy_policy", "/term_and_conditions", "/contact", "/about",
]);
const deniedPrefixes = ["/assets/", "/api/", "/ajax/", "/cdn-cgi/", "/admin/", "/account/", "/booking/"];
const deniedExtensions = /\.(?:avif|bmp|css|gif|ico|jpe?g|js|json|map|mp4|pdf|png|svg|webm|webp|woff2?|xml)(?:$|\?)/i;

function clean(value = "") {
  return String(value).replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function attrs(node) {
  return Object.fromEntries((node.attrs || []).map(({ name, value }) => [name.toLowerCase(), value]));
}

function visibleText(node) {
  if (!node) return "";
  if (node.nodeName === "#text") return node.value || "";
  if (["script", "style", "svg", "noscript", "template"].includes(node.nodeName)) return "";
  return (node.childNodes || []).map(visibleText).join(" ");
}

function visit(node, fn, ancestors = []) {
  fn(node, ancestors);
  for (const child of node.childNodes || []) visit(child, fn, [...ancestors, node]);
}

function normalizeUrl(value, base = LEGACY_ORIGIN) {
  try {
    const url = new URL(value, base);
    if (url.hostname !== "www.vii.co.il" && url.hostname !== "vii.co.il") return null;
    url.protocol = "https:";
    url.hostname = "www.vii.co.il";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(?:utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    const path = url.pathname.replace(/\/{2,}/g, "/");
    url.pathname = path === "/" ? "/" : path.replace(/\/+$/, "");
    return url.toString();
  } catch { return null; }
}

function isContentCandidate(value) {
  const normalized = normalizeUrl(value);
  if (!normalized) return false;
  const url = new URL(normalized);
  const path = decodeURIComponent(url.pathname);
  if (deniedExtensions.test(path) || deniedPrefixes.some((prefix) => path.startsWith(prefix))) return false;
  if (exactStaticPaths.has(path)) return true;
  if (/^\/s(?:\/|$)/i.test(path)) return true;
  if (/^\/events\/s(?:\/|$)/i.test(path)) return true;
  if (/^\/art(?:\/\d+)?\/?$/i.test(path)) return true;
  return false;
}

function routeFamily(value) {
  const path = decodeURIComponent(new URL(value).pathname);
  if (/^\/events\/s(?:\/|$)/i.test(path)) return "event-search";
  if (/^\/s(?:\/|$)/i.test(path)) return "vacation-search";
  if (/^\/art\/\d+\/?$/i.test(path)) return "article";
  if (/^\/art\/?$/i.test(path)) return "article-index";
  return path === "/" ? "homepage" : "static-content";
}

function parseLocations(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => clean(match[1]));
}

async function fetchText(url, accept = "text/html") {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url, { redirect: "follow", headers: { Accept: accept, "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      const body = await response.text();
      if (response.status >= 500 && attempt === 1) { await new Promise((resolveDelay) => setTimeout(resolveDelay, 750)); continue; }
      return { response, body, attempt };
    } catch (error) {
      lastError = error;
      if (attempt === 1) { await new Promise((resolveDelay) => setTimeout(resolveDelay, 750)); continue; }
    }
  }
  throw lastError || new Error(`Unable to fetch ${url}`);
}

async function sitemapSeeds() {
  const index = await fetchText(`${LEGACY_ORIGIN}/sitemap.php`, "application/xml,text/xml;q=0.9,*/*;q=0.8");
  const children = parseLocations(index.body);
  const urls = [];
  for (const child of children) {
    const result = await fetchText(child, "application/xml,text/xml;q=0.9,*/*;q=0.8");
    urls.push(...parseLocations(result.body));
  }
  return { index: `${LEGACY_ORIGIN}/sitemap.php`, children, urls };
}

async function exportedSeeds() {
  const paths = [
    "project_knowledge/launch/legacy-search-pages-complete-merged-20261022.json",
    "app/data/legacy-search-page-publications.json",
    "app/data/legacy-event-search-pages.json",
    "app/data/legacy-redirect-inventory.json",
  ];
  const found = [];
  for (const path of paths) {
    try {
      const value = JSON.parse(await readFile(resolve(ROOT, path), "utf8"));
      const rows = Array.isArray(value) ? value : [...(value.rows || []), ...(value.pages || []), ...(value.aliases || []),
        ...Object.keys(value.redirects || {}).map((sourcePath) => ({ sourcePath })), ...(value.gone || []).map((sourcePath) => ({ sourcePath }))];
      for (const row of rows) for (const field of ["legacySourcePath", "sourcePath", "sourceUrl"]) {
        if (typeof row?.[field] === "string" && row[field]) found.push(row[field]);
      }
    } catch { /* Optional historical evidence. */ }
  }
  return found;
}

function extractPage(html, sourceUrl, response) {
  const doc = parse(html);
  const metadata = [];
  const headings = [];
  const images = [];
  const links = [];
  const structuredData = [];
  const faq = [];
  const breadcrumbs = [];
  const fragments = [];
  const fragmentHashes = new Set();
  let title = "";
  let canonical = "";
  let htmlLang = "";
  let bodyClass = "";

  visit(doc, (node, ancestors) => {
    const a = attrs(node);
    const className = a.class || "";
    const id = a.id || "";
    const text = clean(visibleText(node));
    if (node.nodeName === "html") htmlLang = clean(a.lang);
    if (node.nodeName === "body") bodyClass = clean(className);
    if (node.nodeName === "title" && !title) title = text;
    if (node.nodeName === "link" && /\bcanonical\b/i.test(a.rel || "") && a.href) canonical = normalizeUrl(a.href, sourceUrl) || a.href;
    if (node.nodeName === "meta") metadata.push({ name: clean(a.name), property: clean(a.property), httpEquiv: clean(a["http-equiv"]), content: clean(a.content) });
    if (/^h[1-6]$/.test(node.nodeName) && text) headings.push({ level: Number(node.nodeName.slice(1)), text });
    if (node.nodeName === "img") {
      const src = normalizeUrl(a.src || a["data-src"] || a["data-lazy-src"], sourceUrl) || clean(a.src || a["data-src"] || a["data-lazy-src"]);
      if (src) images.push({ src, alt: clean(a.alt), title: clean(a.title), width: clean(a.width), height: clean(a.height) });
    }
    if (node.nodeName === "a" && a.href) {
      const href = normalizeUrl(a.href, sourceUrl) || clean(a.href);
      if (href) links.push({ href, text: text.slice(0, 300), title: clean(a.title), rel: clean(a.rel) });
    }
    if (node.nodeName === "script" && /application\/ld\+json/i.test(a.type || "")) {
      const raw = (node.childNodes || []).map((child) => child.value || "").join("").trim();
      if (raw) { try { structuredData.push(JSON.parse(raw)); } catch { structuredData.push({ invalidJson: raw.slice(0, 20_000) }); } }
    }
    const lower = `${className} ${id}`.toLowerCase();
    const isBreadcrumb = /breadcrumb/.test(lower);
    if (isBreadcrumb && text && text.length < 1000) breadcrumbs.push(text);
    const relevant = node.nodeName === "main" || node.nodeName === "article"
      || /(?:^|[\s_-])(?:section-text|page-content|article-content|post-content|faq|questions|seo-text|content-text|description)(?:$|[\s_-])/i.test(lower);
    const parentRelevant = ancestors.some((parent) => {
      const pa = attrs(parent); const pl = `${pa.class || ""} ${pa.id || ""}`.toLowerCase();
      return parent.nodeName === "main" || parent.nodeName === "article" || /section-text|page-content|article-content|post-content|seo-text|content-text/.test(pl);
    });
    if (relevant && !parentRelevant && text.length >= 30) {
      const hash = createHash("sha256").update(text).digest("hex");
      if (!fragmentHashes.has(hash)) {
        fragmentHashes.add(hash);
        fragments.push({ tag: node.nodeName, id, className: clean(className), text: text.slice(0, 40_000), html: serialize(node).slice(0, 12_000), sha256: hash });
      }
    }
  });

  const addFaq = (question, answer) => {
    const q = clean(question); const a = clean(answer);
    if (q && a && !faq.some((item) => item.question === q)) faq.push({ question: q, answer: a });
  };
  const inspectSchema = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(inspectSchema); return; }
    if (value["@type"] === "FAQPage" && Array.isArray(value.mainEntity)) for (const item of value.mainEntity) {
      addFaq(item?.name, item?.acceptedAnswer?.text || item?.suggestedAnswer?.text);
    }
    Object.values(value).forEach(inspectSchema);
  };
  structuredData.forEach(inspectSchema);

  const uniqueBy = (rows, key) => [...new Map(rows.map((row) => [key(row), row])).values()];
  const meta = uniqueBy(metadata.filter((item) => item.name || item.property || item.httpEquiv), (item) => JSON.stringify(item));
  const description = meta.find((item) => item.name.toLowerCase() === "description")?.content || "";
  const robots = meta.find((item) => item.name.toLowerCase() === "robots")?.content || "";
  return {
    title, description, canonical, robots, htmlLang, bodyClass,
    metadata: meta,
    headings: uniqueBy(headings, (item) => `${item.level}:${item.text}`),
    breadcrumbs: [...new Set(breadcrumbs)],
    fragments,
    bodyText: fragments.map((item) => item.text).join("\n\n").slice(0, 80_000),
    faq,
    images: uniqueBy(images, (item) => item.src).slice(0, 150),
    links: uniqueBy(links, (item) => `${item.href}:${item.text}`).slice(0, 600),
    structuredData: structuredData.slice(0, 30),
    responseHeaders: Object.fromEntries([...response.headers.entries()].filter(([key]) => ["cache-control", "content-language", "content-type", "etag", "last-modified", "x-robots-tag"].includes(key))),
  };
}

async function writeAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, path);
}

const sitemap = await sitemapSeeds();
const historical = await exportedSeeds();
const seeds = new Map();
const add = (value, discoveredBy) => {
  const normalized = normalizeUrl(value);
  if (!normalized || !isContentCandidate(normalized)) return false;
  if (!seeds.has(normalized)) { seeds.set(normalized, new Set([discoveredBy])); return true; }
  seeds.get(normalized).add(discoveredBy); return false;
};
for (const value of sitemap.urls) add(value, "legacy-sitemap");
for (const value of historical) add(value, "existing-migration-evidence");
for (const value of [`${LEGACY_ORIGIN}/`, `${LEGACY_ORIGIN}/art`, `${LEGACY_ORIGIN}/events/`, `${LEGACY_ORIGIN}/rooms/`]) add(value, "world-hub");

let priorRows = [];
if (RESUME_CORPUS) {
  const previous = JSON.parse(await readFile(RESUME_CORPUS, "utf8"));
  priorRows = Array.isArray(previous.rows) ? previous.rows : [];
}
const priorUrls = new Set(priorRows.map((row) => normalizeUrl(row.sourceUrl)).filter(Boolean));
const queue = [...seeds.keys()].filter((url) => !priorUrls.has(url));
const rows = [];
let cursor = 0;
let completed = 0;
async function worker() {
  while (cursor < queue.length) {
    const index = cursor++;
    const sourceUrl = queue[index];
    const started = Date.now();
    let row;
    try {
      if (REQUEST_DELAY_MS) await new Promise((resolveDelay) => setTimeout(resolveDelay, REQUEST_DELAY_MS));
      const { response, body, attempt } = await fetchText(sourceUrl);
      const finalUrl = normalizeUrl(response.url) || response.url;
      const contentType = response.headers.get("content-type") || "";
      const extracted = response.ok && /text\/html|application\/xhtml/i.test(contentType) ? extractPage(body, finalUrl, response) : null;
      row = {
        sourceUrl, sourcePath: `${new URL(sourceUrl).pathname}${new URL(sourceUrl).search}`, routeFamily: routeFamily(sourceUrl),
        discoveredBy: [...(seeds.get(sourceUrl) || [])].sort(), status: response.status, finalUrl,
        fetchedAt: new Date().toISOString(), elapsedMs: Date.now() - started, attempt, bytes: Buffer.byteLength(body),
        sha256: createHash("sha256").update(body).digest("hex"), contentType, ...extracted,
      };
      if (extracted) for (const link of extracted.links) if (add(link.href, sourceUrl)) queue.push(normalizeUrl(link.href));
    } catch (error) {
      row = { sourceUrl, sourcePath: `${new URL(sourceUrl).pathname}${new URL(sourceUrl).search}`, routeFamily: routeFamily(sourceUrl),
        discoveredBy: [...(seeds.get(sourceUrl) || [])].sort(), status: null, finalUrl: null, fetchedAt: new Date().toISOString(),
        elapsedMs: Date.now() - started, attempt: 2, error: error instanceof Error ? error.message : String(error) };
    }
    rows[index] = row;
    completed++;
    if (completed % 250 === 0) {
      await writeAtomic(CHECKPOINT, { schemaVersion: 1, generatedAt: new Date().toISOString(), complete: false, completed, discovered: queue.length, rows: rows.filter(Boolean) });
      console.log(JSON.stringify({ completed, discovered: queue.length, failures: rows.filter((item) => item && item.status !== 200).length }));
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
const sortedRows = [...new Map([...priorRows, ...rows.filter(Boolean)].map((row) => [normalizeUrl(row.sourceUrl), row])).values()]
  .sort((left, right) => left.sourceUrl.localeCompare(right.sourceUrl));
const corpus = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  legacyOrigin: LEGACY_ORIGIN,
  sitemap,
  extraction: { concurrency: CONCURRENCY, requestDelayMs: REQUEST_DELAY_MS, timeoutMs: REQUEST_TIMEOUT_MS, retries: 1, userAgent: USER_AGENT },
  rows: sortedRows,
};
const families = Object.fromEntries([...new Set(sortedRows.map((row) => row.routeFamily))].sort().map((family) => [family, sortedRows.filter((row) => row.routeFamily === family).length]));
const summary = {
  schemaVersion: 1, generatedAt: corpus.generatedAt, total: sortedRows.length, ok: sortedRows.filter((row) => row.status === 200).length,
  redirects: sortedRows.filter((row) => row.status >= 300 && row.status < 400).length,
  failures: sortedRows.filter((row) => row.status !== 200).map((row) => ({ sourceUrl: row.sourceUrl, status: row.status, error: row.error || null })),
  families,
  withTitle: sortedRows.filter((row) => row.title).length,
  withDescription: sortedRows.filter((row) => row.description).length,
  withCanonical: sortedRows.filter((row) => row.canonical).length,
  withBody: sortedRows.filter((row) => row.bodyText).length,
  withFaq: sortedRows.filter((row) => row.faq?.length).length,
  withImages: sortedRows.filter((row) => row.images?.length).length,
  duplicateCanonicals: Object.entries(Object.groupBy(sortedRows.filter((row) => row.canonical), (row) => row.canonical))
    .filter(([, values]) => values.length > 1).map(([canonical, values]) => ({ canonical, sources: values.map((row) => row.sourceUrl) })),
};
await writeAtomic(OUTPUT, corpus);
await writeAtomic(SUMMARY, summary);
console.log(JSON.stringify({ output: outputArgument, summary: SUMMARY.slice(ROOT.length + 1), ...summary }, null, 2));
