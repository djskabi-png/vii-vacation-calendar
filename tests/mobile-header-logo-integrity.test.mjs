import { readEffectiveWorldCss } from "./helpers/world-css.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readEffectiveWorldCss();

test("the mobile header reserves a complete uncropped logo slot beside all utility actions", () => {
  assert.match(styles, /@media \(max-width: 560px\) \{[\s\S]*?\.site-header:has\(\.world-dock\) \.site-header__inner \{[\s\S]*?width: calc\(100% - 8px\);[\s\S]*?grid-template-columns: 54px minmax\(0,1fr\);[\s\S]*?gap: 2px;/);
  assert.match(styles, /\.site-header:has\(\.world-dock\) \.brand \{ flex: 0 0 54px; overflow: visible; \}/);
  assert.match(styles, /\.site-header:has\(\.world-dock\) \.brand img \{ object-fit: contain; \}/);
  assert.match(styles, /\.site-header:has\(\.world-dock\) \.header-actions \{ min-width: 0; gap: 2px; \}/);
  assert.match(styles, /\.site-header:has\(\.world-dock\) \.world-dock > summary \{[\s\S]*?width: 90px;[\s\S]*?min-width: 90px;[\s\S]*?max-width: 90px;/);
});

test("the narrowest supported header keeps forty-four pixel controls without sacrificing the logo", () => {
  assert.match(styles, /@media \(max-width: 360px\) \{[\s\S]*?grid-template-columns: 48px minmax\(0,1fr\); gap: 1px;[\s\S]*?width: 44px; min-width: 44px; min-height: 44px;/);
  assert.match(styles, /@media \(max-width: 360px\) \{[\s\S]*?\.world-dock > summary \{ width: 90px; min-width: 90px; max-width: 90px; padding-inline: 8px; gap: 4px;/);
  assert.match(styles, /@media \(max-width: 340px\) \{[\s\S]*?grid-template-columns: 44px minmax\(0,1fr\);[\s\S]*?\.brand img \{ width: 44px; max-width: 44px; \}[\s\S]*?\.header-actions > \.language-switcher \{ display: none; \}[\s\S]*?\.world-dock > summary \{ width: 90px; min-width: 90px; max-width: 90px; padding-inline: 8px; gap: 4px;/);
});
