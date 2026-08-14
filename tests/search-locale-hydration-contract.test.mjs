import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");

test("search date label keeps the server and first client render locale-stable", () => {
  const visibleDatesBlock = source.match(/const visibleDates =[\s\S]*?: dates;/)?.[0] || "";

  assert.match(visibleDatesBlock, /dateLabelFromSearch\([\s\S]*?, mode, language\)/);
  assert.doesNotMatch(visibleDatesBlock, /activeRouteLanguage\(language\)/);
});
