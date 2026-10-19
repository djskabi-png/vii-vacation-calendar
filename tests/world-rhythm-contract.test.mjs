import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("world landing intros share one compact vertical rhythm", async () => {
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  const events = await readFile(new URL("app/events/page.tsx", root), "utf8");
  const worldLanding = await readFile(new URL("app/components/world-landing.tsx", root), "utf8");
  assert.match(events, /className="events-page"/);
  assert.match(css, /\.events-hero \{ position: relative; isolation: isolate; padding: 28px 0 58px/);
  assert.match(css, /\.world-page-heading \{ padding-block: 22px 14px/);
  assert.match(css, /\.world-page > \.section,\s*\.events-page > \.section \{ padding-block: 64px/);
  assert.match(css, /\.events-hero__eyebrow/);
  assert.doesNotMatch(events, /className="events-hero__eyebrow"/);
  assert.match(events, /<h1>\{presentation\.title\}<\/h1>/);
  assert.match(events, /<p>\{presentation\.description\}<\/p>/);
  assert.doesNotMatch(worldLanding.match(/<section className="world-hero">[\s\S]*?<\/section>/)?.[0] || "", /className="eyebrow"/);
});

test("world landing spacing stays equal on mobile", async () => {
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.events-hero \{ padding: 10px 0 45px/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.world-page > \.section,\s*\.events-page > \.section \{ padding-block: 48px/);
});
