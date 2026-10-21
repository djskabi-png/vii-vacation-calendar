import type { SiteLanguage } from "./locale-routing";

const indexes = new WeakMap<Record<string, string>, Map<string, string>>();
const normalize = (value: string) => value.trim().replace(/\s+/g, " ").replace(/\s+[-–—]\s+|,\s*/g, ", ");
const holidayMonths: Record<string, Record<Exclude<SiteLanguage, "he">, string>> = {
  "ינואר": { en: "January", fr: "janvier", ru: "января" }, "פברואר": { en: "February", fr: "février", ru: "февраля" },
  "מרץ": { en: "March", fr: "mars", ru: "марта" }, "אפריל": { en: "April", fr: "avril", ru: "апреля" },
  "מאי": { en: "May", fr: "mai", ru: "мая" }, "יוני": { en: "June", fr: "juin", ru: "июня" },
  "יולי": { en: "July", fr: "juillet", ru: "июля" }, "אוגוסט": { en: "August", fr: "août", ru: "августа" },
  "ספטמבר": { en: "September", fr: "septembre", ru: "сентября" }, "אוקטובר": { en: "October", fr: "octobre", ru: "октября" },
  "נובמבר": { en: "November", fr: "novembre", ru: "ноября" }, "דצמבר": { en: "December", fr: "décembre", ru: "декабря" },
};

function localizeHolidayDate(value: string, language: Exclude<SiteLanguage, "he">) {
  const match = value.trim().match(/^(\d{1,2}) ב([^ ]+) (\d{4})$/);
  const month = match ? holidayMonths[match[2]]?.[language] : undefined;
  if (!match || !month) return undefined;
  return language === "en" ? `${match[1]} ${month} ${match[3]}` : language === "fr" ? `${match[1]} ${month} ${match[3]}` : `${match[1]} ${month} ${match[3]} года`;
}

// Resolve only reviewed dictionary entries. Punctuation variants are aliases,
// not permission to translate an unknown name or change its identity.
export function lookupPublicCopy(value: string, language: SiteLanguage, dictionary: Record<string, string>): string | undefined {
  if (language === "he" || !/[\u0590-\u05ff]/.test(value)) return value;
  const core = value.trim().replace(/\s+/g, " ");
  if (dictionary[core]) return dictionary[core];
  let index = indexes.get(dictionary);
  if (!index) { index = new Map(Object.entries(dictionary).map(([source, text]) => [normalize(source), text])); indexes.set(dictionary, index); }
  const alias = index.get(normalize(core));
  if (alias) return alias;
  const brandSuffix = " | וי פור ויקיישן";
  if (core.endsWith(brandSuffix)) {
    const headline = lookupPublicCopy(core.slice(0, -brandSuffix.length), language, dictionary);
    const brand = dictionary["וי פור ויקיישן"];
    if (headline && brand && !/[\u0590-\u05ff]/.test(headline + brand)) return `${headline} | ${brand}`;
  }
  const parts = core.split(" | ");
  if (parts.length > 1) {
    const translated = parts.map((part) => lookupPublicCopy(part, language, dictionary));
    if (translated.every((part) => part && !/[\u0590-\u05ff]/.test(part))) return translated.join(" | ");
  }
  const when = core.match(/^מתי (.+) (\d{4})\?$/);
  const find = core.match(/^איך מוצאים מקום פנוי ל(.+)\?$/);
  const questions = core.match(/^שאלות על נופש ב(.+)$/);
  const sourceName = when?.[1] || find?.[1] || questions?.[1];
  const name = sourceName ? dictionary[sourceName] : undefined;
  if (name && !/[\u0590-\u05ff]/.test(name)) {
    if (when) return language === "en" ? `When is ${name} ${when[2]}?` : language === "fr" ? `Quelles sont les dates de ${name} en ${when[2]} ?` : `Когда ${name} в ${when[2]} году?`;
    if (questions) return language === "en" ? `Questions about stays for ${name}` : language === "fr" ? `Questions sur les séjours pour ${name}` : `Вопросы об отдыхе на ${name}`;
    return language === "en" ? `How can I find an available stay for ${name}?` : language === "fr" ? `Comment trouver un hébergement disponible pour ${name} ?` : `Как найти свободное жильё на ${name}?`;
  }
  const holidayTitle = core.match(/^דילים ל(.+) (\d{4})$/);
  const holidayMetaTitle = core.match(/^דילים ל(.+) (\d{4}) \| נופש בישראל$/);
  const holidayEyebrow = core.match(/^מתכננים את (.+) בדרך שמתאימה לכם$/);
  const holidayMetaDescription = core.match(/^חיפוש נופש ל(.+) (\d{4}) לפי תאריך והרכב, עם מעבר ישיר לזמינות ולמחירים לתקופה שבחרתם\.$/);
  const holidayBody = core.match(/^(.+) חל בין (\d{1,2} ב[^ ]+ \d{4}) לבין (\d{1,2} ב[^ ]+ \d{4})\. אפשר להתחיל מחיפוש לזוג, למשפחה או לקבוצה, ולבדוק את הזמינות בפועל לתאריכים שבחרתם\.$/);
  const holidayRange = core.match(/^(\d{1,2} ב[^ ]+ \d{4}) עד (\d{1,2} ב[^ ]+ \d{4})$/);
  const dynamicName = holidayTitle?.[1] || holidayMetaTitle?.[1] || holidayEyebrow?.[1] || holidayMetaDescription?.[1] || holidayBody?.[1];
  const localizedName = dynamicName ? dictionary[dynamicName] : undefined;
  if (localizedName && !/[\u0590-\u05ff]/.test(localizedName)) {
    const year = holidayTitle?.[2] || holidayMetaTitle?.[2] || holidayMetaDescription?.[2];
    if (holidayTitle) return language === "en" ? `${localizedName} ${year} stays` : language === "fr" ? `Séjours pour ${localizedName} ${year}` : `Отдых на ${localizedName} ${year}`;
    if (holidayMetaTitle) return language === "en" ? `${localizedName} ${year} stays | Holidays in Israel` : language === "fr" ? `Séjours pour ${localizedName} ${year} | Vacances en Israël` : `Отдых на ${localizedName} ${year} | Отдых в Израиле`;
    if (holidayEyebrow) return language === "en" ? `Plan ${localizedName} your way` : language === "fr" ? `Organisez ${localizedName} à votre façon` : `Спланируйте ${localizedName} по-своему`;
    if (holidayMetaDescription) return language === "en" ? `Find ${localizedName} ${year} stays by dates and group size, with direct access to availability and prices.` : language === "fr" ? `Trouvez un séjour pour ${localizedName} ${year} selon vos dates et votre groupe, avec accès direct aux disponibilités et aux prix.` : `Найдите отдых на ${localizedName} ${year} по датам и составу гостей с прямым доступом к наличию и ценам.`;
    if (holidayBody) {
      const from = localizeHolidayDate(holidayBody[2], language); const till = localizeHolidayDate(holidayBody[3], language);
      if (from && till) return language === "en" ? `${localizedName} runs from ${from} to ${till}. Start with a couple, family or group search and check live availability for your dates.` : language === "fr" ? `${localizedName} se déroule du ${from} au ${till}. Commencez par une recherche en couple, en famille ou en groupe et vérifiez les disponibilités pour vos dates.` : `${localizedName} проходит с ${from} по ${till}. Начните поиск для пары, семьи или компании и проверьте наличие на выбранные даты.`;
    }
  }
  if (holidayRange) {
    const from = localizeHolidayDate(holidayRange[1], language); const till = localizeHolidayDate(holidayRange[2], language);
    if (from && till) return language === "en" ? `${from} to ${till}` : language === "fr" ? `Du ${from} au ${till}` : `С ${from} по ${till}`;
  }
  return undefined;
}
