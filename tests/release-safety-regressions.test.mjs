import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const homeShowcaseSource = await readFile(new URL("../app/components/home-showcase.tsx", import.meta.url), "utf8");
const globalStyles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const mobileStyles = await readFile(new URL("../app/mobile-stability.css", import.meta.url), "utf8");
const pageShellSource = await readFile(new URL("../app/components/page-shell.tsx", import.meta.url), "utf8");
const viewportGuardSource = await readFile(new URL("../app/components/responsive-viewport-guard.tsx", import.meta.url), "utf8");

test("homepage heading ids remain unique", () => {
  const ids = [...homeShowcaseSource.matchAll(/\bid=\{?`?['\"]?([^'\"`}]+)['\"]?`?\}?/g)].map((match) => match[1]);
  const literalIds = ids.filter((id) => !id.includes("${"));
  const duplicates = literalIds.filter((id, index) => literalIds.indexOf(id) !== index);

  assert.deepEqual([...new Set(duplicates)], []);
});

test("site shell clips horizontal overflow at every viewport", () => {
  assert.match(globalStyles, /html,\s*body\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*100%;[^}]*overflow-x:\s*hidden;/s);
  assert.match(globalStyles, /\.site-page\s*\{[^}]*overflow:\s*clip;/s);
  assert.match(globalStyles, /\.site-page\s*>\s*main\s*\{[^}]*overflow-x:\s*clip;/s);
});

test("restored mobile pages reset stale horizontal browser positions", () => {
  assert.match(pageShellSource, /<ResponsiveViewportGuard\s*\/>/);
  assert.match(viewportGuardSource, /document\.scrollingElement/);
  assert.match(viewportGuardSource, /scrollLeft\s*=\s*0/);
  assert.match(viewportGuardSource, /pageshow/);
  assert.match(viewportGuardSource, /popstate/);
  assert.match(viewportGuardSource, /orientationchange/);
});

test("mobile quick filters stay inside the page while scrolling internally", () => {
  assert.match(mobileStyles, /\.search-quick-filters\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*100%;[^}]*margin-inline:\s*0;/s);
});
