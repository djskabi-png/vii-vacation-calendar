import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const searchBox = await readFile(new URL("../app/components/search-box.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("desktop destination dialog keeps its title above the world navigation and gives content enough height", () => {
  const dialog = searchBox.slice(searchBox.indexOf('role="dialog"'), searchBox.indexOf('<div className="location-list__body">'));
  assert.ok(dialog.indexOf("location-list__header") < dialog.indexOf("search-desktop-worlds"));
  assert.match(styles, /\.location-list \{[\s\S]*?width: min\(780px,[\s\S]*?max-height: min\(740px, calc\(100dvh - 48px\)\)/);
  assert.match(styles, /\.location-list__header small \{ white-space: normal;/);
  assert.match(styles, /\.search-box-shell\.mobile-expanded \.location-list > \.location-list__header,[\s\S]*?\.location-list > \.search-desktop-worlds \{ display: none; \}/);
});
