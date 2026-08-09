import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const hebrew = /[\u0590-\u05ff]/;

function addPhrase(phrases, value) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (hebrew.test(normalized) && normalized.length <= 700) phrases.add(normalized);
}

async function collectSourcePhrases(directory, phrases) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "i18n") await collectSourcePhrases(path, phrases);
      continue;
    }
    if (!/\.(?:ts|tsx)$/.test(entry.name)) continue;
    const source = await readFile(path, "utf8");
    const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, entry.name.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node) => {
      if (ts.isStringLiteralLike(node) || ts.isJsxText(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) addPhrase(phrases, node.text);
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
}

test("every static Hebrew source phrase has a non-Hebrew translation in every public language", async () => {
  const phrases = new Set();
  await collectSourcePhrases(resolve(root, "app"), phrases);
  for (const language of ["en", "ru", "fr"]) {
    const dictionary = JSON.parse(await readFile(resolve(root, `app/i18n/translations.${language}.generated.json`), "utf8"));
    const missing = [...phrases].filter((phrase) => !dictionary[phrase]);
    const mixed = Object.entries(dictionary).filter(([, translation]) => hebrew.test(translation)).map(([phrase]) => phrase);
    assert.deepEqual(missing, [], `${language} is missing ${missing.length} source phrases`);
    assert.deepEqual(mixed, [], `${language} keeps Hebrew in ${mixed.length} translations`);
  }
});

test("localized routes hydrate from the Hebrew server source before applying their language", async () => {
  const provider = await readFile(resolve(root, "app/i18n/locale-provider.tsx"), "utf8");
  const card = await readFile(resolve(root, "app/components/discovery-card.tsx"), "utf8");
  assert.match(provider, /function initialLanguage\(\): SiteLanguage \{[\s\S]*return "he";/);
  assert.doesNotMatch(provider, /useLayoutEffect/);
  assert.match(provider, /!originalText\.has\(textNode\)/);
  assert.match(provider, /!saved\.has\(attribute\)/);
  assert.doesNotMatch(card, /discovery-card__body" data-no-translate/);
  assert.match(provider, /"יוצאים מהצימר\. נכנסים לישראל היפה\.": "Leave your stay behind\. Step into Israel’s beautiful outdoors\."/);
  assert.match(provider, /"יוצאים מהצימר\. נכנסים לישראל היפה\.": "Оставьте место проживания позади\. Откройте для себя красоту Израиля\."/);
  assert.match(provider, /"יוצאים מהצימר\. נכנסים לישראל היפה\.": "Quittez votre hébergement\. Partez à la découverte des plus beaux paysages d’Israël\."/);
});
