import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [route, engine] = await Promise.all([
  readFile(new URL("../app/api/admin/professor/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/lib/admin-professor.ts", import.meta.url), "utf8"),
]);

test("Professor keeps quota and history on one persistent primary state store", () => {
  assert.match(route, /const stateDb = await runtimeD1Database\(\); const db = stateDb;/);
  assert.doesNotMatch(route, /requiredRuntimeDatabase/);
  assert.doesNotMatch(route, /professor_state_using_d1_fallback/);
  assert.match(route, /professorQuota\(stateDb, session\.email\)/);
  assert.match(route, /professorHistory\(stateDb, session\.email\)/);
  assert.match(route, /saveProfessorQuota\(stateDb, email, limit, session\.email\)/);
});

test("Professor separates report reads from state writes and falls back only for reads", () => {
  assert.match(route, /const report = await reportingDatabase\(\)/);
  assert.match(route, /answerProfessor\(stateDb, session\.email, question, report\.database\)/);
  assert.match(engine, /answerProfessor\(db: D1Database, email: string, question: string, reportingDb: D1Database = db\)/);
  assert.match(engine, /try \{ return await metricSnapshot\(reportingDb, range, intent\); \}/);
  assert.match(engine, /return metricSnapshot\(db, range, intent\)/);
  assert.match(engine, /INSERT INTO vii_professor_questions_v1/);
});
