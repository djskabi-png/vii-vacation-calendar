import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("provider category selection scrolls only the category rail, never the document", async () => {
  const source = await readFile(new URL("../app/components/provider-results.tsx", import.meta.url), "utf8");
  assert.match(source, /scrollSliderRailToCard\(rail, selectedIndex, ":scope > \*"\)/);
  assert.doesNotMatch(source, /querySelector<HTMLElement>\('\[aria-current="page"\]'\)\?\.scrollIntoView/);
  assert.match(source, /import \{ SliderRailControls, scrollSliderRailToCard \} from "\.\/slider-rail-controls"/);
});
