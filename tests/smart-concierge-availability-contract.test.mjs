import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const pageShell = await readFile(new URL("../app/components/page-shell.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("the floating WhatsApp concierge is absent from the shared public page shell", () => {
  assert.doesNotMatch(pageShell, /SmartConcierge/);
});

test("mobile detail pages keep their own contextual actions", () => {
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.detail-sticky-wrap \{ display: none; \}/);
  assert.doesNotMatch(css, /\.property-page, \.event-place-page, \.discovery-detail \{ padding-bottom: calc\(96px/);
});
