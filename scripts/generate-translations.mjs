import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const origin = process.argv[2] || "https://vii.spaplus.co/";
const output = resolve(process.argv[3] || "app/i18n/translations.generated.json");
const queue = [new URL("/", origin)];
const visited = new Set();
const phrases = new Set([
  "שפה", "עברית", "אנגלית", "רוסית", "נגישות מלאה ומאומתת", "סינונים פעילים", "ניקוי הכל",
  "תצוגה על מפה", "תצוגת רשימה", "המפה נטענת", "שמירה במועדפים", "הסרה מהמועדפים",
]);

function decodeHtml(value) {
  return value
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([\da-f]+);/gi, (_, number) => String.fromCodePoint(Number.parseInt(number, 16)))
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function addPhrase(value) {
  const normalized = decodeHtml(value).replace(/\s+/g, " ").trim();
  if (/[\u0590-\u05ff]/.test(normalized) && normalized.length <= 700) phrases.add(normalized);
}

while (queue.length && visited.size < 180) {
  const url = queue.shift();
  const key = `${url.pathname}${url.search}`;
  if (visited.has(key)) continue;
  visited.add(key);
  const response = await fetch(url, { headers: { "user-agent": "VII localization builder" } });
  if (!response.ok || !(response.headers.get("content-type") || "").includes("text/html")) continue;
  const html = await response.text();
  const clean = html.replace(/<(script|style|noscript|template)[\s\S]*?<\/\1>/gi, "");
  for (const match of clean.matchAll(/>([^<>]+)</g)) addPhrase(match[1]);
  for (const match of clean.matchAll(/(?:aria-label|alt|placeholder|title)="([^"]+)"/g)) addPhrase(match[1]);
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    try {
      const next = new URL(decodeHtml(match[1]), url);
      if (next.origin === new URL(origin).origin && !next.pathname.startsWith("/api/") && !/\.(?:png|jpe?g|gif|svg|webp|ico|xml|txt)$/i.test(next.pathname)) queue.push(next);
    } catch { /* Ignore malformed or non-HTTP links. */ }
  }
}

const manual = {
  en: {
    "וי פור ויקיישן": "VII Vacation",
    "מקומות לאירועים פרטיים בישראל | וי פור ויקיישן": "Private Event Venues in Israel | VII Vacation",
    "עין אפק, גשרים מעל הביצה, מדריך מסלול | וי פור ויקיישן": "Ein Afek Wetland Bridges Trail Guide | VII Vacation",
    "משווים את סוג הטיפול, משך הטיפול, שימוש במתקנים, ארוחה, פרטיות ומיקום. המחיר והזמינות חייבים להיבדק מול מקור ההזמנה העדכני.": "Compare the treatment type and duration, access to facilities, meals, privacy and location. Confirm the current price and availability with the booking source.",
    "עוברים מהשאלה לחיפוש מדויק": "Move from a question to a focused search",
    "ריכזנו תשובות קצרות וברורות לשאלות שחוזרות לפני בחירת מקום. המידע בעמוד אינו מחליף את התנאים המחייבים שיוצגו בתהליך ההזמנה.": "We collected clear answers to common questions that come up before choosing a place. This page does not replace the binding terms shown during booking.",
    "כל החופשה, במקום אחד": "Your whole getaway, in one place",
    "מוצאים את החופשה שמתאימה לכם": "Find the getaway that fits you",
    "נופש": "Stays", "אירועים": "Events", "ספא": "Spa", "ספקים": "Services", "יעדים": "Destinations",
    "מגזין": "Magazine", "חדש": "New", "תפריט": "Menu", "שפה": "Language",
    "נגישות מלאה ומאומתת": "Verified full accessibility",
  },
  ru: {
    "וי פור ויקיישן": "VII Vacation",
    "כל החופשה, במקום אחד": "Весь отдых в одном месте",
    "מוצאים את החופשה שמתאימה לכם": "Найдите отдых, который подходит именно вам",
    "נופש": "Отдых", "אירועים": "Мероприятия", "ספא": "Спа", "ספקים": "Услуги", "יעדים": "Направления",
    "מגזין": "Журнал", "חדש": "Новое", "תפריט": "Меню", "שפה": "Язык",
    "נגישות מלאה ומאומתת": "Подтверждённая полная доступность",
  },
  fr: {
    "וי פור ויקיישן": "VII Vacation",
    "כל החופשה, במקום אחד": "Toutes vos vacances, au même endroit",
    "מוצאים את החופשה שמתאימה לכם": "Trouvez le séjour qui vous correspond",
    "נופש": "Séjours", "אירועים": "Événements", "ספא": "Spa", "ספקים": "Services", "יעדים": "Destinations",
    "מגזין": "Magazine", "חדש": "Nouveau", "תפריט": "Menu", "שפה": "Langue",
    "נגישות מלאה ומאומתת": "Accessibilité complète vérifiée",
  },
};

async function translate(text, target) {
  if (manual[target][text]) return manual[target][text];
  const params = new URLSearchParams({ client: "gtx", sl: "he", tl: target, dt: "t", q: text });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`);
    if (response.ok) {
      const data = await response.json();
      return data[0].map((part) => part[0]).join("").trim();
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 400 * (attempt + 1)));
  }
  throw new Error(`Translation failed for ${target}: ${text.slice(0, 80)}`);
}

async function translateBatch(texts, target) {
  const separator = "[[[VII_SPLIT_9F3A]]]";
  const joined = texts.join(`\n${separator}\n`);
  const params = new URLSearchParams({ client: "gtx", sl: "he", tl: target, dt: "t", q: joined });
  const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`);
  if (!response.ok) return mapLimit(texts, 5, (text) => translate(text, target));
  const data = await response.json();
  const translated = data[0].map((part) => part[0]).join("");
  const parts = translated.split(separator).map((part) => part.trim());
  return parts.length === texts.length ? parts : mapLimit(texts, 5, (text) => translate(text, target));
}

function makeBatches(values, maximumCharacters = 3200) {
  const batches = [];
  let batch = [];
  let length = 0;
  for (const value of values) {
    if (batch.length && length + value.length > maximumCharacters) {
      batches.push(batch);
      batch = [];
      length = 0;
    }
    batch.push(value);
    length += value.length + 28;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

async function mapLimit(values, limit, mapper) {
  const results = new Array(values.length);
  let index = 0;
  async function worker() {
    while (index < values.length) {
      const current = index++;
      results[current] = await mapper(values[current], current);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

Object.keys(manual.en).forEach((phrase) => phrases.add(phrase));
const source = [...phrases].sort((a, b) => a.localeCompare(b, "he"));
const generated = { en: {}, ru: {}, fr: {} };
for (const language of ["en", "ru", "fr"]) {
  const batches = makeBatches(source);
  const translatedBatches = await mapLimit(batches, 3, (batch) => translateBatch(batch, language));
  const values = translatedBatches.flat();
  source.forEach((text, index) => { generated[language][text] = values[index]; });
  Object.assign(generated[language], manual[language]);
}
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(generated, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ pages: visited.size, phrases: source.length, output }));
