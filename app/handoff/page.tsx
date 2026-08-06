import type { Metadata } from "next";
import { PageShell } from "../components/page-shell";
export const metadata: Metadata = { title: "מרכז מידע לצוות", robots: { index: false, follow: false } };
const rows=[
  ["דף הבית","חיפוש כללי, יעדים, מקומות מומלצים, תוכן ואירועים"],
  ["תוצאות נופש","סינון, מיון, מפה, שמירה ומצבי אפס"],
  ["דף מקום","גלריה, מאפיינים, יומן, יחידה אחת או כמה יחידות"],
  ["עולם אירועים","דף בית, תוצאות ודף מקום לאירוע"],
  ["תוכן ושירות","יעדים, מגזין, מועדפים, ניהול הזמנות ודפים משפטיים"],
];
export default function HandoffPage(){return <PageShell><main id="main-content"><section className="inner-hero shell"><span className="eyebrow">מסירת חזית האתר</span><h1>מרכז המידע לצוות הפיתוח</h1><p>מפת המסכים, מצבי התצוגה ונקודות החיבור למערכת הקיימת.</p></section><section className="section shell handoff-grid"><div><h2>מה כלול</h2>{rows.map(([name,desc])=><article key={name}><strong>{name}</strong><p>{desc}</p></article>)}</div><aside><h2>עקרונות חיבור</h2><ol><li>כתובות העמודים והכותרות מגיעות מהמערכת הקיימת.</li><li>חיפוש, זמינות, מחירים ויחידות מוזנים דרך ממשקי הנתונים.</li><li>תמונות ותוכן נטענים רק ממקורות מאושרים.</li><li>מועדפים נשמרים מקומית ויכולים להתחבר לחשבון משתמש.</li><li>טפסים דורשים נקודת שליחה מאובטחת ואישור מדיניות.</li></ol><a className="button primary" href="https://github.com/djskabi-png/vii-vacation-calendar" target="_blank" rel="noreferrer">קוד המקור</a></aside></section></main></PageShell>}
