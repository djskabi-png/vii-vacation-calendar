import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const card = await readFile(new URL("../app/components/property-card.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const detail = await readFile(new URL("../app/data/supplier-place-detail.ts", import.meta.url), "utf8");

test("vacation preview text is an optional additive row below the existing card footer", () => {
  const footer = card.indexOf("stay-card__footer");
  const caption = card.indexOf("stay-card__preview-text");
  assert.ok(footer >= 0 && caption > footer);
  assert.match(card, /property\.previewText\?\.trim\(\) \? <p className="stay-card__preview-text">/);
  assert.match(card, /\{property\.previewText\.trim\(\)\}<\/p> : null/);
  assert.doesNotMatch(css, /\.stay-card__preview-text\s*\{[^}]*position:\s*absolute/s);
  assert.match(css, /\.stay-card__preview-text\s*\{[^}]*overflow-wrap:\s*anywhere/s);
});

test("the detailed supplier response retains preview_text as plain optional text", () => {
  assert.match(detail, /previewText\?: string/);
  assert.match(detail, /plain\(detail\.preview_text\)/);
});
