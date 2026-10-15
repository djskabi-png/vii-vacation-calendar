"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BarChart3, CheckCircle2, CircleAlert, FileCode2, FileSearch, Gauge, Globe2, Link2, RefreshCw, Route, Search, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import styles from "./growth.module.css";
import { SitemapDetails, type SitemapReport } from "./sitemap-details.tsx";

type GrowthState = { sitemap: "checking" | "healthy" | "error"; sitemapUrls: number; sitemapFiles: number; robots: "checking" | "healthy" | "error"; measurement: "checking" | "healthy" | "limited"; searches: number; pending: number; published: number; zeroResults: number; generatedAt: string | null };
const initial: GrowthState = { sitemap: "checking", sitemapUrls: 0, sitemapFiles: 0, robots: "checking", measurement: "checking", searches: 0, pending: 0, published: 0, zeroResults: 0, generatedAt: null };
const modules = [
  { title: "עמודי חיפוש ותוכן", description: "עריכה, שאלות, מטא, תזמון, גרסאות ופרסום למפת האתר.", href: "/admin/search-pages", icon: FileSearch, label: "מערכת מלאה" },
  { title: "תור הזדמנויות", description: "סדר עדיפות לעמודים שנוצרו מחיפושים אמיתיים.", href: "/admin/content-queue", icon: Search, label: "מבוסס ביקוש" },
  { title: "מודיעין חיפושים", description: "מגמות, אזורים, תחומים וחיפושים שלא החזירו תוצאה.", href: "/admin/search-analytics", icon: BarChart3, label: "מדידה פנימית" },
  { title: "כתובות והפניות", description: "301 ו־410, תיעוד שינויים ובקרת כתובות ישנות.", href: "/admin/redirects", icon: Route, label: "מנוהל" },
  { title: "קידום מקומות", description: "טיוטות קידום מבוקרות בלי להציג השפעה ציבורית שלא אומתה.", href: "/admin/discovery-promotions", icon: TrendingUp, label: "טיוטות" },
  { title: "ביצועי עסקים", description: "יחס חשיפה, כניסה ופעולות לכל עסק ותחום.", href: "/admin/business-performance", icon: Gauge, label: "משפך אמיתי" },
];

function StatusIcon({ value }: { value: "checking" | "healthy" | "error" | "limited" }) {
  return value === "healthy" ? <CheckCircle2 size={18} /> : value === "checking" ? <RefreshCw size={18} className={styles.spin} /> : <CircleAlert size={18} />;
}

export default function GrowthCenter() {
  const [state, setState] = useState<GrowthState>(initial); const [sitemapReport, setSitemapReport] = useState<SitemapReport | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [forbidden, setForbidden] = useState(false);
  const load = useCallback(async () => { setLoading(true); setError(""); try {
    const [overviewResponse, sitemapResponse, robotsResponse] = await Promise.all([fetch("/api/admin/overview", { cache: "no-store" }), fetch("/api/admin/sitemap", { cache: "no-store" }), fetch("/robots.txt", { cache: "no-store" })]);
    if (overviewResponse.status === 403) { setForbidden(true); return; }
    if (!overviewResponse.ok) throw new Error("לא הצלחנו לטעון את נתוני הקידום.");
    const overview = await overviewResponse.json() as { search: { searches: number; pending: number; published: number; zeroResults: number } | null; business: object | null; generatedAt: string };
    const sitemap = sitemapResponse.ok ? await sitemapResponse.json() as SitemapReport : null; const robotsText = robotsResponse.ok ? await robotsResponse.text() : "";
    setSitemapReport(sitemap);
    setForbidden(false); setState({ sitemap: sitemap?.healthy ? "healthy" : "error", sitemapUrls: sitemap?.totalUrls || 0, sitemapFiles: sitemap?.totalFiles || 0, robots: robotsResponse.ok && /sitemap:/i.test(robotsText) ? "healthy" : "error", measurement: overview.search || overview.business ? "healthy" : "limited", searches: overview.search?.searches || 0, pending: overview.search?.pending || 0, published: overview.search?.published || 0, zeroResults: overview.search?.zeroResults || 0, generatedAt: overview.generatedAt });
  } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאת טעינה"); } finally { setLoading(false); } }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const health = [state.sitemap, state.robots, state.measurement].filter((value) => value === "healthy").length;
  return <main className={styles.page} dir="rtl">
    <header className={styles.header}><div><span>צמיחה, SEO ומדידה</span><h1>מרכז הקידום של VII</h1><p>כל מה שעוזר לאתר להימצא, לענות טוב יותר ולמדוד תוצאה. חיבור שלא אומת מוצג כחסר, לא כפעיל.</p></div><button type="button" onClick={() => void load()} disabled={loading} aria-label="רענון נתוני קידום"><RefreshCw size={18} className={loading ? styles.spin : ""} /></button></header>
    {forbidden ? <section className={styles.state}><ShieldCheck size={28} /><h2>נדרשת הרשאת מנהל</h2><a href="/api/auth/google?returnTo=%2Fadmin%2Fgrowth">כניסה עם Google</a></section> : null}{error ? <section className={styles.state} role="alert"><CircleAlert size={28} /><h2>מרכז הקידום אינו זמין</h2><p>{error}</p><button type="button" onClick={() => void load()}>ניסיון חוזר</button></section> : null}
    {!forbidden && !error ? <>
      <section className={styles.hero}><div><span><Sparkles size={18} /> מוכנות תפעולית</span><strong>{health}/3</strong><p>מפת אתר, robots ומדידה פנימית נבדקים מול האתר החי בכל פתיחה.</p></div><div className={styles.pipeline}><article><small>חיפושים שנמדדו</small><strong>{state.searches.toLocaleString("he-IL")}</strong></article><i>←</i><article><small>ממתינים לעבודה</small><strong>{state.pending.toLocaleString("he-IL")}</strong></article><i>←</i><article><small>עמודים שפורסמו</small><strong>{state.published.toLocaleString("he-IL")}</strong></article></div></section>
      <section className={styles.health} aria-label="בריאות קידום טכנית"><article data-status={state.sitemap}><span><Globe2 size={20} /></span><div><h2>מפת אתר חיה</h2><p>{state.sitemap === "healthy" ? `${state.sitemapUrls.toLocaleString("he-IL")} כתובות ב־${state.sitemapFiles.toLocaleString("he-IL")} קבצים, כולל כל השפות המאושרות` : state.sitemap === "checking" ? "בודקים את מפת האתר..." : "מפת האתר לא החזירה מבנה תקין"}</p><a href="/sitemap.xml" target="_blank" rel="noreferrer">פתיחת המפה <ArrowLeft size={14} /></a></div><StatusIcon value={state.sitemap} /></article><article data-status={state.robots}><span><FileCode2 size={20} /></span><div><h2>מדיניות robots</h2><p>{state.robots === "healthy" ? "הקובץ זמין ומפנה למפת האתר" : state.robots === "checking" ? "בודקים את הקובץ..." : "נדרשת בדיקה של robots.txt"}</p><a href="/robots.txt" target="_blank" rel="noreferrer">פתיחת הקובץ <ArrowLeft size={14} /></a></div><StatusIcon value={state.robots} /></article><article data-status={state.measurement}><span><BarChart3 size={20} /></span><div><h2>מדידת VII</h2><p>{state.measurement === "healthy" ? "חיפוש וביצועי עסקים נקראים ממדידה פנימית בהסכמה" : "אין כרגע מקור נתונים פנימי מלא"}</p><a href="/admin/business-performance">פתיחת הדוחות <ArrowLeft size={14} /></a></div><StatusIcon value={state.measurement} /></article></section>
      {sitemapReport ? <SitemapDetails report={sitemapReport} /> : null}
      <section className={styles.section}><header><div><h2>כלי קידום פעילים</h2><p>העבודה נשמרת בתוך VII עם תיעוד ויעד ברור.</p></div><span>{modules.length} כלים</span></header><div className={styles.modules}>{modules.map(({ title, description, href, icon: Icon, label }) => <a href={href} key={href}><span className={styles.moduleIcon}><Icon size={21} /></span><div><small>{label}</small><h3>{title}</h3><p>{description}</p></div><ArrowLeft size={17} /></a>)}</div></section>
      <section className={styles.integrations}><header><h2>חיבורים חיצוניים</h2><p>המצב כאן שמרני בכוונה. אין סימון “מחובר” בלי אימות חי והרשאה מתאימה.</p></header><div><article><span><Globe2 size={19} /></span><div><strong>Google Search Console</strong><small>לא הוכח חיבור פעיל למערכת הניהול</small></div><b>לא מחובר</b></article><article><span><BarChart3 size={19} /></span><div><strong>Google Analytics 4</strong><small>VII מודד אירועים פנימיים, אך חיבור GA4 לא אומת</small></div><b>לא מאומת</b></article><article><span><Link2 size={19} /></span><div><strong>Google Tag Manager</strong><small>אין גרסה פעילה מאומתת או אפשרות פרסום מהמערכת</small></div><b>לא מאומת</b></article></div></section>
      {state.zeroResults ? <a className={styles.signal} href="/admin/search-analytics"><CircleAlert size={19} /><div><strong>{state.zeroResults.toLocaleString("he-IL")} חיפושים ללא תוצאה</strong><span>כדאי לבדוק אם חסר עמוד, היצע או שם חלופי.</span></div><ArrowLeft size={17} /></a> : null}
      <p className={styles.updated}>בדיקה אחרונה: {state.generatedAt ? new Date(state.generatedAt).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }) : "בתהליך"}</p>
    </> : null}
  </main>;
}
