import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("localized root metadata is rendered before hydration", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  for (const title of [
    "Vifor Vacation | Find the vacation that suits you",
    "Вифор Отпуск | Найдите отдых, который подходит именно вам",
    "Vifor Vacances | Trouvez les vacances qui vous conviennent",
  ]) assert.match(layout, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(layout, /default:\s*localizedRootTitles\[locale\]/);
  assert.match(layout, /template:\s*localizedTitleTemplates\[locale\]/);
});
