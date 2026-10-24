import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("holiday details derive canonical and share URL from the active locale", () => {
  const source = read("app/holidays/[slug]/page.tsx");
  assert.match(source, /serverLocalePath\(`\/holidays\/\$\{world\.slug\}`\)/);
  assert.match(source, /alternates: \{ canonical \}/);
  assert.match(source, /openGraph:[\s\S]*?url: canonical/);
});

test("guide details localize metadata, structured data and canonical URL", () => {
  const source = read("app/guides/[slug]/page.tsx");
  assert.match(source, /serverLocalePath\(`\/guides\/\$\{article\.slug\}`\)/);
  assert.match(source, /const title = translate\(/);
  assert.match(source, /articleSchema\(article, canonical, language, translate\)/);
  assert.match(source, /openGraph:[\s\S]*?url: canonical/);
});

test("robots excludes private application surfaces from crawling", () => {
  const source = read("app/robots.ts");
  for (const path of ["/api/", "/admin/", "/account/", "/booking/", "/handoff/", "/favorites/"]) {
    assert.match(source, new RegExp(path.replaceAll("/", "\\/")));
  }
});
