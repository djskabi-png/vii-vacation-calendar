import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const homeShowcaseSource = await readFile(new URL("../app/components/home-showcase.tsx", import.meta.url), "utf8");
const globalStyles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("homepage heading ids remain unique", () => {
  const ids = [...homeShowcaseSource.matchAll(/\bid=\{?`?['\"]?([^'\"`}]+)['\"]?`?\}?/g)].map((match) => match[1]);
  const literalIds = ids.filter((id) => !id.includes("${"));
  const duplicates = literalIds.filter((id, index) => literalIds.indexOf(id) !== index);

  assert.deepEqual([...new Set(duplicates)], []);
});

test("site shell clips horizontal overflow at every viewport", () => {
  assert.match(globalStyles, /html,\s*body\s*\{[^}]*overflow-x:\s*clip;/s);
  assert.match(globalStyles, /\.site-page\s*\{[^}]*overflow:\s*clip;/s);
  assert.match(globalStyles, /\.site-page\s*>\s*main\s*\{[^}]*overflow-x:\s*clip;/s);
});
