import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("world surface boundary keeps tokens out of the global stylesheet", () => {
  const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.equal(css.includes('.site-page[data-world-surface="spa"]'), false);
  assert.equal(css.split("VII_SPA_AUDIENCE_DATE_CSS_SLOT").length - 1, 1);
});
