import assert from "node:assert/strict";
import ts from "typescript";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app/components/unit-preview-gallery.tsx", import.meta.url), "utf8");
const body = source.replace(/^"use client";\s*/, "").replace(/import[\s\S]*?;\r?\n/g, "").replace(/export function /g, "function ").replace(/function UnitPreviewGallery[\s\S]*$/m, "");
const js = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const { unitPreviewSources, nextUnitPreviewIndex } = new Function(`${js}; return {unitPreviewSources, nextUnitPreviewIndex};`)();

const sourceImages = ["/a.jpg", "", "/b.jpg", "/a.jpg", "/c.jpg"];
assert.deepEqual(unitPreviewSources(sourceImages), [
  { src: "/a.jpg", originalIndex: 0 },
  { src: "/b.jpg", originalIndex: 2 },
  { src: "/c.jpg", originalIndex: 4 },
]);
assert.equal(nextUnitPreviewIndex(["/a.jpg", "/b.jpg", "/c.jpg"], new Set(["/a.jpg"]), 0), 1);
assert.equal(nextUnitPreviewIndex(["/a.jpg", "/b.jpg", "/c.jpg"], new Set(["/a.jpg", "/b.jpg", "/c.jpg"]), 0), -1);
assert.equal(nextUnitPreviewIndex(["/a.jpg", "/b.jpg", "/c.jpg"], new Set(["/a.jpg"]), 2, -1), 1);
assert.equal(nextUnitPreviewIndex(["/unit-a.jpg", "/unit-b.jpg"], new Set(["/unit-a.jpg"]), 0), 1);
console.log("unit preview gallery contract passed");
