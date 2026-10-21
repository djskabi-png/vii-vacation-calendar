import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lookupPublicCopy } from "../app/i18n/public-copy.ts";
import { localizedPath } from "../app/i18n/locale-routing.ts";
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const reviewed = JSON.parse(source("app/data/public-review-translations.json"));
const dictionaries = Object.fromEntries(["en", "fr", "ru"].map(language => [language, { ...JSON.parse(source(`app/i18n/translations.${language}.generated.json`)), ...Object.fromEntries(Object.entries(reviewed).map(([key, value]) => [key, value[language]])) }]));
const hebrew = /[\u0590-\u05ff]/;

test("reviewed holiday metadata and FAQs resolve before hydration in all locales", () => {
  for (const language of ["en", "fr", "ru"]) for (const value of ["דילים לחנוכה 2026 שמתחילים בהרכב ובתאריך שלכם", "דילים לחנוכה 2026 | נופש לזוגות, משפחות וקבוצות | וי פור ויקיישן", "מתי חנוכה 2026?", "איך מוצאים מקום פנוי לחנוכה?", "שאלות על נופש בחנוכה"]) {
    const translated = lookupPublicCopy(value, language, dictionaries[language]);
    assert.ok(translated, `${language}: ${value}`); assert.doesNotMatch(translated, hebrew);
    assert.equal(lookupPublicCopy(translated, language, dictionaries[language]), translated);
  }
});
test("punctuation aliases preserve real venue identity without guessing another name", () => {
  for (const language of ["en", "fr", "ru"]) {
    assert.equal(lookupPublicCopy("אקווה ריזורט - וילת החוף", language, dictionaries[language]), reviewed["אקווה ריזורט, וילת החוף"][language]);
    assert.equal(lookupPublicCopy("עסק לא מוכר", language, dictionaries[language]), undefined);
    assert.equal(lookupPublicCopy("מתי חג לא מוכר 2026?", language, dictionaries[language]), undefined);
    assert.equal(lookupPublicCopy("מתי חנוכה 2026?", "he", dictionaries[language]), "מתי חנוכה 2026?");
  }
});
test("source boundaries apply the shared reviewed copy without broad body rewriting", () => {
  assert.match(source("app/holidays/[slug]/page.tsx"), /readHolidayWorld\(holiday, await database\(\), language\)/);
  assert.match(source("app/spas/page.tsx"), /title=\{translate\(page\?\.title/);
  assert.match(source("app/business/page.tsx"), /const name = translate\(property\.name\)/);
  assert.match(source("worker/index.ts"), /Object\.entries\(publicReviewTranslations\)/);
  assert.match(source("app/i18n/locale-provider.tsx"), /lookupPublicCopy\(value, language, publicReviewByLanguage\[language\]\)/);
  assert.match(source("app/business/client-page.tsx"), /localizedPropertyName = safeBusinessText\(property\.name, property\.name\)/);
  assert.match(source("app/contact/page.tsx"), /permanentRedirect\(localizedPath\("\/join", language\)\)/);
});
test("runtime holiday tabs use reviewed labels in every supported language", () => {
  for (const language of ["en", "fr", "ru"]) for (const name of ["סילבסטר", "רמאדן", "יום האהבה", "עיד אל פיטר"]) assert.doesNotMatch(lookupPublicCopy(name, language, dictionaries[language]), hebrew);
});
test("generic holiday pages localize dynamic headings, metadata, body and date proof", () => {
  const samples = ["דילים לחג הנביא שועייב 2027", "דילים לחג הנביא שועייב 2027 | נופש בישראל", "מתכננים את חג הנביא שועייב בדרך שמתאימה לכם", "חיפוש נופש לחג הנביא שועייב 2027 לפי תאריך והרכב, עם מעבר ישיר לזמינות ולמחירים לתקופה שבחרתם.", "חג הנביא שועייב חל בין 24 באפריל 2027 לבין 25 באפריל 2027. אפשר להתחיל מחיפוש לזוג, למשפחה או לקבוצה, ולבדוק את הזמינות בפועל לתאריכים שבחרתם.", "24 באפריל 2027 עד 25 באפריל 2027"];
  for (const language of ["en", "fr", "ru"]) for (const sample of samples) {
    const translated = lookupPublicCopy(sample, language, dictionaries[language]);
    assert.ok(translated, `${language}: ${sample}`);
    assert.doesNotMatch(translated, hebrew);
  }
});
test("localized alias destinations preserve language, query and hash without double prefixes", () => {
  for (const locale of ["he", "en", "fr", "ru"]) for (const path of ["/join", "/providers/chefs?location=haifa#results", "/discover/place/spa-193", "/guides/vacations-family-planning"]) {
    const expected = locale === "he" ? path : `/${locale}${path}`;
    assert.equal(localizedPath(path, locale), expected);
    assert.equal(localizedPath(expected, locale), expected);
  }
});
