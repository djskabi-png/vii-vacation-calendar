"use client";

import Link from "next/link";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import styles from "./platform.module.css";

/* eslint-disable @next/next/no-img-element */

type NodeKind = "world" | "provider" | "core" | "output";

type PlatformNode = {
  id: string;
  kind: NodeKind;
  eyebrow: string;
  title: string;
  icon: string;
  summary: string;
  owner: string;
  input: string;
  output: string;
  resilience: string;
  status: string;
};

type DecisionStatus = "approved" | "target" | "open" | "current" | "estimate";

type TechChoice = {
  id: string;
  name: string;
  category: string;
  role: string;
  why: string;
  example: string;
  decision: DecisionStatus;
  status: string;
};

type InsightCard = {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  decision: DecisionStatus;
  status: string;
  bullets: string[];
  technical?: string;
};

type ArchitectureTarget =
  | { type: "node"; id: string }
  | { type: "tech"; id: string }
  | { type: "insight"; id: string };

type ArchitectureHotspot = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  target: ArchitectureTarget;
  direction?: "ltr" | "rtl";
};

type ArchitectureScenarioId = "sync" | "availability" | "outage";

type ArchitectureScenarioStep = {
  hotspotId: string;
  title: string;
  detail: string;
};

const decisionLabels: Record<DecisionStatus, string> = {
  approved: "מאושר",
  target: "ארכיטקטורת יעד",
  open: "טרם הוחלט",
  current: "אמת נוכחית",
  estimate: "אומדן בלבד",
};

const worlds: PlatformNode[] = [
  { id: "vacations", kind: "world", eyebrow: "WORLD 01", title: "VACATIONS", icon: "V", summary: "נופש, מתחמים, יחידות, חדרים, מחירים, תמונות ותוכן עסקי.", owner: "VII בונה ומפעילה את האתר, השרת, הנתונים, החיפוש והניהול. סרגיי מספק את רשומת המקום המלאה דרך ממשק.", input: "מזהה ספק, שם, אודות, תיאורים, מדיה, מיקום, מתקנים, יחידות, מבנה חדרים, תפוסה, מדיניות, מחירי בסיס ויכולת זמינות.", output: "עמודי עסק וחיפוש מהירים מהמידע המקומי. זמינות ומחיר סופיים נבדקים מול סרגיי. הזמנות וחוות דעת חוזרות אליו.", resilience: "הקטלוג נשמר אצל VII. מטמון זמינות מסייע לגילוי בלבד ולעולם אינו מאשר הזמנה. תקלה אצל סרגיי אינה מפילה עולמות אחרים.", status: "ארכיטקטורת יעד. החיבור ייחשב פעיל רק לאחר חוזה, דוגמת אמת ובדיקת קריאה וכתיבה מקצה לקצה." },
  { id: "events", kind: "world", eyebrow: "WORLD 02", title: "EVENTS", icon: "E", summary: "מקומות, חללים, חבילות, קיבולת, מחירים, זמינות ומדיה.", owner: "VII מחזיקה במוצר המלא. סרגיי מספק את רשומת המקום והאירוע המלאה דרך ממשק.", input: "מקום, חללים, חבילות, תמונות, תיאורים, קיבולת, מאפיינים, תמחור ויכולת זמינות לפי חוזה.", output: "חיפוש, עמודי מקום, לידים והזמנות. הזמנות וחוות דעת חוזרות לסרגיי.", resilience: "קטלוג מקומי ממשיך לעבוד בזמן תקלה. אישור זמינות והזמנה נעצרים בבטחה אם אין תשובה טרייה מהספק.", status: "ארכיטקטורת יעד, בכפוף לחוזה נתונים ולבדיקות קצה לקצה." },
  { id: "hourly", kind: "world", eyebrow: "WORLD 03", title: "ROOMS VIP", icon: "R", summary: "חדרים לפי שעה, יחידות, חלונות זמן, מחירים, זמינות ותמונות.", owner: "VII בונה ומפעילה את המוצר. סרגיי מספק את רשומת המקום והיחידה המלאה דרך ממשק.", input: "עסקים, יחידות, מדיה, תיאורים, מתקנים, מחירים, חלונות זמן ויכולת זמינות.", output: "חיפוש לפי אזור וזמן, עמודי מקום, בחירת יחידה והזמנה. הזמנות וחוות דעת חוזרות לסרגיי.", resilience: "הקטלוג נשמר אצל VII. אישור החלון והמחיר עובר במסלול טרי, נטול מטמון ומוגן מפני הזמנה כפולה.", status: "ארכיטקטורת יעד, בכפוף להסכם נתונים ולבדיקות קצה לקצה. השם המאושר הוא ROOMS VIP." },
  { id: "spa", kind: "world", eyebrow: "WORLD 04", title: "SPA", icon: "S", summary: "בתי ספא, טיפולים, חבילות, משאבים, שעות, מחירים ותורים.", owner: "VII בונה ומפעילה את כל שכבות המוצר. גל וספא פלוס מספקים את רשומת הספא המלאה דרך ממשק נפרד.", input: "מקום, טיפולים, חבילות, מטפל או חדר כשנדרש, מדיה, תיאורים, מתקנים, מחירים ויכולת זמינות.", output: "גילוי, חיפוש, עמודי מקום והזמנה. הזמנות וחוות דעת חוזרות לגל ולספא פלוס.", resilience: "קטלוג מקומי מהיר, בדיקת תורים טרייה רק כשצריך, מפסק עומס ותור כתיבה חוזרת שמונע כפילויות.", status: "ארכיטקטורת יעד. אין כאן הצהרה על חיבור חי שטרם אומת." },
  { id: "attractions", kind: "world", eyebrow: "WORLD 05", title: "ATTRACTIONS", icon: "A", summary: "אטרקציות, כרטיסים, מפגשים, קיבולת, גילאים, מגבלות ומיקום.", owner: "VII בונה את המוצר והמערכת. ספק האטרקציות טרם נבחר ויתחבר באמצעות מתאם עצמאי.", input: "יעד: רשומת אטרקציה מלאה, סוגי כרטיסים, מפגשים, מגבלות, מדיה, מחיר וזמינות.", output: "חיפוש, מפה, עמוד אטרקציה והזמנה. רק הזמנות חוזרות לספק העתידי. כתיבת חוות דעת חזרה לא אושרה.", resilience: "תקלה בעולם הזה נשארת מבודדת ואינה פוגעת בנופש, באירועים, בחדרים או בספא.", status: "הספק וחוזה הממשק טרם נבחרו. זו מוכנות תכנונית בלבד." },
  { id: "trips", kind: "world", eyebrow: "WORLD 06", title: "TRIPS", icon: "T", summary: "מסלולים, נקודות עניין, מפות, קושי, תמחור או לידים ותוכן מקומי.", owner: "בבעלות ובפיתוח מלא של VII, מהנתונים ועד מערכת הניהול והמוצר.", input: "תוכן מאושר, נתוני מיקום, מדיה ומקורות אמת.", output: "מערכת תוכן ופרסום, חיפוש, מסלולים, לידים או תמחור, קידום, מנועי תשובות ואנליטיקה.", resilience: "עולם עצמאי שמנוהל ונשמר כולו אצל VII.", status: "דרישת מוצר מאושרת. היישום המלא טרם אומת." },
  { id: "suppliers", kind: "world", eyebrow: "WORLD 07", title: "SUPPLIERS", icon: "P", summary: "ספקי אירועים ושירותים, פרופילים, תיקי עבודות, דירוגים ולידים.", owner: "בבעלות ובפיתוח מלא של VII, כולל הנתונים, הטקסונומיה, התוכן והתפעול.", input: "מידע מספקים, מדיה מאושרת, תוכן מערכת, תהליכי קליטה ופעילות משתמשים.", output: "פרופילים, חיפוש, טקסונומיה, לידים, תהליכי עבודה, בקרה, קידום, מנועי תשובות ואנליטיקה.", resilience: "המידע נשמר ומנוהל ישירות בפלטפורמה, עם הרשאות, גרסאות, בקרה ויכולת חזרה.", status: "דרישת מוצר מאושרת. היישום המלא טרם אומת." },
  { id: "magazine", kind: "world", eyebrow: "WORLD 08", title: "MAGAZINE", icon: "M", summary: "כתבות, מדריכים, השראה, עמודים סטטיים ותוכן חיפוש רב לשוני.", owner: "בבעלות ובפיתוח מלא של VII, כולל מחברים, עריכה, מדיה, תרגום וקידום.", input: "תוכן מאושר, מומחיות עסקית, מדיה ונתונים מהעולמות השונים.", output: "תהליך עריכה מלא, כתבות, מדריכים, תרגומים, קישורים פנימיים, קידום, מנועי תשובות ואנליטיקה.", resilience: "טיוטה, ביקורת, אישור, תזמון, פרסום, ארכיון, גרסאות וחזרה נשמרים אצל VII.", status: "דרישת מוצר מאושרת. היישום המלא טרם אומת." },
];

const providers: PlatformNode[] = [
  { id: "sergey", kind: "provider", eyebrow: "TWO-WAY API", title: "SERGEY API", icon: "01", summary: "חיבור דו־כיווני מלא לנופש, אירועים ו־ROOMS VIP.", owner: "סרגיי אחראי למקור ולממשק. VII אחראית לקליטה, למודל המקומי, לתצוגה, לחיפוש ולכתיבה החוזרת.", input: "לכל מקום: מזהה, שם, אודות, תיאורים, כתובת, מיקום, אנשי קשר מותרים, תמונות וסדר, מתקנים, מדיניות, יחידות, מבנה חדרים, תפוסה, מחירים ויכולת זמינות. השדות הסופיים נקבעים בחוזה.", output: "VII מחזירה לסרגיי הזמנות וחוות דעת עבור VACATIONS, EVENTS ו־ROOMS VIP בלבד.", resilience: "ייבוא מלא, עדכוני דלתא או Webhook, השלמה מחזורית, אימות סכימה, הסגר לרשומה לא תקינה, מניעת כפילות, תור כשל, הפעלה חוזרת ידנית, אינדוקס ופינוי מטמון.", status: "ממשק היעד טרם אומת מקצה לקצה. הוא לא מוצג כחיבור חי." },
  { id: "spaplus", kind: "provider", eyebrow: "TWO-WAY API", title: "SPA PLUS API", icon: "02", summary: "חיבור דו־כיווני מלא לעולם הספא, בנפרד מסרגיי.", owner: "גל וספא פלוס אחראים למקור ולממשק. VII אחראית לקליטה, למודל המקומי, לתצוגה ולכתיבה החוזרת.", input: "לכל ספא: מזהה, שם, אודות, תיאורים, כתובת, מיקום, תמונות, מתקנים, טיפולים, משכים, מטפל או משאב, חבילות, מחירים, שעות ויכולת תורים.", output: "VII מחזירה לגל ולספא פלוס הזמנות וחוות דעת מעולם SPA.", resilience: "ייבוא מלא, דלתא או Webhook, השלמה מחזורית, אימות, הסגר, מניעת כפילות, תור כשל, הפעלה חוזרת, אינדוקס ופינוי מטמון.", status: "ממשק היעד טרם אומת מקצה לקצה. הוא לא מוצג כחיבור חי." },
  { id: "attractions-api", kind: "provider", eyebrow: "PROVIDER OPEN", title: "ATTRACTIONS API", icon: "03", summary: "מתאם נפרד לעולם האטרקציות, לספק שטרם נבחר.", owner: "הספק העתידי יהיה אחראי למקור. VII תבנה את המתאם, האחסון, החיפוש והמוצר.", input: "יעד: מזהה, שם, תיאור, מיקום, תמונות, סוגי כרטיסים, מפגשים, קיבולת, גילאים, מגבלות, שעות, מחירים וזמינות.", output: "VII תחזיר הזמנות לספק שייבחר. כתיבת חוות דעת חזרה אינה חלק מההחלטה המאושרת.", resilience: "כשל נשאר בגבולות העולם הזה. כל הזמנה נשלחת פעם אחת עם מזהה קבוע, מצב, תור כשל ובדיקה לפני ניסיון נוסף.", status: "טרם נבחר ספק וטרם נחתם חוזה. זו מוכנות תכנונית בלבד." },
  { id: "future", kind: "provider", eyebrow: "PLUG-IN READY", title: "FUTURE APIs", icon: "+", summary: "שכבת חיבור לספקים ולעולמות עתידיים בארץ ובחו״ל.", owner: "אדיר מחזיק בתקן האחיד ובשער הכניסה. כל ספק מחזיק רק במקור שלו.", input: "כל ממשק חיצוני שעובר אימות, מיפוי והרשאה.", output: "אותו מבנה פנימי עקבי, בלי תלות בצורת המידע של הספק.", resilience: "ספק חדש נכנס דרך מתאם מבודד, בלי לסכן את ליבת המערכת.", status: "יכולת מתוכננת להתרחבות. אין עדיין חיבור עתידי פעיל שאומת." },
];

const core: PlatformNode[] = [
  { id: "edge", kind: "core", eyebrow: "SPEED", title: "EDGE + CDN", icon: "01", summary: "העמודים, התמונות והקוד מגיעים מהנקודה הקרובה ביותר לגולש.", owner: "אדיר ו-VII.", input: "תוצרים מוכנים מהמערכת וממדיית VII.", output: "טעינה מיידית יותר, הגנה מעומסים והפחתת עבודה מהשרת.", resilience: "מטמון בשכבות, פינוי מדויק ושמירת גרסה תקינה בזמן שחרור.", status: "שכבת ליבה מתוכננת. היישום המלא טרם נבנה ואומת." },
  { id: "gateway", kind: "core", eyebrow: "CONTROL", title: "API GATEWAY", icon: "02", summary: "שער אחד מבוקר לכל אתר, אפליקציה וספק חיצוני.", owner: "אדיר ו-VII.", input: "בקשות מהאתר, מהאפליקציות ומהמתאמים.", output: "אימות, הרשאה, הגבלת קצב וניתוב לשירות הנכון.", resilience: "מונע מספק איטי או משתמש תוקף להציף את המערכת.", status: "שכבת ליבה מתוכננת. היישום המלא טרם נבנה ואומת." },
  { id: "adapters", kind: "core", eyebrow: "INTEGRATION", title: "PROVIDER ADAPTERS", icon: "03", summary: "מתאם נפרד לכל ספק, שמתרגם אותו לשפה אחת של VII.", owner: "אדיר ו-VII.", input: "מבנים שונים מסרגיי, ספא פלוס וספקים נוספים.", output: "רשומות אחידות ומאומתות למנוע המרכזי.", resilience: "שינוי אצל ספק אחד דורש תיקון במתאם שלו בלבד.", status: "עיקרון ליבה מאושר. המתאמים המלאים טרם נבנו ואומתו." },
  { id: "database", kind: "core", eyebrow: "APPROVED DATABASE", title: "AURORA POSTGRESQL", icon: "04", summary: "ליבת העסקאות המאושרת של VII בישראל, עם נתוני ספק מנורמלים וזהות קנונית.", owner: "VII. הבחירה המאושרת היא Amazon Aurora PostgreSQL Serverless v2 באזור תל אביב.", input: "משתמשים, הרשאות, ישויות קנוניות, תוכן, הזמנות, לידים, רשומות ביקורת, מצב ספק ויומן שינויים.", output: "אמת טרנזקציונית עקבית לאתר, לניהול, לממשק VII ולאפליקציות עתידיות. חיפוש, מטמון ואנליטיקה הם מערכות נגזרות ולא מקור הזמנה.", resilience: "יעד הייצור הוא כותב וקורא באזורי זמינות נפרדים, קידום קורא בדרגה אפס, שניים עד שישה עשר ACU לכל מופע בתחילת הדרך, בלי השהיה אוטומטית ועם שחזור לנקודת זמן במשך 35 יום.", status: "בחירת המסד והאזור מאושרת. האשכול טרם הוקם ותצורת הייצור היא יעד שדורש בדיקות עומס, מעבר ושחזור." },
  { id: "cache", kind: "core", eyebrow: "MILLISECONDS", title: "SMART CACHE", icon: "05", summary: "מטמון בשכבות שמונע קריאות חוזרות ומספק קטלוג מהיר מאוד.", owner: "VII. הטכנולוגיה המדויקת מעבר למטמון בקצה ובהייפרדרייב תיבחר אחרי מדידה.", input: "עמודים, קטלוג, חיפושים ובקשות זמינות זהות וקצרות חיים.", output: "תגובה מהירה, מניעת הצפה ורענון מדויק לאחר שינוי.", resilience: "קטלוג יכול להשתמש בנתון ישן שהוגדר מראש בזמן תקלה. זמינות ומחיר סופיים והזמנה לעולם אינם מאושרים ממטמון.", status: "יכולת מאושרת בארכיטקטורה. הצורך ב־Redis עדיין פתוח ואינו מוצג כתלות שנבחרה." },
  { id: "search", kind: "core", eyebrow: "DISCOVERY", title: "SEARCH ENGINE", icon: "06", summary: "אינדקס מהיר לחיפוש, סינון, מפה, שפה, תעתיק ודירוג בכל העולמות.", owner: "VII מחזיקה בחוזה החיפוש, בקורפוס הבדיקות ובכללי הדירוג. הספק הטכנולוגי טרם נבחר.", input: "עותק חיפוש מאומת מהנתונים הקנוניים, תוכן מקומי ואותות איכות.", output: "תוצאות, הצעות, מסננים, מפות, אבחון שאילתות ואפס תוצאות.", resilience: "האינדקס נבנה מחדש מהמקור הקנוני, ומערכת הניהול שולטת במילים נרדפות, קידום, החרגה ורענון.", status: "מנוע החיפוש נדרש ומאושר כמוצר. הספק עדיין פתוח." },
  { id: "cms", kind: "core", eyebrow: "OPERATIONS", title: "CMS + ADMIN", icon: "07", summary: "ממשק העל של אדיר לכל עולם, ספק, רשומה, תוכן, חיפוש, תרגום, קידום ודוח.", owner: "אדיר נכנס עם חשבון גוגל כמנהל־על. עובדים מקבלים שילוב מדויק של תפקיד, עולם ופעולה.", input: "נתוני ספק ומקור שדה, עריכות VII, מדיה וזכויות, משתמשים, חיפושים, הזמנות, לידים, חוות דעת, סנכרונים, מטמון וכללי תצוגה.", output: "טיוטה, ביקורת, אישור, תזמון, פרסום, תצוגה מקדימה, גרסאות, השוואה, יומן ביקורת וחזרה לאחור.", resilience: "שמירה שורדת רענון, הרשאות נבדקות בשרת, סודות אינם נחשפים לעורך, וכל פעולה מטפלת בטעינה, כשל ולוג ביקורת.", status: "דרישת מוצר מאושרת. מערכת הניהול המלאה טרם נבנתה ואומתה." },
  { id: "media", kind: "core", eyebrow: "ASSETS", title: "MEDIA PIPELINE", icon: "08", summary: "קליטה, ניקוי, שינוי גודל והפצה חכמה של תמונות ווידאו.", owner: "אדיר ו-VII.", input: "מדיה מאושרת מספקים ומהצוות.", output: "פורמטים מהירים ומותאמים למסך, עם מקור ובעלות מתועדים.", resilience: "עיבוד בתור, בדיקות קובץ, גרסאות ומטמון עולמי.", status: "שכבת ליבה מתוכננת. היישום המלא טרם נבנה ואומת." },
  { id: "queues", kind: "core", eyebrow: "ASYNC", title: "QUEUES + WORKERS", icon: "09", summary: "עבודות כבדות רצות ברקע בלי לעכב מעבר עמוד או חיפוש.", owner: "אדיר ו-VII.", input: "סנכרונים, עיבוד מדיה, בניית אינדקס והתראות.", output: "עבודה עקבית, ניתנת לניסיון חוזר ולמעקב.", resilience: "תור כשל, מניעת כפילות ומפתח ייחודי לכל פעולה.", status: "שכבת ליבה מתוכננת. היישום המלא טרם נבנה ואומת." },
  { id: "security", kind: "core", eyebrow: "DETECT + RESPOND", title: "SECURITY + OBSERVABILITY", icon: "10", summary: "הגנה, לוגים מובנים, מדדים, עקבות, בדיקות סינתטיות, התראות והיסטוריית תקריות.", owner: "VII מחזיקה במדיניות, בספים, בנתיבי ההתראה ובתהליך האירוע. ספק הניטור טרם נבחר.", input: "שגיאות קוד, זמני ספק, טריות, תורים, מסד, מטמון, אבטחה, פעולות ניהול ומסע משתמש.", output: "קיבוץ שגיאות, סימון גרסה, זיהוי אוטומטי, התראה לאדם הנכון, חקירה, התאוששות ותחקיר.", resilience: "בדיקות התראות אמיתיות, ניטור ספקים ובדיקות מסלול הזמנה. לוח מחוונים בלי התראה שנבדקה אינו מוכנות תפעולית.", status: "יכולת נדרשת ומאושרת. ספק הניטור והניתוב עדיין פתוחים והמערכת טרם אומתה." },
  { id: "seo", kind: "core", eyebrow: "GROWTH + MIGRATION", title: "SEO + GEO + REDIRECTS", icon: "11", summary: "מנוע תוכן, ישויות, כתובות, נתונים מובנים והגירה מדויקת של כעשרים עד שלושים אלף עמודים ישנים.", owner: "VII מחזיקה בעמודי חיפוש, אזור, עיר, נחיתה ותוכן, ובמפת ההפניות המלאה.", input: "ייצוא וזחילה של כל כתובת ישנה, חיפושים שאושרו, טקסונומיה, תוכן ויעדים שווי ערך.", output: "עמודים מאושרים, כתובות קבועות, מפת אתר, סכמות, קישורים, הפניית 301 ישירה או תשובת 410 כשאין יעד ראוי.", resilience: "אין הפניה גורפת לדף הבית, אין שרשרת, כל המפה נבדקת לפני השקה ועמודי שגיאה מנוטרים לפחות תשעים יום.", status: "דרישה מאושרת. ייצוא הכתובות המלא ומיפוי התנועה עדיין חסרים." },
  { id: "analytics", kind: "core", eyebrow: "EVERY ACTION", title: "EVENT STREAM", icon: "12", summary: "חוזה אירועים שמסביר מה קרה מחשיפה ועד הזמנה, לפי עולם, ספק, עמוד, קמפיין, שפה ומכשיר.", owner: "VII מחזיקה במילון האירועים ובאיכות המידע. ספק האנליטיקה עדיין פתוח.", input: "חשיפה, צפייה, חיפוש, מסנן, מפה, זמינות, הזמנה, ליד, טלפון, צ׳אט, חוות דעת, שפה, הפניה, כשל ספק ושינוי ניהול.", output: "משפכים, ייחוס, דוחות, התראות והחלטות מוצר.", resilience: "אירועים עוברים בצינור ייעודי, עם הסכמה, צמצום מידע ומניעת כפילויות. טלמטריה בנפח גבוה אינה נזרקת ללא הבחנה למסד העסקאות.", status: "חוזה המדידה מאושר. ספק האנליטיקה ומחסן האירועים עדיין פתוחים." },
  { id: "access", kind: "core", eyebrow: "IDENTITY + CONTROL", title: "GOOGLE SSO + RBAC", icon: "13", summary: "אדיר נכנס עם גוגל כמנהל־על ומקצה לעובדים הרשאות לפי עולם.", owner: "אדיר שולט בכל. כל עובד רואה ועושה רק את מה שהוגדר לו.", input: "זהות גוגל, תפקיד, עולם, רמת הרשאה ומדיניות אישור.", output: "כניסה מאובטחת, מסכים מותאמים והרשאה לכל פעולה.", resilience: "אימות רב־שלבי לפי סיכון, סיום מפגשים, יומן ביקורת ושלילה מיידית.", status: "שכבת ליבה מתוכננת. היישום המלא טרם נבנה ואומת." },
  { id: "engagement", kind: "core", eyebrow: "CONVERSATIONS", title: "CHATWOOT + LEADS", icon: "14", summary: "VII מחזיקה בחוויית הצ׳אט באתר ומעבירה את השיחה לצ׳אטווט עם ההקשר העסקי.", owner: "VII מחזיקה בחוויה, בהסכמה, בניתוב ובהרשאות. צ׳אטווט משמש לתפעול השיחות לאחר חיבור מאומת.", input: "שיחה, טופס, לחיצת טלפון, מקור הגעה, עמוד, עולם, מקום והסכמה.", output: "שיחה לצוות הנכון, ליד עשיר בהקשר ומעקב טיפול.", resilience: "צמצום מידע, מניעת כפילות, תור מסירה, Webhook ומעקב מצב.", status: "חיבור יעד בלבד. חשבון, תיבה, הרשאות, העברה ו־Webhook טרם אומתו מקצה לקצה." },
  { id: "search-factory", kind: "core", eyebrow: "DEMAND TO CONTENT", title: "SEARCH INTELLIGENCE", icon: "15", summary: "אלפי חיפושים אמיתיים הופכים למאגר ביקוש שאפשר לאשר ולהפוך לעמוד.", owner: "אדיר והצוות המורשה מחליטים מה מאשרים, מאחדים, מעשירים ומפרסמים.", input: "שאילתות, מסננים, אזורים, תוצאות, אפס תוצאות, נפח ומגמה.", output: "הצעת עמוד עם כתובת, כוונת חיפוש, תוכן, קישורים, סכמות וכלי SEO ו-GEO.", resilience: "מניעת כפילויות, סינון פרטיות וספאם, ציון איכות ואישור אנושי לפני פרסום.", status: "שכבת ליבה מתוכננת. היישום המלא טרם נבנה ואומת." },
  { id: "reports", kind: "core", eyebrow: "DECISIONS", title: "REPORTING + BI", icon: "16", summary: "דוחות חיים לכל עולם, ספק, עמוד, קמפיין ומסלול המרה.", owner: "אדיר רואה את כל המערכת. עובדים רואים דוחות לפי הרשאה ועולם.", input: "ציר האירועים, הזמנות, לידים, שיחות, חוות דעת, הכנסות וביצועים.", output: "לוחות מחוונים, משפכים, השוואות, התראות, יצוא ותחזיות.", resilience: "הפרדת מידע אישי, הגדרות מדד אחידות, בקרת טריות והיסטוריה שאינה משתנה בדיעבד.", status: "שכבת ליבה מתוכננת. היישום המלא טרם נבנה ואומת." },
  { id: "provider-router", kind: "core", eyebrow: "SAFE WRITEBACK", title: "BOOKINGS + REVIEWS ROUTER", icon: "17", summary: "מנוע שמחזיר פעולה לספק הנכון לפי העולם והחוזה המאומת שלו.", owner: "VII שולטת בניתוב, באימות, ביומן ובמצב כל פעולה.", input: "הזמנה או חוות דעת מאושרת, מזהי VII והספק, הסכמה והגרסה הצפויה.", output: "הזמנות וחוות דעת לסרגיי ולספא פלוס. לספק האטרקציות העתידי חוזרות הזמנות בלבד.", resilience: "מזהה מניעת כפילות קבוע, חתימה, תור ניסיון מבוקר, תור כשל, בדיקה לפני ניסיון נוסף והתאמת מצב דו־כיוונית.", status: "דרישה מאושרת. סמנטיקת ההזמנה והביקורת תלויה בחוזה ספק שטרם אומת." },
  { id: "translations", kind: "core", eyebrow: "MULTILINGUAL", title: "TRANSLATION PIPELINE", icon: "18", summary: "עברית מאומתת הופכת לטיוטות רב לשוניות עם מילון, בדיקות ואישור אנושי.", owner: "VII מחזיקה במקור, במילון, בתרגומים ובסטטוס הפרסום לכל שפה.", input: "גרסת מקור בעברית ושדות שהשתנו אצל הספק או בעורך של VII.", output: "טיוטת מכונה, בדיקות מספרים וסימונים, ביקורת אנושית, גרסה וסטטוס נפרד לכל שפה.", resilience: "שינוי במקור מסמן רק את השדות המושפעים כמיושנים, בלי למחוק תרגום מאושר או לפרסם תרגום מכני אוטומטית.", status: "התהליך מאושר. שפות ההשקה, ספק התרגום ועומק הביקורת האנושית עדיין פתוחים." },
  { id: "recovery", kind: "core", eyebrow: "RECOVERY", title: "BACKUP + FAILOVER", icon: "19", summary: "שחזור לנקודת זמן, גיבויים מוצפנים, עותק נפרד, מעבר בין מופעים ותרגילי התאוששות.", owner: "VII מחזיקה במדיניות, בהרשאות, בתרגילים ובתוצאות המדודות.", input: "גיבוי רציף, תמונות מצב, עותק בין חשבונות ועותק או אתר משני בין אזורים.", output: "שחזור מסד, חזרה מגרסת קוד או סכימה, מעבר מופע, הפעלת תור מחדש וראיית תרגיל.", resilience: "שחזור חודשי או בתדירות מוסכמת, בדיקת כשל מסד, ספק, מטמון ותור. אין הבטחת זמן התאוששות או אובדן מידע בלי תרגיל שעבר.", status: "ארכיטקטורת יעד. מטרות ההתאוששות, האזור המשני והפעלת מסד גלובלי עדיין פתוחים." },
  { id: "shared-surfaces", kind: "core", eyebrow: "VII OWNED", title: "SHARED CONTENT SURFACES", icon: "20", summary: "עמודי חיפוש, אזור, עיר, נחיתה, סטטיים, ניווט וטקסונומיה נשארים בבעלות מלאה של VII.", owner: "VII מחזיקה בתוכן, בכתובות, בפרסום, בקישורים, בחיפוש, בקידום ובמדידה.", input: "חיפושים מאושרים, טקסונומיה, תוכן מערכתי, נתוני העולמות ומפת ההגירה.", output: "עמודים קבועים ומנוהלים לכל עולם ושפה, עם תצוגה מקדימה, גרסה וחזרה.", resilience: "אישור אנושי לפני פרסום, מניעת כפילות ודלות, הפניות מדויקות ויכולת איחוד או פרישה בטוחה.", status: "בעלות ודרישה מאושרות. היישום המלא טרם אומת." },
];

const outputs: PlatformNode[] = [
  { id: "web", kind: "output", eyebrow: "NOW", title: "FAST WEB", icon: "W", summary: "אתר מהיר, נגיש, מותאם מגע ומוכן לקפיצות עומס.", owner: "VII.", input: "ממשק VII בעל גרסאות, נתונים מקומיים, חיפוש ומטמון בקצה.", output: "חוויית גלישה רציפה במחשב ובנייד, בלי דף לבן בין מסכים.", resilience: "מעטפת שנשארת על המסך, טעינה מקדימה מדודה, שלדים תואמי פריסה, תמונות תגובתיות והתנהגות טובה ברשת חלשה.", status: "האתר והמסביר הציבורי קיימים. יעדי המהירות דורשים מדידה חיה ואינם הוכחה שהמערכת המלאה כבר עובדת כך." },
  { id: "ios", kind: "output", eyebrow: "FUTURE", title: "iOS APP", icon: "i", summary: "אפליקציה עתידית שמתחברת לאותה פלטפורמה, לא למערכת ספק נפרדת.", owner: "VII.", input: "אותם חוזי ממשק, זהות, הרשאות, טיפוסים, ולידציה, אסימוני עיצוב ומילון אירועים.", output: "חוויה טבעית לאייפון עם רכיבים טבעיים כשזה נכון.", resilience: "גרסאות ממשק ותאימות לאחור מאפשרות לאפליקציות ישנות להמשיך לעבוד.", status: "כיוון עתידי בלבד. פיתוח האפליקציה אינו חלק משלב היישום הנוכחי." },
  { id: "android", kind: "output", eyebrow: "FUTURE", title: "ANDROID APP", icon: "A", summary: "אפליקציה עתידית לאנדרואיד על אותה ליבה משותפת.", owner: "VII.", input: "אותם חוזי ממשק, זהות, הרשאות, טיפוסים, ולידציה, אסימוני עיצוב ומילון אירועים.", output: "מוצר אחיד עם יכולות מכשיר טבעיות והתראות מאושרות.", resilience: "השירותים מתוכננים מראש למספר לקוחות וגרסאות.", status: "כיוון עתידי בלבד. פיתוח האפליקציה אינו חלק משלב היישום הנוכחי." },
];

const kindNames: Record<NodeKind, string> = {
  world: "עולם",
  provider: "ספק מידע",
  core: "ליבת VII",
  output: "מוצר קצה",
};

const commandCenter = [
  { nodeId: "cms", label: "CMS + ADMIN", title: "מערכת עבודה יומית, לא רק לוח", copy: "עריכה, אישור, תצוגה מקדימה, גרסאות, יומן וחזרה." },
  { nodeId: "access", label: "GOOGLE SSO", title: "אדיר הוא מנהל־העל", copy: "כניסה מאובטחת והרשאות עובדים לפי עולם ותפקיד." },
  { nodeId: "engagement", label: "CHATWOOT", title: "כל שיחה מגיעה עם הקשר", copy: "העמוד, העולם, מקור ההגעה והפעולות שקדמו לפנייה." },
  { nodeId: "analytics", label: "EVENT STREAM", title: "כל פעולה הופכת למידע", copy: "חשיפה, צפייה, טלפון, ליד, שיחה, חוות דעת והזמנה." },
  { nodeId: "provider-router", label: "TWO-WAY DATA", title: "הזמנות וחוות דעת חוזרות", copy: "לספק הנכון, פעם אחת, עם מעקב מצב מלא." },
  { nodeId: "search-factory", label: "SEARCH FACTORY", title: "חיפוש הופך לעמוד אמיתי", copy: "אישור אנושי, תוכן, כתובת וכלי SEO ו-GEO." },
  { nodeId: "reports", label: "REPORTING + BI", title: "דוחות על כל מה שקרה", copy: "לפי עולם, ספק, עמוד, קמפיין, משפך והרשאה." },
  { nodeId: "translations", label: "TRANSLATIONS", title: "עברית הופכת לשפות אחרות בבקרה", copy: "מילון, טיוטה, בדיקות, ביקורת אנושית וגרסה לכל שפה." },
  { nodeId: "recovery", label: "RECOVERY", title: "גיבוי שעובד רק אחרי תרגיל", copy: "שחזור, מעבר, חזרה לאחור ותוצאה מדודה." },
  { nodeId: "shared-surfaces", label: "VII OWNED PAGES", title: "כל עמודי החיפוש והתוכן אצלנו", copy: "עיר, אזור, נחיתה, סטטי, ניווט, טקסונומיה והפניות." },
];

const technicalExamples: Record<string, { title: string; code: string }> = {
  vacations: { title: "קריאת עמוד נופש מהליבה שלנו", code: "GET /v1/worlds/vacations/places/vii_8f21\nCache-Control: public, s-maxage=300" },
  events: { title: "חיפוש אירועים דרך שער VII", code: "GET /v1/search?world=events&region=tel-aviv&guests=120" },
  hourly: { title: "בדיקת חלון ROOMS VIP", code: "POST /v1/availability/rooms-vip\n{ placeId, unitId, startAt, durationMinutes }" },
  spa: { title: "בדיקת טיפול וזמן", code: "POST /v1/availability/spa\n{ placeId, treatmentId, startsAt, guests }" },
  attractions: { title: "בדיקת כרטיסים", code: "POST /v1/availability/attractions\n{ productId, visitDate, adults, children }" },
  trips: { title: "פרסום מסלול בבעלות VII", code: "POST /v1/admin/trips/{id}/publish\n{ sourceVersion, localeStatuses, seoProfile }" },
  suppliers: { title: "קליטת ליד לספק VII", code: "POST /v1/leads\n{ world: 'suppliers', supplierId, source, consentId }" },
  magazine: { title: "תהליך עריכה רב לשוני", code: "draft -> editorialReview -> approved -> scheduled\nlocales: he=published | en=review | fr=stale" },
  sergey: { title: "סנכרון שינוי מסרגיי", code: "POST /v1/integrations/sergey/webhook\n{ event: 'place.updated', providerId: '1042', version: 38 }" },
  spaplus: { title: "סנכרון שינוי מספא פלוס", code: "POST /v1/integrations/spaplus/webhook\n{ event: 'treatment.updated', providerId: '310', version: 12 }" },
  "attractions-api": { title: "חוזה עתידי לספק אטרקציות", code: "POST /v1/integrations/attractions/bookings\nIdempotency-Key: booking_vii_9107" },
  future: { title: "מתאם ספק חדש", code: "implements ProviderAdapter<FuturePayload>\ncapabilities() -> map() -> health() -> writeback()" },
  edge: { title: "קטלוג בקצה", code: "GET /v1/places/vii_8f21\nCache-Control: public, s-maxage=300, stale-if-error=600" },
  gateway: { title: "שער בעל גרסה והרשאה", code: "request -> authenticate -> authorize(world, action)\n-> rateLimit -> route(v1 contract) -> trace" },
  adapters: { title: "מסלול קליטה שלא מאבד מידע", code: "rawSnapshot -> schemaValidate -> quarantine?\nnormalize -> mergeByFieldOwner -> upsert\n-> reindex -> purgeCache -> syncLedger" },
  database: { title: "חיבור פרטי בשני מסלולים", code: "Cloudflare Worker\n  -> Hyperdrive catalog (cached)\n  -> Hyperdrive booking (cache disabled)\n  -> VPC + Tunnel -> Aurora PostgreSQL" },
  cache: { title: "מפתח מטמון בטוח", code: "availability:{provider}:{entity}:{option}:{dates}:{party}\nshort TTL for discovery only\nfinal booking => fresh path + idempotency key" },
  search: { title: "מסמך חיפוש", code: "{ placeId, world, title, region, geo, amenities, priceFrom, rankSignals }" },
  cms: { title: "אישור שינוי", code: "draft -> review -> approved -> published\naudit: actorId, world, before, after, publishedAt" },
  media: { title: "צינור תמונה", code: "source.jpg -> virus scan -> checksum -> AVIF/WebP -> CDN\nretain providerAssetId + rights metadata" },
  queues: { title: "עבודה שאפשר לנסות שוב", code: "jobId=sync_sergey_1042_v38\nattempt=1 | dedupeKey=sergey:1042:38" },
  security: { title: "שגיאה שמגיעה עם הקשר", code: "traceId + release + world + provider\nerror group -> alert policy -> incident timeline" },
  seo: { title: "הפניה מדויקת מהאתר הישן", code: "legacy_url -> equivalent_target -> 301\nno equivalent -> 410\nnever -> homepage catch-all" },
  analytics: { title: "אירוע עסקי אחיד", code: "track('phone_clicked', { world, placeId, pageType, sessionId, occurredAt })" },
  access: { title: "הרשאה לפי עולם", code: "allow(user, 'places.publish', { world: 'spa' })\ndeny(user, 'users.manage')" },
  engagement: { title: "פתיחת שיחה עם הקשר", code: "POST /v1/chatwoot/conversations\n{ world, placeId, pageUrl, leadId, consentId }" },
  "search-factory": { title: "חיפוש שהופך להצעת עמוד", code: "query cluster -> demand score -> editor review\n-> content brief -> SEO/GEO validation -> publish" },
  reports: { title: "משפך אחד", code: "impression -> place_viewed -> phone_clicked\n-> lead_created -> booking_confirmed" },
  "provider-router": { title: "החזרה בטוחה לספק", code: "enqueue('provider.writeback', { provider, bookingId, type })\nIdempotency-Key: provider:bookingId:type" },
  translations: { title: "גרסה נפרדת לכל שפה ושדה", code: "he@v38 -> detectChangedFields() -> glossary\n-> machineDraft -> validate -> humanReview\n-> localeStatus: approved | stale | blocked" },
  recovery: { title: "תרגיל שחזור, לא הבטחה על הנייר", code: "restorePoint = now - 27m\nrestoreToIsolatedCluster(restorePoint)\nrunIntegritySuite() -> record RTO/RPO evidence" },
  "shared-surfaces": { title: "חיפוש מאושר הופך לעמוד קבוע", code: "queryCluster -> editorApproval -> localizedPage\n-> canonicalSlug -> schema -> sitemap -> measure\nretire => 301 equivalent | 410 no equivalent" },
  web: { title: "טעינת מעבר עמוד", code: "prefetch(route + data)\nrender cached shell immediately\nstream fresh sections" },
  ios: { title: "אותו חוזה, חוויה טבעית", code: "viiSdk.places.get(id)\nshared validation + analytics contract\nnative navigation and touch patterns" },
  android: { title: "אותו חוזה, חוויה טבעית", code: "viiSdk.bookings.start(input)\nshared idempotency + auth\nnative navigation and touch patterns" },
};

const techStack: TechChoice[] = [
  { id: "typescript", name: "TYPESCRIPT", category: "PRIMARY LANGUAGE", role: "שפת הפיתוח המרכזית לאתר, לשרתים, למתאמי הספקים, לחוזי הממשק וללוגיקה המשותפת.", why: "טיפוסים קשיחים תופסים פערים בין ספק, אתר, ניהול ואפליקציה לפני ייצור. אותה שפה מאפשרת לשתף מודלים, אימותים וממשק תוכנה בלי לשכפל אמת.", example: "type CanonicalPlace = {\n  id: string;\n  world: WorldId;\n  providerRefs: ProviderRef[];\n  sourceVersion: number;\n}", decision: "target", status: "כיוון טכנולוגי מאושר. מתחילים כמונולית מודולרי עם גבולות תחום ברורים, לא כרשת מיקרו־שירותים." },
  { id: "react-next", name: "REACT + NEXT.JS", category: "WEB PRODUCT", role: "ממשק שרת ואינטראקציה מהירה, טעינה הדרגתית ומעבר עמודים בלי להעלים את המסך הקיים.", why: "מתאים לחיפוש, תוכן, קידום וממשקים עשירים. מביא מסמך שימושי מהשרת ומפעיל רק את האזורים הלחיצים, עם אפשרות לשיתוף רכיבי מוצר.", example: "render cached shell immediately\nprefetch only high-intent routes\nstream fresh sections without blank page", decision: "current", status: "הפרונט והמסביר הנוכחי משתמשים במשפחת React ו־Next. יעדי הביצועים המלאים עדיין דורשים מדידה חיה." },
  { id: "workers", name: "CLOUDFLARE WORKERS + CDN", category: "EDGE RUNTIME", role: "קוד, הגנה, מטמון והפצת תוכן קרוב לגולש בישראל ובעולם.", why: "מתאים לפיקים, קיצור זמן תגובה, הגנת WAF ו־DDoS, הגבלת קצב והפניות ישנות בקצה, בלי צי שרתים ידני.", example: "browser -> nearest Cloudflare edge\n-> WAF + cache -> versioned VII API", decision: "target", status: "ארכיטקטורת יעד. התשתית המלאה, ההגנות והכללים המתוארים כאן טרם אומתו כייצור פעיל." },
  { id: "aurora", name: "AURORA POSTGRESQL SERVERLESS V2", category: "APPROVED DATABASE", role: "מקור האמת הטרנזקציוני לישויות קנוניות, משתמשים, הרשאות, הזמנות, לידים, תוכן, ביקורת ומצב ספק.", why: "PostgreSQL מתאים לעסקאות וקשרים מורכבים. Serverless v2 מתאים לעומס לא אחיד, והאזור הישראלי מקצר מסלול למשתמשים ולספקים המקומיים.", example: "PostgreSQL 16.x | il-central-1\nwriter AZ-A + reader AZ-B (tier 0)\nmin 2 ACU each | initial max 16 ACU each\nauto-pause off | PITR 35 days", decision: "approved", status: "הבחירה מאושרת. האשכול טרם הוקם. תקרת 16 ACU היא נקודת פתיחה לבדיקת עומס ולא הבטחת קיבולת קבועה." },
  { id: "hyperdrive", name: "HYPERDRIVE + PRIVATE CONNECTIVITY", category: "DATABASE PATH", role: "מאגר חיבורים בין Workers למסד, עם מסלול קטלוג מטמון ומסלול טרי לעסקאות.", why: "Workers יוצרים הרבה חיבורים קצרים. Hyperdrive מרכז אותם, ושני חיבורים לוגיים מונעים מקריאת מטמון לזהם הרשאות, זמינות סופית או קריאה מיד אחרי כתיבה.", example: "catalog binding -> cached reads\nbooking binding -> cache disabled\nWorkers VPC + redundant Tunnel -> private Aurora", decision: "target", status: "יעד תכנוני. החיבור הפרטי אינו הצצה ישירה בין רשתות וצריך לעבור הוכחת היתכנות ברשת AWS שנבחרה." },
  { id: "r2", name: "CLOUDFLARE R2", category: "OBJECT STORAGE", role: "שמירת מדיה, קובצי מקור ונתוני ספק גולמיים מחוץ למסד העסקאות.", why: "תמונה אינה רשומת מסד. אחסון אובייקטים שומר מקור, גרסאות, זכויות ובדיקות שלמות ומתאים להפצה דרך CDN.", example: "raw/{provider}/{entity}/{version}.json\nmedia/{placeId}/{assetId}/original\nmedia/{placeId}/{assetId}/card.avif", decision: "target", status: "יעד האחסון הנוכחי. זכויות השימוש של כל ספק חייבות להיסגר בחוזה לפני פרסום." },
  { id: "queues", name: "CLOUDFLARE QUEUES + WORKERS", category: "BACKGROUND JOBS", role: "סנכרון, אינדוקס, תרגום, עיבוד מדיה, כתיבה לספק והתראות רצים מחוץ לבקשת הגולש.", why: "הגולש אינו מחכה לעבודה כבדה. כל משימה מקבלת מזהה, מניעת כפילות, ניסיונות מבוקרים, תור כשל והפעלה חוזרת.", example: "publish(sync.place.updated)\nvalidate -> merge -> upsert -> reindex -> purge\nfailed -> dead letter -> inspect -> replay", decision: "target", status: "ארכיטקטורת יעד. תורים וחיבורי הספק המלאים טרם אומתו." },
  { id: "react-native", name: "REACT NATIVE", category: "FUTURE MOBILE APPS", role: "כיוון עתידי לאפליקציות אייפון ואנדרואיד על אותה ליבה, בלי לבנות מחדש את הספקים.", why: "מאפשר לשתף טיפוסים, ערכת פיתוח, אימות, אסימוני עיצוב ואירועים, ועדיין להשתמש בניווט וברכיבי מכשיר טבעיים.", example: "shared: types + SDK + validation + tokens + events\nnative: navigation + gestures + device capabilities", decision: "target", status: "כיוון עתידי מועדף. פיתוח אפליקציות אינו חלק מהשלב הנוכחי." },
  { id: "search-vendor", name: "SEARCH VENDOR", category: "OPEN SELECTION", role: "מנוע נפרד לחיפוש טקסט, מפה, מסננים, תעתיק, מילים נרדפות ודירוג.", why: "מסד עסקאות אינו צריך לשאת את כל שילובי החיפוש. האינדקס נבנה מחדש מהמקור הקנוני ונבחר לפי איכות, מהירות, מחיר ותפעול.", example: "golden queries per world + language\nrelevance + geo + filters + freshness\nrebuild from Aurora canonical data", decision: "open", status: "טרם נבחר ספק. OpenSearch הוא אפשרות, לא החלטה מאושרת." },
  { id: "observability-vendor", name: "ANALYTICS + OBSERVABILITY VENDORS", category: "OPEN SELECTION", role: "אחסון אירועים בנפח גבוה, ניתוח מוצר, שגיאות, מדדים, עקבות, בדיקות סינתטיות והתראות.", why: "Aurora שומרת אמת עסקית, לא מיליארדי אירועי צפייה. שכבה ייעודית מאפשרת דוחות וחקירה בלי לפגוע בהזמנות.", example: "release marker -> logs + metrics + traces\nsynthetic booking check -> alert route\nprivacy-safe event warehouse -> BI", decision: "open", status: "החוזה והיכולות מאושרים כדרישה. ספקי האנליטיקה והניטור טרם נבחרו." },
  { id: "redis", name: "REDIS", category: "OPTION, NOT DECIDED", role: "אפשרות למטמון חם, נעילות קצרות ומגבלות קצב אם המדידה תוכיח שחסר פתרון קיים.", why: "אין מוסיפים מערכת תפעולית רק כי היא נפוצה. קודם משתמשים במטמון הקצה, ב־Hyperdrive וביכולות הפלטפורמה, ואז מודדים צורך אמיתי.", example: "if measured_need:\n  add Redis with owner + SLA + backup\nelse:\n  keep architecture simpler", decision: "open", status: "Redis לא נבחר ואינו תלות מאושרת." },
  { id: "iac-secrets", name: "INFRASTRUCTURE + SECRETS TOOLING", category: "OPEN DETAILS", role: "הגדרת סביבות, רשת, הרשאות, מסד, תורים, התראות וסודות בצורה נשלטת וניתנת לשחזור.", why: "קוד תשתית וסודות מנוהלים מונעים הבדל ידני בין פיתוח לייצור, מקטינים הרשאות ומאפשרים חזרה וביקורת.", example: "production != staging\nleast privilege service identities\nversioned changes + reviewed rollback", decision: "open", status: "העיקרון מאושר. ספק הסודות ופרטי התשתית כקוד טרם נסגרו." },
];

const providerExamples = [
  { provider: "SERGEY", world: "VACATIONS", code: "provider_id: <placeholder, unverified>", title: "וילת הדגמה בגליל", fields: "שם, מזהה, אודות, כתובת, מיקום, תמונות, מתקנים, יחידות, מבנה חדרים, מחירים, מדיניות וזמינות", meta: "3 יחידות · בריכה · החל מ־1,900 ₪" },
  { provider: "SPA PLUS", world: "SPA", code: "provider_id: <placeholder, unverified>", title: "ספא הדגמה בתל אביב", fields: "שם, מזהה, אודות, כתובת, תמונות, טיפולים, משכים, מטפלים, חבילות, מחירים, שעות ותורים", meta: "12 טיפולים · פתוח היום · החל מ־260 ₪" },
  { provider: "FUTURE PROVIDER", world: "ATTRACTIONS", code: "provider_id: pending", title: "אטרקציית הדגמה בצפון", fields: "שם, מזהה, תיאור, מיקום, תמונות, סוגי כרטיסים, גילאים, מגבלות, שעות, מחירים וזמינות", meta: "משפחות · 90 דקות · החל מ־85 ₪" },
];

const hilatInsights: InsightCard[] = [
  {
    id: "hilat-identity",
    eyebrow: "01 IDENTITY + CONTENT",
    title: "זהות, שם ותוכן מלא",
    summary: "סרגיי צריך לספק מזהה יציב, סטטוס, שם, סוג מקום, תיאור קצר ותיאור מלא. VII שומרת את המקור וממפה אותו לזהות קנונית משלה.",
    decision: "target",
    status: "חוזה מוצע לאישור סרגיי. השמות הטכניים אינם ממשק פעיל.",
    bullets: ["המקור הנוכחי שנבדק כולל את השם הילת הנוף, מתחם בקתות עץ בכלנית.", "מזהה הספק לעולם אינו משמש ככתובת הציבורית של VII.", "שינוי שם או תיאור מעדכן רק שדות שבבעלות הספק ואינו מוחק עריכת VII."],
    technical: "GET /v1/venues/{supplierVenueId}\ninclude=content,units,media,policies\n\n{\n  schemaVersion: '1.0',\n  supplierVenueId: '<Sergey ID to confirm>',\n  sourceUpdatedAt: '<ISO-8601>',\n  status: 'active',\n  name: 'הילת הנוף',\n  type: 'cabin_complex',\n  descriptions: { short, full }\n}",
  },
  {
    id: "hilat-location",
    eyebrow: "02 LOCATION + CONTACT",
    title: "מיקום, מפה ודרכי קשר",
    summary: "היישוב, האזור, הכתובת, הקואורדינטות ודרכי הקשר המורשות מגיעים כמבנה נתונים, ולא כטקסט אחד שאי אפשר לבדוק.",
    decision: "target",
    status: "המיקום והקשר קיימים במקור הנוכחי. חוזה סרגיי והרשאות השימוש עדיין פתוחים.",
    bullets: ["המקור הנוכחי מציב את המקום בכלנית, באזור סובב כנרת.", "המערכת בודקת קואורדינטות מול היישוב והאזור לפני פרסום.", "טלפון ו־WhatsApp נשמרים עם הרשאת הצגה וניתוב, בלי לחשוף מידע פנימי."],
    technical: "location: {\n  locality: 'כלנית',\n  region: 'סובב כנרת',\n  latitude: 32.8764309,\n  longitude: 35.4552075,\n  geocodeSource: '<to confirm>'\n}\ncontact: { publicPhone, whatsapp, displayAllowed }",
  },
  {
    id: "hilat-media",
    eyebrow: "03 MEDIA + RIGHTS",
    title: "גלריה, סדר תמונות וזכויות",
    summary: "לא מספיק לקבל כתובות תמונה. לכל נכס מדיה נדרשים מזהה, מקור, סדר, שיוך למתחם או ליחידה, זכויות, checksum ומידע חלופי.",
    decision: "target",
    status: "במאגר המקומי קיימים 46 קובצי מדיה של הילת הנוף. מקור CDN וזכויות מסרגיי טרם אומתו.",
    bullets: ["VII שומרת מקור או עותק בר־שחזור ומפיקה גרסאות מהירות למסכים שונים.", "לכל תמונה יש סדר, נושא, יחידה, מקור וזכויות שימוש.", "VII רשאית להוסיף חיתוך, בחירת תמונת שער, כיתוב ו־alt מקומי בלי לשנות את קובץ המקור."],
    technical: "media: [{\n  supplierAssetId: '<asset id>',\n  sourceUrl: 'https://...',\n  sortOrder: 1,\n  scope: 'venue | unit',\n  unitId: '<optional>',\n  rights: { publishAllowed, credit },\n  checksum: 'sha256:...',\n  sourceAlt: '<optional>'\n}]",
  },
  {
    id: "hilat-units",
    eyebrow: "04 UNITS + ROOMS",
    title: "ארבע בקתות ומבנה חדרים",
    summary: "כל בקתה היא יחידה נפרדת עם מזהה יציב, קיבולת, חדרי שינה, מיטות, שטח, תמונות ומתקנים. יחידה אינה חדר שינה.",
    decision: "target",
    status: "פירוט ארבע היחידות קיים במקור הנוכחי. מזהי היחידות ומחירן בממשק סרגיי אינם מאומתים.",
    bullets: ["בקתות 1 עד 3: עד שישה אורחים, חדר שינה אחד ו־45 מ״ר לכל יחידה.", "בקתה 4: עד שבעה אורחים, שני חדרי שינה ו־45 מ״ר.", "כל סתירה בין סיכום המקום לסכום היחידות נעצרת לבדיקה במקום להתפרסם אוטומטית."],
    technical: "units: [{\n  supplierUnitId: '<Sergey unit id>',\n  name: 'בקתה 1',\n  quantity: 1,\n  maxGuests: 6,\n  bedrooms: 1,\n  areaSqm: 45,\n  beds: [{ type, quantity }],\n  amenities: [], media: []\n}]\nvalidateAggregate(units) -> pass | quarantine",
  },
  {
    id: "hilat-features",
    eyebrow: "05 AMENITIES + POLICIES",
    title: "מתקנים, קהלים, מדיניות ונגישות",
    summary: "מתקנים ומדיניות מתקבלים כשדות מובנים שאפשר לסנן, לתרגם ולאמת. נגישות אינה תג כללי, אלא מידע מפורט שדורש מקור ואישור.",
    decision: "target",
    status: "המתקנים והמדיניות קיימים במקור המקומי. מידע הנגישות עצמו מוצג כיום כטרם אומת.",
    bullets: ["המקור כולל בריכה, ג׳קוזי בכל בקתה, מטבח משותף, מדשאות, ברביקיו וציוד ביחידות.", "שעות כניסה ויציאה, קהלים וכללי רעש נשמרים בנפרד.", "פרסום נגישות דורש שדות מפורטים ובדיקה, לא סימון כן או לא בלבד."],
    technical: "amenityCodes: ['pool', 'private_jacuzzi', 'shared_kitchen']\npolicies: { checkInFrom, checkOutUntil, noise, parties }\naccessibility: {\n  status: 'unverified | verified',\n  parking, route, entrance, bathroom, facilities,\n  checkedAt, verifiedBy\n}",
  },
  {
    id: "hilat-commerce",
    eyebrow: "06 LIVE AVAILABILITY",
    title: "מחיר, זמינות והזמנה טרייה",
    summary: "קטלוג המקום נטען מ־VII. רק אחרי בחירת תאריכים, אורחים ויחידה נשלחת בדיקה ממוקדת לסרגיי. אישור הזמנה לעולם אינו מגיע ממטמון.",
    decision: "target",
    status: "בדף הנוכחי יש תמונת מצב מקומית. זמינות יחידתית והזמנה מול סרגיי טרם חוברו.",
    bullets: ["מענה חייב להחזיר מצב מפורש: זמין, לא זמין, לא ידוע או שגיאה.", "המחיר כולל מטבע, לילות מינימום, מיסים, עמלות, תוקף הצעה ומזהה בקשה.", "יצירת הזמנה משתמשת במפתח מניעת כפילות ובבדיקה טרייה לפני התחייבות."],
    technical: "POST /v1/integrations/sergey/availability\n{ supplierVenueId, unitIds, from, till, adults, children }\n\n-> {\n  status: 'available | unavailable | unknown | error',\n  units: [{ supplierUnitId, quantity, totalPrice }],\n  currency: 'ILS', quoteId, validUntil, supplierRequestId\n}\n\nPOST /bookings\nIdempotency-Key: vii_booking_<stable-id>",
  },
  {
    id: "hilat-overlay",
    eyebrow: "07 VII OWNED OVERLAY",
    title: "מה VII מוסיפה ושומרת לעצמה",
    summary: "VII קובעת את הכתובת, מבנה העמוד, עריכת התוכן, התרגומים, סדר המדיה, קידום, קישורים, פרסום ודוחות. עדכון ספק אינו מוחק אותם.",
    decision: "approved",
    status: "עקרון הבעלות מאושר. מערכת הניהול והמודל הקנוני המלאים טרם נבנו ואומתו.",
    bullets: ["כתובת ציבורית, canonical, metadata, schema, breadcrumbs וקישורים פנימיים.", "תרגומים, כותרות ערוכות, בחירת תמונת שער, FAQ, מקומות קרובים וכללי פרסום.", "מקור ובעלות לכל שדה, גרסה, תצוגה מקדימה, אישור, יומן וחזרה לאחור."],
    technical: "canonicalPlace: { id: 'vii_place_hilat_hanof', supplierRefs: [...] }\noverlay: {\n  slug: 'business?id=hilat-hanof',\n  heroAssetId, localizedCopy, seo, faq, relatedItems,\n  publicationStatus, version, approvedBy\n}\nmergeRule: supplier fields + preserved VII overlay",
  },
  {
    id: "hilat-reviews-sync",
    eyebrow: "08 REVIEWS + SYNC",
    title: "חוות דעת ועדכון דו־כיווני",
    summary: "העמוד מציג 180 חוות דעת ממקור legacy מאומת. חוות דעת חדשות והזמנות יוחזרו לסרגיי רק בחוזה מאושר, עם מצב, מתינות ומניעת כפילות.",
    decision: "target",
    status: "המקור המקומי קיים. חוזה הכתיבה, Webhook, מגבלות הקצב וה־SLA של סרגיי עדיין פתוחים.",
    bullets: ["שומרים מזהה VII ומזהה ספק, שיוך למקום וליחידה, שפה, אימות ביקור ומצב ביקורת.", "שינוי תמונה או חדר עובר דרך מקור גולמי, אימות, מיזוג, אינדוקס ופינוי מטמון.", "כשל נשמר בתור כשל עם סיבה. ניסיון חוזר אינו יוצר הזמנה או חוות דעת כפולה."],
    technical: "place.updated v38\n-> raw snapshot\n-> schema + media + aggregate validation\n-> field-owner diff\n-> canonical upsert\n-> preserve VII overlay\n-> reindex + purge cache\n-> audit + alert\n\nPOST /reviews\nIdempotency-Key: sergey:<review-id>",
  },
];

const hilatPageComponents = [
  ["שם, סוג ומיקום", "hilat-identity"], ["גלריה ותמונת שער", "hilat-media"], ["שמירה, שיתוף ויצירת קשר", "hilat-location"],
  ["תיאור וקהלי יעד", "hilat-identity"], ["נתוני על של המקום", "hilat-units"], ["בדיקת תאריכים והזמנה", "hilat-commerce"],
  ["יחידות ומבנה שינה", "hilat-units"], ["מתקנים ושירותים", "hilat-features"], ["מידע נגישות", "hilat-features"],
  ["מפה ומיקום", "hilat-location"], ["שאלות, מדיניות ותנאים", "hilat-features"], ["חוות דעת", "hilat-reviews-sync"],
  ["חוויות ומקומות קרובים", "hilat-overlay"], ["קידום, כתובת ונתונים מובנים", "hilat-overlay"],
] as const;

const decisionSnapshot: InsightCard[] = [
  { id: "decision-owner", eyebrow: "PLATFORM OWNERSHIP", title: "VII מחזיקה במוצר ובאמת המקומית", summary: "הספקים מספקים מידע ופעולות לעולם שלהם. הם אינם מרנדרים את VII ואינם מכתיבים את המודל שלה.", decision: "approved", status: "עקרון בעלות מאושר.", bullets: ["VII: אתר, שרת, ממשק, נתונים, חיפוש, ניהול, תוכן, קידום, מדידה והרשאות.", "ספק: מקור נתונים וזמינות לפי חוזה עולם מאומת.", "מתאם מבודד לכל ספק מאפשר החלפה בלי לפרק את המוצר."], technical: "provider payload -> VII adapter -> raw snapshot\n-> canonical model -> VII overlay -> public API" },
  { id: "decision-database", eyebrow: "CENTRAL DATABASE", title: "Aurora PostgreSQL בישראל", summary: "המסד הטרנזקציוני נבחר. VII תשתמש ב־Aurora Serverless v2 באזור תל אביב.", decision: "approved", status: "בחירת הטכנולוגיה והאזור מאושרת. ההקמה עדיין לא בוצעה.", bullets: ["PostgreSQL 16.x, גרסת משנה נתמכת שנבדקה.", "אזור AWS תל אביב.", "מסד פרטי, מוצפן וללא גישה ציבורית."], technical: "engine = aurora-postgresql\nregion = il-central-1\npublic_access = false\nencryption = enabled" },
  { id: "decision-topology", eyebrow: "PRODUCTION TOPOLOGY", title: "כותב וקורא בשני אזורי זמינות", summary: "תצורת הייצור מבודדת כשל של מופע או אזור זמינות ומאפשרת קידום קורא.", decision: "target", status: "תצורת יעד שדורשת הקמה, בדיקת מעבר ובדיקת עומס.", bullets: ["כותב Serverless באזור זמינות אחד.", "קורא Serverless באזור זמינות אחר, בדרגת קידום אפס.", "מינימום 2 ACU ומקסימום 16 ACU לכל מופע בתחילת הדרך, ללא השהיה אוטומטית."], technical: "writer AZ-A: min 2 / max 16 ACU\nreader AZ-B: min 2 / max 16 ACU\npromotion_tier = 0\nauto_pause = off" },
  { id: "decision-current", eyebrow: "CURRENT IMPLEMENTATION", title: "המסביר והפרונט קיימים, הליבה עדיין לא", summary: "הדף הזה מתאר את המערכת שנבנה. הוא אינו צילום מסך של תשתית שכבר פועלת.", decision: "current", status: "אמת נוכחית שנבדקה ב־18 באוגוסט 2026.", bullets: ["הפרונט הציבורי והמסביר האינטראקטיבי קיימים.", "Aurora, ממשקי הספק, קליטה קנונית מלאה, כתיבה חוזרת, ניהול מלא, ניטור והתאוששות טרם אומתו.", "אין להשתמש במפה כהוכחה שחיבור או שרת כבר עלו לאוויר."], technical: "verified: public frontend + /platform\nunverified: supplier APIs + Aurora + full admin + DR" },
  { id: "decision-open", eyebrow: "OPEN SELECTIONS", title: "כמה ספקים והחלטות עדיין פתוחים", summary: "הארכיטקטורה שומרת מקום להחלטות שצריכות להגיע מחוזים, בדיקות ועלות אמיתית.", decision: "open", status: "אין להציג אפשרות פתוחה כבחירה סופית.", bullets: ["ספק אטרקציות וחוזי סרגיי וספא פלוס.", "מנוע חיפוש, אנליטיקה, ניטור, תרגום, תשלום וסודות.", "שפות השקה, זכויות מדיה, פרטיות, מטרות התאוששות והאזור המשני."], technical: "open decisions -> owner + due date + acceptance test\nno production claim before end-to-end evidence" },
  { id: "decision-estimate", eyebrow: "COST + TIME", title: "עלויות וזמנים הם אומדן, לא הצעת מחיר", summary: "המספרים מיועדים לתכנון עד שנקבל חוזי ספק, דוגמאות נתונים, שפות, צוות ויעדי התאוששות.", decision: "estimate", status: "אין כאן אישור תקציב או התחייבות לזמן.", bullets: ["אורורה: רצפת מחשוב של 438 דולר לחודש לשני מופעים במינימום.", "פיתוח ליבה חזק: כ־850 אלף עד 1.6 מיליון ₪.", "פלטפורמה רב־עולמית מלאה: כ־1.3 עד 2.5 מיליון ₪."], technical: "re-estimate after API samples + language scope\n+ booking policy + redirect inventory + staffing" },
];

const infrastructureInsights: InsightCard[] = [
  { id: "infra-runtime", eyebrow: "WHAT IS THE SERVER", title: "אין שרת יחיד, יש שכבות עם תפקיד ברור", summary: "הגולש פוגש את קלאודפלייר בקצה. קוד TypeScript מפעיל את ממשק VII, ואורורה שומרת את האמת העסקית.", decision: "target", status: "כיוון טכנולוגי מאושר, יישום מלא טרם אומת.", bullets: ["Cloudflare: הפצה, הגנה, מטמון, הגבלת קצב והפניות.", "TypeScript: מונולית מודולרי וממשק בעל גרסאות.", "Aurora: עסקאות ונתונים קנוניים. R2: מדיה וקובצי מקור. תורים: עבודות רקע."], technical: "user -> Cloudflare edge -> VII API\nVII API -> Hyperdrive -> private Aurora\nqueues -> sync / media / translation / writeback" },
  { id: "infra-connections", eyebrow: "TWO DATABASE PATHS", title: "מסלול מהיר לקטלוג ומסלול טרי להזמנה", summary: "הקטלוג יכול ליהנות ממטמון. הרשאה, זמינות סופית, הזמנה וקריאה אחרי כתיבה חייבות להיות טריות.", decision: "target", status: "דורש הוכחת היתכנות לחיבור הפרטי ובדיקת עקביות.", bullets: ["חיבור Hyperdrive עם מטמון לקריאות קטלוג שמותר להן להתיישן מעט.", "חיבור Hyperdrive ללא מטמון להרשאות, הזמנה, זמינות סופית וקריאה אחרי כתיבה.", "Workers VPC ומנהרת Cloudflare עם מחברים יתירים למסד פרטי."], technical: "catalog_db: cache enabled\ntransaction_db: cache disabled\nprivate path: Workers VPC -> redundant Tunnel -> Aurora" },
  { id: "infra-staging", eyebrow: "SAFE STAGING", title: "סביבת בדיקות נפרדת לחלוטין", summary: "פיתוח ובדיקות לא משתמשים בנתוני לקוח אמיתיים ולא חולקים הרשאות עם הייצור.", decision: "target", status: "תצורת יעד, כפופה לתמיכת גרסת המנוע בהשהיה מאפס.", bullets: ["אשכול, הרשאות וסודות נפרדים.", "מינימום אפס ACU כשנתמך, מקסימום ארבעה ACU והשהיה אוטומטית.", "נתונים מסונתזים או מוסווים בלבד."], technical: "staging: min 0 / max 4 ACU\nauto_pause = on\ncustomer_data = forbidden\ncredentials != production" },
  { id: "infra-data-layers", eyebrow: "THREE DATA LAYERS", title: "מקור ספק, מודל VII ושכבת עריכה אינם אותו דבר", summary: "כל שדה יודע מאיפה הגיע ומי רשאי לשנות אותו. עדכון ספק אינו מוחק תוכן, תרגום או קידום של VII.", decision: "approved", status: "דרישת נתונים מאושרת. היישום המלא טרם אומת.", bullets: ["שכבה גולמית לשחזור, חקירה ומיפוי מחדש.", "שכבה קנונית מנורמלת לשירותי המוצר.", "שכבת VII לעריכה, תרגום, קידום, מדיה, כללי פרסום וחריגות."], technical: "raw_payload(provider, entity, schema_version)\ncanonical_place(vii_id, normalized_fields)\nfield_overlay(field, owner, locale, version, status)" },
  { id: "infra-performance", eyebrow: "TOUCH + SPEED", title: "המהירות נבנית לתוך המערכת", summary: "אין מסך לבן בין עמודים, וכל לחיצה מקבלת תגובה מקומית מיידית.", decision: "approved", status: "יעדי שחרור שדורשים מדידה חיה, לא הבטחה על הפרונט הנוכחי.", bullets: ["תגובה מקומית מתחת ל־100 אלפיות השנייה.", "פעולת שרת קלה באחוזון 95 מתחת ל־300 אלפיות השנייה היכן שהארכיטקטורה מאפשרת.", "INP מתחת ל־200 אלפיות השנייה, LCP מתחת ל־2.5 שניות ומטרות מגע של 44 פיקסלים לפחות."], technical: "keep shell -> predictive prefetch when useful\nlayout-matching skeletons -> responsive media\nRUM by route + device + network" },
];

const failureInsights: InsightCard[] = [
  { id: "failure-supplier", eyebrow: "SUPPLIER DOWN", title: "ספק נופל, העולם שלו מצטמצם ולא מפיל את VII", summary: "VII ממשיכה להציג קטלוג מקומי שאושר, אבל לא ממציאה זמינות או הזמנה.", decision: "target", status: "התנהגות יעד שצריכה לעבור תרגיל ספק.", bullets: ["זמן קצוב, מפסק עומס, הגבלת קצב, איחוד בקשות וניסיון חוזר מבוקר.", "עמודי קטלוג נשארים זמינים לפי מדיניות נתון ישן מאושרת.", "זמינות סופית והזמנה מציגות ניסיון חוזר, ליד או תמיכה כשאין אישור טרי."], technical: "supplier timeout -> circuit open\nserve allowed stale catalog\nfinal availability = unavailable to confirm\nbooking success = never fabricated" },
  { id: "failure-traffic", eyebrow: "TRAFFIC SPIKE", title: "פיק של גולשים נספג לפני שהוא מגיע לספק", summary: "המטמון בקצה, איחוד הבקשות, התורים והגדלת קיבולת המסד שומרים על הליבה.", decision: "target", status: "הגדרות ההשקה יאושרו רק לאחר בדיקת עומס.", bullets: ["CDN ומטמון מגישים קטלוג ותוכן נפוץ.", "בקשות זמינות זהות מתאחדות לזמן קצר.", "תורים סופגים עבודות רקע ו־Aurora מגדילה ACU עד התקרה שנבדקה."], technical: "edge cache hit -> no origin\ndedupe availability key -> one provider call\nqueue absorbs burst -> monitored lag\nAurora scales within tested bounds" },
  { id: "failure-az", eyebrow: "INSTANCE OR AZ DOWN", title: "קורא באזור זמינות אחר מקודם לכותב", summary: "כשל של מופע או אזור זמינות אינו אמור לדרוש שחזור ידני של כל המערכת.", decision: "target", status: "אין הבטחת זמן מעבר לפני תרגיל ייצור מתועד.", bullets: ["כותב וקורא באזורים נפרדים.", "קורא בדרגת קידום אפס.", "האפליקציה חייבת להתחבר מחדש ולעבור בדיקת כתיבה וקריאה לאחר המעבר."], technical: "writer unavailable -> Aurora failover\nreader tier 0 -> promoted writer\nHyperdrive reconnect -> transaction smoke test" },
  { id: "failure-region", eyebrow: "REGION OR ACCOUNT FAILURE", title: "עותק נפרד ושחזור בין אזורים לפני השקה קריטית", summary: "שחזור לנקודת זמן באותו אזור אינו מספיק לכשל חשבון או אזור שלם.", decision: "target", status: "האזור המשני, מסד גלובלי ויעדי זמן ואובדן מידע עדיין פתוחים.", bullets: ["עותק גיבוי בין חשבונות להגנה מטעות או פגיעה ברמת החשבון.", "גיבוי בין אזורים או אתר משני חם לפני מועד מוכנות הזמנות קריטית.", "גישה מוצפנת ותרגיל שחזור עם זמן ותוצאה מדודים."], technical: "continuous backup + 35d PITR\ncopy -> separate AWS account\ncopy or warm secondary -> selected region\nrestore drill -> measured RTO/RPO" },
  { id: "failure-release", eyebrow: "BAD RELEASE OR DATA CHANGE", title: "חזרה לאחור נפרדת לקוד, סכימה ונתונים", summary: "פריסה שנכשלה אינה מטופלת בהחלפת קוד בלבד אם גם מבנה הנתונים השתנה.", decision: "target", status: "נוהל יעד. כל הגירה מחייבת תוכנית חזרה ובדיקת שחזור.", bullets: ["גרסה שמורה ואפשרות להחזיר את היישום.", "הגירות סכימה תואמות לאחור או בעלות מסלול חזרה מפורש.", "יומן שינויים ושחזור נקודתי כאשר הפעולה פגעה בנתונים."], technical: "deploy N -> health gates\nfail -> route traffic to N-1\nschema migration -> backward compatible window\ndata incident -> PITR into isolated restore" },
];

const translationInsights: InsightCard[] = [
  { id: "translation-source", eyebrow: "01 SOURCE", title: "שומרים את העברית המאומתת ואת הגרסה שלה", summary: "כל תרגום קשור לשדה ולגרסת מקור, לא רק לעמוד שלם.", decision: "approved", status: "דרישת תוכן מאושרת.", bullets: ["מזהים אילו שדות באמת השתנו.", "שומרים מקור שדה, בעלות וגרסה.", "לא מתרגמים מחדש טקסט שלא השתנה."], technical: "source_field = description.he@v38\nchanged_fields = diff(v37, v38)" },
  { id: "translation-draft", eyebrow: "02 GLOSSARY + DRAFT", title: "מילון VII מכוון את טיוטת המכונה", summary: "שמות עולמות, מקומות, מתקנים ומונחי מותג אינם נשארים ליד המקרה.", decision: "approved", status: "התהליך מאושר. ספק התרגום טרם נבחר.", bullets: ["מילון לפי שפה ושוק.", "טיוטת מכונה, לא פרסום אוטומטי.", "שמירת סימונים, מספרים ומבנה."], technical: "applyGlossary(world, locale)\nmachineDraft(source, glossary)\nstatus = draft" },
  { id: "translation-validate", eyebrow: "03 VALIDATE", title: "בודקים חסרים, מספרים, סימונים ומבנה", summary: "המערכת עוצרת תרגום ששבר מחיר, שם מקום, משתנה או קוד.", decision: "approved", status: "בדיקות נדרשות לפני מעבר לביקורת אנושית.", bullets: ["אין שדה חסר או placeholder שנעלם.", "מספרים, מטבע, HTML וקישורים נשמרים.", "מונחים אסורים או שינוי משמעות מסומנים לבדיקה."], technical: "validate(placeholders, numbers, markup, links)\nfailed -> blocked + reason" },
  { id: "translation-review", eyebrow: "04 REVIEW + PUBLISH", title: "אדם מאשר שפה חשובה לפני פרסום", summary: "לכל שפה סטטוס וגרסה עצמאיים, עם תצוגה מקדימה והחלטת פרסום.", decision: "approved", status: "עומק הביקורת ורשימת שפות ההשקה עדיין פתוחים.", bullets: ["ביקורת אנושית לשדות ציבוריים חשובים.", "פרסום נפרד לכל שפה.", "שינוי מקור מסמן רק את התרגומים המושפעים כמיושנים."], technical: "locale status: draft -> review -> approved -> published\nsource changed -> affected locale fields = stale" },
];

const monitoringInsights: InsightCard[] = [
  { id: "monitor-release", eyebrow: "RELEASE MARKERS", title: "כל שגיאה יודעת באיזו גרסה התחילה", summary: "פריסה מסומנת בלוגים, במדדים ובעקבות כדי לקשור שינוי לתקלה.", decision: "target", status: "יכולת יעד, ספק טרם נבחר.", bullets: ["גרסת קוד ותשתית על כל אירוע.", "קיבוץ שגיאות לפי מקור והשפעה.", "השוואה לפני ואחרי שחרור."], technical: "release=<deployment-version>\ntraceId + route + world + provider\nerror group -> first_seen + affected_sessions" },
  { id: "monitor-synthetic", eyebrow: "AUTOMATIC CHECKS", title: "רובוטים בודקים את המסלולים הקריטיים כל הזמן", summary: "בדיקת דף בלבד אינה מספיקה. בודקים חיפוש, ספק, התחלת הזמנה וממשק ניהול.", decision: "target", status: "תרחישי הבדיקה והספים ייקבעו לפי שלב ההשקה.", bullets: ["בדיקות סינתטיות ממיקומים מוסכמים.", "בדיקת טריות, זמני ספק, תור ומסד.", "בדיקה שמתריעה בלי ליצור הזמנה כפולה או אמיתית."], technical: "GET catalog -> expected 200 + freshness\nsearch golden query -> expected result\nbooking sandbox -> idempotent dry run" },
  { id: "monitor-alert", eyebrow: "ALERT ROUTING", title: "ההתראה מגיעה לאדם הנכון עם הקשר", summary: "התראה שימושית כוללת חומרה, עולם, ספק, גרסה, השפעה ופעולה ראשונה.", decision: "target", status: "ספק וערוצי ההתראה עדיין פתוחים.", bullets: ["ספים שונים לזמינות, כשלי ספק, שגיאות הזמנה ופיגור תור.", "מניעת סערת התראות וכפילויות.", "הסלמה לפי חומרה ושעות כוננות."], technical: "alert = { severity, world, provider, release, impact }\ndedupe window -> owner -> escalation policy" },
  { id: "monitor-incident", eyebrow: "INCIDENT HISTORY", title: "מתקלה לתיקון ולמניעת חזרה", summary: "המערכת שומרת מה קרה, מה הושפע, מי טיפל ואיזו בדיקה נוספה.", decision: "target", status: "נדרש לפני מוכנות תפעולית.", bullets: ["ציר זמן של זיהוי, תגובה והתאוששות.", "הוכחת תיקון ובדיקת חזרה.", "מעקב אחרי כשל חוזר ויעד סגירה."], technical: "detect -> contain -> recover -> verify\npost-incident: cause + fix + regression + owner" },
];

const costInsights: InsightCard[] = [
  { id: "cost-aurora-floor", eyebrow: "DATABASE FLOOR", title: "438 דולר לחודש למחשוב המינימלי", summary: "שני מופעים, כל אחד במינימום שני ACU, במשך 730 שעות ובמחיר אזורי של 0.15 דולר ל־ACU לשעה.", decision: "estimate", status: "חישוב תכנוני, ללא אחסון, קלט ופלט, גיבוי, תעבורה, מס או תמיכה.", bullets: ["2 מופעים × 2 ACU × 730 שעות × 0.15 דולר.", "דוגמה טכנית מלאה יותר: כ־529 דולר לחודש.", "טווח מסד התחלתי מציאותי: כ־750 עד 1,000 דולר לחודש."], technical: "2 * 2 * 730 * $0.15 = $438 / month\nstorage: $0.14 / GB-month\nI/O: $0.27 / million requests" },
  { id: "cost-aurora-load", eyebrow: "HIGHER DATABASE LOAD", title: "כ־1,500 עד 2,100 דולר בעומס מתמשך גבוה יותר", summary: "העלות עולה עם שימוש בפועל. תקרה של 16 ACU אינה אומרת שמשלמים אותה בכל שעה.", decision: "estimate", status: "טווח תכנוני בלבד. בדיקת עומס ומדדי ייצור יקבעו את הקיבולת.", bullets: ["שני מופעים על 16 ACU במשך חודש שלם: 3,504 דולר למחשוב בלבד.", "ייתכן שנעלה את התקרה ל־32 או 64 ACU אחרי בדיקה.", "מטמון, חיפוש ותורים משפיעים על עומס המסד ועל העלות."], technical: "2 instances * 16 ACU * 730h * $0.15\n= $3,504 compute-only ceiling if sustained all month" },
  { id: "cost-build", eyebrow: "BUILD ESTIMATE", title: "ליבת פלטפורמה חזקה: כ־850 אלף עד 1.6 מיליון ₪", summary: "כולל תכנון, ליבת שרת, נתונים, ניהול, חיפוש, סנכרון ראשוני, הגירת כתובות ובדיקות, לפי המפרט שייסגר.", decision: "estimate", status: "אומדן מוקדם, לא תקציב מאושר ולא הצעת מחיר.", bullets: ["כל עולם ספק נוסף: כ־80 עד 220 אלף ₪ לפי איכות הממשק.", "פלטפורמה רב־עולמית מלאה: כ־1.3 עד 2.5 מיליון ₪.", "תפעול חודשי ראשוני לכל הפלטפורמה: כ־20 עד 80 אלף ₪."], technical: "re-estimate after supplier contracts\n+ exact languages + booking/payment policy\n+ redirect inventory + staffing + recovery objectives" },
];

const deliveryPhases = [
  ["01", "חוזי ספק ומודל קנוני", "2 עד 3 שבועות"],
  ["02", "תשתית, זהות, מסד, תורים וניטור", "4 עד 6 שבועות"],
  ["03", "VACATIONS, EVENTS ו־ROOMS VIP", "6 עד 10 שבועות"],
  ["04", "מערכת ניהול והגירת כתובות במקביל", "5 עד 8 שבועות"],
  ["05", "SPA דרך גל וספא פלוס", "4 עד 8 שבועות"],
  ["06", "ATTRACTIONS לאחר בחירת ספק", "4 עד 8 שבועות"],
  ["07", "עומס, אבטחה, שחזור והשקה מדורגת", "3 עד 5 שבועות"],
];

const openDecisionGroups = [
  { title: "ספקים וחוזים", items: "דוגמאות, סביבת בדיקות, מגבלות קצב, עימוד, Webhooks, זמינות, הזמנה, ביקורות, זכויות מדיה ושירות." },
  { title: "מוצר ושפות", items: "שפות השקה, עומק לוקליזציה, תשלום, ביטול, החזר, חיוב חוזר ושירות לקוחות." },
  { title: "ספקי טכנולוגיה", items: "חיפוש, אנליטיקה, ניטור, תרגום, תשלום, סודות והחלטה אם Redis נחוץ." },
  { title: "שרידות ופרטיות", items: "יעדי זמן ואובדן מידע, אזור משני, מועד מסד גלובלי, שמירת נתונים ודרישות בכל מדינת יעד." },
];

const ARCHITECTURE_WIDTH = 1672;
const ARCHITECTURE_HEIGHT = 941;
const architecturePercent = (value: number, total: number) => `${((value / total) * 100).toFixed(4)}%`;
const architectureAngle = (deltaY: number, deltaX: number) => `${(Math.atan2(deltaY, deltaX) * (180 / Math.PI)).toFixed(4)}deg`;

const architectureHotspots: ArchitectureHotspot[] = [
  { id: "sergey", label: "SERGEY API", x: 108, y: 24, width: 205, height: 126, target: { type: "node", id: "sergey" } },
  { id: "spaplus", label: "SPA PLUS API", x: 435, y: 22, width: 205, height: 128, target: { type: "node", id: "spaplus" } },
  { id: "attractions-api", label: "ATTRACTIONS API", x: 980, y: 22, width: 214, height: 128, target: { type: "node", id: "attractions-api" } },
  { id: "future", label: "FUTURE APIs", x: 1327, y: 24, width: 206, height: 126, target: { type: "node", id: "future" } },
  { id: "vii-core", label: "VII CORE", x: 735, y: 184, width: 193, height: 108, target: { type: "insight", id: "decision-owner" } },
  { id: "edge", label: "EDGE + CDN", x: 450, y: 282, width: 109, height: 91, target: { type: "node", id: "edge" } },
  { id: "typescript", label: "TYPESCRIPT", x: 559, y: 282, width: 109, height: 91, target: { type: "tech", id: "typescript" } },
  { id: "gateway", label: "API GATEWAY", x: 669, y: 282, width: 117, height: 91, target: { type: "node", id: "gateway" } },
  { id: "database", label: "AURORA DB", x: 790, y: 282, width: 118, height: 91, target: { type: "node", id: "database" } },
  { id: "cache", label: "SMART CACHE", x: 910, y: 282, width: 108, height: 91, target: { type: "node", id: "cache" } },
  { id: "search", label: "SEARCH", x: 1021, y: 282, width: 118, height: 91, target: { type: "node", id: "search" } },
  { id: "canonical", label: "CANONICAL DATA HUB", x: 669, y: 383, width: 307, height: 131, target: { type: "insight", id: "infra-data-layers" } },
  { id: "cms", label: "CMS + ADMIN", x: 389, y: 377, width: 139, height: 80, target: { type: "node", id: "cms" } },
  { id: "media", label: "MEDIA PIPELINE", x: 389, y: 457, width: 139, height: 84, target: { type: "node", id: "media" } },
  { id: "queues", label: "QUEUES + WORKERS", x: 1078, y: 377, width: 142, height: 80, target: { type: "node", id: "queues" } },
  { id: "security", label: "SECURITY", x: 1078, y: 457, width: 142, height: 84, target: { type: "node", id: "security" } },
  { id: "analytics", label: "EVENT STREAM", x: 494, y: 509, width: 139, height: 89, target: { type: "node", id: "analytics" } },
  { id: "replicas", label: "REDUNDANT REPLICAS", x: 632, y: 508, width: 300, height: 99, target: { type: "insight", id: "decision-topology" } },
  { id: "seo", label: "SEO + REDIRECTS", x: 973, y: 509, width: 142, height: 89, target: { type: "node", id: "seo" } },
  { id: "monitoring", label: "MONITORING + OBSERVABILITY", x: 478, y: 610, width: 443, height: 46, target: { type: "insight", id: "monitor-release" } },
  { id: "security-layer", label: "SECURITY LAYER", x: 918, y: 610, width: 236, height: 46, target: { type: "node", id: "security" } },
  { id: "suppliers", label: "SUPPLIERS", x: 563, y: 666, width: 126, height: 101, target: { type: "node", id: "suppliers" } },
  { id: "trips", label: "TRIPS", x: 686, y: 666, width: 122, height: 101, target: { type: "node", id: "trips" } },
  { id: "magazine", label: "MAGAZINE", x: 806, y: 666, width: 129, height: 101, target: { type: "node", id: "magazine" } },
  { id: "content", label: "CONTENT", x: 928, y: 666, width: 130, height: 101, target: { type: "node", id: "shared-surfaces" } },
  { id: "web", label: "FAST WEB", x: 377, y: 792, width: 177, height: 118, target: { type: "node", id: "web" } },
  { id: "ios", label: "iOS APP", x: 748, y: 792, width: 177, height: 118, target: { type: "node", id: "ios" } },
  { id: "android", label: "ANDROID APP", x: 1107, y: 792, width: 177, height: 118, target: { type: "node", id: "android" } },
  { id: "legend", label: "LEGEND", x: 14, y: 483, width: 196, height: 387, target: { type: "insight", id: "decision-current" } },
  { id: "vii-owns", label: "VII OWNS", x: 1407, y: 482, width: 252, height: 370, target: { type: "insight", id: "decision-owner" } },
];

const architectureBeams = [
  { id: "sergey-hub", from: [207, 180], to: [818, 448], delay: "-1.4s", returnable: true, nodes: ["sergey", "typescript", "gateway", "canonical"] },
  { id: "spa-hub", from: [538, 160], to: [818, 448], delay: "-3.1s", returnable: true, nodes: ["spaplus", "gateway", "canonical"] },
  { id: "attractions-hub", from: [1088, 160], to: [844, 448], delay: "-4.6s", returnable: true, nodes: ["attractions-api", "gateway", "canonical"] },
  { id: "future-hub", from: [1430, 180], to: [844, 448], delay: "-6.2s", returnable: true, nodes: ["future", "gateway", "canonical"] },
  { id: "hub-web", from: [810, 506], to: [467, 830], delay: "-2.3s", returnable: false, nodes: ["canonical", "media", "search", "web"] },
  { id: "hub-ios", from: [824, 506], to: [838, 830], delay: "-4.2s", returnable: false, nodes: ["canonical", "ios"] },
  { id: "hub-android", from: [838, 506], to: [1195, 830], delay: "-5.4s", returnable: false, nodes: ["canonical", "android"] },
];

const architectureScenarios: Record<ArchitectureScenarioId, { label: string; eyebrow: string; description: string; complete: string; steps: ArchitectureScenarioStep[] }> = {
  sync: {
    label: "עדכון תמונה",
    eyebrow: "SUPPLIER UPDATE",
    description: "הדמיה של שינוי תמונה אצל סרגיי עד לרענון הדף באתר.",
    complete: "ההדמיה הסתיימה. במערכת האמיתית נדרש חיבור ספק פעיל, מאומת ומנוטר.",
    steps: [
      { hotspotId: "sergey", title: "הספק מדווח על שינוי", detail: "מטען הדגמה התקבל מסרגיי. הוא עדיין לא נחשב מידע תקין או מאושר לפרסום." },
      { hotspotId: "typescript", title: "מתאם הספק מתרגם את המבנה", detail: "המזהים, זכויות המדיה, סדר התמונות וגרסת המקור ממופים לחוזה האחיד של VII." },
      { hotspotId: "gateway", title: "שער הכניסה מאמת ומגביל", detail: "חתימה, גרסת סכימה, גודל קובץ והרשאת הספק נבדקים לפני המשך התהליך." },
      { hotspotId: "canonical", title: "המודל הקנוני מתעדכן", detail: "המקור הגולמי נשמר, השדה המשותף מתעדכן ושכבת העריכה של VII נשארת מוגנת." },
      { hotspotId: "media", title: "המדיה עוברת עיבוד בטוח", detail: "בדיקת קובץ, גיבוב, גדלים מותאמים, פורמטים מהירים ותיעוד זכויות." },
      { hotspotId: "search", title: "החיפוש והמטמון מתרעננים", detail: "האינדקס מקבל את הגרסה החדשה ורק המפתחות שנפגעו מפונים מהמטמון." },
      { hotspotId: "web", title: "העמוד החדש מוגש לגולש", detail: "האתר נשאר מהיר ומציג את הגרסה שאושרה, בלי להמתין בכל צפייה לספק החיצוני." },
    ],
  },
  availability: {
    label: "בדיקת זמינות",
    eyebrow: "FRESH AVAILABILITY",
    description: "הדמיה של בדיקה טרייה שאינה הופכת מטמון לאישור הזמנה.",
    complete: "ההדמיה הסתיימה. אישור סופי יתקבל רק מתשובה טרייה ומחוזה ספק שנבדק מקצה לקצה.",
    steps: [
      { hotspotId: "web", title: "הגולש בוחר תאריכים", detail: "האתר שולח מזהה מקום, יחידה, תאריכים והרכב אורחים, בלי מידע עודף." },
      { hotspotId: "gateway", title: "הבקשה עוברת במסלול טרי", detail: "המערכת מאמתת הרשאה, מאחדת בקשות זהות לזמן קצר ומונעת הצפה." },
      { hotspotId: "sergey", title: "סרגיי נשאל על הזמינות", detail: "ההדמיה מחכה לתשובה טרייה. נתון ישן יכול לסייע לגילוי, אך אינו מאשר הזמנה." },
      { hotspotId: "gateway", title: "המחיר והתנאים נבדקים", detail: "המטבע, העמלות, מגבלת הלילות ותוקף ההצעה עוברים אימות חוזה." },
      { hotspotId: "web", title: "מוצגת תשובה מפורשת", detail: "זמין, לא זמין או לא ניתן לאישור. המערכת לעולם אינה ממציאה הצלחה." },
    ],
  },
  outage: {
    label: "ספק לא מגיב",
    eyebrow: "SAFE FAILURE",
    description: "הדמיה של תקלה אצל ספק בלי להפיל את הקטלוג ואת שאר העולמות.",
    complete: "ההדמיה הסתיימה. הקטלוג נשאר זמין לפי מדיניות, אך זמינות והזמנה אינן מאושרות בלי הספק.",
    steps: [
      { hotspotId: "sergey", title: "הספק חורג מזמן התגובה", detail: "הבקשה נעצרת בזמן קצוב ואינה משאירה את הגולש מול מסך ממתין ללא סוף." },
      { hotspotId: "security", title: "הניטור מזהה ומקבץ", detail: "הכשל מקושר לעולם, לספק ולגרסה ונשלחת התראה אחת שימושית במקום סערת הודעות." },
      { hotspotId: "queues", title: "פעולות כתיבה נשמרות בבטחה", detail: "פעולה מורשית מקבלת מזהה קבוע ותור כשל. אין ניסיון עיוור שעלול ליצור כפילות." },
      { hotspotId: "canonical", title: "הקטלוג המקומי נשאר פעיל", detail: "השם, התמונות והתוכן המאושרים מוגשים מהמקור המקומי בלי לפגוע בעולמות אחרים." },
      { hotspotId: "web", title: "האתר מסביר מה אפשר לעשות", detail: "הקטלוג זמין, אך זמינות חדשה מסומנת כלא ניתנת לאישור ומוצע מסלול בטוח להמשך." },
    ],
  },
};

function NodeButton({ node, selected, onSelect }: { node: PlatformNode; selected: boolean; onSelect: (node: PlatformNode) => void }) {
  return (
    <button
      type="button"
      className={`${styles.node} ${styles[`node_${node.kind}`]} ${selected ? styles.nodeSelected : ""}`}
      onClick={() => onSelect(node)}
      aria-pressed={selected}
      aria-haspopup="dialog"
      aria-controls="platform-detail-dialog"
    >
      <span className={styles.nodeIcon} aria-hidden="true">{node.icon}</span>
      <span className={styles.nodeCopy}>
        <span className={styles.nodeEyebrow}>{node.eyebrow}</span>
        <strong dir="ltr">{node.title}</strong>
        <span>{node.summary}</span>
      </span>
      <span className={styles.nodeArrow} aria-hidden="true">←</span>
    </button>
  );
}

function DecisionBadge({ decision }: { decision: DecisionStatus }) {
  return <span className={`${styles.decisionBadge} ${styles[`decision_${decision}`]}`}>{decisionLabels[decision]}</span>;
}

function InsightButton({ item, onSelect }: { item: InsightCard; onSelect: (item: InsightCard) => void }) {
  return (
    <button type="button" className={styles.insightCard} onClick={() => onSelect(item)} aria-haspopup="dialog" aria-controls="platform-detail-dialog">
      <span className={styles.insightTopline}>
        <span dir="ltr">{item.eyebrow}</span>
        <DecisionBadge decision={item.decision} />
      </span>
      <b>{item.title}</b>
      <p>{item.summary}</p>
      <i aria-hidden="true">פתחו הסבר ודוגמה טכנית ←</i>
    </button>
  );
}

function InteractiveArchitecture({
  onSelectNode,
  onSelectTech,
  onSelectInsight,
}: {
  onSelectNode: (node: PlatformNode) => void;
  onSelectTech: (tech: TechChoice) => void;
  onSelectInsight: (item: InsightCard) => void;
}) {
  const [selectedHotspotId, setSelectedHotspotId] = useState("canonical");
  const [simulationMode, setSimulationMode] = useState<ArchitectureScenarioId>("sync");
  const [simulationStep, setSimulationStep] = useState(-1);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simulationComplete, setSimulationComplete] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const scenario = architectureScenarios[simulationMode];
  const activeStep = simulationStep >= 0 ? scenario.steps[simulationStep] : null;
  const activeHotspotId = activeStep?.hotspotId ?? selectedHotspotId;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);
    return () => mediaQuery.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const mobileQuery = window.matchMedia("(max-width: 760px)");
    let frame = 0;
    const alignViewport = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        viewport.scrollLeft = mobileQuery.matches ? Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2) : 0;
      });
    };
    alignViewport();
    mobileQuery.addEventListener("change", alignViewport);
    window.addEventListener("orientationchange", alignViewport);
    return () => {
      cancelAnimationFrame(frame);
      mobileQuery.removeEventListener("change", alignViewport);
      window.removeEventListener("orientationchange", alignViewport);
    };
  }, []);

  useEffect(() => {
    if (!simulationRunning || simulationStep < 0) return;
    const timer = window.setTimeout(() => {
      if (simulationStep >= scenario.steps.length - 1) {
        setSimulationRunning(false);
        setSimulationComplete(true);
        return;
      }
      setSimulationStep((step) => step + 1);
    }, prefersReducedMotion ? 850 : 1350);
    return () => window.clearTimeout(timer);
  }, [prefersReducedMotion, scenario.steps.length, simulationRunning, simulationStep]);

  function chooseScenario(nextMode: ArchitectureScenarioId) {
    setSimulationMode(nextMode);
    setSimulationStep(-1);
    setSimulationRunning(false);
    setSimulationComplete(false);
    setSelectedHotspotId(architectureScenarios[nextMode].steps[0].hotspotId);
  }

  function toggleSimulation() {
    if (simulationRunning) {
      setSimulationRunning(false);
      return;
    }
    if (simulationStep < 0 || simulationComplete) {
      setSimulationStep(0);
      setSimulationComplete(false);
    }
    setSimulationRunning(true);
  }

  function resetSimulation() {
    setSimulationStep(-1);
    setSimulationRunning(false);
    setSimulationComplete(false);
    setSelectedHotspotId(scenario.steps[0].hotspotId);
  }

  function selectHotspot(hotspot: ArchitectureHotspot) {
    setSelectedHotspotId(hotspot.id);
    setSimulationRunning(false);
    setSimulationStep(-1);
    setSimulationComplete(false);
    const allNodes = [...worlds, ...providers, ...core, ...outputs];
    const allInsights = [...decisionSnapshot, ...infrastructureInsights, ...monitoringInsights, ...failureInsights, ...hilatInsights];
    if (hotspot.target.type === "node") {
      const node = allNodes.find((item) => item.id === hotspot.target.id);
      if (node) onSelectNode(node);
      return;
    }
    if (hotspot.target.type === "tech") {
      const tech = techStack.find((item) => item.id === hotspot.target.id);
      if (tech) onSelectTech(tech);
      return;
    }
    const insight = allInsights.find((item) => item.id === hotspot.target.id);
    if (insight) onSelectInsight(insight);
  }

  const currentStatusTitle = activeStep?.title ?? (simulationComplete ? "התרחיש הסתיים" : "המערכת מוכנה להדגמה");
  const currentStatusDetail = activeStep?.detail ?? (simulationComplete ? scenario.complete : scenario.description);
  const simulationButtonLabel = simulationRunning
    ? "עצירת התרחיש"
    : simulationComplete
      ? "הרצה מחדש"
      : simulationStep >= 0
        ? "המשך התרחיש"
        : "הפעלת התרחיש";

  return (
    <div className={styles.interactiveArchitecture}>
      <div className={styles.architectureConsole}>
        <div>
          <span className={styles.architectureConsoleTitle} dir="ltr">VII INTERACTIVE SYSTEM</span>
          <span className={styles.architectureDemoBadge}><i aria-hidden="true" />הדמיית ארכיטקטורה</span>
          <p>זהו אבטיפוס לחיץ של המערכת שנבנה, לא נתוני ייצור חיים ולא הוכחה שחיבור ספק כבר פעיל.</p>
        </div>
        <button
          type="button"
          onClick={() => setMotionPaused((paused) => !paused)}
          aria-pressed={motionPaused || prefersReducedMotion}
          disabled={prefersReducedMotion}
        >
          {prefersReducedMotion ? "התנועה מושהית לפי הגדרות המכשיר" : motionPaused ? "הפעלת התנועה" : "עצירת התנועה"}
        </button>
      </div>

      <div ref={viewportRef} className={styles.architectureViewport} tabIndex={0} aria-label="תרשים ארכיטקטורה אינטראקטיבי. בנייד אפשר להחליק לצדדים וללחוץ על כל אזור זוהר.">
        <div
          className={styles.architectureStage}
          data-motion={motionPaused || prefersReducedMotion ? "paused" : "running"}
          data-scenario={simulationStep >= 0 ? simulationMode : "idle"}
        >
          <picture>
            <source srcSet="/platform-architecture-overview.avif" type="image/avif" />
            <source srcSet="/platform-architecture-overview.webp" type="image/webp" />
            <img src="/platform-architecture-overview.png" alt="המחשה של ארכיטקטורת היעד של VII, מידע מלא נכנס מספקים ולפי החוזה הזמנות וחוות דעת חוזרות לספק המתאים" width="1672" height="941" loading="lazy" decoding="async" />
          </picture>
          <span className={styles.architectureScan} aria-hidden="true" />
          <span className={styles.architectureCorePulse} aria-hidden="true" />
          <div className={styles.architectureFlowLayer} aria-hidden="true">
            {architectureBeams.map((beam) => {
              const deltaX = beam.to[0] - beam.from[0];
              const deltaY = beam.to[1] - beam.from[1];
              const beamStyle = {
                left: architecturePercent(beam.from[0], ARCHITECTURE_WIDTH),
                top: architecturePercent(beam.from[1], ARCHITECTURE_HEIGHT),
                width: architecturePercent(Math.hypot(deltaX, deltaY), ARCHITECTURE_WIDTH),
                "--beam-angle": architectureAngle(deltaY, deltaX),
                "--beam-delay": beam.delay,
              } as CSSProperties;
              return (
                <span key={beam.id} className={styles.architectureFlowBeam} style={beamStyle} data-active={beam.nodes.includes(activeHotspotId) ? "true" : "false"}>
                  <span className={styles.architectureBeamParticle} />
                  {beam.returnable && <span className={styles.architectureReturnParticle} />}
                </span>
              );
            })}
          </div>
          <div className={styles.architectureHotspotLayer}>
            {architectureHotspots.map((hotspot) => {
              const hotspotStyle = {
                left: architecturePercent(hotspot.x, ARCHITECTURE_WIDTH),
                top: architecturePercent(hotspot.y, ARCHITECTURE_HEIGHT),
                width: architecturePercent(hotspot.width, ARCHITECTURE_WIDTH),
                height: architecturePercent(hotspot.height, ARCHITECTURE_HEIGHT),
              } as CSSProperties;
              return (
                <button
                  key={hotspot.id}
                  type="button"
                  className={styles.architectureHotspot}
                  style={hotspotStyle}
                  data-active={activeHotspotId === hotspot.id ? "true" : "false"}
                  onClick={() => selectHotspot(hotspot)}
                  aria-label={`פתיחת הסבר על ${hotspot.label}`}
                  aria-haspopup="dialog"
                  aria-controls="platform-detail-dialog"
                >
                  <span dir={hotspot.direction ?? "ltr"}>{hotspot.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <p className={styles.architectureMobileHint}>החליקו לצדדים על התרשים, ואז לחצו על אזור זוהר לקבלת הסבר.</p>

      <div className={styles.architectureScenarioPanel}>
        <div className={styles.architectureScenarioIntro}>
          <span dir="ltr">LIVE FLOW LAB</span>
          <h3>הפעילו תרחיש וראו את המערכת חושבת</h3>
          <p>כל שלב מדגיש את האזור הרלוונטי ומסביר מה אמור לקרות בליבה האמיתית.</p>
        </div>
        <div className={styles.architectureScenarioChoices} role="group" aria-label="בחירת תרחיש הדמיה">
          {(Object.entries(architectureScenarios) as [ArchitectureScenarioId, typeof architectureScenarios[ArchitectureScenarioId]][]).map(([id, item]) => (
            <button key={id} type="button" onClick={() => chooseScenario(id)} aria-pressed={simulationMode === id}>
              <span dir="ltr">{item.eyebrow}</span>
              <b>{item.label}</b>
            </button>
          ))}
        </div>
        <div className={styles.architectureScenarioStatus} aria-live="polite" aria-atomic="true">
          <span>{simulationStep >= 0 ? `שלב ${simulationStep + 1} מתוך ${scenario.steps.length}` : "מוכן"}</span>
          <b>{currentStatusTitle}</b>
          <p>{currentStatusDetail}</p>
          <div>
            <button type="button" className={styles.architectureRunButton} onClick={toggleSimulation}>{simulationButtonLabel}</button>
            <button type="button" className={styles.architectureResetButton} onClick={resetSimulation} disabled={simulationStep < 0 && !simulationComplete}>איפוס</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlatformExplorer() {
  const [selectedNode, setSelectedNode] = useState<PlatformNode | null>(null);
  const [selectedTech, setSelectedTech] = useState<TechChoice | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<InsightCard | null>(null);
  const [activeLayer, setActiveLayer] = useState<"all" | NodeKind>("all");
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const modalOpen = Boolean(selectedNode || selectedTech || selectedInsight);
  const isVisible = (kind: NodeKind) => activeLayer === "all" || activeLayer === kind;

  function selectNode(node: PlatformNode) {
    setSelectedTech(null);
    setSelectedInsight(null);
    setSelectedNode(node);
  }

  function selectTech(tech: TechChoice) {
    setSelectedNode(null);
    setSelectedInsight(null);
    setSelectedTech(tech);
  }

  function selectInsight(item: InsightCard) {
    setSelectedNode(null);
    setSelectedTech(null);
    setSelectedInsight(item);
  }

  function closeModal() {
    setSelectedNode(null);
    setSelectedTech(null);
    setSelectedInsight(null);
  }

  useEffect(() => {
    if (!modalOpen) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousScrollY = window.scrollY;
    const previousOverflow = document.body.style.overflow;
    const previousPosition = document.body.style.position;
    const previousTop = document.body.style.top;
    const previousWidth = document.body.style.width;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${previousScrollY}px`;
    document.body.style.width = "100%";
    (dialogRef.current?.querySelector<HTMLElement>("button") ?? dialogRef.current)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')).filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.position = previousPosition;
      document.body.style.top = previousTop;
      document.body.style.width = previousWidth;
      previousFocusRef.current?.focus({ preventScroll: true });
      window.scrollTo(0, previousScrollY);
    };
  }, [modalOpen]);

  return (
    <>
      <header className={styles.hero}>
        <nav className={styles.topbar} aria-label="ניווט מפת המערכת">
          <Link href="/" className={styles.brand} aria-label="VII, חזרה לאתר">
            <img src="/vii-logo.png" alt="וי פור ויקיישן" width="160" height="122" />
            <span>PLATFORM BLUEPRINT</span>
          </Link>
          <a className={styles.topAction} href="#platform-map">לתרשים הלחיץ</a>
        </nav>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <span className={styles.kicker}>ONE PLATFORM. MANY WORLDS.</span>
            <h1>המנוע של <b dir="ltr">VII</b></h1>
            <p>זהו התכנון המאושר למערכת־העל של VII: כל העולמות, הספקים ומוצרי הקצה מתחברים לליבה אחת מהירה, מודולרית ובבעלותנו.</p>
            <div className={styles.heroTruth}>
              <DecisionBadge decision="current" />
              <p><b>מה קיים היום:</b> הפרונט והמסביר הציבורי. מסד Aurora, ממשקי הספקים, מערכת הניהול המלאה, הניטור וההתאוששות עדיין אינם תשתית פעילה ומאומתת.</p>
            </div>
            <div className={styles.heroStats} aria-label="עקרונות המערכת">
              <span><b>8</b> עולמות</span>
              <span><b>1</b> מודל קנוני</span>
              <span><b>✓</b> כל עולם מבודד</span>
            </div>
          </div>
          <div className={styles.orbit} aria-label="כל עולמות VII">
            <span className={styles.orbitRing} />
            <span className={styles.orbitCore}><img src="/vii-logo.png" alt="" width="160" height="122" /><small>VII CORE</small></span>
            {worlds.map((world, index) => <button type="button" key={world.id} className={`${styles.orbitWorld} ${styles[`orbitWorld${index + 1}`]}`} onClick={() => selectNode(world)} aria-haspopup="dialog" aria-controls="platform-detail-dialog" dir="ltr">{world.title}</button>)}
          </div>
        </div>
      </header>

      <section className={styles.statusLegend} aria-label="מקרא סטטוס החלטות">
        <p>כל רכיב בעמוד מסומן לפי מצבו האמיתי:</p>
        <div>{(["approved", "target", "current", "open", "estimate"] as DecisionStatus[]).map((decision) => <DecisionBadge key={decision} decision={decision} />)}</div>
      </section>

      <section className={styles.decisionSection} aria-labelledby="decision-title">
        <div className={styles.sectionHeading}>
          <span>DECISION SNAPSHOT</span>
          <h2 id="decision-title">מה כבר הוחלט, מה היעד ומה עדיין פתוח</h2>
          <p>לחצו על כל החלטה לקבלת הסבר מלא ודוגמה טכנית. כך אף אפשרות פתוחה לא נראית בטעות כמו מערכת שכבר עובדת.</p>
        </div>
        <div className={styles.insightGrid}>{decisionSnapshot.map((item) => <InsightButton key={item.id} item={item} onSelect={selectInsight} />)}</div>
      </section>

      <section className={styles.visualSection} aria-labelledby="visual-title">
        <div className={styles.sectionHeading}>
          <span>THE BIG PICTURE</span>
          <h2 id="visual-title">התמונה המלאה, במבט אחד</h2>
          <p>המידע נכנס מהספקים ונשמר אצל VII. זמינות נבדקת בזמן אמת, והזמנות וחוות דעת חוזרות לספק הנכון דרך מנגנון כתיבה בטוח.</p>
        </div>
        <figure className={styles.architectureFigure}>
          <InteractiveArchitecture onSelectNode={selectNode} onSelectTech={selectTech} onSelectInsight={selectInsight} />
          <div className={styles.architectureTextFlow} aria-label="חלופה טקסטואלית מקוצרת לתרשים">
            <span><b>ספקים</b><small>סרגיי · ספא פלוס · אטרקציות בעתיד</small></span>
            <i aria-hidden="true">↓</i>
            <span><b>ליבת VII</b><small>קליטה · נתונים · חיפוש · ניהול · הזמנות</small></span>
            <i aria-hidden="true">↓</i>
            <span><b>מוצרי VII</b><small>אתר מהיר · ניהול · אפליקציות בעתיד</small></span>
          </div>
          <figcaption>המחשת ארכיטקטורת יעד אינטראקטיבית. לחצו על כל אזור או הפעילו תרחיש כדי להבין את הזרימה. המפה הלחיצה שבהמשך היא הרשימה המלאה והעדכנית של שמונת העולמות. זהו תרשים תכנוני, לא צילום של תשתית פעילה ולא אישור שחיבורי הספקים כבר עלו לאוויר.</figcaption>
        </figure>
      </section>

      <section className={styles.hilatCaseStudy} aria-labelledby="hilat-case-title">
        <div className={styles.sectionHeading}>
          <span>REAL VII CASE STUDY</span>
          <h2 id="hilat-case-title">הילת הנוף, ממקור נתונים לעמוד אמיתי ב־VII</h2>
          <p>זו אינה וילת הדגמה. הנתונים והתמונות שבתצוגה נבדקו בדף הילת הנוף ובמקור ההגירה הקיים. החיבור לסרגיי עדיין אינו פעיל, ולכן מבנה הממשק שמוצג כאן הוא חוזה מוצע לאישורו.</p>
        </div>

        <div className={styles.hilatTruthStrip} aria-label="מקורות ומצב הדוגמה">
          <article><DecisionBadge decision="current" /><div><b>עמוד VII חי</b><p>הדף החדש קיים ופועל באתר שאנו בונים.</p></div></article>
          <article><span className={styles.hilatSourceMark}>V</span><div><b>מקור שנבדק</b><p>המקור הישן, הקוד המקומי והעמוד החי.</p></div></article>
          <article><DecisionBadge decision="target" /><div><b>חוזה סרגיי מוצע</b><p>שדות, כתובות ופעולות שמחכים לדוגמה ולאישור.</p></div></article>
        </div>

        <div className={styles.hilatJourney} aria-label="מסלול הילת הנוף ממערכת סרגיי לעמוד VII">
          <article className={styles.hilatSupplierPanel}>
            <div className={styles.hilatPanelTopline}><span dir="ltr">SERGEY SYSTEM</span><DecisionBadge decision="target" /></div>
            <h3>רשומת המקום שנדרוש מסרגיי</h3>
            <p>משיכה מלאה ראשונה, אחריה עדכוני דלתא או Webhook והשלמה מחזורית.</p>
            <pre dir="ltr"><code>{`GET /v1/venues/{supplierVenueId}
?include=content,media,units,policies

{
  "name": "הילת הנוף",
  "status": "active",
  "location": { ... },
  "media": [ ... ],
  "units": [ ... ],
  "amenities": [ ... ],
  "policies": { ... },
  "sourceUpdatedAt": "..."
}`}</code></pre>
            <button type="button" onClick={() => selectInsight(hilatInsights[0])} aria-haspopup="dialog" aria-controls="platform-detail-dialog">פתחו את חוזה הזהות והתוכן</button>
            <a href="https://www.vii.co.il/hilat_hanof" target="_blank" rel="noopener noreferrer" aria-label="פתיחת מקור ההגירה של הילת הנוף בחלון חדש">מקור ההגירה שנבדק, בחלון חדש</a>
          </article>

          <i className={styles.hilatJourneyArrow} aria-hidden="true">←</i>

          <article className={styles.hilatCorePanel}>
            <div className={styles.hilatPanelTopline}><span dir="ltr">VII DATA CORE</span><DecisionBadge decision="approved" /></div>
            <h3>VII שומרת, בודקת ומחליטה מה לפרסם</h3>
            <ol>
              <li><span>01</span><div><b dir="ltr">RAW SNAPSHOT</b><p>המקור המדויק שקיבלנו, כולל גרסה וזמן.</p></div></li>
              <li><span>02</span><div><b dir="ltr">CANONICAL PLACE</b><p>מקום, יחידות, מדיה ומדיניות במבנה אחיד.</p></div></li>
              <li><span>03</span><div><b dir="ltr">VII OVERLAY</b><p>עריכה, שפות, קידום, סדר מדיה ופרסום.</p></div></li>
            </ol>
            <div className={styles.hilatValidation}>
              <strong>בדיקת עקביות אמיתית</strong>
              <p>הסיכום הנוכחי מציג ארבעה חדרי שינה, אך פירוט ארבע היחידות מכיל אחד, אחד, אחד ושניים. מערכת הקליטה לא מפרסמת סתירה כזאת אוטומטית, אלא מחשבת מחדש או מעבירה לבדיקה.</p>
            </div>
            <button type="button" onClick={() => selectInsight(hilatInsights[6])} aria-haspopup="dialog" aria-controls="platform-detail-dialog">מה נשמר בבעלות VII</button>
          </article>

          <i className={styles.hilatJourneyArrow} aria-hidden="true">←</i>

          <article className={styles.hilatPagePanel}>
            <div className={styles.hilatBrowserBar}><span aria-hidden="true"><i /><i /><i /></span><b dir="ltr">vii.spaplus.co</b></div>
            <div className={styles.hilatMiniHeader}><img src="/vii-logo.png" alt="וי פור ויקיישן" width="160" height="122" /><span>נופש</span><span>בחירת עולם</span></div>
            <div className={styles.hilatMiniTitle}><small>מתחם בקתות עץ · נופש ולינה</small><h3>הילת הנוף</h3><p>כלנית, סובב כנרת</p></div>
            <div className={styles.hilatMiniActions}><span>שמירה</span><span>שיתוף</span><span>הצגת מספר</span><span>פנייה בוואטסאפ</span></div>
            <div className={styles.hilatMiniGallery}>
              <img src="/media/hilat-hanof/87686399e3d2342.jpg" alt="בריכת השחייה והנוף בהילת הנוף" width="1027" height="687" />
              <img src="/media/hilat-hanof/495f7c268eb4431.jpeg" alt="ג׳קוזי ביחידת אירוח בהילת הנוף" width="1024" height="683" />
              <img src="/media/hilat-hanof/845f7c268dc8ca2.jpeg" alt="יחידת אירוח בהילת הנוף" width="1024" height="683" />
              <span>לגלריה המלאה</span>
            </div>
            <div className={styles.hilatMiniStats}><span><b>25</b> אורחים</span><span><b>4</b> יחידות</span><span><b>4</b> בקתות</span><span><b>180</b> חוות דעת</span></div>
            <div className={styles.hilatMiniUnits}><span>בקתה 1 · עד 6</span><span>בקתה 2 · עד 6</span><span>בקתה 3 · עד 6</span><span>בקתה 4 · עד 7</span></div>
            <a className={styles.hilatLiveLink} href="/business?id=hilat-hanof" target="_blank" rel="noopener noreferrer" aria-label="פתיחת עמוד הילת הנוף החי באתר VII בחלון חדש">פתחו את עמוד הילת הנוף החי</a>
            <small className={styles.hilatPreviewCaption}>שחזור מוקטן מתוך רכיבי העמוד החי, עם מדיה ונתונים ממקור VII הקיים.</small>
          </article>
        </div>

        <div className={styles.hilatFieldHeading}>
          <div><span dir="ltr">FIELD BY FIELD</span><h3>כל מה שמופיע בעמוד, ומאיפה הוא מגיע</h3></div>
          <p>לחצו על כל רכיב כדי לראות את השדות, דרך השמירה והדוגמה הטכנית.</p>
        </div>
        <div className={styles.hilatComponentGrid}>
          {hilatPageComponents.map(([label, insightId], index) => {
            const insight = hilatInsights.find((item) => item.id === insightId)!;
            return <button type="button" key={label} onClick={() => selectInsight(insight)} aria-haspopup="dialog" aria-controls="platform-detail-dialog">
              <span>{String(index + 1).padStart(2, "0")}</span><b>{label}</b><small>{insight.eyebrow}</small><i aria-hidden="true">←</i>
            </button>;
          })}
        </div>

        <div className={styles.hilatUpdateStory}>
          <div className={styles.hilatUpdateIntro}><DecisionBadge decision="target" /><h3>מה קורה כשסרגיי מחליף תמונה או משנה מבנה חדרים?</h3><p>הגולש אינו מחכה לסרגיי בכל פתיחת עמוד. השינוי עובר מסלול מבוקר ורק אז מגיע לאתר.</p></div>
          <ol>
            <li><span>1</span><b>שינוי בסרגיי</b><p>אירוע, דלתא או זיהוי בהשלמה.</p></li>
            <li><span>2</span><b>שמירת המקור</b><p>גרסה גולמית שאפשר לשחזר.</p></li>
            <li><span>3</span><b>אימות והשוואה</b><p>סכימה, מדיה, יחידות וסתירות.</p></li>
            <li><span>4</span><b>מיזוג לפי בעלות</b><p>שדות ספק מתעדכנים, עריכת VII נשמרת.</p></li>
            <li><span>5</span><b>רענון האתר</b><p>אינדקס, מטמון, מדיה ויומן שינוי.</p></li>
          </ol>
          <button type="button" onClick={() => selectInsight(hilatInsights[7])} aria-haspopup="dialog" aria-controls="platform-detail-dialog">פתחו את מסלול הסנכרון והכתיבה החוזרת</button>
        </div>

        <p className={styles.sectionNote}><DecisionBadge decision="current" /> הנתונים בדוגמה מקורם בעמוד ובמאגר VII הנוכחיים. הם אינם מוכיחים שהם הגיעו מסרגיי. רק דוגמת ממשק מאושרת ובדיקת קצה לקצה ישנו את הסטטוס לחיבור פעיל.</p>
      </section>

      <section className={styles.dataContract} aria-labelledby="data-contract-title">
        <div className={styles.sectionHeading}>
          <span>FULL PLACE DATA CONTRACT</span>
          <h2 id="data-contract-title">כן, שומרים אצלנו את כל המידע הדרוש על המקום</h2>
          <p>החוזה מול כל ספק חייב להגדיר במפורש את כל שדות העסק. VII אינה מסתפקת בשם ובמחיר, והיא גם אינה מציגה שדה שלא התקבל ואומת.</p>
        </div>
        <div className={styles.fieldCloud} aria-label="שדות מידע מלאים על מקום">
          {["PROVIDER ID", "NAME", "ABOUT", "DESCRIPTIONS", "ADDRESS", "GEO LOCATION", "IMAGES + ORDER", "MEDIA RIGHTS", "AMENITIES", "POLICIES", "UNITS", "ROOM STRUCTURE", "CAPACITY", "PRICES", "AVAILABILITY CAPABILITY", "OPENING HOURS", "TREATMENTS", "TICKETS", "SOURCE VERSION", "PUBLICATION STATUS"].map((field) => <span key={field} dir="ltr">{field}</span>)}
        </div>
        <div className={styles.storageGrid}>
          <article><span>01</span><b dir="ltr">RAW SUPPLIER SNAPSHOT</b><p>עותק בר־שחזור של מה שהספק שלח, עם סכימה, גרסה וזמן קליטה, לצורכי ביקורת והפעלה חוזרת.</p></article>
          <article><span>02</span><b dir="ltr">VII CANONICAL MODEL</b><p>זהות פנימית אחידה לכל מקום, יחידה ומוצר, עם מקור ובעלות לכל שדה.</p></article>
          <article><span>03</span><b dir="ltr">VII OWNED OVERLAY</b><p>עריכה, תרגום, קידום, מדיה, פרסום וכללים מקומיים שאינם נמחקים כשהספק משנה את הרשומה שלו.</p></article>
          <article><span>04</span><b dir="ltr">MEDIA OBJECT STORAGE</b><p>מקור המדיה, מזהה ספק, זכויות, checksum וגרסאות מהירות שמופצות דרך CDN.</p></article>
          <article><span>05</span><b dir="ltr">SEARCH INDEX + CACHE</b><p>עותקים נגזרים לחיפוש ולתצוגה מהירה, שתמיד אפשר לבנות מחדש מהמקור הקנוני.</p></article>
          <article><span>06</span><b dir="ltr">SYNC + AUDIT LEDGER</b><p>מי השתנה, מה התקבל, מה נדחה, מה נשלח, איזו גרסה פורסמה ומי הפעיל שחזור.</p></article>
        </div>
        <div className={styles.updateTimeline}>
          <div><span>1</span><b>סרגיי או גל משנים מידע</b><p>לדוגמה תמונה, טקסט, מחיר או מבנה חדרים.</p></div>
          <i aria-hidden="true">←</i>
          <div><span>2</span><b>מתקבל שינוי ונשמר מקור</b><p>Webhook או דלתא, ובנוסף סנכרון השלמה שמזהה שינוי שלא דווח או רשומה שנעלמה.</p></div>
          <i aria-hidden="true">←</i>
          <div><span>3</span><b>VII מאמתת או מעבירה להסגר</b><p>סכימה, שדות, גרסה ו־checksum. רשומה לא תקינה אינה מתפרסמת ונכנסת לטיפול.</p></div>
          <i aria-hidden="true">←</i>
          <div><span>4</span><b>ממזגים בלי למחוק את VII</b><p>שדות ספק מתעדכנים, שכבת העריכה והתרגומים נשמרות, ואז מתבצעים אינדוקס ופינוי מטמון.</p></div>
          <i aria-hidden="true">←</i>
          <div><span>5</span><b>הגרסה המאושרת מוצגת</b><p>האתר מציג את השינוי לאחר אימות ופרסום, בלי לקרוא מחדש את כל הספק בכל צפייה.</p></div>
        </div>
        <p className={styles.sectionNote}>כל פעולה חסינת כפילות. כשל נכנס לתור כשל עם סיבה, וניתן לבדוק ולהפעיל אותו מחדש ידנית בלי לאבד את המקור.</p>
      </section>

      <section className={styles.providerExamples} aria-labelledby="provider-examples-title">
        <div className={styles.sectionHeading}>
          <span>PROVIDER TO VII EXAMPLES</span>
          <h2 id="provider-examples-title">כך רשומת ספק הופכת לעמוד וכרטיס ב־VII</h2>
          <p>אלה דוגמאות סינתטיות ומדומות, לא נתוני ספק. הן אינן עסקים אמיתיים, המחירים אינם לשימוש עסקי, והן אינן הוכחה לחיבור פעיל.</p>
        </div>
        <div className={styles.exampleGrid}>
          {providerExamples.map((example, index) => <article key={`${example.provider}-${example.world}`}>
            <div className={styles.exampleSource}>
              <span className={styles.demoBadge}>דוגמה מדומה</span>
              <b dir="ltr">{example.provider}</b>
              <small dir="ltr">{example.world}</small>
              <code dir="ltr">{example.code}</code>
              <p>{example.fields}</p>
            </div>
            <i aria-hidden="true">←</i>
            <div className={styles.exampleCard}>
              <div className={`${styles.exampleImage} ${styles[`exampleImage${index + 1}`]}`}><span dir="ltr">VII</span></div>
              <small dir="ltr">{example.world}</small>
              <b>{example.title}</b>
              <p>{example.meta}</p>
              <small className={styles.demoPriceNote}>כל הנתונים והמחיר מדומים</small>
              <span>לצפייה בפרטי המקום</span>
            </div>
          </article>)}
        </div>
      </section>

      <section className={styles.infrastructureSection} aria-labelledby="infrastructure-title">
        <div className={styles.sectionHeading}>
          <span>THE ACTUAL SERVER PLAN</span>
          <h2 id="infrastructure-title">איזה שרת יהיה, ואיך הכל מתחבר</h2>
          <p>אין קופסה אחת שעליה יושב הכל. כל שכבה מקבלת תפקיד ברור, ושתי דרכי חיבור שונות שומרות על מהירות בלי לסכן הזמנה או הרשאה.</p>
        </div>
        <div className={styles.topology} aria-label="תרשים תשתית היעד של VII">
          <div className={styles.topologyNode}><small>USERS</small><b>אתר וממשק ניהול</b><span>מחשב · נייד · אפליקציות בעתיד</span></div>
          <i aria-hidden="true">←</i>
          <div className={`${styles.topologyNode} ${styles.topologyPrimary}`}><small>EDGE</small><b dir="ltr">CLOUDFLARE</b><span>הגנה · מטמון · קוד · הפניות</span></div>
          <i aria-hidden="true">←</i>
          <div className={styles.topologyNode}><small>VII API</small><b dir="ltr">TYPESCRIPT</b><span>מונולית מודולרי · חוזים בעלי גרסאות</span></div>
          <i aria-hidden="true">←</i>
          <div className={styles.topologySplit}>
            <span><small>CACHED</small><b>קטלוג</b></span>
            <span><small>FRESH</small><b>הזמנה והרשאה</b></span>
          </div>
          <i aria-hidden="true">←</i>
          <div className={styles.topologyNode}><small>PRIVATE PATH</small><b dir="ltr">HYPERDRIVE + TUNNEL</b><span>חיבור פרטי ומאגר חיבורים</span></div>
          <i aria-hidden="true">←</i>
          <div className={`${styles.topologyNode} ${styles.topologyDatabase}`}><small>APPROVED DB</small><b dir="ltr">AURORA POSTGRESQL</b><span>כותב וקורא בשני אזורי זמינות בישראל</span></div>
        </div>
        <p className={styles.topologyCaption}><DecisionBadge decision="target" /> החיבור הפרטי, התקרה וביצועי המעבר יאושרו רק לאחר הוכחת היתכנות, בדיקת עומס ותרגיל כשל.</p>
        <div className={styles.insightGrid}>{infrastructureInsights.map((item) => <InsightButton key={item.id} item={item} onSelect={selectInsight} />)}</div>
      </section>

      <section id="platform-map" className={styles.explorer} aria-labelledby="explorer-title">
        <div className={styles.sectionHeading}>
          <span>CLICK TO EXPLORE</span>
          <h2 id="explorer-title">לחצו על כל חלק וראו בדיוק איך הוא עובד</h2>
        </div>
        <div className={styles.layerFilters} aria-label="סינון שכבות">
          {([
            ["all", "הכל"], ["world", "העולמות"], ["provider", "ספקי מידע"], ["core", "ליבת VII"], ["output", "מוצרי קצה"],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" className={activeLayer === id ? styles.filterActive : ""} onClick={() => setActiveLayer(id)} aria-pressed={activeLayer === id}>{label}</button>
          ))}
        </div>

        <div className={styles.explorerGrid}>
          <div className={styles.nodeGroups}>
            {isVisible("world") && <section className={styles.nodeGroup} aria-labelledby="worlds-title"><div className={styles.groupTitle}><span>01</span><h3 id="worlds-title">OUR WORLDS</h3><small>מוצרים נפרדים, ליבה משותפת</small></div><div className={styles.worldGrid}>{worlds.map((node) => <NodeButton key={node.id} node={node} selected={selectedNode?.id === node.id} onSelect={selectNode} />)}</div></section>}
            {isVisible("provider") && <section className={styles.nodeGroup} aria-labelledby="providers-title"><div className={styles.groupTitle}><span>02</span><h3 id="providers-title">DATA PROVIDERS</h3><small>מספקים מידע, לא מחזיקים במוצר</small></div><div className={styles.nodeList}>{providers.map((node) => <NodeButton key={node.id} node={node} selected={selectedNode?.id === node.id} onSelect={selectNode} />)}</div></section>}
            {isVisible("core") && <section className={styles.nodeGroup} aria-labelledby="core-title"><div className={styles.groupTitle}><span>03</span><h3 id="core-title">VII CORE</h3><small>הקוד, הנתונים והשליטה של אדיר</small></div><div className={styles.coreGrid}>{core.map((node) => <NodeButton key={node.id} node={node} selected={selectedNode?.id === node.id} onSelect={selectNode} />)}</div></section>}
            {isVisible("output") && <section className={styles.nodeGroup} aria-labelledby="outputs-title"><div className={styles.groupTitle}><span>04</span><h3 id="outputs-title">PRODUCTS</h3><small>אתר עכשיו, אפליקציות בהמשך</small></div><div className={styles.nodeList}>{outputs.map((node) => <NodeButton key={node.id} node={node} selected={selectedNode?.id === node.id} onSelect={selectNode} />)}</div></section>}
          </div>
        </div>
      </section>

      <section className={styles.returnFlow} aria-labelledby="return-flow-title">
        <div className={styles.sectionHeading}>
          <span>TWO-WAY PROVIDER NETWORK</span>
          <h2 id="return-flow-title">המידע נכנס. העסקאות חוזרות.</h2>
          <p>כל ספק מקבל רק את הפעולות ששייכות לעולמות שלו, דרך תור מבוקר שמונע כפילויות ושומר היסטוריית מצב.</p>
        </div>
        <div className={styles.exchangeGrid}>
          <article><span className={styles.exchangeProvider}>SERGEY</span><div><b>DATA IN</b><p>VACATIONS · EVENTS · ROOMS VIP</p></div><i aria-hidden="true">⇄</i><div><b>DATA OUT</b><p>BOOKINGS · REVIEWS</p></div></article>
          <article><span className={styles.exchangeProvider}>SPA PLUS</span><div><b>DATA IN</b><p>SPA</p></div><i aria-hidden="true">⇄</i><div><b>DATA OUT</b><p>BOOKINGS · REVIEWS</p></div></article>
          <article><span className={styles.exchangeProvider}>ATTRACTIONS PROVIDER</span><div><b>DATA IN</b><p>ATTRACTIONS</p></div><i aria-hidden="true">⇄</i><div><b>DATA OUT</b><p>BOOKINGS ONLY</p></div><small>הספק טרם נבחר. כתיבת חוות דעת חזרה לא אושרה.</small></article>
        </div>
        <p className={styles.sectionNote}>הזמנה או חוות דעת נשלחת רק לפי חוזה ספק שעבר אימות. לכל פעולה מזהה מניעת כפילות קבוע, ומענה לא ברור נבדק לפני ניסיון נוסף.</p>
      </section>

      <section className={styles.commandCenter} aria-labelledby="command-title">
        <div className={styles.sectionHeading}>
          <span>THE VII COMMAND CENTER</span>
          <h2 id="command-title">מערכת־על שיודעת, מנהלת ומשפרת הכל</h2>
          <p>לחצו על יכולת כדי לפתוח את המנגנון שמאחוריה.</p>
        </div>
        <div className={styles.commandGrid}>
          {commandCenter.map((item) => {
            const node = core.find((entry) => entry.id === item.nodeId)!;
            return <button type="button" key={item.nodeId} onClick={() => selectNode(node)} aria-haspopup="dialog" aria-controls="platform-detail-dialog"><span dir="ltr">{item.label}</span><b>{item.title}</b><p>{item.copy}</p><i aria-hidden="true">←</i></button>;
          })}
        </div>
      </section>

      <section className={styles.adminSection} aria-labelledby="admin-title">
        <div className={styles.sectionHeading}>
          <span>ONE CONTROL PLANE</span>
          <h2 id="admin-title">מערכת הניהול של אדיר, לכל דבר שקורה ב־VII</h2>
          <p>אדיר נכנס עם חשבון גוגל כמנהל־על. כל עובד מקבל הרשאה מדויקת לפי תפקיד, עולם ופעולה, ורואה רק את העבודה והדוחות ששייכים לו.</p>
        </div>
        <div className={styles.adminIdentity}>
          <span className={styles.adminAvatar}>A</span>
          <div><small dir="ltr">GOOGLE SIGN-IN</small><b>אדיר, מנהל־על</b><p>גישה לכל העולמות, ההרשאות, הספקים, התוכן, ההזמנות, הדוחות והבקרות.</p></div>
          <span className={styles.adminPermission}>תפקיד + עולם + פעולה</span>
        </div>
        <div className={styles.adminModuleGrid}>
          <article><span>01</span><b>עולמות וספקים</b><p>הגדרות עולם, יכולות ממשק, בריאות, טריות, ריצות סנכרון, רשומות שנדחו, ניסיון חוזר והפעלה מחדש.</p></article>
          <article><span>02</span><b>מקומות ותוכן</b><p>מקור ובעלות לכל שדה, נעילות, חריגות VII, מדיה וזכויות, טיוטה, ביקורת, אישור, תזמון וארכיון.</p></article>
          <article><span>03</span><b>חיפוש וקידום</b><p>מילים נרדפות, קידום, החרגה, אבחון, אינדקס, כתובות, canonical, robots, schema, sitemap, קישורים והפניות.</p></article>
          <article><span>04</span><b>שפות ותרגומים</b><p>מקור, מילון, טיוטות מכונה, בדיקות, תור ביקורת, סטטוס לכל שפה וזיהוי תרגום שהתיישן.</p></article>
          <article><span>05</span><b>עסקאות ושירות</b><p>הזמנות, לידים, חוות דעת, לחיצות טלפון, שיחות, ביטולים ומצב כתיבה חוזרת לכל ספק.</p></article>
          <article><span>06</span><b>דוחות ותפעול</b><p>חשיפות, צפיות, חיפושים, המרות, זמני ספק, שגיאות, מטמון, פיגור תור, ייצוא והתראות לפי הרשאה.</p></article>
        </div>
        <div className={styles.adminStates} aria-label="מצבים שכל פעולת ניהול חייבת לתמוך בהם">
          {['טעינה', 'הצלחה', 'שגיאת אימות', 'אין הרשאה', 'פג תוקף החיבור', 'שירות לא זמין', 'שמירה', 'רענון', 'תצוגה מקדימה', 'פרסום', 'יומן שינוי', 'חזרה לאחור'].map((state) => <span key={state}>{state}</span>)}
        </div>
        <p className={styles.sectionNote}>שינוי נשמר רק אם הוא שורד רענון, יוצר יומן ביקורת ומופיע ביעד הטבעי לאחר פרסום. מערכת הניהול המלאה עדיין אינה מערכת ייצור מאומתת.</p>
      </section>

      <section className={styles.translationSection} aria-labelledby="translation-title">
        <div className={styles.sectionHeading}>
          <span>HEBREW TO EVERY LANGUAGE</span>
          <h2 id="translation-title">כך מידע שקיבלנו בעברית הופך לתוכן מקומי בשפות אחרות</h2>
          <p>לא מחליפים מקור בתרגום אוטומטי. שומרים גרסה, מתרגמים רק מה שהשתנה, בודקים ומפרסמים כל שפה בנפרד.</p>
        </div>
        <div className={`${styles.insightGrid} ${styles.pipelineGrid}`}>{translationInsights.map((item) => <InsightButton key={item.id} item={item} onSelect={selectInsight} />)}</div>
        <p className={styles.sectionNote}><DecisionBadge decision="open" /> רשימת שפות ההשקה, ספק התרגום ועומק הביקורת האנושית טרם נסגרו.</p>
      </section>

      <section className={styles.monitoringSection} aria-labelledby="monitoring-title">
        <div className={styles.sectionHeading}>
          <span>AUTOMATIC BUG DETECTION</span>
          <h2 id="monitoring-title">באג או תקלה לא מחכים שמישהו יספר לנו</h2>
          <p>כל גרסה, קריאת ספק, שאילתה, תור ופעולה עסקית משאירים עקבה. בדיקות אוטומטיות מגלות כשל, וההתראה מגיעה עם ההקשר שצריך כדי לפעול.</p>
        </div>
        <div className={styles.signalFlow} aria-label="מסלול זיהוי וטיפול בתקלה">
          <span><b>קוד וספקים</b><small>שגיאות · זמני תגובה · טריות</small></span><i aria-hidden="true">←</i>
          <span><b>לוגים ומדדים</b><small>עקבות · אירועים · סימון גרסה</small></span><i aria-hidden="true">←</i>
          <span><b>זיהוי</b><small>קיבוץ · סף · בדיקה סינתטית</small></span><i aria-hidden="true">←</i>
          <span><b>התראה</b><small>חומרה · בעלים · השפעה</small></span><i aria-hidden="true">←</i>
          <span><b>טיפול ותחקיר</b><small>התאוששות · בדיקת חזרה</small></span>
        </div>
        <div className={styles.insightGrid}>{monitoringInsights.map((item) => <InsightButton key={item.id} item={item} onSelect={selectInsight} />)}</div>
      </section>

      <section className={styles.failureSection} aria-labelledby="failure-title">
        <div className={styles.sectionHeading}>
          <span>WHEN SOMETHING FALLS</span>
          <h2 id="failure-title">מה קורה כשספק, מסד, אזור או גרסה נופלים</h2>
          <p>המערכת נבנית כך שכשל אחד אינו הופך למסך לבן לכל האתר. היא מצמצמת יכולת בבטחה, שומרת אמת ומחזירה שירות לפי תהליך שנבדק.</p>
        </div>
        <div className={styles.insightGrid}>{failureInsights.map((item) => <InsightButton key={item.id} item={item} onSelect={selectInsight} />)}</div>
      </section>

      <section className={styles.techSection} aria-labelledby="technology-title">
        <div className={styles.sectionHeading}>
          <span>ENGINEERING CHOICES</span>
          <h2 id="technology-title">הטכנולוגיה שנבחרה, ולמה היא נכונה ל־VII</h2>
          <p>כל אריח נפתח להסבר ולדוגמה טכנית. הסימון על כל אריח מבדיל בין בחירה מאושרת, רכיב יעד, אמת נוכחית והחלטה שעדיין פתוחה.</p>
        </div>
        <div className={styles.techGrid}>
          {techStack.map((tech) => <button type="button" key={tech.id} onClick={() => selectTech(tech)} aria-haspopup="dialog" aria-controls="platform-detail-dialog">
            <span className={styles.techTopline}><span dir="ltr">{tech.category}</span><DecisionBadge decision={tech.decision} /></span>
            <b dir="ltr">{tech.name}</b>
            <p>{tech.role}</p>
            <i>פתחו הסבר ודוגמה טכנית</i>
          </button>)}
        </div>
      </section>

      <section className={styles.costSection} aria-labelledby="cost-title">
        <div className={styles.sectionHeading}>
          <span>COSTS WITHOUT SURPRISES</span>
          <h2 id="cost-title">עלויות, עם הפרדה בין מסד, תפעול ופיתוח</h2>
          <p>המספרים נועדו לתכנון בלבד. הם אינם כוללים מס, שערי מטבע, דמי ספקים, תרגום, הודעות, חיפוש, אנליטיקה, ניטור, מדיה, אתר משני או תמיכה אלא אם צוין במפורש.</p>
        </div>
        <div className={styles.costFormula}>
          <span><small>COMPUTE FLOOR</small><b dir="ltr">$438 / MONTH</b><p>שני מופעי Aurora במינימום שני ACU</p></span>
          <i aria-hidden="true">+</i>
          <span><small>STORAGE</small><b dir="ltr">$0.14 / GB-MONTH</b><p>לחודש באזור תל אביב</p></span>
          <i aria-hidden="true">+</i>
          <span><small>I/O</small><b dir="ltr">$0.27 / 1M</b><p>בקשות קלט ופלט</p></span>
        </div>
        <div className={styles.insightGrid}>{costInsights.map((item) => <InsightButton key={item.id} item={item} onSelect={selectInsight} />)}</div>
        <p className={styles.sectionNote}><DecisionBadge decision="estimate" /> המחירים האזוריים נשמרו לצורכי תכנון נכון ל־1 באוגוסט 2026. אין כאן רכישה, הצעת מחיר או אישור תקציב.</p>
      </section>

      <section className={styles.scheduleSection} aria-labelledby="schedule-title">
        <div className={styles.sectionHeading}>
          <span>DELIVERY ROADMAP</span>
          <h2 id="schedule-title">איך בונים את זה בלי לנסות להקים אימפריה ביום אחד</h2>
          <p>השלבים חופפים, והזמן תלוי באיכות הממשקים, בדוגמאות האמת, בכמות השפות, במדיניות ההזמנה ובצוות שייבחר.</p>
        </div>
        <ol className={styles.scheduleGrid}>
          {deliveryPhases.map(([number, title, duration]) => <li key={number}><span>{number}</span><div><b>{title}</b><p>{duration}</p></div></li>)}
        </ol>
        <p className={styles.sectionNote}><DecisionBadge decision="estimate" /> זהו אומדן של שלבים, לא לוח זמנים חוזי. לפני התחייבות צריך דוגמאות ממשק, בעלי תפקידים ותוכנית מסירה מפורטת.</p>
      </section>

      <section className={styles.migrationSection} aria-labelledby="migration-title">
        <div className={styles.sectionHeading}>
          <span>20,000 TO 30,000 LEGACY URLS</span>
          <h2 id="migration-title">כל כתובת ישנה מקבלת החלטה, לא קיצור דרך</h2>
          <p>מייצאים, זוחלים, מנרמלים וממפים כל כתובת ליעד שווה ערך. כשאין יעד מתאים מחזירים תשובת 410, ולא שולחים הכל לדף הבית.</p>
        </div>
        <div className={styles.migrationFlow}>
          <span><b>1</b><small>ייצוא וזחילה</small><p>סטטוס, canonical ותנועה כשזמינה</p></span><i aria-hidden="true">←</i>
          <span><b>2</b><small>נרמול ומיפוי</small><p>מקור, יעד, ביטחון ובעלים</p></span><i aria-hidden="true">←</i>
          <span><b>3</b><small>הכרעה</small><p>301 ישיר ליעד שווה או 410</p></span><i aria-hidden="true">←</i>
          <span><b>4</b><small>בדיקה מלאה</small><p>אין לולאה, שרשרת או יעד בית גורף</p></span><i aria-hidden="true">←</i>
          <span><b>5</b><small>ניטור 90 יום</small><p>שגיאות, פספוסים ותנועה</p></span>
        </div>
        <button type="button" className={styles.migrationAction} onClick={() => selectNode(core.find((node) => node.id === "seo")!)} aria-haspopup="dialog" aria-controls="platform-detail-dialog">פתחו את מנוע הקידום וההפניות ←</button>
      </section>

      <section className={styles.flow} aria-labelledby="flow-title">
        <div className={styles.sectionHeading}>
          <span>ONE DATA JOURNEY</span>
          <h2 id="flow-title">כך בקשה אחת עוברת במערכת</h2>
        </div>
        <ol className={styles.flowSteps}>
          <li><span>01</span><b>קליטת ספק</b><p>כל ספק נכנס דרך מתאם פרטי ומבודד.</p></li>
          <li><span>02</span><b>אימות ואיחוד</b><p>המידע נבדק ומתורגם לתקן אחד של VII.</p></li>
          <li><span>03</span><b>שמירה מקומית</b><p>הקטלוג נשמר במקור האמת שלנו.</p></li>
          <li><span>04</span><b>חיפוש ומטמון</b><p>הגולש מקבל תשובה מהירה בלי לחכות לספק.</p></li>
          <li><span>05</span><b>זמינות בזמן אמת</b><p>רק כשנדרש, מתבצעת בדיקה ממוקדת ומבוקרת.</p></li>
          <li><span>06</span><b>אתר ואפליקציות</b><p>כל מוצר מקבל אותה אמת דרך אותו שער.</p></li>
        </ol>
      </section>

      <section className={styles.truthSection} aria-labelledby="truth-title">
        <div className={styles.sectionHeading}>
          <span>CURRENT TRUTH VS TARGET</span>
          <h2 id="truth-title">האם האתר שכבר בנינו עובד ככה היום? עדיין לא</h2>
          <p>יש פרונט ציבורי ויסודות מקומיים, אבל אסור לבלבל ביניהם לבין הפלטפורמה המלאה שמתוארת כאן.</p>
        </div>
        <div className={styles.truthGrid}>
          <article className={styles.truthCurrent}>
            <DecisionBadge decision="current" />
            <h3>מה קיים ונבדק</h3>
            <ul>
              <li>האתר הציבורי והמסביר האינטראקטיבי.</li>
              <li>פרונט וחלק מיסודות העבודה המקומיים.</li>
              <li>תכנון קנוני מאושר שמרכז את החלטות הפרויקט.</li>
            </ul>
          </article>
          <article className={styles.truthTarget}>
            <DecisionBadge decision="target" />
            <h3>מה עדיין צריך לבנות ולאמת</h3>
            <ul>
              <li>אשכול Aurora בייצור ובבדיקות, חיבור פרטי ומעבר בין מופעים.</li>
              <li>ממשקי ספק אמיתיים, קליטה מלאה, זמינות, הזמנה וכתיבה חוזרת.</li>
              <li>מערכת ניהול מלאה, הרשאות, תרגום, חיפוש חכם, אנליטיקה, ניטור, גיבויים והתאוששות.</li>
            </ul>
          </article>
        </div>
        <div className={styles.openHeading}><DecisionBadge decision="open" /><h3>החלטות ומידע חיצוני שחייבים לסגור</h3></div>
        <div className={styles.openGrid}>
          {openDecisionGroups.map((group) => <article key={group.title}><b>{group.title}</b><p>{group.items}</p></article>)}
        </div>
        <p className={styles.sectionNote}>הקמת תשתית, רכישת שירות, חיבור חשבון או הצגת חיבור כחי תתרחש רק לאחר הרשאה ובדיקה אמיתית. הדף עצמו נשאר מחוץ לאינדוקס ואינו כולל סודות או כתובות פרטיות.</p>
      </section>

      <section className={styles.ownership} aria-labelledby="ownership-title">
        <div>
          <span>THE OWNERSHIP RULE</span>
          <h2 id="ownership-title">הספקים מספקים נתונים.<br />אדיר מחזיק בפלטפורמה.</h2>
        </div>
        <ul>
          <li><span>VII</span><b>קוד, שרתים, מסד נתונים, חיפוש, מטמון, ניהול, אבטחה, קידום וניתוח.</b></li>
          <li><span>SUPPLIERS</span><b>מידע מקור וזמינות בהתאם לחוזה הממשק של כל עולם.</b></li>
          <li><span>RESULT</span><b>אפשר להוסיף עולם, להחליף ספק או לצאת לחו״ל בלי לבנות את VII מחדש.</b></li>
        </ul>
      </section>

      {modalOpen && <div className={styles.modalBackdrop} onClick={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
        <div id="platform-detail-dialog" ref={dialogRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="platform-modal-title" aria-describedby="platform-modal-description" tabIndex={-1}>
          <button type="button" className={styles.modalClose} onClick={closeModal} aria-label="סגירת ההסבר">×</button>
          {selectedNode && <>
            <div className={styles.detailHeader}>
              <span className={styles.detailIcon} aria-hidden="true">{selectedNode.icon}</span>
              <div><span>{kindNames[selectedNode.kind]}</span><h3 id="platform-modal-title" dir="ltr">{selectedNode.title}</h3></div>
            </div>
            <p id="platform-modal-description" className={styles.detailLead}>{selectedNode.summary}</p>
            <dl className={styles.detailList}>
              <div><dt>מי בונה ומפעיל</dt><dd>{selectedNode.owner}</dd></div>
              <div><dt>מה נכנס</dt><dd>{selectedNode.input}</dd></div>
              <div><dt>מה יוצא</dt><dd>{selectedNode.output}</dd></div>
              <div><dt>איך שומרים על מהירות ויציבות</dt><dd>{selectedNode.resilience}</dd></div>
            </dl>
            <div className={styles.codeExample}>
              <span>{technicalExamples[selectedNode.id]?.title ?? "דוגמה טכנית לממשק"}</span>
              <pre dir="ltr"><code>{technicalExamples[selectedNode.id]?.code ?? `GET /v1/platform/${selectedNode.id}\nAuthorization: Bearer &lt;token&gt;`}</code></pre>
            </div>
            <div className={styles.status}><span aria-hidden="true" /><div><b>מצב נוכחי</b><p>{selectedNode.status}</p></div></div>
          </>}
          {selectedTech && <>
            <div className={styles.detailHeader}>
              <span className={styles.detailIcon} aria-hidden="true">&lt;/&gt;</span>
              <div><DecisionBadge decision={selectedTech.decision} /><span dir="ltr">{selectedTech.category}</span><h3 id="platform-modal-title" dir="ltr">{selectedTech.name}</h3></div>
            </div>
            <p id="platform-modal-description" className={styles.detailLead}>{selectedTech.role}</p>
            <div className={styles.whyChoice}><b>למה זו בחירה נכונה</b><p>{selectedTech.why}</p></div>
            <div className={styles.codeExample}><span>דוגמה טכנית</span><pre dir="ltr"><code>{selectedTech.example}</code></pre></div>
            <div className={styles.status}><span aria-hidden="true" /><div><b>מצב ההחלטה</b><p>{selectedTech.status}</p></div></div>
          </>}
          {selectedInsight && <>
            <div className={styles.detailHeader}>
              <span className={styles.detailIcon} aria-hidden="true">+</span>
              <div><DecisionBadge decision={selectedInsight.decision} /><span dir="ltr">{selectedInsight.eyebrow}</span><h3 id="platform-modal-title">{selectedInsight.title}</h3></div>
            </div>
            <p id="platform-modal-description" className={styles.detailLead}>{selectedInsight.summary}</p>
            <ul className={styles.insightBullets}>{selectedInsight.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
            {selectedInsight.technical && <div className={styles.codeExample}><span>דוגמה טכנית</span><pre dir="ltr"><code>{selectedInsight.technical}</code></pre></div>}
            <div className={styles.status}><span aria-hidden="true" /><div><b>מצב אמיתי</b><p>{selectedInsight.status}</p></div></div>
          </>}
        </div>
      </div>}

      <footer className={styles.footer}>
        <Link href="/" aria-label="חזרה לאתר VII"><img src="/vii-logo.png" alt="וי פור ויקיישן" width="160" height="122" /></Link>
        <p>VII PLATFORM BLUEPRINT</p>
        <span>מסמך תכנון אינטראקטיבי לצוות. עודכן לפי החלטות 18 באוגוסט 2026. ללא מידע סודי וללא פרטי גישה.</span>
      </footer>
    </>
  );
}
