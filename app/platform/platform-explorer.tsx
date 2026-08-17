"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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

type TechChoice = {
  id: string;
  name: string;
  category: string;
  role: string;
  why: string;
  example: string;
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
  { id: "sergey", kind: "provider", eyebrow: "TWO-WAY API", title: "SERGEY API", icon: "01", summary: "חיבור דו־כיווני ומלא לנופש, אירועים וחדרים לפי שעה.", owner: "סרגיי אחראי לממשק המקור. אדיר אחראי לכל מה שקורה מרגע הקליטה ל-VII.", input: "לכל מקום: מזהה ספק, שם, אודות, תיאורים, כתובת ומיקום, אנשי קשר מותרים, תמונות וסדרן, מתקנים, מדיניות, יחידות, מבנה חדרים, תפוסה, מחירים וזמינות. השדות הסופיים נקבעים בחוזה API.", output: "VII מחזירה לסרגיי הזמנות וחוות דעת עבור VACATIONS, EVENTS ו-ROOMS VIP.", resilience: "Webhook מיידי לשינוי, סנכרון השלמה מחזורי, מספר גרסה, checksum, upsert שאינו יוצר כפילות, היסטוריית שינויים ומטמון.", status: "החיבור יוצג כחי רק אחרי הרשאה, חוזה ממשק ובדיקות כתיבה וקריאה." },
  { id: "spaplus", kind: "provider", eyebrow: "TWO-WAY API", title: "SPA PLUS API", icon: "02", summary: "חיבור דו־כיווני ומלא לעולם הספא, בנפרד מסרגיי.", owner: "גל, המתכנת של ספא פלוס, אחראי לממשק המקור. אדיר אחראי לפלטפורמת VII.", input: "לכל ספא: מזהה ספק, שם, אודות, תיאורים, כתובת ומיקום, תמונות, מתקנים, טיפולים, משכים, מטפלים או משאבים, חבילות, מחירים, שעות ותורים. השדות הסופיים נקבעים בחוזה API.", output: "VII מחזירה לגל ולספא פלוס הזמנות וחוות דעת מעולם SPA.", resilience: "Webhook מיידי לשינוי, סנכרון השלמה מחזורי, מספר גרסה, checksum, מניעת שליחה כפולה ותור בטוח בזמן תקלה.", status: "מותנה באישור ובאימות ממשק דו־כיווני." },
  { id: "attractions-api", kind: "provider", eyebrow: "TWO-WAY READY", title: "ATTRACTIONS API", icon: "03", summary: "חיבור נפרד ומלא לעולם האטרקציות, לספק שייבחר.", owner: "הספק העתידי יהיה אחראי למקור. אדיר בונה את המתאם, האחסון והמוצר.", input: "לכל אטרקציה: מזהה, שם, תיאור, מיקום, תמונות, סוגי כרטיסים, גילאים, מגבלות, שעות, מחירים וזמינות, לפי החוזה העתידי.", output: "VII תחזיר הזמנות לספק האטרקציות שייבחר.", resilience: "כשל נשאר בגבולות העולם הזה, כל שינוי נגרס וכל הזמנה נשלחת פעם אחת עם מעקב מצב.", status: "הספק הסופי טרם נבחר ולכן החיבור מוצג כמוכנות תכנונית." },
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

const technicalExamples: Record<string, { title: string; code: string }> = {
  vacations: { title: "קריאת עמוד נופש מהליבה שלנו", code: "GET /v1/worlds/vacations/places/vii_8f21\nCache-Control: public, s-maxage=300" },
  events: { title: "חיפוש אירועים דרך שער VII", code: "GET /v1/search?world=events&region=tel-aviv&guests=120" },
  hourly: { title: "בדיקת חלון אירוח קצר", code: "POST /v1/availability/hourly\n{ placeId, unitId, startAt, durationMinutes }" },
  spa: { title: "בדיקת טיפול וזמן", code: "POST /v1/availability/spa\n{ placeId, treatmentId, startsAt, guests }" },
  attractions: { title: "בדיקת כרטיסים", code: "POST /v1/availability/attractions\n{ productId, visitDate, adults, children }" },
  sergey: { title: "סנכרון שינוי מסרגיי", code: "POST /v1/integrations/sergey/webhook\n{ event: 'place.updated', providerId: '1042', version: 38 }" },
  spaplus: { title: "סנכרון שינוי מספא פלוס", code: "POST /v1/integrations/spaplus/webhook\n{ event: 'treatment.updated', providerId: '310', version: 12 }" },
  "attractions-api": { title: "חוזה עתידי לספק אטרקציות", code: "POST /v1/integrations/attractions/bookings\nIdempotency-Key: booking_vii_9107" },
  adapters: { title: "תרגום ספק למודל אחד", code: "normalize(providerPayload) => CanonicalPlace\nvalidate() => upsert() => reindex()" },
  database: { title: "זהות פנימית מול זהות הספק", code: "places(id, world, title, status, version)\nprovider_refs(place_id, provider, provider_id, source_version)" },
  cache: { title: "מפתח מטמון צפוי", code: "place:vii_8f21:he:v38\nTTL catalog=300s | availability=15s" },
  search: { title: "מסמך חיפוש", code: "{ placeId, world, title, region, geo, amenities, priceFrom, rankSignals }" },
  cms: { title: "אישור שינוי", code: "draft -> review -> approved -> published\naudit: actorId, world, before, after, publishedAt" },
  media: { title: "צינור תמונה", code: "source.jpg -> virus scan -> checksum -> AVIF/WebP -> CDN\nretain providerAssetId + rights metadata" },
  queues: { title: "עבודה שאפשר לנסות שוב", code: "jobId=sync_sergey_1042_v38\nattempt=1 | dedupeKey=sergey:1042:38" },
  analytics: { title: "אירוע עסקי אחיד", code: "track('phone_clicked', { world, placeId, pageType, sessionId, occurredAt })" },
  access: { title: "הרשאה לפי עולם", code: "allow(user, 'places.publish', { world: 'spa' })\ndeny(user, 'users.manage')" },
  engagement: { title: "פתיחת שיחה עם הקשר", code: "POST /v1/chatwoot/conversations\n{ world, placeId, pageUrl, leadId, consentId }" },
  "search-factory": { title: "חיפוש שהופך להצעת עמוד", code: "query cluster -> demand score -> editor review\n-> content brief -> SEO/GEO validation -> publish" },
  reports: { title: "משפך אחד", code: "impression -> place_viewed -> phone_clicked\n-> lead_created -> booking_confirmed" },
  "provider-router": { title: "החזרה בטוחה לספק", code: "enqueue('provider.writeback', { provider, bookingId, type })\nIdempotency-Key: provider:bookingId:type" },
  web: { title: "טעינת מעבר עמוד", code: "prefetch(route + data)\nrender cached shell immediately\nstream fresh sections" },
};

const techStack: TechChoice[] = [
  { id: "typescript", name: "TYPESCRIPT", category: "PRIMARY LANGUAGE", role: "שפת הפיתוח המרכזית לאתר, לשרתים, לחוזי הממשקים וללוגיקה המשותפת.", why: "טיפוסים קשיחים תופסים שגיאות בין ספקים, אתר ואפליקציות לפני שהן מגיעות לייצור. אותה שפה מקצרת פיתוח ומאפשרת שיתוף מודלים.", example: "type CanonicalPlace = {\n  id: string;\n  world: WorldId;\n  providerRefs: ProviderRef[];\n  version: number;\n}" },
  { id: "react-next", name: "REACT + NEXT.JS", category: "WEB PRODUCT", role: "ממשק מהיר עם רינדור שרת, טעינה הדרגתית ומעבר עמודים ללא מסך לבן.", why: "מתאים למוצר חיפוש עשיר, לקידום אורגני, לתוכן ולממשקים אינטראקטיביים. מאפשר להביא HTML מהשרת ואז להפעיל רק את החלקים הלחיצים.", example: "export default async function PlacePage({ params }) {\n  const place = await getPlace(params.slug);\n  return <PlaceView place={place} />;\n}" },
  { id: "workers", name: "CLOUDFLARE WORKERS + CDN", category: "GLOBAL EDGE", role: "הפעלת קוד והגשת תוכן קרוב לגולש בישראל ובעולם.", why: "זמן תגובה נמוך, קפיצות עומס אוטומטיות, הגנה ומטמון עולמי בלי לנהל צי שרתים ידנית.", example: "request -> nearest edge -> cache check\n-> API gateway -> response" },
  { id: "postgres", name: "POSTGRESQL + SQL", category: "SOURCE OF TRUTH", role: "מסד הנתונים העסקי הקנוני לעסקים, יחידות, מחירים, הזמנות, הרשאות וגרסאות.", why: "עסקאות אמינות, קשרים מורכבים, חיפוש גיאוגרפי, שכפול וגיבוי. זה בסיס נכון למערכת הזמנות רב־עולמית.", example: "BEGIN;\nUPDATE places SET version = version + 1 WHERE id = $1;\nINSERT INTO place_revisions (...) VALUES (...);\nCOMMIT;" },
  { id: "redis", name: "REDIS", category: "HOT CACHE", role: "מטמון מהיר, מגבלות קצב, נעילות קצרות ומניעת הצפה של ספקים.", why: "זמן תגובה של אלפיות שנייה ומבני נתונים שמתאימים לזמינות קצרת חיים ולחיפושים חוזרים.", example: "SET availability:unit_7:2026-08-20 payload EX 15 NX" },
  { id: "opensearch", name: "OPENSEARCH", category: "SEARCH", role: "חיפוש טקסט, סינון, מפה, תעתיקים, מילים נרדפות ודירוג בכל העולמות.", why: "מסד עסקאות אינו צריך לשאת לבדו אלפי שילובי חיפוש. אינדקס נפרד נותן מהירות וגמישות וניתן לבנות אותו מחדש.", example: "multi_match(title, aliases, description)\n+ geo_distance + availability + quality_rank" },
  { id: "r2", name: "R2 OBJECT STORAGE", category: "MEDIA", role: "שמירת מקור וגרסאות של תמונות, סרטונים ומסמכים, עם הפצה דרך CDN.", why: "מדיה אינה שייכת למסד הנתונים. אחסון אובייקטים זול, עמיד ומתאים לעיבוד גרסאות רבות.", example: "media/{placeId}/{assetId}/original.jpg\nmedia/{placeId}/{assetId}/card.avif" },
  { id: "queues", name: "QUEUES + WORKERS", category: "BACKGROUND JOBS", role: "סנכרונים, עיבוד תמונות, כתיבה חזרה לספק, אינדוקס והתראות רצים ברקע.", why: "הגולש אינו מחכה לעבודה כבדה. כל משימה ניתנת לניסיון חוזר, מעקב ובידוד תקלות.", example: "publish(sync.place.updated)\nconsume -> validate -> upsert -> reindex -> purge cache" },
  { id: "react-native", name: "REACT NATIVE", category: "MOBILE APPS", role: "אפליקציות עתידיות לאייפון ולאנדרואיד על אותם חוזי API ולוגיקה משותפת.", why: "מהירות יציאה לשתי החנויות, שיתוף טיפוסים ולוגיקה, ועדיין אפשרות לרכיבים טבעיים כשנדרש.", example: "const place = await viiApi.places.get(id);\nreturn <NativePlaceScreen place={place} />;" },
  { id: "telemetry", name: "OPENTELEMETRY", category: "OBSERVABILITY", role: "קישור בין בקשת גולש, קריאת ספק, שאילתה, תור ותגובה אחת.", why: "במערכת מרובת ספקים חייבים לדעת איפה זמן אבד ומי נכשל, בלי לנחש ובלי לחשוף מידע אישי.", example: "traceId -> web -> gateway -> provider adapter\nmetrics: latency, errors, queue_lag, cache_hit" },
  { id: "terraform", name: "TERRAFORM", category: "INFRASTRUCTURE AS CODE", role: "הגדרת סביבות, הרשאות, תורים, מסדי נתונים והתראות כקוד מבוקר.", why: "מונע הגדרות ידניות שונות בין פיתוח לייצור ומאפשר לשחזר סביבה ולהתרחב למדינות נוספות.", example: "module \"vii_region\" {\n  country = \"IL\"\n  environment = \"production\"\n}" },
];

const providerExamples = [
  { provider: "SERGEY", world: "VACATIONS", code: "provider_id: 1042", title: "וילת הדגמה בגליל", fields: "שם, מזהה, אודות, כתובת, מיקום, תמונות, מתקנים, יחידות, מבנה חדרים, מחירים, מדיניות וזמינות", meta: "3 יחידות · בריכה · החל מ־1,900 ₪" },
  { provider: "SPA PLUS", world: "SPA", code: "provider_id: 310", title: "ספא הדגמה בתל אביב", fields: "שם, מזהה, אודות, כתובת, תמונות, טיפולים, משכים, מטפלים, חבילות, מחירים, שעות ותורים", meta: "12 טיפולים · פתוח היום · החל מ־260 ₪" },
  { provider: "FUTURE PROVIDER", world: "ATTRACTIONS", code: "provider_id: pending", title: "אטרקציית הדגמה בצפון", fields: "שם, מזהה, תיאור, מיקום, תמונות, סוגי כרטיסים, גילאים, מגבלות, שעות, מחירים וזמינות", meta: "משפחות · 90 דקות · החל מ־85 ₪" },
];

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

export function PlatformExplorer() {
  const [selectedNode, setSelectedNode] = useState<PlatformNode | null>(null);
  const [selectedTech, setSelectedTech] = useState<TechChoice | null>(null);
  const [activeLayer, setActiveLayer] = useState<"all" | NodeKind>("all");
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const modalOpen = Boolean(selectedNode || selectedTech);
  const isVisible = (kind: NodeKind) => activeLayer === "all" || activeLayer === kind;

  function selectNode(node: PlatformNode) {
    setSelectedTech(null);
    setSelectedNode(node);
  }

  function selectTech(tech: TechChoice) {
    setSelectedNode(null);
    setSelectedTech(tech);
  }

  function closeModal() {
    setSelectedNode(null);
    setSelectedTech(null);
  }

  useEffect(() => {
    if (!modalOpen) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

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
      previousFocusRef.current?.focus();
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
          <a className={styles.topAction} href="#platform-map">למפת המערכת</a>
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
          <div className={styles.orbit} aria-label="כל עולמות VII">
            <span className={styles.orbitRing} />
            <span className={styles.orbitCore}><img src="/vii-logo.png" alt="" width="160" height="122" /><small>VII CORE</small></span>
            {worlds.map((world, index) => <button type="button" key={world.id} className={`${styles.orbitWorld} ${styles[`orbitWorld${index + 1}`]}`} onClick={() => selectNode(world)} aria-haspopup="dialog" aria-controls="platform-detail-dialog" dir="ltr">{world.title}</button>)}
          </div>
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

      <section className={styles.dataContract} aria-labelledby="data-contract-title">
        <div className={styles.sectionHeading}>
          <span>FULL PLACE DATA CONTRACT</span>
          <h2 id="data-contract-title">כן, שומרים אצלנו את כל המידע הדרוש על המקום</h2>
          <p>החוזה מול כל ספק חייב להגדיר במפורש את כל שדות העסק. VII אינה מסתפקת בשם ובמחיר, והיא גם אינה מציגה שדה שלא התקבל ואומת.</p>
        </div>
        <div className={styles.fieldCloud} aria-label="שדות מידע מלאים על מקום">
          {["PROVIDER ID", "NAME", "ABOUT", "DESCRIPTIONS", "ADDRESS", "GEO LOCATION", "IMAGES + ORDER", "AMENITIES", "POLICIES", "UNITS", "ROOM STRUCTURE", "CAPACITY", "PRICES", "AVAILABILITY", "OPENING HOURS", "TREATMENTS", "TICKETS"].map((field) => <span key={field} dir="ltr">{field}</span>)}
        </div>
        <div className={styles.storageGrid}>
          <article><span>01</span><b dir="ltr">RAW PAYLOAD STORE</b><p>עותק מקורי ובלתי משתנה של מה שהספק שלח, לצורכי ביקורת, שחזור והשוואה.</p></article>
          <article><span>02</span><b dir="ltr">CANONICAL DATABASE</b><p>הגרסה האחידה של VII לעסק, ליחידות, למחירים, למדיניות ולקשרים בין הנתונים.</p></article>
          <article><span>03</span><b dir="ltr">MEDIA OBJECT STORAGE</b><p>מקור התמונות, מזהה הספק, זכויות, checksum וגרסאות מהירות שמופצות דרך CDN.</p></article>
          <article><span>04</span><b dir="ltr">SEARCH INDEX + CACHE</b><p>עותק שמותאם לחיפוש ולתצוגה מהירה, ותמיד ניתן לבנייה מחדש ממקור האמת.</p></article>
          <article><span>05</span><b dir="ltr">SYNC LEDGER</b><p>מי השתנה, איזו גרסה התקבלה, מה עודכן, מה נכשל ומתי העמוד הציבורי התרענן.</p></article>
        </div>
        <div className={styles.updateTimeline}>
          <div><span>1</span><b>סרגיי או גל משנים מידע</b><p>לדוגמה תמונה, טקסט, מחיר או מבנה חדרים.</p></div>
          <i aria-hidden="true">←</i>
          <div><span>2</span><b>מתקבל אירוע שינוי</b><p>Webhook מיידי, ובנוסף סנכרון השלמה מחזורי.</p></div>
          <i aria-hidden="true">←</i>
          <div><span>3</span><b>VII בודקת הבדל וגרסה</b><p>אימות שדות, checksum ו-upsert שאינו יוצר כפילות.</p></div>
          <i aria-hidden="true">←</i>
          <div><span>4</span><b>כל העותקים מתרעננים</b><p>מסד קנוני, מדיה, אינדקס חיפוש ומטמון.</p></div>
          <i aria-hidden="true">←</i>
          <div><span>5</span><b>האתר מציג את העדכון</b><p>הגרסה החדשה עולה בלי להמתין לקריאה מלאה לספק.</p></div>
        </div>
      </section>

      <section className={styles.providerExamples} aria-labelledby="provider-examples-title">
        <div className={styles.sectionHeading}>
          <span>PROVIDER TO VII EXAMPLES</span>
          <h2 id="provider-examples-title">כך רשומת ספק הופכת לעמוד וכרטיס ב־VII</h2>
          <p>הדוגמאות הבאות מדומות לצורך המחשה בלבד. הן אינן עסקים אמיתיים ואינן הוכחה לחיבור פעיל.</p>
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
              <span>לצפייה בפרטי המקום</span>
            </div>
          </article>)}
        </div>
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
            return <button type="button" key={item.nodeId} onClick={() => selectNode(node)} aria-haspopup="dialog" aria-controls="platform-detail-dialog"><span dir="ltr">{item.label}</span><b>{item.title}</b><p>{item.copy}</p><i aria-hidden="true">←</i></button>;
          })}
        </div>
      </section>

      <section className={styles.techSection} aria-labelledby="technology-title">
        <div className={styles.sectionHeading}>
          <span>ENGINEERING CHOICES</span>
          <h2 id="technology-title">הטכנולוגיה שנבחרה, ולמה היא נכונה ל־VII</h2>
          <p>כל אריח נפתח להסבר ולדוגמת קוד. זו ארכיטקטורת היעד, והבחירה הסופית בכל שירות תאושר מול חוזי הספקים, בדיקות עומס, אבטחה ועלויות אמיתיות.</p>
        </div>
        <div className={styles.techGrid}>
          {techStack.map((tech) => <button type="button" key={tech.id} onClick={() => selectTech(tech)} aria-haspopup="dialog" aria-controls="platform-detail-dialog">
            <span dir="ltr">{tech.category}</span>
            <b dir="ltr">{tech.name}</b>
            <p>{tech.role}</p>
            <i>למה בחרנו ודוגמת קוד</i>
          </button>)}
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

      {modalOpen && <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
        <div id="platform-detail-dialog" ref={dialogRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="platform-modal-title" tabIndex={-1}>
          <button type="button" className={styles.modalClose} onClick={closeModal} aria-label="סגירת ההסבר">×</button>
          {selectedNode && <>
            <div className={styles.detailHeader}>
              <span className={styles.detailIcon} aria-hidden="true">{selectedNode.icon}</span>
              <div><span>{kindNames[selectedNode.kind]}</span><h3 id="platform-modal-title" dir="ltr">{selectedNode.title}</h3></div>
            </div>
            <p className={styles.detailLead}>{selectedNode.summary}</p>
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
              <div><span dir="ltr">{selectedTech.category}</span><h3 id="platform-modal-title" dir="ltr">{selectedTech.name}</h3></div>
            </div>
            <p className={styles.detailLead}>{selectedTech.role}</p>
            <div className={styles.whyChoice}><b>למה זו בחירה נכונה</b><p>{selectedTech.why}</p></div>
            <div className={styles.codeExample}><span>דוגמה טכנית</span><pre dir="ltr"><code>{selectedTech.example}</code></pre></div>
            <div className={styles.status}><span aria-hidden="true" /><div><b>החלטת יעד</b><p>הטכנולוגיה תאושר לייצור לאחר אבטיפוס, בדיקת עומס, בדיקת אבטחה וניתוח עלות.</p></div></div>
          </>}
        </div>
      </div>}

      <footer className={styles.footer}>
        <Link href="/" aria-label="חזרה לאתר VII"><img src="/vii-logo.png" alt="וי פור ויקיישן" width="160" height="122" /></Link>
        <p>VII PLATFORM BLUEPRINT</p>
        <span>מסמך חזון אינטראקטיבי לצוות. ללא מידע סודי וללא פרטי גישה.</span>
      </footer>
    </>
  );
}
