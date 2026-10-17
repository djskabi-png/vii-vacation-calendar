import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];

test("shared search layout hosts never paint a second square frame or shadow", () => {
  const hosts = rules.filter(([, selectors]) => selectors.split(",").some((selector) => /\.search-box-shell\s*$/.test(selector)));
  assert.equal(hosts.length, 5, "global host plus width-only world/layout selectors must remain inventoried");
  for (const [whole, , declarations] of hosts) {
    const allowed = { border: "0", "box-shadow": "none", background: "transparent" };
    for (const [, property, value] of declarations.matchAll(/(?:^|;)\s*(border|box-shadow|background)\s*:\s*([^;]+)/gi)) {
      assert.equal(value.trim(), allowed[property.toLowerCase()], whole);
    }
  }
  assert.match(css, /\.search-box-shell \{ position: relative; border: 0; background: transparent; box-shadow: none; \}/);
});

test("rounded search surface and mobile portal retain their own visuals and layering", () => {
  assert.match(css, /\.search-box\s*\{[^}]*border-radius:\s*999px/s);
  assert.match(css, /\.search-mobile-summary\s*\{[^}]*border-radius:\s*17px/s);
  assert.match(css, /body > \.search-box-shell\.mobile-expanded \{ position:fixed; inset:0; z-index:1600/);
  assert.doesNotMatch(css, /\.search-box-shell\s*\{[^}]*overflow:\s*(?:hidden|clip)/s);
});
