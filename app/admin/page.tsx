"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowLeft, BarChart3, CalendarSync, MessageCircle, RefreshCw, ShieldCheck, Star, TrendingUp, Route, FilePenLine, ListChecks } from "lucide-react";
import styles from "./admin.module.css";

type Overview = {
  account: { name: string; email: string };
  totals: { bookings: number | null; reviews: number | null; whatsappLeads: number | null };
  catalog: Array<{ world: string; activeCount: number; acceptedAt: string | null }> | null;
  recentActivity: Array<{ id: string; type: string; label: string; detail: string; at: string; href: string }>;
  generatedAt: string;
};

const worlds: Record<string, string> = { vacations: "נופש", events: "אירועים", rooms: "חדרים לפי שעה", spa: "ספא" };
const number = (value: number | null) => value === null ? "לא זמין" : value.toLocaleString("he-IL");
const date = (value: string | null) => value ? new Date(value).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }) : "עדיין אין משיכה מאושרת";

const modules = [
  { title: "קטלוג וספקים", description: "משיכות נתונים, מצב ארבעת התחומים ושגיאות.", href: "/admin/catalog-sync", icon: CalendarSync },
  { title: "חיפושים באתר", description: "מדידה בהסכמה לפי תחום, יעד ותקופה.", href: "/admin/search-analytics", icon: BarChart3 },
  { title: "ביצועי עסקים", description: "חשיפות, כניסות, פעולות והמרות לפי עסק.", href: "/admin/business-performance", icon: BarChart3 },
  { title: "תור אישורי תוכן", description: "עמודים לבדיקה מתוך חיפושים אמיתיים, עם מעבר לעריכה ותזמון.", href: "/admin/content-queue", icon: ListChecks },
  { title: "עמודי חיפוש", description: "עריכת כותרת ותיאור לעמודי נחיתה קבועים, עם טיוטות וגרסאות.", href: "/admin/search-pages", icon: FilePenLine },
  { title: "הפניות וכתובות", description: "ניהול 301 ו־410 לכתובות ישנות, עם תיעוד שינויים.", href: "/admin/redirects", icon: Route },
  { title: "הזמנות וחוות דעת", description: "בקשות הזמנה, חוות דעת ומצב המסירה הידוע.", href: "/admin/operations", icon: Star },
  { title: "פניות וואטסאפ", description: "פניות שנשמרו בטופס המקדים של VII.", href: "/admin/whatsapp-leads", icon: MessageCircle },
  { title: "קידום מקומות", description: "טיוטות קידום מתועדות. הדירוג הציבורי עדיין לא מושפע מהן.", href: "/admin/discovery-promotions", icon: TrendingUp },
];

export default function AdminHome() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/overview", { cache: "no-store", headers: { Accept: "application/json" } });
      if (response.status === 403) { setForbidden(true); setOverview(null); return; }
      if (!response.ok) throw new Error("לא הצלחנו לטעון את נתוני הניהול. נסו שוב.");
      setForbidden(false);
      setOverview(await response.json() as Overview);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאת טעינה"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  return <main className={styles.page} dir="rtl">
    {loading && !overview ? <section className={styles.state} role="status" aria-live="polite"><RefreshCw size={20} className={styles.spin} aria-hidden="true" /> טוענים את מרכז הניהול...</section> : null}
    {forbidden ? <section className={styles.state}><ShieldCheck size={28} aria-hidden="true" /><h1>כניסה למנהלי VII</h1><p>המידע כאן פתוח רק לחשבון מנהל מורשה.</p><a href="/api/auth/google?returnTo=%2Fadmin" className={styles.primary}>כניסה עם Google <ArrowLeft size={17} aria-hidden="true" /></a></section> : null}
    {error ? <section className={styles.state} role="alert"><h1>נתוני הניהול אינם זמינים</h1><p>{error}</p><button onClick={() => void refresh()} type="button" className={styles.primary}>ניסיון חוזר</button></section> : null}
    {overview && !forbidden ? <div className={styles.content}>
      <div className={styles.heading}><div><p className={styles.eyebrow}>מרכז תפעול</p><h1>תמונת מצב</h1><p>פעילות שנשמרה במערכות VII.</p></div><button type="button" className={styles.refresh} onClick={() => void refresh()} disabled={loading} title="רענון נתונים" aria-label="רענון נתונים"><RefreshCw size={18} className={loading ? styles.spin : ""} /></button></div>
      <div className={styles.metrics} aria-label="נתוני פעילות"><article><small>בקשות הזמנה</small><strong>{number(overview.totals.bookings)}</strong><span>מאז תחילת התיעוד ב־VII</span></article><article><small>חוות דעת</small><strong>{number(overview.totals.reviews)}</strong><span>מאז תחילת התיעוד ב־VII</span></article><article><small>פניות וואטסאפ</small><strong>{number(overview.totals.whatsappLeads)}</strong><span>טפסים שהושלמו ונשמרו</span></article></div>
      <section className={styles.section} aria-labelledby="tools-title"><div className={styles.sectionHead}><h2 id="tools-title">כלי ניהול פעילים</h2><span>{modules.length} כלים</span></div><div className={styles.modules}>{modules.map(({ title, description, href, icon: Icon }) => <a key={href} href={href} className={styles.module}><Icon size={22} aria-hidden="true" /><span><strong>{title}</strong><small>{description}</small></span><ArrowLeft size={18} aria-hidden="true" /></a>)}</div></section>
      <div className={styles.columns}><section className={styles.section} aria-labelledby="catalog-title"><div className={styles.sectionHead}><h2 id="catalog-title">קטלוגים</h2><a href="/admin/catalog-sync">ניהול משיכות <ArrowLeft size={15} aria-hidden="true" /></a></div><div className={styles.catalog}>{Object.keys(worlds).map((world) => { const state = overview.catalog?.find((item) => item.world === world); return <div key={world}><strong>{worlds[world]}</strong><span>{overview.catalog === null ? "נתוני הקטלוג אינם זמינים" : state ? `${number(state.activeCount)} מקומות` : "אין דור קטלוג מאושר"}</span><small>{overview.catalog === null ? "נסו לרענן" : date(state?.acceptedAt || null)}</small></div>; })}</div></section>
      <section className={styles.section} aria-labelledby="activity-title"><div className={styles.sectionHead}><h2 id="activity-title">מה קרה באתר</h2><Activity size={18} aria-hidden="true" /></div>{overview.recentActivity.length ? <ol className={styles.activity}>{overview.recentActivity.map((event) => <li key={`${event.type}-${event.id}`}><a href={event.href}><span><strong>{event.label}</strong><small>{event.detail}</small></span><time dateTime={event.at}>{date(event.at)}</time></a></li>)}</ol> : <p className={styles.empty}>עדיין אין פעילות מתועדת במקורות המחוברים.</p>}</section></div>
      <p className={styles.updated}>עדכון אחרון: <time dateTime={overview.generatedAt}>{date(overview.generatedAt)}</time></p>
    </div> : null}
  </main>;
}

