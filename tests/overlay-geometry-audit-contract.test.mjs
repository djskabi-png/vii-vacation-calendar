import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const audit = await readFile(new URL("../scripts/audit-overlay-geometry.cjs", import.meta.url), "utf8");
const qqqaaa = await readFile(new URL("../scripts/run-qqqaaa.cjs", import.meta.url), "utf8");

test("every isolated search hero is elevated while an option overlay is open", () => {
  for (const selector of [".discovery-world-hero", ".spa-discovery-hero", ".events-hero"]) {
    assert.match(css, new RegExp(`${selector.replace(".", "\\.")}:has\\(\\.search-option-backdrop\\)`));
  }
});

test("overlay geometry audit detects viewport escape and underlay painting above a dialog", () => {
  assert.match(audit, /dialog_outside_viewport/);
  assert.match(audit, /interactive_control_escaped_dialog/);
  assert.match(audit, /underlay_paints_above_dialog/);
  assert.match(audit, /overlay_host_not_elevated/);
  assert.match(audit, /overlay_did_not_close_cleanly/);
  assert.match(audit, /detectorSelfTest/);
  assert.match(audit, /underlay_paints_above_dialog/);
  assert.match(audit, /he,en,ru,fr/);
});

test("QQQAAA includes the shared overlay geometry gate", () => {
  assert.match(qqqaaa, /overlay-geometry/);
  assert.match(qqqaaa, /qa:overlay-geometry/);
});
