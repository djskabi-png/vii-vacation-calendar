import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { adminModules } from "../app/admin/access-policy.ts";

const root = new URL("../", import.meta.url);
const pageRoutes = [...new Set(adminModules.flatMap((module) => module.pages))];
const pageFiles = [...pageRoutes.map((route) => route === "/admin"
  ? "app/admin/page.tsx"
  : `app${route}/page.tsx`), "app/admin/users/page.tsx"];
const adminUiFiles = readdirSync(new URL("../app/admin/", import.meta.url), { recursive: true })
  .map((file) => `app/admin/${String(file).replaceAll("\\", "/")}`)
  .filter((file) => file.endsWith(".tsx"));

function source(path) {
  return readFileSync(new URL(path, root), "utf8");
}

function openingTags(text, name) {
  const output = [];
  const needle = `<${name}`;
  let offset = 0;
  while ((offset = text.indexOf(needle, offset)) >= 0) {
    const boundary = text[offset + needle.length];
    if (boundary && !/[\s/>]/.test(boundary)) {
      offset += needle.length;
      continue;
    }
    let quote = "";
    let braces = 0;
    let index = offset + needle.length;
    for (; index < text.length; index += 1) {
      const char = text[index];
      if (quote) {
        if (char === quote && text[index - 1] !== "\\") quote = "";
        continue;
      }
      if (char === '"' || char === "'" || char === "`") { quote = char; continue; }
      if (char === "{") braces += 1;
      else if (char === "}") braces = Math.max(0, braces - 1);
      else if (char === ">" && braces === 0) break;
    }
    output.push(text.slice(offset, index + 1));
    offset = index + 1;
  }
  return output;
}

test("every registered administration route has a real page", () => {
  assert.ok(pageRoutes.length >= 15, `expected the complete administration family, got ${pageRoutes.length}`);
  for (const file of pageFiles) {
    assert.equal(existsSync(new URL(file, root)), true, `missing administration page: ${file}`);
    assert.match(source(file), /export default/, `administration page has no default surface: ${file}`);
  }
});

test("every administration button has an explicit safe browser type and an action", () => {
  const failures = [];
  for (const file of adminUiFiles) {
    for (const [index, tag] of openingTags(source(file), "button").entries()) {
      if (!/\btype\s*=/.test(tag)) failures.push(`${file} button ${index + 1}: missing explicit type`);
      if (!/\btype\s*=\s*["']submit["']/.test(tag) && !/\bonClick\s*=|\bonPointerDown\s*=/.test(tag)) {
        failures.push(`${file} button ${index + 1}: missing click, submit or pointer action`);
      }
      if (/onClick\s*=\s*{\s*\(.*?\)\s*=>\s*{\s*}\s*}/s.test(tag)) failures.push(`${file} button ${index + 1}: empty action`);
    }
  }
  assert.deepEqual(failures, []);
});

test("administration links have destinations and forms have submit behavior", () => {
  const failures = [];
  for (const file of adminUiFiles) {
    const text = source(file);
    for (const [index, tag] of [...openingTags(text, "a"), ...openingTags(text, "Link")].entries()) {
      if (!/\bhref\s*=/.test(tag)) failures.push(`${file} link ${index + 1}: missing href`);
      if (/\bhref\s*=\s*["']#["']/.test(tag)) failures.push(`${file} link ${index + 1}: placeholder href`);
    }
    for (const [index, tag] of openingTags(text, "form").entries()) {
      if (!/\bonSubmit\s*=|\baction\s*=/.test(tag)) failures.push(`${file} form ${index + 1}: missing submit behavior`);
    }
  }
  assert.deepEqual(failures, []);
});

test("QQQAAA includes the complete administration control inventory", () => {
  const runner = source("scripts/run-qqqaaa.cjs");
  const packageJson = JSON.parse(source("package.json"));
  assert.match(runner, /administration-control-inventory/);
  assert.match(runner, /qa:admin-controls/);
  assert.match(packageJson.scripts["qa:admin-controls"], /admin-control-inventory\.test\.mjs/);
});
