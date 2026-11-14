import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("shared modern select measures and corrects horizontal viewport collisions", async () => {
  const source = await readFile(new URL("app/components/modern-select.tsx", root), "utf8");
  assert.match(source, /useLayoutEffect/);
  assert.match(source, /document\.documentElement\.clientWidth/);
  assert.match(source, /rect\.left < safeViewportInset/);
  assert.match(source, /rect\.right > viewportWidth - safeViewportInset/);
  assert.match(source, /visualViewport\?\.addEventListener\("resize", keepMenuInsideViewport\)/);
  assert.match(source, /ref=\{menuRef\} className="modern-select__menu"/);
});

test("modern select menu keeps a viewport-safe width and applies the collision shift", async () => {
  const styles = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(styles, /\.modern-select__menu\s*\{[^}]*max-width:\s*calc\(100vw - 24px\)/s);
  assert.match(styles, /\.modern-select__menu\s*\{[^}]*transform:\s*translateX\(var\(--modern-select-menu-shift-x,0px\)\)/s);
});
