import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("root metadata publishes the current localized pathname as the social URL", async () => {
  const source = await read("app/layout.tsx");
  assert.match(source, /openGraph:\s*\{[\s\S]*?url:\s*pathname,[\s\S]*?locale:\s*openGraphLocale/);
});

test("business metadata localizes canonical and social URLs", async () => {
  const source = await read("app/business/page.tsx");
  assert.match(source, /const canonical = localizedPath\(`\/business\?id=\$\{property\.slug\}`, language\)/);
  assert.match(source, /alternates:\s*\{ canonical \}/);
  assert.match(source, /openGraph:\s*\{[^}]*url:\s*canonical/);
});

test("shared listing and content pages localize canonical and social URLs", async () => {
  for (const [path, route] of [
    ["app/hourly/page.tsx", "/hourly"],
    ["app/spas/page.tsx", "/spas"],
    ["app/gift-card/page.tsx", "/gift-card/"],
    ["app/guides/page.tsx", "/guides"],
  ]) {
    const source = await read(path);
    assert.ok(source.includes(`serverLocalePath(\"${route}\")`), `${path} must localize ${route}`);
    assert.match(source, /openGraph:\s*\{[^}]*url:\s*canonical/, `${path} must expose localized og:url`);
  }
});

test("dynamic discover and event detail pages localize canonical and social URLs", async () => {
  for (const path of [
    "app/discover/place/[id]/page.tsx",
    "app/events/place/[id]/page.tsx",
    "app/events/place/page.tsx",
  ]) {
    const source = await read(path);
    assert.match(source, /const canonical = await serverLocalePath\(/, `${path} must derive a localized canonical`);
    assert.match(source, /openGraph:[\s\S]*?url:\s*canonical/, `${path} must expose localized og:url`);
  }
});
