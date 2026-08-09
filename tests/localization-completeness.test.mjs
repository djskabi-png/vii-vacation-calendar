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

test("localized routes translate the server response and retain safe hydration", async () => {
  const provider = await readFile(resolve(root, "app/i18n/locale-provider.tsx"), "utf8");
  const card = await readFile(resolve(root, "app/components/discovery-card.tsx"), "utf8");
  const worker = await readFile(resolve(root, "worker/index.ts"), "utf8");
  assert.match(provider, /function initialLanguage\(\): SiteLanguage \{[\s\S]*return "he";/);
  assert.match(worker, /serverTranslations/);
  assert.match(worker, /translateServerText/);
  assert.match(worker, /script\[type="application\/ld\+json"\]/);
  assert.match(worker, /translateSeoHtml\(rewritten, locale\)/);
  assert.doesNotMatch(worker, /body \*:not\(script\):not\(style\):not\(noscript\)/);
  assert.match(provider, /function revealLocalizedDocument\(\)/);
  assert.doesNotMatch(provider, /useLayoutEffect/);
  assert.match(provider, /!originalText\.has\(textNode\)/);
  assert.match(provider, /!saved\.has\(attribute\)/);
  assert.doesNotMatch(card, /discovery-card__body" data-no-translate/);
  assert.match(provider, /"יוצאים מהצימר\. נכנסים לישראל היפה\.": "Leave your stay behind\. Step into Israel’s beautiful outdoors\."/);
  assert.match(provider, /"יוצאים מהצימר\. נכנסים לישראל היפה\.": "Оставьте место проживания позади\. Откройте для себя красоту Израиля\."/);
  assert.match(provider, /"יוצאים מהצימר\. נכנסים לישראל היפה\.": "Quittez votre hébergement\. Partez à la découverte des plus beaux paysages d’Israël\."/);
});

test("CMS-backed names stay localized in controls, favorites and accessible labels", async () => {
  const provider = await readFile(resolve(root, "app/i18n/locale-provider.tsx"), "utf8");
  const favorite = await readFile(resolve(root, "app/components/favorite-button.tsx"), "utf8");
  const discovery = await readFile(resolve(root, "app/components/discovery-card.tsx"), "utf8");
  const favoritesPage = await readFile(resolve(root, "app/favorites/page.tsx"), "utf8");
  assert.match(provider, /translate: \(value: string\) => string/);
  assert.match(provider, /localizedPrefixMatch/);
  assert.match(provider, /if \(translatedRegion === sourceRegion\) return value/);
  assert.match(provider, /if \(translatedDestination === sourceDestination\) return value/);
  assert.match(favorite, /aria-label=\{`\$\{saved \? copy\.removeLabel : copy\.addLabel\}: \$\{translate\(name\)\}`\}/);
  assert.match(favoritesPage, /translate\(item\.name\)/);
  assert.match(discovery, /aria-label=\{`\$\{details\}: \$\{translate\(item\.name\)\}`\}/);
});
