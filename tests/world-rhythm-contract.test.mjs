import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("world landing intros share one compact vertical rhythm", async () => {
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  const events = await readFile(new URL("app/events/page.tsx", root), "utf8");
  const worldLanding = await readFile(new URL("app/components/world-landing.tsx", root), "utf8");
  assert.match(events, /className="events-page"/);
  assert.match(css, /\.events-hero \{ padding: 46px 0 48px/);
  assert.match(css, /\.world-page > \.section,\s*\.events-page > \.section \{ padding-block: 64px/);
  assert.match(css, /\.world-hero > \.shell > \.eyebrow,\s*\.events-hero > \.shell > \.eyebrow \{ display: none/);
  assert.doesNotMatch(events.match(/<section className="events-hero">[\s\S]*?<\/section>/)?.[0] || "", /className="eyebrow"/);
  assert.doesNotMatch(worldLanding.match(/<section className="world-hero">[\s\S]*?<\/section>/)?.[0] || "", /className="eyebrow"/);
});

test("world landing spacing stays equal on mobile", async () => {
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.events-hero \{ padding: 26px 0 24px/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.world-page > \.section,\s*\.events-page > \.section \{ padding-block: 48px/);
});
