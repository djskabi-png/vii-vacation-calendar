import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const raw = await readFile(new URL("../app/data/sergey-public-catalog.json", import.meta.url), "utf8");
const catalog = JSON.parse(raw);
const source = await readFile(new URL("../app/data/supplier-display-text.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function("module", "exports", compiled)(module, module.exports);
const { supplierDisplayDescription } = module.exports;
const { default: worker } = await import("../dist/server/index.js");
const render = (path) => worker.fetch(new Request(`https://vii.spaplus.co${path}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });

test("event-711 retains its raw supplier promotion while public copy omits the unverified price", () => {
  const place = catalog.places.find((place) => place.slug === "event-711");
  assert.match(place.description, /1,999 ₪/);
  assert.equal(supplierDisplayDescription(place), "לופט קאסה בוטיק נתניה: אירוע חלומי מול הבריכה!");
  assert.equal(JSON.stringify(catalog), raw.trim());
  for (const place of catalog.places) assert.doesNotMatch(supplierDisplayDescription(place), /\d[\d,]*\s*₪/);
});

test("currency claims are excluded without removing unrelated factual sentences", () => {
  const place = { name: "מקום", location: "עיר", area: "אזור" };
  for (const price of ["1,999 ₪", "₪ 1999", '1999 ש"ח', "1999 שקלים", "$1999", "1999 USD"]) {
    assert.equal(supplierDisplayDescription({ ...place, description: `בריכה פרטית. מחיר ${price}!` }), "בריכה פרטית.");
    assert.equal(supplierDisplayDescription({ ...place, description: `מחיר ${price}!` }), "מקום, עיר, אזור.");
  }
});

test("event search, place HTML and metadata do not publish event-711's unverified promotion", async () => {
  for (const path of ["/events/search", "/events/search?location=%D7%A0%D7%AA%D7%A0%D7%99%D7%94", "/events/place/event-711"]) {
    const response = await render(path);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.doesNotMatch(html, /1,999|1&#44;999|מבצע חורף|רק 1999/);
    if (path.includes("/place/")) assert.match(html, /אירוע חלומי מול הבריכה/);
  }
});
