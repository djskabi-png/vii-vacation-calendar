import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [translations, pageShell, skipLink] = await Promise.all([
  readFile(new URL("app/data/visitor-ui-translations.json", root), "utf8").then(JSON.parse),
  readFile(new URL("app/components/page-shell.tsx", root), "utf8"),
  readFile(new URL("app/components/localized-skip-link.tsx", root), "utf8"),
]);

test("critical desktop shell copy is synchronously available in every public language", () => {
  const keys = [
    "דילוג לתוכן",
    "כל מה שכיף לעשות",
    "טיפולים, חבילות וימי פינוק",
    "שהייה קצרה, פרטית וגמישה",
    "אטרקציות פעילות עם מידע מאומת ואפשרויות הזמנה",
    "מסלולים עצמאיים לפי אזור, טבע ורמת קושי",
    "שפים, תקליטנים ותוכן לאירוח",
    "ימי גיבוש, רווחה וחבילות מלאות לארגונים",
    "תפריט",
  ];
  for (const key of keys) {
    for (const locale of ["en", "fr", "ru"]) {
      assert.ok(translations[key]?.[locale], `${key}:${locale}`);
      assert.doesNotMatch(translations[key][locale], /[\u0590-\u05ff]/, `${key}:${locale}`);
    }
  }
});

test("the page shell renders the localized skip link instead of fixed Hebrew", () => {
  assert.match(pageShell, /<LocalizedSkipLink\s*\/>/);
  assert.doesNotMatch(pageShell, /<a className="skip-link"/);
  assert.match(skipLink, /translate\("דילוג לתוכן"\)/);
});
