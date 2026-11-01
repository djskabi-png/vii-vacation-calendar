import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [page, engine, styles] = await Promise.all([
  readFile(new URL("../app/admin/professor/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/lib/admin-professor.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/admin/admin.module.css", import.meta.url), "utf8"),
]);

test("Professor formats answers as readable RTL lines", () => {
  assert.match(engine, /lines\.join\("\\n"\)/);
  assert.match(page, /styles\.professorAnswerText/);
  assert.match(styles, /\.professorAnswerText\{[^}]*white-space:pre-line[^}]*text-align:right[^}]*direction:rtl/);
});

test("Professor visible copy does not contain long or Hebrew presentation dashes", () => {
  assert.doesNotMatch(page, /[–—־]/);
  assert.doesNotMatch(engine, /[–—־]/);
});
