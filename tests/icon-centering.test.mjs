import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("property feature icons use one normalized icon library", async () => {
  const [page, icons] = await Promise.all([
    read("app/business/client-page.tsx"),
    read("app/components/feature-icon.tsx"),
  ]);
  assert.match(page, /import \{ FeatureIcon \} from "\.\.\/components\/feature-icon"/);
  for (const icon of ["Waves", "Bath", "Gamepad2", "Trees", "CookingPot", "Eye", "CircleParking", "Accessibility", "Sparkles", "BedDouble", "BadgeCheck"]) {
    assert.match(icons, new RegExp(`\\b${icon}\\b`));
  }
  assert.doesNotMatch(icons, /const path = icon ===/);
});

test("shared square icon frames center the SVG box explicitly", async () => {
  const styles = await read("app/globals.css");
  assert.match(styles, /\.property-highlight-icon \{[^}]*display: grid;[^}]*place-items: center;[^}]*line-height: 0;/s);
  assert.match(styles, /\.property-highlight-icon svg \{[^}]*display: block;[^}]*margin: auto;[^}]*transform-origin: center;/s);
  assert.match(styles, /\.property-feature-groups \.feature-list \.property-highlight-icon \{[^}]*display: grid;[^}]*place-items: center;[^}]*padding: 0;[^}]*line-height: 0;/s);
  assert.match(styles, /:is\(\.property-highlight-icon,[^)]+\) > svg \{[^}]*display: block;[^}]*margin: auto;/s);
  assert.match(styles, /\.online-booking-badge > svg \{[^}]*display: block;[^}]*margin: auto 0;/s);
  assert.match(styles, /\.discovery-card__chip-icon \{[^}]*display: grid;[^}]*place-items: center;[^}]*overflow: hidden;[^}]*line-height: 0;/s);
  assert.match(styles, /\.discovery-card__chip-icon > svg \{[^}]*width: 15px;[^}]*height: 15px;[^}]*display: block;[^}]*margin: auto;/s);
});
