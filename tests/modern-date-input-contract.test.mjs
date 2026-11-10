import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/components/modern-date-input.tsx", import.meta.url), "utf8");

test("public date inputs display Israeli dotted dates while forms keep canonical ISO values", () => {
  assert.match(source, /function displayDate\(value: string\)/);
  assert.match(source, /function canonicalDate\(value: string\)/);
  assert.match(source, /type="hidden" name=\{name\} value=\{current\}/);
  assert.match(source, /pattern="\[0-9\]\{2\}\\\.\[0-9\]\{2\}\\\.\[0-9\]\{4\}"/);
  assert.match(source, /placeholder=\{props\.placeholder \|\| "dd\.mm\.yyyy"\}/);
  assert.match(source, /target: hiddenRef\.current/);
});
