import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import ts from "typescript";

const origin = process.argv[2] || "https://vii.spaplus.co/";
const output = resolve(process.argv[3] || "app/i18n/translations.generated.json");
const providerDetailIds = [
  "maor-natan", "nissan-mukhtar", "dj-kfir-w", "liran-elias-dj", "photoshot",
  "baboom", "balloona", "bp-cocktails", "onyx-bar", "zen-events",
];
const queue = [
  new URL("/", origin),
  new URL("/providers", origin),
  ...providerDetailIds.map((id) => new URL(`/discover/place?world=providers&id=${encodeURIComponent(id)}`, origin)),
];
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

async function collectSourcePhrases(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "i18n") await collectSourcePhrases(path);
      continue;
    }
    if (!/\.(?:ts|tsx)$/.test(entry.name)) continue;
    const source = await readFile(path, "utf8");
    const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, entry.name.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node) => {
      if (ts.isStringLiteralLike(node) || ts.isJsxText(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) addPhrase(node.text);
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
}

await collectSourcePhrases(resolve("app"));

while (queue.length && visited.size < 260) {
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
    "כל מה שצריך כדי לעשות טוב לאנשים שלכם": "Everything you need to create great experiences for your people",
    "מאסו לעובדים ולארגונים": "MASU for teams and organizations",
    "נגישות מלאה ומאומתת": "Verified full accessibility",
    "רוצים להמשיך מכאן?": "Want to continue from here?",
    "משהייה קצרה לחופשה או ליום של פינוק": "From a short stay to a getaway or a day of pampering",
    "אם אתם מחפשים יותר מכמה שעות, אפשר לעבור למקומות לינה ללילה שלם או לבחור חבילת ספא שמתאימה לזוג וליחיד.": "If you are looking for more than a few hours, explore overnight stays or choose a spa package for couples or individuals.",
    "למקומות נופש": "Explore vacation stays",
    "לחבילות ספא": "Explore spa packages",
    "משלימים את החוויה": "Complete the experience",
    "הופכים את הטיפול ליום שלם": "Turn your treatment into a full day",
    "אפשר לשלב את הספא עם מקום לינה, מסעדה, מסלול או פעילות קרובה ולבנות יום שמתאים בדיוק לכם.": "Combine your spa visit with an overnight stay, restaurant, trail or nearby activity and create a day that suits you.",
    "לפעילויות בסביבה": "Explore nearby activities",
    "מתכננים את האירוע השלם": "Plan the complete event",
    "מוצאים מקום שמתאים לספק שבחרתם": "Find a venue that suits your chosen provider",
    "עברו למתחמי האירועים, התאימו מקום לכמות המשתתפים והשלימו את כל השירותים בלי לצאת מהאתר.": "Explore event venues, match the space to your guest count and complete every service without leaving the site.",
    "למקומות לאירועים": "Explore event venues",
    "לאירועי חברה": "Explore corporate events",
    "\u05d4\u05d2\u05d3\u05dc\u05ea \u05d4\u05de\u05e4\u05d4": "Zoom in",
    "\u05d4\u05e7\u05d8\u05e0\u05ea \u05d4\u05de\u05e4\u05d4": "Zoom out",
    "\u05d4\u05ea\u05e7\u05e8\u05d1\u05d5\u05ea \u05dc\u05de\u05e7\u05d5\u05de\u05d5\u05ea \u05d4\u05de\u05e7\u05d5\u05d1\u05e6\u05d9\u05dd": "Zoom in to grouped places",
  },
  ru: {
    "וי פור ויקיישן": "VII Vacation",
    "כל החופשה, במקום אחד": "Весь отдых в одном месте",
    "מוצאים את החופשה שמתאימה לכם": "Найдите отдых, который подходит именно вам",
    "נופש": "Отдых", "אירועים": "Мероприятия", "ספא": "Спа", "ספקים": "Услуги", "יעדים": "Направления",
    "מגזין": "Журнал", "חדש": "Новое", "תפריט": "Меню", "שפה": "Язык",
    "כל מה שצריך כדי לעשות טוב לאנשים שלכם": "Всё для ярких впечатлений вашей команды",
    "\u05d4\u05d2\u05d3\u05dc\u05ea \u05d4\u05de\u05e4\u05d4": "\u0423\u0432\u0435\u043b\u0438\u0447\u0438\u0442\u044c \u043a\u0430\u0440\u0442\u0443",
    "\u05d4\u05e7\u05d8\u05e0\u05ea \u05d4\u05de\u05e4\u05d4": "\u0423\u043c\u0435\u043d\u044c\u0448\u0438\u0442\u044c \u043a\u0430\u0440\u0442\u0443",
    "\u05d4\u05ea\u05e7\u05e8\u05d1\u05d5\u05ea \u05dc\u05de\u05e7\u05d5\u05de\u05d5\u05ea \u05d4\u05de\u05e7\u05d5\u05d1\u05e6\u05d9\u05dd": "\u041f\u0440\u0438\u0431\u043b\u0438\u0437\u0438\u0442\u044c \u0441\u0433\u0440\u0443\u043f\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0435 \u043c\u0435\u0441\u0442\u0430",
    "מאסו לעובדים ולארגונים": "MASU для команд и организаций",
    "נגישות מלאה ומאומתת": "Подтверждённая полная доступность",
    "רוצים להמשיך מכאן?": "Хотите продолжить?",
    "משהייה קצרה לחופשה או ליום של פינוק": "От короткого отдыха к отпуску или дню спа",
    "אם אתם מחפשים יותר מכמה שעות, אפשר לעבור למקומות לינה ללילה שלם או לבחור חבילת ספא שמתאימה לזוג וליחיד.": "Если вам нужно больше, чем несколько часов, выберите ночлег или спа-пакет для пары либо одного гостя.",
    "למקומות נופש": "Места для отдыха",
    "לחבילות ספא": "Спа-пакеты",
    "משלימים את החוויה": "Дополните впечатления",
    "הופכים את הטיפול ליום שלם": "Превратите процедуру в полноценный день отдыха",
    "אפשר לשלב את הספא עם מקום לינה, מסעדה, מסלול או פעילות קרובה ולבנות יום שמתאים בדיוק לכם.": "Совместите спа с ночлегом, рестораном, маршрутом или развлечением поблизости и создайте день по своему вкусу.",
    "לפעילויות בסביבה": "Развлечения поблизости",
    "מתכננים את האירוע השלם": "Спланируйте всё мероприятие",
    "מוצאים מקום שמתאים לספק שבחרתם": "Найдите площадку, подходящую выбранному подрядчику",
    "עברו למתחמי האירועים, התאימו מקום לכמות המשתתפים והשלימו את כל השירותים בלי לצאת מהאתר.": "Выберите площадку по числу гостей и добавьте все необходимые услуги, не покидая сайт.",
    "למקומות לאירועים": "Площадки для мероприятий",
    "לאירועי חברה": "Корпоративные мероприятия",
  },
  fr: {
    "וי פור ויקיישן": "VII Vacation",
    "כל החופשה, במקום אחד": "Toutes vos vacances, au même endroit",
    "מוצאים את החופשה שמתאימה לכם": "Trouvez le séjour qui vous correspond",
    "נופש": "Séjours", "אירועים": "Événements", "ספא": "Spa", "ספקים": "Services", "יעדים": "Destinations",
    "מגזין": "Magazine", "חדש": "Nouveau", "תפריט": "Menu", "שפה": "Langue",
    "כל מה שצריך כדי לעשות טוב לאנשים שלכם": "Tout pour créer de belles expériences pour vos équipes",
    "מאסו לעובדים ולארגונים": "MASU pour les équipes et les organisations",
    "נגישות מלאה ומאומתת": "Accessibilité complète vérifiée",
    "\u05d4\u05d2\u05d3\u05dc\u05ea \u05d4\u05de\u05e4\u05d4": "Agrandir la carte",
    "\u05d4\u05e7\u05d8\u05e0\u05ea \u05d4\u05de\u05e4\u05d4": "R\u00e9duire la carte",
    "\u05d4\u05ea\u05e7\u05e8\u05d1\u05d5\u05ea \u05dc\u05de\u05e7\u05d5\u05de\u05d5\u05ea \u05d4\u05de\u05e7\u05d5\u05d1\u05e6\u05d9\u05dd": "Agrandir les lieux regroup\u00e9s",
    "רוצים להמשיך מכאן?": "Vous souhaitez continuer ?",
    "משהייה קצרה לחופשה או ליום של פינוק": "D'un court séjour à une escapade ou une journée bien-être",
    "אם אתם מחפשים יותר מכמה שעות, אפשר לעבור למקומות לינה ללילה שלם או לבחור חבילת ספא שמתאימה לזוג וליחיד.": "Si vous cherchez plus que quelques heures, choisissez un hébergement pour la nuit ou une formule spa pour une personne ou un couple.",
    "למקומות נופש": "Voir les séjours",
    "לחבילות ספא": "Voir les formules spa",
    "משלימים את החוויה": "Complétez l'expérience",
    "הופכים את הטיפול ליום שלם": "Transformez votre soin en une journée complète",
    "אפשר לשלב את הספא עם מקום לינה, מסעדה, מסלול או פעילות קרובה ולבנות יום שמתאים בדיוק לכם.": "Associez le spa à un hébergement, un restaurant, un parcours ou une activité à proximité pour créer la journée qui vous convient.",
    "לפעילויות בסביבה": "Voir les activités à proximité",
    "מתכננים את האירוע השלם": "Planifiez l'événement complet",
    "מוצאים מקום שמתאים לספק שבחרתם": "Trouvez un lieu adapté au prestataire choisi",
    "עברו למתחמי האירועים, התאימו מקום לכמות המשתתפים והשלימו את כל השירותים בלי לצאת מהאתר.": "Choisissez un lieu adapté au nombre de participants et ajoutez tous les services nécessaires sans quitter le site.",
    "למקומות לאירועים": "Voir les lieux événementiels",
    "לאירועי חברה": "Voir les événements d'entreprise",
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
await Promise.all(Object.entries(generated).map(([language, translations]) => {
  const languageOutput = output.replace(/\.generated\.json$/i, `.${language}.generated.json`);
  return writeFile(languageOutput, `${JSON.stringify(translations, null, 2)}\n`, "utf8");
}));
console.log(JSON.stringify({ pages: visited.size, phrases: source.length, output }));
