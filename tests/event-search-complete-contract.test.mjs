import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

function loadTsModule(path) {
  const source = fs.readFileSync(path, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", output)(module, module.exports);
  return module.exports;
}

test("event search keeps catalog matches and hides discovery rails for transactional searches", () => {
  const page = fs.readFileSync(new URL("../app/events/search/page.tsx", import.meta.url), "utf8");
  assert.match(page, /matchesEventSearchLocation\(place, area\) && matchesHardFilters\(place\)\)/);
  assert.doesNotMatch(page, /matchesHardFilters\(place\) && confirmedEventPlace\(place\)/);
  assert.match(page, /orderEventResults\(baseOrdered/);
  assert.match(page, /const hasTransactionalSearch = Boolean\(eventFrom \|\| guests/);
  assert.match(page, /!hasTransactionalSearch \? <SearchAfterResults/);
});

test("event participant controls use five-person steps and allow direct entry", () => {
  const searchBox = fs.readFileSync(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");
  assert.match(searchBox, /value - 5/);
  assert.match(searchBox, /value \+ 5/);
  assert.match(searchBox, /type="number"[^>]+max="1000"[^>]+step="5"/);
  assert.doesNotMatch(searchBox, /value - 10/);
  assert.doesNotMatch(searchBox, /value \+ 10/);
});
