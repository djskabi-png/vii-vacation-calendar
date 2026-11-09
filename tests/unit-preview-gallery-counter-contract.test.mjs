import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("unit gallery counter cannot inherit full-height image badge geometry", () => {
  assert.match(css, /\.room-card__image > \.preview-card-gallery__count\s*\{[^}]*top:\s*auto[^}]*bottom:\s*12px[^}]*height:\s*auto/s);
});
