const updatedAt = "2026-11-14T00:00:00.000Z";

const page = (value: {
  id: string; slug: string; title: string; description: string;
  sourcePath: string; filters: Record<string, string | number | boolean>;
  latestResultCount: number; body: string;
}) => ({
  ...value,
  legacySourcePath: value.sourcePath,
  location: "כל הארץ",
  metaTitle: value.title,
  metaDescription: value.description,
  h1: value.title,
  summary: value.description,
  canonicalPath: `/search/events/${value.slug}`,
  updatedAt,
  faq: [],
});

export const curatedEventSearchPages = [
  page({
    id: "curated-event-birthday-venues", slug: "birthday-venues", title: "מקומות לימי הולדת בישראל",
    description: "מקומות לימי הולדת ברחבי הארץ, עם תמונות, מתקנים, כמות משתתפים ופרטי קשר ישירים לתכנון החגיגה.",
    sourcePath: "/events/search?eventType=%D7%99%D7%9E%D7%99+%D7%94%D7%95%D7%9C%D7%93%D7%AA", filters: { eventType: "ימי הולדת" }, latestResultCount: 11,
    body: "יום הולדת מוצלח מתחיל במקום שמתאים לאופי החגיגה ולמספר המשתתפים. בעמוד זה מרוכזים מקומות שמסומנים כמתאימים לימי הולדת, עם גלריות, מתקנים ופרטי קשר.\n\nלפני שסוגרים מומלץ לוודא שעות פעילות, מדיניות מוזיקה, אפשרויות אוכל, נגישות ותנאי תשלום וביטול ישירות מול המקום.",
  }),
  page({
    id: "curated-event-family-events", slug: "family-events", title: "מקומות לאירועים משפחתיים בישראל",
    description: "מקומות לאירועים משפחתיים ברחבי הארץ, עם תמונות, מתקנים, התאמה לכמות המשתתפים ופנייה ישירה למקום.",
    sourcePath: "/events/search?eventType=%D7%90%D7%99%D7%A8%D7%95%D7%A2%D7%99%D7%9D+%D7%9E%D7%A9%D7%A4%D7%97%D7%AA%D7%99%D7%99%D7%9D", filters: { eventType: "אירועים משפחתיים" }, latestResultCount: 8,
    body: "אירוע משפחתי דורש מקום שנוח לדורות שונים ומותאם לכמות המשתתפים. כאן מרוכזים מקומות שמסומנים כמתאימים לאירועים משפחתיים, עם תמונות, מתקנים ופרטי קשר.\n\nבדקו מראש נגישות, חניה, אפשרויות ישיבה ואוכל, שעות פעילות ומדיניות ביטול כדי לבחור מקום שמתאים לכל המשפחה.",
  }),
  page({
    id: "curated-event-large-events", slug: "large-events-over-100", title: "מקומות לאירועים מעל 100 משתתפים",
    description: "מתחמים לאירועים של 100 משתתפים ומעלה, עם מידע על קיבולת, מתקנים, תמונות ופרטי קשר ישירים.",
    sourcePath: "/events/search?guests=100", filters: { guests: 100 }, latestResultCount: 64,
    body: "באירוע גדול חשוב להתחיל מהקיבולת ולא רק מהמראה. העמוד מרכז מקומות שמסומנים כמתאימים ל-100 משתתפים ומעלה.\n\nלפני בחירה בדקו את סידור הישיבה, החניה, מערכות ההגברה, הנגישות, צוות המקום ותנאי התשלום והביטול.",
  }),
  page({
    id: "curated-event-no-noise-limit", slug: "no-noise-limit", title: "מקומות לאירועים ללא הגבלת רעש",
    description: "מקומות שמסומנים ללא הגבלת רעש, עם תמונות, מתקנים ופרטי קשר. יש לאשר את התנאים העדכניים מול המקום.",
    sourcePath: "/events/search?noise=1", filters: { noise: true }, latestResultCount: 44,
    body: "הסימון ללא הגבלת רעש עוזר למקד את החיפוש, אך תנאי המוזיקה עשויים להשתנות לפי יום, שעה ורישוי.\n\nלפני שסוגרים יש לאשר מול המקום את שעות הפעילות, עוצמת המוזיקה, ציוד ההגברה וכל מגבלה מקומית אחרת.",
  }),
  page({
    id: "curated-event-corporate-events", slug: "corporate-events", title: "מקומות לאירועי חברה בישראל",
    description: "מקומות לאירועי חברה, ימי גיבוש וכנסים ברחבי הארץ, עם תמונות, מתקנים ופנייה ישירה למקום.",
    sourcePath: "/events/search?eventType=%D7%90%D7%99%D7%A8%D7%95%D7%A2%D7%99+%D7%97%D7%91%D7%A8%D7%94", filters: { eventType: "אירועי חברה" }, latestResultCount: 22,
    body: "אירוע חברה דורש התאמה למטרה העסקית, לכמות המשתתפים ולציוד הנדרש. כאן מרוכזים מקומות שמסומנים כמתאימים לאירועי חברה.\n\nבדקו מראש מסכים והגברה, אפשרויות אוכל, חניה, נגישות, שעות הפעילות ותנאי התשלום והביטול.",
  }),
] as const;
