import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";
import ts from "typescript";
import { hourlyEntryMode } from "../app/lib/hourly-entry.ts";

const root = resolve(import.meta.dirname, "..");
const internalCopy = /\bAPI\b|מקור הנתונים|ספק[י]? (?:הסליקה|סליקה)|לאחר (?:ה)?חיבור (?:המערכת|מערכת|מערכות|פרטי העסק)|יחוברו למערכת|בקטלוג הנוכחי|מהקטלוג הפעיל|מערכת (?:ההזמנות|הספק)|החיבור למערכת|מחיר או תאריך מחובר|מול המערכת לפני|תוצאה שחזרה מהמערכת|אומת מול האתר הרשמי של מאסו|מערכת האירועים|מערכת הלידים|לאחר שיוך ואימות|event system|системе мероприятий|מול ביז|נתוני זמינות מביז|מקומות שביז|משבצת פנויה|שנמסרו מספא פלוס|מנוע ההזמנות|מחיר מחובר|מקור המידע|שיוך מאומת|התמונות אומתו|נבדקו באוגוסט/iu;
const hasVisitorLanguage = /[\u0590-\u05ff]|\sAPI\s/u;
function protectedOfficialSource(path,text) {
  text=text.trim();
  return (path.endsWith(resolve("app/trails/[slug]/page.tsx")) && text === "מקור המידע שנבדק:")
    || (path.endsWith(resolve("app/data/editorial-world-articles.ts")) && text === "פתחו את מקור המידע הרשמי, בדקו שהמסלול פתוח ושקראו את ההנחיות העדכניות. הגדירו מרחק, שעת חזרה ונקודת מפגש. אם אחד המשתתפים מתקשה, מסתובבים בלי לחכות לרגע האחרון. אל תבנו על הודעה ישנה או על ביקור שהיה בעונה אחרת.");
}
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
    } else if (/\.tsx?$/.test(entry.name)) files.push(path);
  }
  return files;
}

test("public visitor templates do not explain internal data or integration mechanisms", async () => {
  const leaks = [];
  for (const path of [...await collect(resolve(root, "app")), ...["spa-editorial-policy.ts", "public-availability-notice.ts", "public-review-error.ts"].map(file=>resolve(root,"app/lib",file))]) {
    for (const text of visitorLiterals(path, await readFile(path, "utf8"))) {
      if (internalCopy.test(text) && !protectedOfficialSource(path,text)) leaks.push(`${relative(root, path)}: ${text.trim()}`);
    }
  }
  assert.deepEqual(leaks, []);
});

test("copy guard rejects technical fixtures but permits useful capability and booking truth", () => {
  assert.equal(protectedOfficialSource(resolve(root,"app/trails/[slug]/page.tsx"),"מקור המידע שנבדק:"),true);
  assert.equal(protectedOfficialSource(resolve(root,"app/trails/[slug]/page.tsx"),"נתוני API במקור המידע"),false);
  for (const text of ["מחירים מה־API של VII", "ב־API אין בדיקת זמינות", "ספק הסליקה טרם חובר", "היחידות במקור הנתונים", "לאחר חיבור המערכת המחיר יגיע"]) assert.ok(internalCopy.test(text), text);
  for (const text of ["בודקים זמינות מול ביז און ליין", "מוצגים רק מקומות שביז דיווח להם על משבצת פנויה", "הנתונים במקור המידע", "אין שיוך מאומת לתמונת חדר", "הזמינות מחוברת למנוע ההזמנות", "המחירים שנמסרו מספא פלוס"]) assert.ok(internalCopy.test(text),text);
  for (const text of ["המחירים המוצגים הם מחירי בסיס", "ההזמנה ממתינה לאישור המקום", "המחשה בלבד. לא מתבצע תשלום", "למחיר, פנו למקום", "תמונה אינה זמינה"]) assert.ok(!internalCopy.test(text), text);
});

test("review failures never expose raw response or network errors",async()=>{
  const file=resolve(root,"app/lib/public-review-error.ts");
  const module={exports:{}};
  new Function("exports",ts.transpileModule(await readFile(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(module.exports);
  for(const language of ["he","en","ru","fr"]){
    for(const value of ["D1_ERROR: invalid schema","API token missing","<script>oops</script>","constructor",{},null])assert.equal(module.exports.publicReviewError(value,language,"safe"),"safe");
    assert.notEqual(module.exports.publicReviewError("אפשר לצרף עד 8 תמונות",language,"safe"),"safe");
  }
  const client=await readFile(resolve(root,"app/components/guest-review-studio.tsx"),"utf8");
  assert.doesNotMatch(client,/setSubmitError\(error instanceof Error/);
  assert.match(client,/publicReviewError\(payload\.error, language, copy\.genericError\)/);
});

test("hourly data and localized visitor guidance preserve useful truth without internal explanations", async () => {
  const path = resolve(root, "app/data/hourly-details.ts");
  const source = await readFile(path, "utf8");
  const transpiled = ts.transpileModule(source.replace(/^import .*;\r?\n/gm, ""), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  const catalog = JSON.parse(await readFile(resolve(root, "app/data/sergey-hourly-catalog.json"), "utf8"));
  new Function("exports", "hourlyCatalog", "hourlyEntryMode", transpiled)(module.exports, catalog, hourlyEntryMode);
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
