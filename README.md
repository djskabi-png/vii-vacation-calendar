# VII frontend

חזית מלאה ורספונסיבית לאתר VII, הכוללת את עולם הנופש, עולם האירועים, חיפוש, עמודי מקום, יעדים, מדריכים, מועדפים, יצירת קשר, עמודים משפטיים ומצבי קצה.

## הרצה מקומית

```bash
pnpm install
pnpm dev
```

## בדיקות

```bash
pnpm lint
pnpm test
```

## מבנה עיקרי

- `app/page.tsx`: דף הבית
- `app/search/page.tsx`: תוצאות חיפוש נופש
- `app/business/page.tsx`: עמוד מקום, כולל מקום יחיד ומתחם רב יחידות
- `app/events/`: עולם האירועים
- `app/destinations/`: יעדים
- `app/guides/`: מדריכים ומאמרים
- `app/favorites/`: מועדפים
- `app/contact/`: יצירת קשר
- `app/legal/`: פרטיות, תנאים וביטולים
- `app/handoff/`: מפת מסכים ונקודות חיבור לצוות הפיתוח
- `app/data/site-data.ts`: נתוני תצוגה מרוכזים

פרטי החיבור למערכת הקיימת נמצאים בקובץ `INTEGRATION.md`.
