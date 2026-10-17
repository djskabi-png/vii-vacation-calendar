import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../app/components/search-box.tsx",import.meta.url),"utf8");
const css = await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
const home = await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
test("expanded shared search escapes hero clipping while inline desktop and calendars remain separate",()=>{
  assert.match(source,/import \{ createPortal \} from "react-dom"/);
  assert.match(source,/mobileExpanded && typeof document !== "undefined" \? createPortal\(searchSurface, document.body\) : searchSurface/);
  assert.match(source,/role=\{mobileExpanded \? "dialog" : undefined\}/);
  assert.match(source,/aria-modal=\{mobileExpanded \? true : undefined\}/);
  assert.match(css,/body > \.search-box-shell\.mobile-expanded \{ position:fixed; inset:0; z-index:1600/);
  assert.match(css,/\.discovery-world-hero__search \{ margin-bottom:0; \}/);
  assert.match(source,/event\.target instanceof Node && !surface\.contains\(event\.target\)\) return/);
  assert.match(source,/event\.key !== "Tab"/);
  assert.match(source,/document\.body\.style\.overflow = previousOverflow/);
  assert.match(source,/if \(event\.matches\) cancelMobileSearch\(\)/);
  assert.ok(source.indexOf("<EventDatePicker")>source.indexOf("createPortal(searchSurface, document.body)"));
});
test("homepage uses the exact approved copy",()=>{
  assert.match(home,/<h1>כל מה שעושים בחופש, במקום אחד<\/h1>/);
  assert.match(home,/<p>נופש, ספא, אירועים ופעילויות\. מחפשים ומזמינים ישר כאן\.<\/p>/);
});
