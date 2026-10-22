# ביקורת פירורי לחם ונתיבים ציבוריים

תאריך: 22 באוקטובר 2026
קומיט שנבדק: `c121f38ad27a047cc60d0e861629a6c80b9cb692`
אופי: קריאה בלבד, ללא שינוי קוד או פרסום.

## פסק דין

פירורי הלחם עצמם משתמשים בנתיבי בסיס תקינים ברוב משפחות העולמות: `/search`, `/events`, `/spas`, `/hourly`, `/providers`, `/trails`, `/attractions`, `/guides`, `/legal/*`. לא נמצאה בפונקציות `BreadcrumbTrail` כתובת path שמכילה טקסט עברי.

נמצא פער מאושר בדרישת "אין נתיב ציבורי עם תווי עברית": יש קישורי חיפוש ציבוריים עם ערכי query לא מקודדים במקורות המצגת, והם מוזרמים ל־`Link` בלי שכבת encoding ייעודית.

## פערים מדויקים

1. `app/lib/event-landing-presentation.ts:20-25` מכיל `href` עם ערכי query בעברית: `eventType=יום+הולדת`, `eventType=אירוע+משפחתי`, `location=מרכז`, `location=תל+אביב`.
2. `app/events/page.tsx:67` מעביר את `item.href` דרך `localizedPath(item.href, language)`. `app/i18n/locale-routing.ts` מפרידה query אך אינה מקודדת אותו מחדש. לכן הערך העברי נשאר ב־href המקורי/ב־SSR bundle.
3. `app/lib/homepage-presentation.ts:24-35` מכיל קישורי query בעברית: `location=אילת`, `location=כנרת`, `location=ירושלים והסביבה`, `location=נתניה`, `location=גליל עליון`, `types=צימרים`, `types=מתחמי אירוח`.
4. `app/lib/homepage-search-href.ts:3-12` מטפל רק בהמרת `feature=בריכה` ל־`pool=1`; הוא אינו מקודד query עברי כללי.
5. `app/lib/sitemap-inventory.ts:20` מקודד את prefix השפה בלבד; הוא אינו הוכחה שכל קישור UI ציבורי עבר encoding.

## ראיה

אותם מחרוזות מופיעות גם ב־`dist/server/index.js` וב־SSR/client bundles שנבנו מהקומיט, למשל `dist/server/index.js:85940`, `85949`, `92792`, `92808`. לכן זה אינו פער תיאורטי בלבד של מקור שלא נכלל בבנייה.

## בדיקות קיימות וחסר

- `tests/event-region-carousel-contract.test.mjs` בודק encoding עבור אזורי הקרוסלה שנבנים עם `encodeURIComponent(label)`.
- `tests/homepage-search-href.test.mjs` בודק את מקרה `feature=בריכה`, אך במפורש משאיר ערכים עבריים אחרים ללא שינוי; אין כלל שמוודא שכל href ציבורי הוא ASCII או שכל query value מקודד.
- `tests/event-landing-management.test.mjs` בודק רק שהקישור מתחיל ב־`/events/`, לא שאין בו תווי עברית.

## חומרה והמלצה

חומרה: P2, עקביות URL/SEO/שיתוף ועמידה בדרישת נתיבים נקיים. לא הוכח שהניווט נשבר, משום שהדפדפן עשוי לקודד Unicode בזמן ניווט, אך ה־href הציבורי המיוצר אינו עומד בדרישה המפורשת.

נדרש תיקון ממוקד: לקודד query values בעת בניית כל קישורי המצגות, או להוסיף normalizer מרכזי ל־`localizedPath`/presentation links שאינו משנה semantics. לאחר מכן להוסיף בדיקת regression שסורקת את כל קישורי ה־UI הציבוריים הרלוונטיים ומכשילה תווי `U+0590-U+05FF` ב־href, תוך החרגת טקסט גלוי, labels ו־`tel/mailto` לפי הצורך.

לא בוצע תיקון במסגרת ביקורת זו.
