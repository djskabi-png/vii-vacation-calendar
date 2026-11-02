import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../app/lib/admin-professor-openai.ts", import.meta.url), "utf8");
const engine = await readFile(new URL("../app/lib/admin-professor.ts", import.meta.url), "utf8");

test("Professor uses the Responses API only on the server and keeps a deterministic fallback", () => {
  assert.match(source, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(source, /OPENAI_API_KEY/);
  assert.match(source, /provider: "deterministic"/);
  assert.match(source, /AbortController/);
  assert.match(source, /json_schema/);
});

test("Professor interprets first, validates through the existing intent engine, and reports its source", () => {
  assert.match(engine, /interpretProfessorQuestion\(normalizedQuestion\)/);
  assert.match(engine, /parseProfessorIntent\(interpretedQuestion, places\)/);
  assert.match(engine, /פענוח OpenAI מאומת מול מסד V ומטמון Biz/);
});
