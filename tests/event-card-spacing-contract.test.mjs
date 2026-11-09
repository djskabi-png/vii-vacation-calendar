import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("event result actions follow content without forced empty vertical slot", async () => {
  const css = await readFile(new URL("../app/preview-card-consistency.css", import.meta.url), "utf8");
  assert.match(css, /\.event-result-card \.event-card__actions \{ margin-top: 4px; min-block-size: 0; align-content: start; \}/);
  assert.match(css, /\.event-result-card \.event-result-card__title \{ min-block-size: 0; \}/);
  assert.match(css, /\.event-result-card \.event-result-card__location\s*\{[^}]*block-size: auto;/);
  assert.match(css, /\.event-result-card \.event-capacity \{ margin: 0; min-block-size: 0;/);
  assert.match(css, /\.event-map-results > \.event-result-card > \.event-card-gallery img[\s\S]*aspect-ratio: 4 \/ 3/);
});
