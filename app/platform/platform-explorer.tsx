"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

const worlds: PlatformNode[] = [
  { id: "vacations", kind: "world", eyebrow: "WORLD 01", title: "VACATIONS", icon: "V", summary: "נופש, מתחמים, חדרים, מחירים, תמונות ותוכן עסקי.", owner: "אדיר בונה ומפעיל את האתר, השרת, מסד הנתונים, החיפוש והניהול. סרגיי מספק נתוני נופש דרך ממשק.", input: "קטלוג מסרגיי, עריכות ותוכן משלים של VII, וחיפושי גולשים.", output: "עמודי עסק, תוצאות חיפוש, השוואה, מועדפים ותשתית הזמנה.", resilience: "הקטלוג נשמר אצל VII. זמינות רגישה לזמן נבדקת מול הספק עם מטמון קצר, מגבלות עומס ותשובה חלופית בטוחה.", status: "ארכיטקטורת יעד, חיבור הספק ייחשב פעיל רק לאחר אימות מלא." },
  { id: "events", kind: "world", eyebrow: "WORLD 02", title: "EVENTS", icon: "E", summary: "מקומות לאירועים, סוגי אירוח, קיבולת, מחירים ומדיה.", owner: "אדיר בונה ומפעיל את המוצר המלא. סרגיי מספק את נתוני האירועים דרך ממשק.", input: "מידע מסרגיי ותוכן עסקי שנוצר ומנוהל אצל VII.", output: "חיפוש אירועים, עמודי מקום, לידים, תוכן וקידום אורגני.", resilience: "נתונים קנוניים נשמרים אצל VII, כך שהאתר ממשיך להציג מידע גם בתקלה זמנית אצל הספק.", status: "ארכיטקטורת יעד, בכפוף להסכם נתונים ובדיקות קצה לקצה." },
  { id: "hourly", kind: "world", eyebrow: "WORLD 03", title: "ROOMS VIP", icon: "R", summary: "חדרים לפי שעה, יחידות, חלונות אירוח, מחירים ותמונות.", owner: "אדיר בונה ומפעיל את האתר, המערכת והנתונים המקומיים. סרגיי מספק את נתוני החדרים לפי שעה דרך ממשק.", input: "עסקים, יחידות, שעות, מחירים, תמונות וזמינות מסרגיי.", output: "חיפוש לפי אזור וזמן, עמודי עסק, בחירת יחידה ומסלול הזמנה.", resilience: "הקטלוג נשמר אצל VII. זמינות רגישה לזמן נבדקת מול סרגיי באופן ממוקד ועם מטמון קצר.", status: "ארכיטקטורת יעד, בכפוף להסכם נתונים ובדיקות קצה לקצה." },
  { id: "spa", kind: "world", eyebrow: "WORLD 04", title: "SPA", icon: "S", summary: "בתי ספא, טיפולים, חבילות, שעות ותורים.", owner: "אדיר בונה ומפעיל את כל שכבות VII. גל וספא פלוס מספקים את נתוני עולם הספא דרך ממשק נפרד.", input: "קטלוג ספא, טיפולים, חבילות וזמינות מספא פלוס.", output: "גילוי ספא, חיפוש טיפולים, עמודי עסק ומסלול הזמנה עתידי.", resilience: "קטלוג מקומי מהיר, בדיקת תורים בזמן אמת רק כשצריך, ומפסק חכם שמונע עומס חוזר בזמן תקלה.", status: "ארכיטקטורת יעד, אין כאן הצהרה על חיבור חי שטרם אומת." },
  { id: "attractions", kind: "world", eyebrow: "WORLD 05", title: "ATTRACTIONS", icon: "A", summary: "אטרקציות, כרטיסים, שעות פעילות, גילאים ומיקום.", owner: "אדיר בונה את המוצר והמערכת. ספק האטרקציות מספק נתונים באמצעות מתאם עצמאי.", input: "קטלוג, מחירים, מגבלות, מיקום וזמינות מספק ייעודי.", output: "חיפוש חוויות, מפה, עמודי אטרקציה ומסלול רכישה עתידי.", resilience: "תקלה בעולם האטרקציות מבודדת ואינה פוגעת בנופש, באירועים או בספא.", status: "ספק ומפרט סופי ייקבעו לאחר בדיקה מסחרית וטכנית." },
  { id: "trips", kind: "world", eyebrow: "WORLD 06", title: "TRIPS", icon: "T", summary: "מסלולים, נקודות עניין, מפות, קושי ותוכן מקומי.", owner: "בבעלות ובפיתוח מלא של אדיר, מהתוכן ועד ממשקי הניהול והמוצר.", input: "תוכן מערכת, נתוני מיקום ומקורות מאושרים.", output: "מדריכי טיול, מסלולים אינטראקטיביים וחיבור להצעות נופש סמוכות.", resilience: "עולם עצמאי שאינו תלוי בזמינות של ספק חיצוני יחיד.", status: "עולם בבעלות VII." },
  { id: "suppliers", kind: "world", eyebrow: "WORLD 07", title: "SUPPLIERS", icon: "P", summary: "ספקי אירועים ושירותים, פרופילים, תיקי עבודות ולידים.", owner: "בבעלות ובפיתוח מלא של אדיר, כולל קליטה, ניהול, דירוג וחיבור לקוחות.", input: "מידע מספקים, מדיה מאושרת, תוכן מערכת ופעילות משתמשים.", output: "אינדקס ספקים, עמודי פרופיל, חיפוש וקבלת פניות.", resilience: "המידע נשמר ומנוהל ישירות בפלטפורמה, עם היסטוריית שינויים והרשאות.", status: "עולם בבעלות VII." },
  { id: "magazine", kind: "world", eyebrow: "WORLD 08", title: "MAGAZINE", icon: "M", summary: "כתבות, מדריכים, השראה, עמודים סטטיים ותוכן חיפוש.", owner: "בבעלות ובפיתוח מלא של אדיר, כולל מערכת תוכן, קישורים וקידום אורגני.", input: "תוכן מערכת מאושר, מומחיות עסקית ונתונים מהעולמות השונים.", output: "כתבות, מדריכים, עמודי נחיתה וקישורים חכמים לעולמות המסחריים.", resilience: "גרסאות, טיוטות, תזמון ופרסום מבוקר נשמרים אצל VII.", status: "עולם בבעלות VII." },
];

const providers: PlatformNode[] = [
  { id: "sergey", kind: "provider", eyebrow: "TWO-WAY API", title: "SERGEY API", icon: "01", summary: "חיבור דו־כיווני לנופש, אירועים וחדרים לפי שעה.", owner: "סרגיי אחראי לממשק המקור. אדיר אחראי לכל מה שקורה מרגע הקליטה ל-VII.", input: "עסקים, חדרים, מחירים, תמונות, שעות, מאפיינים וזמינות, לפי חוזה נתונים מוסכם.", output: "VII מחזירה לסרגיי הזמנות וחוות דעת עבור VACATIONS, EVENTS ו-ROOMS VIP.", resilience: "בדיקת מבנה, מניעת כפילויות, מפתחות פעולה ייחודיים, ניסיונות חוזרים מבוקרים ומטמון.", status: "החיבור יוצג כחי רק אחרי הרשאה, חוזה ממשק ובדיקות כתיבה וקריאה." },
  { id: "spaplus", kind: "provider", eyebrow: "TWO-WAY API", title: "SPA PLUS API", icon: "02", summary: "חיבור דו־כיווני לעולם הספא, בנפרד מסרגיי.", owner: "גל וספא פלוס אחראים לממשק המקור. אדיר אחראי לפלטפורמת VII.", input: "בתי ספא, טיפולים, חבילות, שעות ותורים.", output: "VII מחזירה לגל ולספא פלוס הזמנות וחוות דעת מעולם SPA.", resilience: "מתאם עצמאי, חתימת פעולות, מניעת שליחה כפולה ותור בטוח בזמן תקלה.", status: "מותנה באישור ובאימות ממשק דו־כיווני." },
  { id: "attractions-api", kind: "provider", eyebrow: "TWO-WAY READY", title: "ATTRACTIONS API", icon: "03", summary: "חיבור נפרד לעולם האטרקציות, לספק שייבחר.", owner: "הספק העתידי יהיה אחראי למקור. אדיר בונה את המתאם, האחסון והמוצר.", input: "קטלוג, תמחור, תנאים וזמינות.", output: "VII תחזיר הזמנות לספק האטרקציות שייבחר.", resilience: "כשל נשאר בגבולות העולם הזה, וכל הזמנה נשלחת פעם אחת עם מעקב מצב.", status: "הספק הסופי טרם נבחר ולכן החיבור מוצג כמוכנות תכנונית." },
  { id: "future", kind: "provider", eyebrow: "PLUG-IN READY", title: "FUTURE APIs", icon: "+", summary: "שכבת חיבור לספקים ולעולמות עתידיים בארץ ובחו״ל.", owner: "אדיר מחזיק בתקן האחיד ובשער הכניסה. כל ספק מחזיק רק במקור שלו.", input: "כל ממשק חיצוני שעובר אימות, מיפוי והרשאה.", output: "אותו מבנה פנימי עקבי, בלי תלות בצורת המידע של הספק.", resilience: "ספק חדש נכנס דרך מתאם מבודד, בלי לסכן את ליבת המערכת.", status: "יכולת מתוכננת להתרחבות." },
];

const core: PlatformNode[] = [
  { id: "edge", kind: "core", eyebrow: "SPEED", title: "EDGE + CDN", icon: "01", summary: "העמודים, התמונות והקוד מגיעים מהנקודה הקרובה ביותר לגולש.", owner: "אדיר ו-VII.", input: "תוצרים מוכנים מהמערכת וממדיית VII.", output: "טעינה מיידית יותר, הגנה מעומסים והפחתת עבודה מהשרת.", resilience: "מטמון בשכבות, פינוי מדויק ושמירת גרסה תקינה בזמן שחרור.", status: "שכבת ליבה מתוכננת." },
  { id: "gateway", kind: "core", eyebrow: "CONTROL", title: "API GATEWAY", icon: "02", summary: "שער אחד מבוקר לכל אתר, אפליקציה וספק חיצוני.", owner: "אדיר ו-VII.", input: "בקשות מהאתר, מהאפליקציות ומהמתאמים.", output: "אימות, הרשאה, הגבלת קצב וניתוב לשירות הנכון.", resilience: "מונע מספק איטי או משתמש תוקף להציף את המערכת.", status: "שכבת ליבה מתוכננת." },
  { id: "adapters", kind: "core", eyebrow: "INTEGRATION", title: "PROVIDER ADAPTERS", icon: "03", summary: "מתאם נפרד לכל ספק, שמתרגם אותו לשפה אחת של VII.", owner: "אדיר ו-VII.", input: "מבנים שונים מסרגיי, ספא פלוס וספקים נוספים.", output: "רשומות אחידות ומאומתות למנוע המרכזי.", resilience: "שינוי אצל ספק אחד דורש תיקון במתאם שלו בלבד.", status: "עיקרון ליבה של הארכיטקטורה." },
  { id: "database", kind: "core", eyebrow: "SOURCE OF TRUTH", title: "CANONICAL DATABASE", icon: "04", summary: "מסד הנתונים המרכזי של VII, עם זהות אחידה לכל עסק, חדר ומוצר.", owner: "אדיר ו-VII.", input: "מידע מאומת מהספקים ותוכן בבעלות VII.", output: "נתונים עקביים לאתר, לחיפוש, לניהול ולאפליקציות.", resilience: "גיבויים, שכפול, היסטוריית שינויים ומדיניות מחיקה מוגדרת.", status: "שכבת ליבה מתוכננת." },
  { id: "cache", kind: "core", eyebrow: "MILLISECONDS", title: "SMART CACHE", icon: "05", summary: "שומר תשובות נפוצות ומונע אלפי פניות חוזרות לספקים.", owner: "אדיר ו-VII.", input: "קטלוג, חיפושים ותוצאות זמינות קצרות חיים.", output: "תגובות מהירות מאוד עם תפוגה שונה לכל סוג מידע.", resilience: "מניעת הצפה, רענון ברקע ותשובה ישנה בטוחה כשמותר.", status: "שכבת ליבה מתוכננת." },
  { id: "search", kind: "core", eyebrow: "DISCOVERY", title: "SEARCH ENGINE", icon: "06", summary: "אינדקס מהיר לחיפוש, סינון, מיקום ושפה בכל העולמות.", owner: "אדיר ו-VII.", input: "עותק חיפוש של הנתונים הקנוניים.", output: "תוצאות מהירות, הצעות, מפות ומסננים.", resilience: "האינדקס ניתן לבנייה מחדש ממסד הנתונים, בלי לאבד את המקור.", status: "שכבת ליבה מתוכננת." },
  { id: "cms", kind: "core", eyebrow: "OPERATIONS", title: "CMS + ADMIN", icon: "07", summary: "מערכת העל של אדיר לכל העולמות, התוכן, החיפושים והבקרות.", owner: "אדיר הוא מנהל־על. עובדי VII מקבלים הרשאות מדויקות לפי עולם ותפקיד.", input: "עריכות, אישורים, מדיה, משתמשים, חיפושים אמיתיים וכללי תצוגה.", output: "פרסום מבוקר, תצוגה מקדימה, תורים לאישור והיסטוריית פעולות מלאה.", resilience: "כניסה עם חשבון גוגל, הרשאות מינימליות, אישור כפול ושחזור גרסאות.", status: "שכבת ליבה מתוכננת." },
  { id: "media", kind: "core", eyebrow: "ASSETS", title: "MEDIA PIPELINE", icon: "08", summary: "קליטה, ניקוי, שינוי גודל והפצה חכמה של תמונות ווידאו.", owner: "אדיר ו-VII.", input: "מדיה מאושרת מספקים ומהצוות.", output: "פורמטים מהירים ומותאמים למסך, עם מקור ובעלות מתועדים.", resilience: "עיבוד בתור, בדיקות קובץ, גרסאות ומטמון עולמי.", status: "שכבת ליבה מתוכננת." },
  { id: "queues", kind: "core", eyebrow: "ASYNC", title: "QUEUES + WORKERS", icon: "09", summary: "עבודות כבדות רצות ברקע בלי לעכב מעבר עמוד או חיפוש.", owner: "אדיר ו-VII.", input: "סנכרונים, עיבוד מדיה, בניית אינדקס והתראות.", output: "עבודה עקבית, ניתנת לניסיון חוזר ולמעקב.", resilience: "תור כשל, מניעת כפילות ומפתח ייחודי לכל פעולה.", status: "שכבת ליבה מתוכננת." },
  { id: "security", kind: "core", eyebrow: "TRUST", title: "SECURITY + OBSERVABILITY", icon: "10", summary: "הגנה, לוגים, מדדים, התראות ומעקב אחרי כל מסע משתמש.", owner: "אדיר ו-VII.", input: "אירועים מהקוד, השרתים, הספקים והמשתמשים.", output: "זיהוי תקלות, חקירה, התראות ובקרת סיכונים.", resilience: "הפרדת סודות, חומות הגנה, הרשאות מינימליות ותוכנית התאוששות.", status: "שכבת ליבה מתוכננת." },
  { id: "seo", kind: "core", eyebrow: "GROWTH", title: "SEO + GEO ENGINE", icon: "11", summary: "מנוע כתובות, תוכן, נתונים מובנים והעברות מדויקות מעשרות אלפי עמודים ישנים.", owner: "אדיר ו-VII.", input: "מפת האתר הישן, חיפושים שאושרו, מבנה העולמות ותוכן איכותי.", output: "עמודים יציבים למנועי חיפוש ולמנועי בינה, מפת אתר, תשובות מובנות והעברות קבועות.", resilience: "מפת התאמה, בקרת איכות, מניעת עמודים דלים ומעקב אחרי עמודים שלא נמצאו.", status: "שכבת ליבה מתוכננת." },
  { id: "analytics", kind: "core", eyebrow: "EVERY ACTION", title: "EVENT STREAM", icon: "12", summary: "מערכת שיודעת מה קרה בכל שלב, מחשיפה ועד הזמנה.", owner: "אדיר ו-VII.", input: "חשיפות, צפיות, חיפושים, לחיצות טלפון, פתיחת צ׳אט, לידים, חוות דעת, הזמנות, ביצועים ותקלות.", output: "ציר אירועים אחיד לניתוח מסע, ייחוס, התראות ודוחות.", resilience: "אירועים עוברים דרך תור, עם הסכמה, צמצום מידע, מניעת כפילויות ובקרת איכות.", status: "שכבת ליבה מתוכננת." },
  { id: "access", kind: "core", eyebrow: "IDENTITY + CONTROL", title: "GOOGLE SSO + RBAC", icon: "13", summary: "אדיר נכנס עם גוגל כמנהל־על ומקצה לעובדים הרשאות לפי עולם.", owner: "אדיר שולט בכל. כל עובד רואה ועושה רק את מה שהוגדר לו.", input: "זהות גוגל, תפקיד, עולם, רמת הרשאה ומדיניות אישור.", output: "כניסה מאובטחת, מסכים מותאמים והרשאה לכל פעולה.", resilience: "אימות רב־שלבי לפי סיכון, סיום מפגשים, יומן ביקורת ושלילה מיידית.", status: "שכבת ליבה מתוכננת." },
  { id: "engagement", kind: "core", eyebrow: "CONVERSATIONS", title: "CHATWOOT + LEADS", icon: "14", summary: "הצ׳אט של VII מחובר לצ׳אטווט ומרכז שיחות ולידים מכל עולם.", owner: "אדיר ו-VII מחזיקים בחוויית האתר, בניתוב, בהרשאות ובהקשר העסקי.", input: "שיחות, טפסים, לחיצות טלפון, מקור הגעה, עמוד ועולם.", output: "שיחה לצוות המתאים, ליד עשיר בהקשר ומעקב טיפול.", resilience: "הסכמה, צמצום מידע, מניעת כפילויות, תור מסירה ומעקב סטטוס.", status: "חיבור יעד, ייחשב פעיל רק אחרי אימות חשבון והרשאות." },
  { id: "search-factory", kind: "core", eyebrow: "DEMAND TO CONTENT", title: "SEARCH INTELLIGENCE", icon: "15", summary: "אלפי חיפושים אמיתיים הופכים למאגר ביקוש שאפשר לאשר ולהפוך לעמוד.", owner: "אדיר והצוות המורשה מחליטים מה מאשרים, מאחדים, מעשירים ומפרסמים.", input: "שאילתות, מסננים, אזורים, תוצאות, אפס תוצאות, נפח ומגמה.", output: "הצעת עמוד עם כתובת, כוונת חיפוש, תוכן, קישורים, סכמות וכלי SEO ו-GEO.", resilience: "מניעת כפילויות, סינון פרטיות וספאם, ציון איכות ואישור אנושי לפני פרסום.", status: "שכבת ליבה מתוכננת." },
  { id: "reports", kind: "core", eyebrow: "DECISIONS", title: "REPORTING + BI", icon: "16", summary: "דוחות חיים לכל עולם, ספק, עמוד, קמפיין ומסלול המרה.", owner: "אדיר רואה את כל המערכת. עובדים רואים דוחות לפי הרשאה ועולם.", input: "ציר האירועים, הזמנות, לידים, שיחות, חוות דעת, הכנסות וביצועים.", output: "לוחות מחוונים, משפכים, השוואות, התראות, יצוא ותחזיות.", resilience: "הפרדת מידע אישי, הגדרות מדד אחידות, בקרת טריות והיסטוריה שאינה משתנה בדיעבד.", status: "שכבת ליבה מתוכננת." },
  { id: "provider-router", kind: "core", eyebrow: "SAFE WRITEBACK", title: "BOOKINGS + REVIEWS ROUTER", icon: "17", summary: "מנוע שמחזיר הזמנות וחוות דעת לספק הנכון, לפי העולם והחוזה שלו.", owner: "אדיר ו-VII שולטים בניתוב, באימות, בתיעוד ובמצב כל פעולה.", input: "הזמנה או חוות דעת מאושרת, מזהי העולם והעסק, והסכמת המשתמש.", output: "שליחה מדויקת לסרגיי, לספא פלוס או לספק האטרקציות העתידי.", resilience: "מפתח ייחודי, חתימה, תור ניסיון חוזר, תור כשל והתאמת מצב דו־כיוונית.", status: "שכבת ליבה מתוכננת." },
];

const outputs: PlatformNode[] = [
  { id: "web", kind: "output", eyebrow: "NOW", title: "FAST WEB", icon: "W", summary: "אתר מהיר, נגיש, מותאם מגע ומוכן לקפיצות עומס.", owner: "אדיר ו-VII.", input: "אותו שער מערכת ואותו מקור נתונים מרכזי.", output: "חוויית גלישה רציפה במחשב ובנייד.", resilience: "טעינה מקדימה, מטמון, מסכי שלד והחלפת גרסה ללא דף לבן.", status: "מוצר הקצה הראשון." },
  { id: "ios", kind: "output", eyebrow: "NEXT", title: "iOS APP", icon: "i", summary: "אפליקציה עתידית שמתחברת לאותה פלטפורמה, לא למערכת נפרדת.", owner: "אדיר ו-VII.", input: "אותם ממשקים, חשבון, מועדפים והזמנות.", output: "חוויה טבעית לאייפון ולהתראות מאושרות.", resilience: "גרסאות ממשק לאחור מאפשרות לאפליקציות ישנות להמשיך לעבוד.", status: "מוכנות ארכיטקטונית לשלב הבא." },
  { id: "android", kind: "output", eyebrow: "NEXT", title: "ANDROID APP", icon: "A", summary: "אפליקציה עתידית לאנדרואיד על אותה ליבה.", owner: "אדיר ו-VII.", input: "אותם שירותים ונתונים כמו באתר ובאייפון.", output: "מוצר אחיד עם יכולות מכשיר והתראות.", resilience: "השירותים מתוכננים מראש למספר לקוחות וגרסאות.", status: "מוכנות ארכיטקטונית לשלב הבא." },
];

const allNodes = [...worlds, ...providers, ...core, ...outputs];

const kindNames: Record<NodeKind, string> = {
  world: "עולם",
  provider: "ספק מידע",
  core: "ליבת VII",
  output: "מוצר קצה",
};

const commandCenter = [
  { nodeId: "access", label: "GOOGLE SSO", title: "אדיר הוא מנהל־העל", copy: "כניסה מאובטחת והרשאות עובדים לפי עולם ותפקיד." },
  { nodeId: "engagement", label: "CHATWOOT", title: "כל שיחה מגיעה עם הקשר", copy: "העמוד, העולם, מקור ההגעה והפעולות שקדמו לפנייה." },
  { nodeId: "analytics", label: "EVENT STREAM", title: "כל פעולה הופכת למידע", copy: "חשיפה, צפייה, טלפון, ליד, שיחה, חוות דעת והזמנה." },
  { nodeId: "provider-router", label: "TWO-WAY DATA", title: "הזמנות וחוות דעת חוזרות", copy: "לספק הנכון, פעם אחת, עם מעקב מצב מלא." },
  { nodeId: "search-factory", label: "SEARCH FACTORY", title: "חיפוש הופך לעמוד אמיתי", copy: "אישור אנושי, תוכן, כתובת וכלי SEO ו-GEO." },
  { nodeId: "reports", label: "REPORTING + BI", title: "דוחות על כל מה שקרה", copy: "לפי עולם, ספק, עמוד, קמפיין, משפך והרשאה." },
];

function NodeButton({ node, selected, onSelect }: { node: PlatformNode; selected: boolean; onSelect: (node: PlatformNode) => void }) {
  return (
    <button
      type="button"
      className={`${styles.node} ${styles[`node_${node.kind}`]} ${selected ? styles.nodeSelected : ""}`}
      onClick={() => onSelect(node)}
      aria-pressed={selected}
      aria-controls="platform-detail"
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

export function PlatformExplorer() {
  const [selectedId, setSelectedId] = useState("vacations");
  const [activeLayer, setActiveLayer] = useState<"all" | NodeKind>("all");
  const selected = useMemo(() => allNodes.find((node) => node.id === selectedId) ?? worlds[0], [selectedId]);
  const isVisible = (kind: NodeKind) => activeLayer === "all" || activeLayer === kind;

  function selectNode(node: PlatformNode) {
    setSelectedId(node.id);
    window.requestAnimationFrame(() => {
      document.getElementById("platform-detail")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  return (
    <>
      <header className={styles.hero}>
        <nav className={styles.topbar} aria-label="ניווט מפת המערכת">
          <Link href="/" className={styles.brand} aria-label="VII, חזרה לאתר">
            <img src="/vii-logo.png" alt="VII" width="74" height="74" />
            <span>PLATFORM BLUEPRINT</span>
          </Link>
          <a className={styles.topAction} href="#platform-map">כניסה למערכת</a>
        </nav>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <span className={styles.kicker}>ONE PLATFORM. MANY WORLDS.</span>
            <h1>המנוע של <b dir="ltr">VII</b></h1>
            <p>כל העולמות, כל הספקים וכל מוצרי הקצה מתחברים לליבה אחת מהירה, מודולרית ובבעלות אדיר.</p>
            <div className={styles.heroStats} aria-label="עקרונות המערכת">
              <span><b>8</b> עולמות</span>
              <span><b>1</b> מקור אמת</span>
              <span><b>0</b> תלות בספק יחיד</span>
            </div>
          </div>
          <div className={styles.orbit} aria-hidden="true">
            <span className={styles.orbitRing} />
            <span className={styles.orbitCore}>VII<small>CORE</small></span>
            <span className={`${styles.orbitWorld} ${styles.orbitWorld1}`}>VACATIONS</span>
            <span className={`${styles.orbitWorld} ${styles.orbitWorld2}`}>SPA</span>
            <span className={`${styles.orbitWorld} ${styles.orbitWorld3}`}>EVENTS</span>
            <span className={`${styles.orbitWorld} ${styles.orbitWorld4}`}>TRIPS</span>
          </div>
        </div>
        <div className={styles.heroWorlds} aria-label="עולמות VII">
          {worlds.map((world) => <button type="button" key={world.id} onClick={() => selectNode(world)} dir="ltr">{world.title}</button>)}
        </div>
      </header>

      <section className={styles.visualSection} aria-labelledby="visual-title">
        <div className={styles.sectionHeading}>
          <span>THE BIG PICTURE</span>
          <h2 id="visual-title">התמונה המלאה, במבט אחד</h2>
          <p>המידע נכנס מהספקים ונשמר אצל VII. זמינות נבדקת בזמן אמת, והזמנות וחוות דעת חוזרות לספק הנכון דרך מנגנון כתיבה בטוח.</p>
        </div>
        <figure className={styles.architectureFigure}>
          <img src="/platform-architecture.png" alt="המחשה של ארכיטקטורת היעד של VII, ספקים חיצוניים מתחברים לליבת נתונים אחת וממנה לאתר ולאפליקציות" width="1672" height="941" />
          <figcaption>המחשת ארכיטקטורת יעד כללית. המפה הלחיצה שבהמשך היא הרשימה המלאה והעדכנית של שמונת העולמות. זהו תרשים תכנוני, לא צילום של תשתית פעילה ולא אישור שחיבורי הספקים כבר עלו לאוויר.</figcaption>
        </figure>
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
            {isVisible("world") && <section className={styles.nodeGroup} aria-labelledby="worlds-title"><div className={styles.groupTitle}><span>01</span><h3 id="worlds-title">OUR WORLDS</h3><small>מוצרים נפרדים, ליבה משותפת</small></div><div className={styles.worldGrid}>{worlds.map((node) => <NodeButton key={node.id} node={node} selected={selected.id === node.id} onSelect={selectNode} />)}</div></section>}
            {isVisible("provider") && <section className={styles.nodeGroup} aria-labelledby="providers-title"><div className={styles.groupTitle}><span>02</span><h3 id="providers-title">DATA PROVIDERS</h3><small>מספקים מידע, לא מחזיקים במוצר</small></div><div className={styles.nodeList}>{providers.map((node) => <NodeButton key={node.id} node={node} selected={selected.id === node.id} onSelect={selectNode} />)}</div></section>}
            {isVisible("core") && <section className={styles.nodeGroup} aria-labelledby="core-title"><div className={styles.groupTitle}><span>03</span><h3 id="core-title">VII CORE</h3><small>הקוד, הנתונים והשליטה של אדיר</small></div><div className={styles.coreGrid}>{core.map((node) => <NodeButton key={node.id} node={node} selected={selected.id === node.id} onSelect={selectNode} />)}</div></section>}
            {isVisible("output") && <section className={styles.nodeGroup} aria-labelledby="outputs-title"><div className={styles.groupTitle}><span>04</span><h3 id="outputs-title">PRODUCTS</h3><small>אתר עכשיו, אפליקציות בהמשך</small></div><div className={styles.nodeList}>{outputs.map((node) => <NodeButton key={node.id} node={node} selected={selected.id === node.id} onSelect={selectNode} />)}</div></section>}
          </div>

          <aside id="platform-detail" className={styles.detail} aria-live="polite" aria-label={`פרטי ${selected.title}`}>
            <div className={styles.detailHeader}>
              <span className={styles.detailIcon} aria-hidden="true">{selected.icon}</span>
              <div><span>{kindNames[selected.kind]}</span><h3 dir="ltr">{selected.title}</h3></div>
            </div>
            <p className={styles.detailLead}>{selected.summary}</p>
            <dl>
              <div><dt>מי בונה ומפעיל</dt><dd>{selected.owner}</dd></div>
              <div><dt>מה נכנס</dt><dd>{selected.input}</dd></div>
              <div><dt>מה יוצא</dt><dd>{selected.output}</dd></div>
              <div><dt>איך נשארים חזקים</dt><dd>{selected.resilience}</dd></div>
            </dl>
            <div className={styles.status}><span aria-hidden="true" /><div><b>מצב</b><p>{selected.status}</p></div></div>
          </aside>
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
          <article><span className={styles.exchangeProvider}>ATTRACTIONS PROVIDER</span><div><b>DATA IN</b><p>ATTRACTIONS</p></div><i aria-hidden="true">⇄</i><div><b>DATA OUT</b><p>BOOKINGS</p></div><small>הספק טרם נבחר</small></article>
        </div>
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
            return <button type="button" key={item.nodeId} onClick={() => selectNode(node)} aria-controls="platform-detail"><span dir="ltr">{item.label}</span><b>{item.title}</b><p>{item.copy}</p><i aria-hidden="true">←</i></button>;
          })}
        </div>
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

      <footer className={styles.footer}>
        <Link href="/" aria-label="חזרה לאתר VII"><img src="/vii-logo.png" alt="VII" width="64" height="64" /></Link>
        <p>VII PLATFORM BLUEPRINT</p>
        <span>מסמך חזון אינטראקטיבי לצוות. ללא מידע סודי וללא פרטי גישה.</span>
      </footer>
    </>
  );
}
