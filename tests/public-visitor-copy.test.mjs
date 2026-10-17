import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const internalCopy = /\bAPI\b|מקור הנתונים|ספק[י]? (?:הסליקה|סליקה)|לאחר (?:ה)?חיבור (?:המערכת|מערכת|מערכות|פרטי העסק)|יחוברו למערכת|בקטלוג הנוכחי|מהקטלוג הפעיל|מערכת (?:ההזמנות|הספק)|החיבור למערכת/iu;
const hasVisitorLanguage = /[\u0590-\u05ff]|\sAPI\s/u;
function visitorLiterals(path, source) {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const values = [];
  function visit(node) {
    if (ts.isStringLiteralLike(node) || ts.isJsxText(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      if (hasVisitorLanguage.test(node.text)) values.push(node.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return values;
}
async function collect(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (!["admin", "platform", "api", "i18n", "lib"].includes(entry.name)) files.push(...await collect(path));
    } else if (entry.name.endsWith(".tsx") || ["hourly-details.ts", "world-data.ts", "site-data.ts"].includes(entry.name)) files.push(path);
  }
  return files;
}

test("public visitor templates do not explain internal data or integration mechanisms", async () => {
  const leaks = [];
  for (const path of [...await collect(resolve(root, "app")), resolve(root, "app/lib/spa-editorial-policy.ts")]) {
    for (const text of visitorLiterals(path, await readFile(path, "utf8"))) {
      if (internalCopy.test(text)) leaks.push(`${relative(root, path)}: ${text.trim()}`);
    }
  }
  assert.deepEqual(leaks, []);
});

test("copy guard rejects technical fixtures but permits useful capability and booking truth", () => {
  for (const text of ["מחירים מה־API של VII", "ב־API אין בדיקת זמינות", "ספק הסליקה טרם חובר", "היחידות במקור הנתונים", "לאחר חיבור המערכת המחיר יגיע"]) assert.ok(internalCopy.test(text), text);
  for (const text of ["המחירים המוצגים הם מחירי בסיס", "ההזמנה ממתינה לאישור המקום", "המחשה בלבד. לא מתבצע תשלום", "למחיר, פנו למקום", "תמונה אינה זמינה"]) assert.ok(!internalCopy.test(text), text);
});

test("hourly data and localized visitor guidance preserve useful truth without internal explanations", async () => {
  const path = resolve(root, "app/data/hourly-details.ts");
  const source = await readFile(path, "utf8");
  const transpiled = ts.transpileModule(source.replace(/^import .*;\r?\n/gm, ""), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  const catalog = JSON.parse(await readFile(resolve(root, "app/data/sergey-hourly-catalog.json"), "utf8"));
  new Function("exports", "hourlyCatalog", transpiled)(module.exports, catalog);
  const realPlace = catalog.places.find((place) => place.id === "hourly-1891");
  assert.ok(realPlace);
  const details = module.exports.getHourlyDetails({ id: realPlace.id, description: "תיאור המקום", features: [] }, realPlace);
  assert.ok(details.rates.length);
  assert.equal(details.arrivalNotes.length, 1);
  assert.match(details.arrivalNotes[0], /מאשרים עם המקום/);
  assert.doesNotMatch(JSON.stringify(details), internalCopy);
  const empty = module.exports.getHourlyDetails({ id: "unknown", description: "", features: [] }, { rooms: [] });
  assert.equal(empty.rates.length, 0);
  assert.doesNotMatch(JSON.stringify(empty), internalCopy);
  for (const file of ["hourly-ui-translations.json", "visitor-ui-translations.json"]) {
    const dictionary = JSON.parse(await readFile(resolve(root, "app/data", file), "utf8"));
    for (const [key, translations] of Object.entries(dictionary)) {
      assert.doesNotMatch(key, internalCopy);
      for (const language of ["en", "ru", "fr"]) {
        assert.ok(translations[language], `${key}: ${language}`);
        assert.doesNotMatch(translations[language], /\bAPI\b|données source|исходных данных/iu);
      }
    }
  }
  const client = await readFile(resolve(root, "app/i18n/locale-provider.tsx"), "utf8");
  const server = await readFile(resolve(root, "worker/index.ts"), "utf8");
  assert.match(client, /const exact = visitorExact \|\|/);
  assert.match(server, /Object\.entries\(visitorUiTranslations\)/);
});
