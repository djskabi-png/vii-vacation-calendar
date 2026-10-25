import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("localized root metadata is rendered before hydration", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  for (const title of [
    "V Vacation | Find the vacation that suits you",
    "V Vacation | Найдите отдых, который подходит именно вам",
    "V Vacation | Trouvez les vacances qui vous conviennent",
  ]) assert.match(layout, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(layout, /default:\s*localizedRootTitles\[locale\]/);
  assert.match(layout, /template:\s*localizedTitleTemplates\[locale\]/);
});

test("same-origin APIs cannot race the initial streamed hydration", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /apiHydrationGate/);
  assert.match(layout, /target\.origin===location\.origin&&target\.pathname\.indexOf\('\/api\/'\)===0/);
  assert.match(layout, /window\.addEventListener\('load',open,\{once:true\}\)/);
  assert.match(layout, /setTimeout\(function\(\)\{release\(\);window\.fetch=original\},800\)/);
});
