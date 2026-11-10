import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

test("holiday artwork stays desktop-only on mobile breakpoints", async () => {
  const css = await fs.readFile(new URL("../app/holidays/holiday-world.css", import.meta.url), "utf8");

  assert.match(
    css,
    /@media\(max-width:700px\).*\.holiday-hub__media\{display:none\}/,
    "holiday hub cards must not render artwork on mobile",
  );
  assert.match(
    css,
    /@media\(max-width:760px\).*\.holiday-hero__media\{display:none\}/,
    "holiday detail heroes must not render artwork on mobile",
  );
});
