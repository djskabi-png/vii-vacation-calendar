import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("world selection uses a dedicated, accessible continuation action", async () => {
  const [component, styles] = await Promise.all([
    readFile(new URL("../app/join/partner-onboarding.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(component, /function chooseWorld\(worldId: JoinWorld\) \{\s*setSelectedWorld\(worldId\);\s*\}/);
  const chooseWorldBody = component.match(/function chooseWorld\(worldId: JoinWorld\) \{([\s\S]*?)\n  \}/)?.[1] ?? "";
  assert.doesNotMatch(chooseWorldBody, /scrollIntoView/);
  assert.match(component, /className="join-world-continue" aria-live="polite"/);
  assert.match(component, /selectedWorld === item\.id \? <div className="join-world-continue"/);
  assert.match(component, /type="button" className="join-world-continue__button" onClick=\{continueWithWorld\}/);
  assert.match(component, /isProvider \? "provider-pricing" : "expert-registration"/);
  assert.match(styles, /\.join-world-continue__button \{[^}]*min-height: 56px/);
  assert.match(styles, /@media \(max-width: 650px\)[\s\S]*?\.join-world-continue__button \{[^}]*width: 100%[^}]*min-height: 58px/);
});
