import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const page = await readFile(new URL("../app/favorites/page.tsx", import.meta.url), "utf8");

test("viewed-history controls never compete with the world filter rail", () => {
  assert.match(css, /\.favorites-toolbar\s*\{[^}]*grid-template-columns:\s*minmax\(0,1fr\)/s);
  assert.match(css, /\.favorites-toolbar \.favorites-tabs\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0/s);
  assert.match(css, /\.favorites-history-actions\s*\{[^}]*justify-self:\s*start/s);
});

test("mobile history controls stretch without clipping either action", () => {
  assert.match(css, /\.favorites-history-actions\s*\{[^}]*width:\s*100%[^}]*justify-self:\s*stretch[^}]*justify-content:\s*space-between/s);
});

test("catalog reconciliation does not restart itself when nothing changed", () => {
  assert.match(page, /if \(nextSaved\.length !== savedItems\.length\) \{\s*writeSavedItems\(nextSaved\);\s*setSavedItems\(nextSaved\);\s*\}/s);
  assert.match(page, /if \(nextViewed\.length !== viewedItems\.length\) \{\s*writeViewedItems\(nextViewed\);\s*setViewedItems\(nextViewed\);\s*\}/s);
  assert.doesNotMatch(page, /\n\s*setSavedItems\(nextSaved\);\s*\n\s*setViewedItems\(nextViewed\);/s);
});
