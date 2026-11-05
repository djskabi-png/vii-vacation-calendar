"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, BarChart3, CheckCircle2, CircleAlert, FileCode2, FileSearch, Gauge, Globe2, Link2, RefreshCw, Route, Search, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import styles from "./growth.module.css";
import { SitemapDetails, type SitemapReport } from "./sitemap-details.tsx";
import { readGrowthEndpoint } from "./growth-read.ts";

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
  const [state, setState] = useState<GrowthState>(initial); const [sitemapReport, setSitemapReport] = useState<SitemapReport | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [forbidden, setForbidden] = useState(false); const [overviewReady, setOverviewReady] = useState(false);
  const requestRef = useRef(0); const controllersRef = useRef<Set<AbortController>>(new Set());
  const load = useCallback(async () => {
    const requestId = ++requestRef.current; controllersRef.current.forEach((controller) => controller.abort()); controllersRef.current.clear();
    setLoading(true); setError(""); setForbidden(false); setOverviewReady(false); setState(initial); setSitemapReport(null);
    const run = async <T,>(url: string, kind: "json" | "text", apply: (result: Awaited<ReturnType<typeof readGrowthEndpoint<T>>>) => void) => { const controller = new AbortController(); controllersRef.current.add(controller); const result = await readGrowthEndpoint<T>(fetch, url, kind, controller); controllersRef.current.delete(controller); if (requestId === requestRef.current) apply(result); return result; };
    const overviewPromise = run("/api/admin/overview", "json", (result) => { if (result.status === 403) { requestRef.current += 1; controllersRef.current.forEach((controller) => controller.abort()); controllersRef.current.clear(); setForbidden(true); setOverviewReady(false); setState(initial); setSitemapReport(null); setLoading(false); return; } const overview = result.ok ? result.value as { search: { searches: number; pending: number; published: number; zeroResults: number } | null; business: object | null; generatedAt: string } : null; setState((current) => ({ ...current, measurement: overview?.search || overview?.business ? "healthy" : "limited", searches: overview?.search?.searches || 0, pending: overview?.search?.pending || 0, published: overview?.search?.published || 0, zeroResults: overview?.search?.zeroResults || 0, generatedAt: overview?.generatedAt || null })); setOverviewReady(Boolean(overview)); if (!result.ok) setError("לא הצלחנו לטעון את נתוני הקידום. אפשר לנסות שוב."); });
    const sitemapPromise = run<SitemapReport>("/api/admin/sitemap", "json", (result) => { const sitemap = result.ok ? result.value : null; setSitemapReport(sitemap); setState((current) => ({ ...current, sitemap: sitemap?.healthy ? "healthy" : "error", sitemapUrls: sitemap?.totalUrls || 0, sitemapFiles: sitemap?.totalFiles || 0 })); });
    const robotsPromise = run<string>("/robots.txt", "text", (result) => setState((current) => ({ ...current, robots: result.ok && /sitemap:/i.test(result.value || "") ? "healthy" : "error" })));
    await Promise.all([overviewPromise, sitemapPromise, robotsPromise]); if (requestId === requestRef.current) setLoading(false);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => { window.clearTimeout(timer); requestRef.current += 1; controllersRef.current.forEach((controller) => controller.abort()); controllersRef.current.clear(); }; }, [load]);
  const health = [state.sitemap, state.robots, state.measurement].filter((value) => value === "healthy").length;
  return <main className={styles.page} dir="rtl">
    <header className={styles.header}><div><span>צמיחה, SEO ומדידה</span><h1>מרכז הקידום של V</h1><p>כל מה שעוזר לאתר להימצא, לענות טוב יותר ולמדוד תוצאה. חיבור שלא אומת מוצג כחסר, לא כפעיל.</p></div><button type="button" onClick={() => void load()} disabled={loading} aria-label="רענון נתוני קידום"><RefreshCw size={18} className={loading ? styles.spin : ""} /></button></header>
    {forbidden ? <section className={styles.state}><ShieldCheck size={28} /><h2>נדרשת הרשאת מנהל</h2><a href="/api/auth/google?returnTo=%2Fadmin%2Fgrowth">כניסה עם Google</a></section> : null}{error ? <section className={styles.state} role="alert"><CircleAlert size={28} /><h2>מרכז הקידום אינו זמין</h2><p>{error}</p><button type="button" onClick={() => void load()}>ניסיון חוזר</button></section> : null}
    {!forbidden ? <>
      <section className={styles.hero}><div><span><Sparkles size={18} /> מוכנות תפעולית</span><strong>{health}/3</strong><p>מפת אתר, robots ומדידה פנימית נבדקים מול האתר החי בכל פתיחה.</p></div>{overviewReady ? <div className={styles.pipeline}><article><small>חיפושים שנמדדו</small><strong>{state.searches.toLocaleString("he-IL")}</strong></article><i>←</i><article><small>ממתינים לעבודה</small><strong>{state.pending.toLocaleString("he-IL")}</strong></article><i>←</i><article><small>עמודים שפורסמו</small><strong>{state.published.toLocaleString("he-IL")}</strong></article></div> : null}</section>
      <section className={styles.health} aria-label="בריאות קידום טכנית"><article data-status={state.sitemap}><span><Globe2 size={20} /></span><div><h2>מפת אתר חיה</h2><p>{state.sitemap === "healthy" ? `${state.sitemapUrls.toLocaleString("he-IL")} כתובות ב־${state.sitemapFiles.toLocaleString("he-IL")} קבצים, כולל כל השפות המאושרות` : state.sitemap === "checking" ? "בודקים את מפת האתר..." : "מפת האתר לא החזירה מבנה תקין"}</p><a href="/sitemap.xml" target="_blank" rel="noreferrer">פתיחת המפה <ArrowLeft size={14} /></a></div><StatusIcon value={state.sitemap} /></article><article data-status={state.robots}><span><FileCode2 size={20} /></span><div><h2>מדיניות robots</h2><p>{state.robots === "healthy" ? "הקובץ זמין ומפנה למפת האתר" : state.robots === "checking" ? "בודקים את הקובץ..." : "נדרשת בדיקה של robots.txt"}</p><a href="/robots.txt" target="_blank" rel="noreferrer">פתיחת הקובץ <ArrowLeft size={14} /></a></div><StatusIcon value={state.robots} /></article><article data-status={state.measurement}><span><BarChart3 size={20} /></span><div><h2>מדידת V</h2><p>{state.measurement === "healthy" ? "חיפוש וביצועי עסקים נקראים ממדידה פנימית בהסכמה" : "אין כרגע מקור נתונים פנימי מלא"}</p><a href="/admin/business-performance">פתיחת הדוחות <ArrowLeft size={14} /></a></div><StatusIcon value={state.measurement} /></article></section>
      {sitemapReport ? <SitemapDetails report={sitemapReport} /> : null}
      <section className={styles.section}><header><div><h2>כלי קידום פעילים</h2><p>העבודה נשמרת בתוך V עם תיעוד ויעד ברור.</p></div><span>{modules.length} כלים</span></header><div className={styles.modules}>{modules.map(({ title, description, href, icon: Icon, label }) => <a href={href} key={href}><span className={styles.moduleIcon}><Icon size={21} /></span><div><small>{label}</small><h3>{title}</h3><p>{description}</p></div><ArrowLeft size={17} /></a>)}</div></section>
      <section className={styles.integrations}><header><h2>חיבורים חיצוניים</h2><p>הסטטוס מבוסס על בדיקת הנכסים החיים ב־24 באוקטובר 2026 ועל הטמעת הגרסה הנוכחית.</p></header><div><article><span><Globe2 size={19} /></span><div><strong>Google Search Console</strong><small>נכס הדומיין vii.co.il פעיל. מפת האתר הישנה נקראה בהצלחה עם 2,703 כתובות; המעבר למפת האתר החדשה יבוצע רק בחיתוך הדומיין הראשי.</small></div><b>מאומת</b></article><article><span><BarChart3 size={19} /></span><div><strong>Google Analytics 4</strong><small>הנכס vii.co.il - GA4 וזרם האתר פעילים. מזהה המדידה G-6DMS0FKGYK מתקבל דרך GTM לאחר הסכמת הגולש.</small></div><b>מחובר</b></article><article><span><Link2 size={19} /></span><div><strong>Google Tag Manager</strong><small>המיכל GTM-WG8VXDB נטען באתר הציבורי רק לאחר אישור מדידה. במצב חיוניים בלבד הוא אינו נטען.</small></div><b>מחובר בהסכמה</b></article></div></section>
      {overviewReady && state.zeroResults ? <a className={styles.signal} href="/admin/search-analytics"><CircleAlert size={19} /><div><strong>{state.zeroResults.toLocaleString("he-IL")} חיפושים ללא תוצאה</strong><span>כדאי לבדוק אם חסר עמוד, היצע או שם חלופי.</span></div><ArrowLeft size={17} /></a> : null}
      <p className={styles.updated}>בדיקה אחרונה: {state.generatedAt ? new Date(state.generatedAt).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }) : "בתהליך"}</p>
    </> : null}
  </main>;
}
