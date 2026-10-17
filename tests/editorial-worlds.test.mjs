import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
async function load(path) {
  const source = await fs.readFile(new URL(path, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  return import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
}
const { editorialWorldArticles: articles } = await load("../app/data/editorial-world-articles.ts");
const { editorialImageCopy: copy } = await load("../app/data/editorial-image-copy.ts");
const { magazineBodyOverride, magazineBodySource } = await load("../app/lib/magazine-body.ts");
test("all eight editorial worlds have three distinct substantive articles", () => {
  assert.equal(articles.length,24);
  assert.equal(new Set(articles.map(x=>x.slug)).size,24);
  for (const world of new Set(articles.map(x=>x.world))) assert.equal(articles.filter(x=>x.world===world).length,3);
  const paragraphs = new Set();
  for(const article of articles) {
    assert.match(article.slug,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(article.sections.length >=4 && article.sections.length <=5);
    assert.ok(article.faqs.length>=3);
    assert.ok(article.relatedSearches.every(link=>link.href.startsWith("/")&&!link.href.startsWith("//")));
    for(const paragraph of article.sections.flatMap(x=>x.paragraphs)) { assert.ok(!paragraphs.has(paragraph),"duplicate: "+article.slug); paragraphs.add(paragraph); }
  }
});
test("all 34 article covers exist and have four intentional metadata variants", async () => {
  assert.equal(Object.keys(copy).length,34);
  const hashes = new Set();
  const crypto = await import("node:crypto");
  for(const [slug,locales] of Object.entries(copy)) {
    const asset = await fs.readFile(new URL("../public/media/editorial/"+slug+".webp",import.meta.url));
    assert.equal(asset.toString("ascii",8,12),"WEBP");
    assert.ok(asset.length<350000);
    const hash=crypto.createHash("sha256").update(asset).digest("hex");
    assert.ok(!hashes.has(hash)); hashes.add(hash);
    for(const locale of ["he","en","fr","ru"]) {
      assert.ok(locales[locale].alt.length>8); assert.ok(locales[locale].title.length>5);
      if(locale!=="he") assert.doesNotMatch(locales[locale].alt,/[א-ת]/);
    }
  }
});
test("CMS structured body roundtrips and old lead-only overrides remain compatible", () => {
  const article=articles[0];
  const parsed=magazineBodyOverride(magazineBodySource(article),article);
  assert.equal(parsed.intro,article.intro);
  assert.deepEqual(parsed.sections.map(x=>x.title),article.sections.map(x=>x.title));
  assert.deepEqual(parsed.sections.flatMap(x=>x.paragraphs),article.sections.flatMap(x=>x.paragraphs));
  assert.equal(magazineBodyOverride("פתיח ערוך",article).sections,article.sections);
});
test("shared editorial links never import article bodies", async () => {
  const source=await fs.readFile(new URL("../app/components/world-editorial-links.tsx",import.meta.url),"utf8");
  assert.doesNotMatch(source,/from ["'][^"']*(?:magazine-data|editorial-world-articles)/);
  const client=await fs.readFile(new URL("../app/guides/client-page.tsx",import.meta.url),"utf8");
  assert.doesNotMatch(client,/import \{ magazineArticles/);
});
test("Hebrew-only editorial content is not misrepresented as approved translations", async () => {
  const data=await fs.readFile(new URL("../app/data/magazine-data.ts",import.meta.url),"utf8");
  const route=await fs.readFile(new URL("../app/guides/[slug]/page.tsx",import.meta.url),"utf8");
  const worker=await fs.readFile(new URL("../worker/index.ts",import.meta.url),"utf8");
  assert.match(data,/publishedLocales: \["he"\]/);
  assert.match(route,/localeApproved && article.indexable !== false/);
  assert.match(route,/index: false, follow: true/);
  assert.match(worker,/hebrewOnlyArticle \? \{ "he-IL": basePath, "x-default": basePath \}/);
});
test("article group composition is not mistranslated as a vehicle and utility pages receive no world-guide rail", async () => {
  const translations=JSON.parse(await fs.readFile(new URL("../app/data/visitor-ui-translations.json",import.meta.url),"utf8"));
  const title=translations["איך בוחרים מקום שבאמת מתאים להרכב שלכם"];
  assert.match(title.en,/group/); assert.doesNotMatch(title.en,/vehicle|car\b/i);
  assert.match(title.fr,/groupe/); assert.doesNotMatch(title.fr,/véhicule|voiture/i);
  assert.doesNotMatch(title.ru,/автомобил|машин/i);
  const client=await fs.readFile(new URL("../app/i18n/locale-provider.tsx",import.meta.url),"utf8");
  assert.match(client,/core\.endsWith\(brandSuffix\)/);
  assert.match(client,/if \(reviewedHeadline\) return/);
  const source=await fs.readFile(new URL("../app/components/world-editorial-links.tsx",import.meta.url),"utf8");
  assert.match(source,/!\/\^/);
  assert.ok(articles.every(article=>!article.sourceLinks?.some(link=>link.url.includes("govil-landing-page"))));
});
test("editorial visibility has exact enter and exit boundaries", async () => {
  const { editorialAreaVisible }=await load("../app/lib/editorial-viewport.ts");
  assert.equal(editorialAreaVisible({top:843,bottom:1200},844),true);
  assert.equal(editorialAreaVisible({top:844,bottom:1200},844),false);
  assert.equal(editorialAreaVisible({top:-900,bottom:1},844),true);
  assert.equal(editorialAreaVisible({top:-900,bottom:0},844),false);
  assert.equal(editorialAreaVisible({top:0,bottom:100},0),false);
});
test("editorial floating-control policy preserves active maps, keyboard focus and cleanup", async () => {
  const component=await fs.readFile(new URL("../app/components/world-editorial-links.tsx",import.meta.url),"utf8");
  const css=await fs.readFile(new URL("../app/globals.css",import.meta.url),"utf8");
  assert.match(component,/observer\.observe\(element\)/);
  assert.match(component,/observer\.disconnect\(\)/);
  assert.match(component,/removeEventListener\("resize", update\)/);
  assert.match(component,/removeAttribute\("data-world-editorial-reading"\)/);
  assert.match(component,/\[pathname, language, variant\]/);
  assert.match(css,/max-width:820px/);
  assert.match(css,/\.mobile-map-fab:not\(\.active\):not\(:focus\)/);
  assert.match(css,/\.back-to-top:not\(:focus\)/);
});
