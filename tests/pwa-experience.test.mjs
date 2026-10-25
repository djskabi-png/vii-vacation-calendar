import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("manifest exposes a scoped standalone experience with safe any and maskable icons", () => {
  const manifest = source("../app/manifest.ts");
  assert.match(manifest, /id: "\/"/);
  assert.match(manifest, /scope: "\/"/);
  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /vii-app-icon\.svg[\s\S]*purpose: "any"/);
  assert.match(manifest, /vii-app-icon-maskable\.svg[\s\S]*purpose: "maskable"/);
});

test("service worker supports offline navigation and updates without caching private surfaces", () => {
  const worker = source("../public/sw.js");
  assert.match(worker, /caches\.match\(OFFLINE\)/);
  assert.match(worker, /SKIP_WAITING/);
  for (const prefix of ["/api/", "/admin", "/auth", "/account", "/booking", "/favorites", "/checkout"]) assert.ok(worker.includes(`"${prefix}"`), prefix);
  assert.match(worker, /if \(url\.origin !== self\.location\.origin \|\| privateRequest\(url\)\) return/);
});

test("PWA controls cover install, iOS guidance, update and offline states in all public languages", () => {
  const experience = source("../app/components/pwa-experience.tsx");
  for (const language of ["he", "en", "fr", "ru"]) assert.match(experience, new RegExp(`\\n  ${language}: \\{`));
  assert.match(experience, /beforeinstallprompt/);
  assert.match(experience, /appinstalled/);
  assert.match(experience, /controllerchange/);
  assert.match(experience, /role="status"/);
  assert.match(experience, /role="dialog" aria-modal="true"/);
});

test("first service-worker control never reloads an active public flow", () => {
  const experience = source("../app/components/pwa-experience.tsx");
  assert.match(experience, /let hadController = Boolean\(navigator\.serviceWorker\.controller\)/);
  assert.match(experience, /if \(!hadController\) \{[\s\S]*hadController = true;[\s\S]*return;/);
  assert.match(experience, /if \(!refreshing\) \{ refreshing = true; location\.reload\(\); \}/);
});

test("the global footer always keeps a truthful install app entry point", () => {
  const experience = source("../app/components/pwa-experience.tsx");
  const footer = source("../app/components/site-footer.tsx");
  assert.match(footer, /<PwaInstallControl \/>/);
  assert.doesNotMatch(experience, /if \(!state\.update && !state\.installPrompt && !state\.ios\) return null/);
  assert.doesNotMatch(experience, /if \(state\.installed && !state\.update\) return null/);
  assert.match(experience, /state\.ios \? copy\[language\]\.ios : copy\[language\]\.browser/);
  assert.match(experience, /disabled=\{state\.installed && !state\.update\}/);
  assert.match(experience, /if \(state\.installPrompt\) \{ await state\.installPrompt\.prompt\(\)/);
});
