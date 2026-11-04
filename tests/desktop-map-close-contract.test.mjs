import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const audit = fs.readFileSync(new URL("../scripts/audit-map-experience.cjs", import.meta.url), "utf8");

test("desktop split maps keep an in-map return control after the toolbar scrolls away", () => {
  assert.match(css, /@media \(min-width: 821px\)[\s\S]*?\.airbnb-map-split__map \.map-mobile-close \{[^}]*left: 84px;[^}]*right: auto;[^}]*display: inline-flex/);
  assert.match(audit, /record\.checks\.desktopCloseInsideMap = await close\.count\(\)/);
});

test("desktop map return control cannot cover the physical left Leaflet zoom control", () => {
  assert.doesNotMatch(css, /@media \(min-width: 821px\)[\s\S]*?\.airbnb-map-split__map \.map-mobile-close \{[^}]*inset-inline-end:/);
});
