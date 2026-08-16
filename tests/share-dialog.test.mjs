import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("sharing uses one branded accessible dialog instead of the operating system sheet", async () => {
  const [dialog, business, events, article, css] = await Promise.all([
    read("app/components/share-dialog.tsx"),
    read("app/business/client-page.tsx"),
    read("app/events/place/client-page.tsx"),
    read("app/guides/article/client-page.tsx"),
    read("app/globals.css"),
  ]);

  assert.doesNotMatch(`${business}\n${events}\n${article}`, /navigator\.share/);
  assert.match(business, /<ShareButton title=\{property\.name\}/);
  assert.match(events, /<ShareButton title=\{place\.name\} kind="event"/);
  assert.match(article, /<ShareButton title=\{article\.title\} kind="article"/);
  assert.match(dialog, /createPortal/);
  assert.match(dialog, /role="dialog" aria-modal="true"/);
  assert.match(dialog, /document\.body\.style\.overflow = "hidden"/);
  assert.match(dialog, /event\.key === "Escape"/);
  assert.match(dialog, /triggerRef\.current\?\.focus/);
  assert.match(dialog, /navigator\.clipboard\.writeText/);
  assert.match(dialog, /cleanShareUrl/);
  assert.match(dialog, /if \(id\) essential\.set\("id", id\)/);
  assert.match(dialog, /current\.hash = ""/);
  assert.match(dialog, /מצאתי ב־VII מקום שיכול להתאים לנו/);
  assert.doesNotMatch(dialog, /<bdi>/);
  assert.match(dialog, /https:\/\/wa\.me\/\?text=/);
  assert.match(dialog, /facebook\.com\/sharer\/sharer\.php/);
  assert.match(dialog, /mailto:\?subject=/);
  assert.match(dialog, /const copy: Record<SiteLanguage, ShareCopy>/);
  assert.match(css, /\.share-dialog-layer \{ position: fixed; z-index: 2100/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.share-dialog-layer \{ align-items: end/);
  assert.match(css, /font-family: var\(--font-sans\)/);
});
