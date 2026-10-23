"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, BarChart3, CalendarSync, CheckCircle2, Eye, FilePenLine, ListChecks, MessageCircle, MousePointerClick, RefreshCw, Route, Search, ShieldCheck, Sparkles, Star, TrendingUp, Users } from "lucide-react";
import { getIsraelGreeting } from "./israel-greeting";
import styles from "./admin.module.css";

type Overview = {
  account: { name: string; email: string };
  totals: { bookings: number | null; reviews: number | null; whatsappLeads: number | null };
  periodDays: number;
  search: { searches: number; uniqueSessions: number; pending: number; published: number; zeroResults: number } | null;
  business: { impressions: number; pageViews: number; phoneReveals: number; whatsappLeads: number; bookingRequests: number; uniqueBrowsers: number } | null;
  catalog: Array<{ world: string; activeCount: number; acceptedAt: string | null }> | null;
  recentActivity: Array<{ id: string; type: string; label: string; detail: string; at: string; href: string }>;
  generatedAt: string;
};

const worlds: Record<string, { name: string; short: string }> = {
  vacations: { name: "נופש", short: "נו" }, events: { name: "אירועים", short: "אי" }, rooms: { name: "חדרים לפי שעה", short: "חד" }, spa: { name: "ספא", short: "ספ" },
};
const number = (value: number | null | undefined) => value == null ? "לא זמין" : value.toLocaleString("he-IL");
const date = (value: string | null) => value ? new Date(value).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "short" }) : "עדיין אין עדכון מאושר";
const rate = (part: number, whole: number) => whole ? `${Math.round(part / whole * 100)}%` : "—";
const activityIcons = { booking: Star, review: Star, whatsapp: MessageCircle, sync: CalendarSync, promotion: TrendingUp } as const;

const modules = [
  { title: "מרכז קידום", description: "מפת אתר, robots, מדידה, תוכן והפניות במבט אחד.", href: "/admin/growth", icon: Sparkles },
  { title: "עמודי חיפוש", description: "מביקוש אמיתי לעריכה, תזמון ופרסום.", href: "/admin/search-pages", icon: FilePenLine },
  { title: "ביצועי עסקים", description: "משפך חשיפה, כניסה, פעולה והמרה לכל עסק.", href: "/admin/business-performance", icon: BarChart3 },
  { title: "קטלוגים וספקים", description: "מצב ארבעת התחומים, משיכות ואבחון תקלות.", href: "/admin/catalog-sync", icon: CalendarSync },
  { title: "מודיעין חיפושים", description: "מה אנשים ביקשו, איפה ומה לא מצא תוצאה.", href: "/admin/search-analytics", icon: Search },
  { title: "תור אישורים", description: "עמודים שממתינים לבדיקה לפי ביקוש ומוכנות.", href: "/admin/content-queue", icon: ListChecks },
  { title: "הפניות וכתובות", description: "ניהול 301 ו־410 עם גרסאות ותיעוד.", href: "/admin/redirects", icon: Route },
  { title: "הזמנות וחוות דעת", description: "בקשות, סטטוסים, אסמכתאות וטיפול.", href: "/admin/operations", icon: Star },
  { title: "פניות וואטסאפ", description: "פניות שנשמרו לפני המעבר לשיחה.", href: "/admin/whatsapp-leads", icon: MessageCircle },
  { title: "איכות ויציבות", description: "בדיקות אוטומטיות, אירועים, התאוששות וראיות.", href: "/admin/quality", icon: ShieldCheck },
];

export default function AdminHome() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [greeting, setGreeting] = useState(() => getIsraelGreeting());
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/overview", { cache: "no-store", headers: { Accept: "application/json" } });
      if (response.status === 403) { setForbidden(true); setOverview(null); return; }
      if (!response.ok) throw new Error("לא הצלחנו לטעון את נתוני הניהול. נסו שוב.");
      setForbidden(false); setOverview(await response.json() as Overview);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאת טעינה"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const updateGreeting = () => setGreeting(getIsraelGreeting());
    const interval = window.setInterval(updateGreeting, 60_000);
    document.addEventListener("visibilitychange", updateGreeting);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", updateGreeting);
    };
  }, []);

  const priorities = useMemo(() => {
    if (!overview) return [];
    const rows: Array<{ title: string; detail: string; href: string; icon: typeof ListChecks }> = [];
    if (overview.search?.pending) rows.push({ title: `${number(overview.search.pending)} עמודים מחכים לטיפול`, detail: "מבוסס על חיפושים אמיתיים", href: "/admin/content-queue", icon: ListChecks });
    if (overview.search?.zeroResults) rows.push({ title: `${number(overview.search.zeroResults)} חיפושים ללא תוצאה`, detail: `${overview.periodDays} הימים האחרונים`, href: "/admin/search-analytics", icon: Search });
    if (overview.business?.pageViews) rows.push({ title: "בדיקת ביצועי העסקים", detail: `${number(overview.business.pageViews)} כניסות לעמודי עסק`, href: "/admin/business-performance", icon: TrendingUp });
    return rows.slice(0, 3);
  }, [overview]);

  return <main className={styles.page} dir="rtl">
    {loading && !overview ? <section className={styles.state} role="status" aria-live="polite"><RefreshCw size={22} className={styles.spin} aria-hidden="true" /><strong>מכינים את מרכז השליטה</strong><span>מחברים נתוני חיפוש, עסקים, קטלוגים ותפעול...</span></section> : null}
    {forbidden ? <section className={styles.state}><ShieldCheck size={30} aria-hidden="true" /><h1>כניסה למנהלי VII</h1><p>המידע כאן פתוח רק לחשבון מנהל מורשה.</p><a href="/api/auth/google?returnTo=%2Fadmin" className={styles.primary}>כניסה עם Google <ArrowLeft size={17} aria-hidden="true" /></a></section> : null}
    {error ? <section className={styles.state} role="alert"><h1>מרכז השליטה אינו זמין</h1><p>{error}</p><button onClick={() => void refresh()} type="button" className={styles.primary}>ניסיון חוזר</button></section> : null}
    {overview && !forbidden ? <div className={styles.content}>
      <div className={styles.heading}><div className={styles.headingCopy}><p className={styles.eyebrow}>מרכז שליטה חי</p><h1>{overview.account.name ? `${greeting}, ${overview.account.name.split(" ")[0]}` : "תמונת המצב של VII"}</h1><p>כל מה שדורש החלטה, כל מה שזז באתר וכל הכלים החשובים במקום אחד.</p></div><div className={styles.headingActions}><a href="/admin/growth" className={styles.ghostButton}><Sparkles size={16} /> מרכז קידום</a><button type="button" className={styles.refresh} onClick={() => void refresh()} disabled={loading} title="רענון נתונים" aria-label="רענון נתונים"><RefreshCw size={18} className={loading ? styles.spin : ""} /></button></div></div>

      <div className={styles.heroGrid}>
        <section className={styles.pulseCard} aria-labelledby="pulse-title"><div className={styles.pulseTop}><span className={styles.pulseLabel}><i className={styles.liveDot} /> נתוני VII, {overview.periodDays} ימים</span><CheckCircle2 size={19} aria-label="הנתונים נטענו" /></div><h2 id="pulse-title">מה קורה עכשיו באתר</h2><p>המספרים כוללים פעילות חיצונית שנשמרה בהסכמה. מנהלים ורובוטים מזוהים אינם נכללים במדדי החיפוש והעסקים.</p><div className={styles.pulseStats}><div><strong>{number(overview.search?.searches)}</strong><small>חיפושים</small></div><div><strong>{number(overview.business?.pageViews)}</strong><small>כניסות לעסקים</small></div><div><strong>{number((overview.business?.phoneReveals || 0) + (overview.business?.whatsappLeads || 0) + (overview.business?.bookingRequests || 0))}</strong><small>פעולות כוונה</small></div></div></section>
        <aside className={styles.priorityCard} aria-labelledby="priority-title"><header><h2 id="priority-title">מה כדאי לעשות עכשיו</h2><span>{priorities.length || 0} משימות</span></header><div className={styles.priorityList}>{priorities.length ? priorities.map(({ title, detail, href, icon: Icon }) => <a className={styles.priorityItem} href={href} key={href}><span><Icon size={17} /></span><div><strong>{title}</strong><small>{detail}</small></div><ArrowLeft size={16} /></a>) : <div className={styles.allClear}><CheckCircle2 size={25} /><p>אין כרגע משימה דחופה שעולה מהנתונים.</p></div>}</div></aside>
      </div>

      <section className={styles.metrics} aria-label="מדדי משפך מרכזיים">
        <article><span className={styles.metricIcon}><Eye size={17} /></span><small>חשיפות לעסקים</small><strong>{number(overview.business?.impressions)}</strong><span>{overview.periodDays} הימים האחרונים</span></article>
        <article><span className={styles.metricIcon}><MousePointerClick size={17} /></span><small>כניסות מתוך חשיפה</small><strong>{rate(overview.business?.pageViews || 0, overview.business?.impressions || 0)}</strong><span>{number(overview.business?.pageViews)} כניסות</span></article>
        <article data-tone="success"><span className={styles.metricIcon}><TrendingUp size={17} /></span><small>פעולה מתוך כניסה</small><strong>{rate((overview.business?.phoneReveals || 0) + (overview.business?.whatsappLeads || 0) + (overview.business?.bookingRequests || 0), overview.business?.pageViews || 0)}</strong><span>טלפון, ליד שמור או הזמנה</span></article>
        <article data-tone="warning"><span className={styles.metricIcon}><Users size={17} /></span><small>דפדפנים ייחודיים</small><strong>{number(overview.business?.uniqueBrowsers)}</strong><span>לא אומדן של אנשים</span></article>
      </section>

      <section className={styles.section} aria-labelledby="tools-title"><div className={styles.sectionHead}><div><h2 id="tools-title">מרכזי העבודה</h2><p>כל יכולת מובילה למסלול עבודה מלא, לא למסך ראווה.</p></div><span>{modules.length} כלים פעילים</span></div><div className={styles.modules}>{modules.map(({ title, description, href, icon: Icon }) => <a key={href} href={href} className={styles.module}><span className={styles.moduleIcon}><Icon size={21} aria-hidden="true" /></span><span><strong>{title}</strong><small>{description}</small></span><ArrowLeft size={17} aria-hidden="true" /></a>)}</div></section>

      <div className={styles.columns}>
        <section className={styles.section} aria-labelledby="catalog-title"><div className={styles.sectionHead}><div><h2 id="catalog-title">בריאות הקטלוגים</h2><p>הדור הציבורי האחרון שנשמר לכל תחום.</p></div><a href="/admin/catalog-sync">ניהול משיכות <ArrowLeft size={14} /></a></div><div className={`${styles.surface} ${styles.catalog}`}>{Object.keys(worlds).map((world) => { const state = overview.catalog?.find((item) => item.world === world); return <div key={world}><span className={styles.catalogIcon}>{worlds[world].short}</span><span className={styles.catalogText}><strong>{worlds[world].name}</strong><small>{overview.catalog === null ? "הקטלוג אינו זמין כרגע" : date(state?.acceptedAt || null)}</small></span><span>{overview.catalog === null ? "—" : state ? `${number(state.activeCount)} מקומות` : "אין דור מאושר"}</span></div>; })}</div></section>
        <section className={styles.section} aria-labelledby="activity-title"><div className={styles.sectionHead}><div><h2 id="activity-title">זרם הפעילות</h2><p>אירועים אחרונים ממערכות התפעול המחוברות.</p></div><Activity size={18} aria-hidden="true" /></div><div className={styles.surface}>{overview.recentActivity.length ? <ol className={styles.activity}>{overview.recentActivity.map((event) => { const Icon = activityIcons[event.type as keyof typeof activityIcons] || Activity; return <li key={`${event.type}-${event.id}`}><a href={event.href}><span className={styles.activityIcon}><Icon size={16} /></span><span><strong>{event.label}</strong><small>{event.detail}</small></span><time dateTime={event.at}>{date(event.at)}</time></a></li>; })}</ol> : <p className={styles.empty}>עדיין אין פעילות מתועדת במקורות המחוברים.</p>}</div></section>
      </div>
      <p className={styles.updated}>עודכן לאחרונה: <time dateTime={overview.generatedAt}>{date(overview.generatedAt)}</time></p>
    </div> : null}
  </main>;
}
