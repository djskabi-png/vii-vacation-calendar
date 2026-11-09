import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("RTL nearby popular tile keeps the location icon inside its grid column", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.home-popular-search-location\s*\{[^}]*box-sizing:\s*border-box[^}]*flex:none/s);
  assert.match(css, /\.home-visual-searches a\s*\{[^}]*grid-template-columns:\s*58px 1fr/s);
});
