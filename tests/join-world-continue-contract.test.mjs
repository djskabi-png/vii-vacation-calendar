import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("world selection is one stable, accessible action with no intermediate continuation card", async () => {
  const [component, styles] = await Promise.all([
    readFile(new URL("../app/join/partner-onboarding.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(component, /className=\{`join-world-card\$\{selectedWorld === item\.id \? " active" : ""\}`\}/);
  assert.match(component, /localizedPath\(`\/join\/\$\{item\.id\}#\$\{target\}`, language\)/);
  assert.match(component, /const target = item\.id === "providers" \? "provider-pricing" : "expert-registration"/);
  assert.match(component, /aria-current=\{selectedWorld === item\.id \? "page" : undefined\}/);
  assert.doesNotMatch(component, /join-world-continue/);
  assert.doesNotMatch(component, /function chooseWorld/);
  assert.doesNotMatch(component, /function continueWithWorld/);
  assert.match(styles, /\.join-world-card \{[^}]*min-height: 150px/);
  assert.match(styles, /\.join-world-card:focus-visible/);
  assert.doesNotMatch(styles, /\.join-world-continue/);
});

test("provider plans start unselected, persist one selection and reveal one form", async () => {
  const component = await readFile(new URL("../app/join/partner-onboarding.tsx", import.meta.url), "utf8");

  assert.match(component, /useState<PlanId \| null>\(initialWorld === "providers" \? initialPlan \?\? null : null\)/);
  assert.match(component, /window\.history\.replaceState/);
  assert.match(component, /url\.searchParams\.set\("plan", plan\)/);
  assert.match(component, /url\.searchParams\.set\("billing", cycle\)/);
  assert.match(component, /isProvider && selected \? <section id="join-form"/);
  assert.match(component, /aria-pressed=\{selectedPlan === planId\}/);
  assert.doesNotMatch(component, /useState<PlanId>\("standard"\)/);
});

test("join world pages pass their current world to the shared footer", async () => {
  const [joinPage, footer] = await Promise.all([
    readFile(new URL("../app/join/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/site-footer.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(joinPage, /<PageShell variant=\{initialWorld \?\? "vacation"\}>/);
  assert.match(footer, /variant === "providers" \? "provider-pricing" : "expert-registration"/);
  assert.match(footer, /href=\{`\/join\/\$\{variant\}#\$\{joinTarget\}`\}/);
});
