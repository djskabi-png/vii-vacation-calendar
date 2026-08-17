import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const explorer = await readFile(new URL("../app/trails/trails-explorer.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../app/trails/page.tsx", import.meta.url), "utf8");

test("trail discovery supports shareable multi-selection without changing trail cards", () => {
  assert.match(explorer, /function MultiChoice/);
  assert.match(explorer, /type="checkbox"/);
  assert.match(explorer, /next\.join\(","\)/);
  assert.match(explorer, /selectedNatures\.some/);
  assert.match(explorer, /<TrailCard key={trail\.slug} trail={trail} \/>/);
  assert.match(page, /מסלולי טיול בישראל למטייל העצמאי/);
});
