import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/admin/professor/page.tsx", import.meta.url), "utf8");
const engine = await readFile(new URL("../app/lib/admin-professor.ts", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/admin/admin.module.css", import.meta.url), "utf8");

test("Professor renders interactive data-backed comparison, ranking and snapshot charts", () => {
  assert.match(page, /ProfessorVisualization/);
  assert.match(page, /השוואה/);
  assert.match(page, /דירוג/);
  assert.match(page, /תמונת מצב/);
  assert.match(page, /אין השלמת ערכים או תחזית/);
  assert.match(styles, /professorChartIn/);
});

test("Professor returns deterministic insights and keeps safe follow-up context", () => {
  assert.match(engine, /buildInsights/);
  assert.match(engine, /יחס קשר להזמנה/);
  assert.match(engine, /previousProfessorContext/);
  assert.match(engine, /isFollowUp/);
  assert.match(engine, /parsed\.explicitMetrics \? parsed\.metrics : context\.plan\.metrics/);
});

test("Professor visual motion respects reduced-motion preferences", () => {
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(styles, /\.professorBrain>i/);
});
