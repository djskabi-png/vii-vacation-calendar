import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mobile menu keeps account access while removing redundant promotional copy", async () => {
  const source = await readFile(new URL("../app/site-header.tsx", import.meta.url), "utf8");

  assert.match(source, /className="menu-panel__account"[^>]*onClick=\{openAccountLogin\}/);
  assert.doesNotMatch(source, /\{accountCopy\.login\}<ArrowIcon \/>/);
  assert.doesNotMatch(source, /<span>VII<\/span>/);
  assert.doesNotMatch(source, /כל מה שכיף לעשות, בדיוק בדרך שלכם/);
  assert.match(source, /<div className="menu-panel__footer">\s*<LanguageSwitcher compact \/>\s*<\/div>/);
});
