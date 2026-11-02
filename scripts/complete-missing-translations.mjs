import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(".");
const hebrew = /[\u0590-\u05ff]/;
const excludedDirectories = new Set(["i18n", "platform", "admin"]);
const excludedFiles = new Set([
  "legacy-vacation-profiles.ts", "editorial-world-articles.ts", "editorial-world-links.ts",
  "editorial-image-copy.ts", "editorial-cover.tsx", "world-editorial-links.tsx",
  "quality-platform.ts", "homepage-content-inventory.ts", "search-filter-labels.ts",
]);

function addPhrase(phrases, value) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (hebrew.test(normalized) && normalized.length <= 700) phrases.add(normalized);
}

async function collect(directory, phrases) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name)) await collect(path, phrases);
      continue;
    }
    if (!/\.(?:ts|tsx)$/.test(entry.name) || entry.name.startsWith("admin-") || excludedFiles.has(entry.name)) continue;
    const source = await readFile(path, "utf8");
    const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, entry.name.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node) => {
      if (ts.isStringLiteralLike(node) || ts.isJsxText(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) addPhrase(phrases, node.text);
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
}

async function translate(text, language) {
  const params = new URLSearchParams({ client: "gtx", sl: "he", tl: language, dt: "t", q: text });
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`);
    if (response.ok) {
      const data = await response.json();
      const translated = data[0].map((part) => part[0]).join("").trim();
      if (translated && !hebrew.test(translated)) return translated;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000 * (attempt + 1)));
  }
  throw new Error(`Translation failed for ${language}: ${text.slice(0, 80)}`);
}

const phrases = new Set();
await collect(resolve(root, "app"), phrases);
const result = {};
const auxiliaryFiles = [
  "legacy-vacation-ui-translations.json", "booking-hub-translations.json",
  "hourly-ui-translations.json", "provider-join-translations.json",
  "spa-ui-translations.json", "catalog-admin-translations.json",
  "email-polish-translations.json", "world-depth-translations.json",
  "visitor-ui-translations.json", "public-review-translations.json",
];
for (const language of ["en", "ru", "fr"]) {
  const path = resolve(root, `app/i18n/translations.${language}.generated.json`);
  const dictionary = JSON.parse(await readFile(path, "utf8"));
  const covered = { ...dictionary };
  for (const file of auxiliaryFiles) {
    const auxiliary = JSON.parse(await readFile(resolve(root, `app/data/${file}`), "utf8"));
    for (const [phrase, translations] of Object.entries(auxiliary)) covered[phrase] = translations[language];
  }
  const missing = [...phrases].filter((phrase) => !covered[phrase]);
  for (const [index, phrase] of missing.entries()) {
    dictionary[phrase] = await translate(phrase, language);
    if ((index + 1) % 20 === 0) process.stdout.write(`${language}:${index + 1}/${missing.length}\n`);
  }
  await writeFile(path, `${JSON.stringify(dictionary, null, 2)}\n`, "utf8");
  result[language] = missing.length;
}
console.log(JSON.stringify(result));
