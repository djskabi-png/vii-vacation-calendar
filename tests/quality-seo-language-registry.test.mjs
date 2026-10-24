import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../app/lib/quality-platform.ts", import.meta.url), "utf8");

test("recurring production QA covers every public language at a unique route", () => {
  for (const locale of ["en", "fr", "ru"]) {
    assert.match(source, new RegExp(`global\\.home\\.${locale}\\.semantic`));
    assert.match(source, new RegExp(`route: "/${locale}"`));
    assert.match(source, new RegExp(`<html lang=\\\\"${locale}\\\\"`));
  }
});

test("recurring production QA checks every child sitemap, not only the index", () => {
  for (const section of ["core", "holidays", "vacations", "events", "spas", "hourly", "discovery", "search-pages"]) {
    assert.match(source, new RegExp(`\\"${section}\\"`));
  }
  assert.match(source, /`\/sitemaps\/\$\{section\}\/1\.xml`/);
});
