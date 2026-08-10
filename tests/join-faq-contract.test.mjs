import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("join page exposes one visible and structured FAQ source above the footer", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../app/join/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /const joinFaqs = \[/);
  assert.match(page, /faqSchema\(joinFaqs\)/);
  assert.match(page, /joinFaqs\.map\(\(item\)/);
  assert.match(page, /<details key=\{item\.question\}>[\s\S]*<summary>\{item\.question\}<\/summary>/);
  assert.ok((page.match(/question: "/g) ?? []).length >= 8);
  assert.ok(page.indexOf("<PartnerOnboarding") < page.indexOf('className="section shell join-faq"'));
  assert.match(styles, /\.join-faq summary:focus-visible/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.join-faq \{ grid-template-columns: 1fr/);
});
