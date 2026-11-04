import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const seoAudit = fs.readFileSync(new URL("../scripts/audit-public-seo.mjs", import.meta.url), "utf8");
const siteAudit = fs.readFileSync(new URL("../scripts/audit-sitewide-release.cjs", import.meta.url), "utf8");

test("release SEO audit is bounded and samples every sitemap family", () => {
  assert.match(seoAudit, /sitemapDocuments\.flatMap\(\(document, index\)/);
  assert.match(seoAudit, /evenly-stratified-by-sitemap-family/);
  assert.match(siteAudit, /SITEWIDE_SEO_AUDIT_LIMIT \|\| "350"/);
  assert.match(siteAudit, /public-seo-and-structured-data-stratified/);
});
