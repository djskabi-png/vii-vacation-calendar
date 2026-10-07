import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { createHash } from "node:crypto";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import NextImage from "next/image.js";

const page = await readFile(new URL("../app/trails/[slug]/page.tsx", import.meta.url), "utf8");
const card = await readFile(new URL("../app/components/trail-card.tsx", import.meta.url), "utf8");

test("trail details answer the critical visit questions in the first screen", () => {
  assert.match(page, /aria-label="תקציר המסלול"/);
  assert.match(page, />איפה\?</);
  assert.match(page, />כמה זמן\?</);
  assert.match(page, />מה הקושי\?</);
  assert.match(page, />למי מתאים\?</);
  assert.match(page, />פתיחה במפה</);
  assert.match(page, />בדיקה במקור הרשמי</);
  assert.match(page, /faqSchema\(trailFaqs\)/);
});

test("all trail illustrations expose accurate text and distinct matching JPEG files", async () => {
  const data = await readFile(new URL("../app/data/trail-data.ts", import.meta.url), "utf8");
  const compile = (source) => ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React,
  } }).outputText;
  const { trails } = await import(`data:text/javascript;base64,${Buffer.from(compile(data)).toString("base64")}`);
  const visualSource = card.slice(card.indexOf("export function TrailVisual"), card.indexOf("export function TrailCard"));
  const visual = compile(visualSource).replace("export function TrailVisual", "return function TrailVisual");
  const TrailVisual = new Function("React", "Image", visual)(React, NextImage.default || NextImage);
  const directory = new URL("../public/images/trails/", import.meta.url);
  const files = (await readdir(directory)).filter((name) => name.endsWith(".jpg")).sort();
  assert.equal(trails.length, 48);
  assert.deepEqual(files, trails.map((trail) => `${trail.slug}.jpg`).sort());
  const hashes = new Set();
  for (const trail of trails) {
    const bytes = await readFile(new URL(`${trail.slug}.jpg`, directory));
    assert.equal(bytes.readUInt16BE(0), 0xffd8);
    assert.equal(bytes.readUInt16BE(bytes.length - 2), 0xffd9);
    hashes.add(createHash("sha256").update(bytes).digest("hex"));
    const html = renderToStaticMarkup(React.createElement(TrailVisual, { trail }));
    assert.ok(html.includes(`title="תמונת המחשה למסלול ${trail.name}"`));
    assert.ok(html.includes(`alt="תמונת המחשה למסלול ${trail.name}: ${trail.highlights.slice(0, 2).join(" ו")}."`));
    assert.ok(html.includes('image-context-label">תמונת המחשה</span>'));
    assert.ok(!html.includes('aria-hidden="true"'));
  }
  assert.equal(hashes.size, 48);
});
