"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, BarChart3, CalendarDays, CheckCircle2, Clock3, ExternalLink, FilePenLine, Filter, RefreshCw, Search, ShieldCheck, Target, Users } from "lucide-react";
import styles from "./search-analytics.module.css";

type SearchRow = {
  eventId?: string; opportunityId: string; suggestedTitle: string; world: string; location: string;
  filters: Record<string, string | number | boolean>; pagePath: string; resultCount: number;
  zeroResult?: boolean; hasDate?: boolean; createdAt?: string; searches?: number;
  uniqueSessions?: number; zeroResults?: number; lastSeenAt?: string; status: string;
};

type Report = {
  periodHours: number; since: string; generatedAt: string; total: number; dated: number;
  pendingOpportunities: number; zeroResults: number; internalTotal: number;
  byWorld: Array<{ world: string; count: number }>; byLocation: Array<{ location: string; count: number }>;
  daily: Array<{ date: string; count: number }>; recentPublic: SearchRow[]; recentInternal: SearchRow[]; topIntents: SearchRow[];
};

const worlds: Record<string, string> = { vacation: "נופש", events: "אירועים", spa: "ספא", hourly: "חדרים לפי שעה" };
const filterNames: Record<string, string> = { type: "סוג", eventType: "אירוע", guests: "אורחים", bedrooms: "חדרי שינה", accessible: "נגישות", features: "מאפיינים", experience: "חוויה", package: "הרכב", maxPrice: "מחיר מרבי", hours: "שעות", noise: "רעש" };
const number = (value: number) => Number(value || 0).toLocaleString("he-IL");
const dateTime = (value?: string) => value ? new Date(value).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "short" }) : "לא ידוע";

function intentLine(row: SearchRow) {
  const filters = Object.entries(row.filters || {}).map(([key, value]) => `${filterNames[key] || key}: ${value === true ? "כן" : value}`);
  return [row.location, ...filters].filter(Boolean).join(" · ");
}

export default function SearchAnalyticsPage() {
  const [days, setDays] = useState(7);
  const [report, setReport] = useState<Report | null>(null);
  const [view, setView] = useState<"public" | "internal">("public");
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async (period: number) => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/search-analytics?days=${period}`, { cache: "no-store" });
      if (response.status === 403) { setForbidden(true); setReport(null); return; }
      if (!response.ok) throw new Error("נתוני החיפושים אינם זמינים כרגע.");
      setForbidden(false); setReport(await response.json() as Report);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאת טעינה"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(days); }, [days, load]);

  const recent = report ? view === "internal" ? report.recentInternal : report.recentPublic : [];
  const daily = useMemo(() => [...(report?.daily || [])].reverse(), [report?.daily]);
  const dailyMax = Math.max(1, ...daily.map((item) => Number(item.count)));
  const resultRate = report?.total ? Math.round((report.total - report.zeroResults) / report.total * 100) : 0;

  return <main className={styles.page} dir="rtl">
    <header className={styles.head}><div><span className={styles.kicker}>מודיעין חיפוש חי</span><h1>מה אנשים מחפשים ב־V</h1><p>רואים את החיפוש עצמו, מבינים מה חסר ועוברים ישר לעריכת עמוד. בדיקות של מנהל נשמרות בנפרד ולעולם אינן מגדילות ביקוש ציבורי.</p></div><button type="button" onClick={() => void load(days)} disabled={loading} title="רענון נתונים" aria-label="רענון נתונים"><RefreshCw size={18} className={loading ? styles.spin : ""} /></button></header>
    <div className={styles.toolbar}><div className={styles.period} role="group" aria-label="תקופת מדידה">{[{ value: 1, label: "24 שעות" }, { value: 7, label: "7 ימים" }, { value: 30, label: "30 ימים" }].map((option) => <button type="button" key={option.value} aria-pressed={days === option.value} onClick={() => setDays(option.value)}>{option.label}</button>)}</div>{report ? <span><Clock3 size={14} /> עודכן {dateTime(report.generatedAt)}</span> : null}</div>
    {forbidden ? <section className={styles.state}><ShieldCheck size={34} /><h2>כניסה למודיעין החיפוש</h2><p>הנתונים פתוחים רק למנהלי V מורשים.</p><a href="/api/auth/google?returnTo=%2Fadmin%2Fsearch-analytics">כניסה עם Google <ArrowLeft size={16} /></a></section> : null}
    {error ? <section className={styles.state} role="alert"><AlertCircle size={34} /><h2>לא הצלחנו לטעון את החיפושים</h2><p>{error}</p><button type="button" onClick={() => void load(days)}>ניסיון חוזר</button></section> : null}
    {loading && !report ? <section className={styles.state} role="status"><RefreshCw size={28} className={styles.spin} /><h2>מחברים את נתוני החיפוש</h2><p>טוענים ביקוש, אפס תוצאות ובדיקות מנהל...</p></section> : null}
    {report && !forbidden ? <>
      <section className={styles.metrics} aria-label="מדדי חיפוש"><article className={styles.metricPrimary}><span><Search size={17} /> חיפושי גולשים</span><strong>{number(report.total)}</strong><small>{days} הימים האחרונים</small></article><article><span><CheckCircle2 size={17} /> מצאו תוצאות</span><strong>{resultRate}%</strong><small>{number(report.total - report.zeroResults)} חיפושים</small></article><article data-tone="warning"><span><AlertCircle size={17} /> ללא תוצאות</span><strong>{number(report.zeroResults)}</strong><small>דורש היצע, ניסוח או עמוד</small></article><article><span><CalendarDays size={17} /> עם תאריך</span><strong>{number(report.dated)}</strong><small>{report.total ? Math.round(report.dated / report.total * 100) : 0}% מהחיפושים</small></article><article><span><FilePenLine size={17} /> ממתינים לעבודה</span><strong>{number(report.pendingOpportunities)}</strong><small>עמודים בתהליך</small></article><article data-tone="internal"><span><Target size={17} /> בדיקות מנהל</span><strong>{number(report.internalTotal)}</strong><small>לא נספרות כביקוש</small></article></section>
      <section className={styles.workspace}>
        <div className={styles.activityPanel}><header><div><h2>זרם החיפושים</h2><p>האירועים האחרונים עם כל ההקשר שצריך כדי לפעול.</p></div><div className={styles.viewSwitch} role="group" aria-label="סוג חיפושים"><button type="button" aria-pressed={view === "public"} onClick={() => setView("public")}><Users size={15} /> גולשים <b>{number(report.total)}</b></button><button type="button" aria-pressed={view === "internal"} onClick={() => setView("internal")}><Target size={15} /> בדיקות שלי <b>{number(report.internalTotal)}</b></button></div></header>
          <div className={styles.recentList}>{recent.length ? recent.map((row) => <article key={row.eventId || `${row.opportunityId}-${row.createdAt}`}><div className={styles.rowIcon} data-world={row.world}>{(worlds[row.world] || row.world).slice(0, 2)}</div><div className={styles.rowMain}><div><span>{worlds[row.world] || row.world}</span>{row.zeroResult ? <b>ללא תוצאות</b> : <small>{number(row.resultCount)} תוצאות</small>}</div><h3>{row.suggestedTitle}</h3><p>{intentLine(row)}</p><code dir="ltr">{row.pagePath}</code></div><div className={styles.rowAction}><time>{dateTime(row.createdAt)}</time><a href={`/admin/search-pages?id=${encodeURIComponent(row.opportunityId)}`}>פתיחה ועריכה <ArrowLeft size={15} /></a></div></article>) : <div className={styles.empty}><Search size={28} /><h3>{view === "internal" ? "עדיין אין בדיקות מנהל בתקופה הזאת" : "עדיין אין חיפושי גולשים בתקופה הזאת"}</h3><p>{view === "internal" ? "בצעו חיפוש באתר וחזרו לכאן. הבדיקה תופיע בנפרד בלי לשנות את הביקוש הציבורי." : "כאשר ייקלטו חיפושים בהסכמה, הם יופיעו כאן עם ההקשר המלא."}</p></div>}</div>
        </div>
        <aside className={styles.insights}><section><header><div><BarChart3 size={18} /><h2>מגמה יומית</h2></div><small>{number(report.total)} חיפושים</small></header><div className={styles.chart}>{daily.length ? daily.map((item) => <div key={item.date} title={`${item.date}: ${item.count}`}><i><b style={{ height: `${Math.max(8, Number(item.count) / dailyMax * 100)}%` }} /></i><span>{new Date(`${item.date}T12:00:00Z`).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" })}</span></div>) : <p>אין עדיין נתונים לגרף.</p>}</div></section><section><header><div><Target size={18} /><h2>אזורים מובילים</h2></div></header><div className={styles.rankList}>{report.byLocation.length ? report.byLocation.slice(0, 7).map((item, index) => <div key={item.location}><span><b>{index + 1}</b>{item.location}</span><strong>{number(item.count)}</strong></div>) : <p>עדיין אין חלוקה לאזורים.</p>}</div></section></aside>
      </section>
      <section className={styles.intentSection}><header><div><span className={styles.kicker}>הזדמנויות לפי ביקוש</span><h2>החיפושים שכדאי להפוך לעמודים</h2><p>הדירוג מבוסס על חיפושי גולשים אמיתיים בלבד. בדיקות מנהל אינן משנות אותו.</p></div><a href="/admin/content-queue">פתיחת תור האישורים <ArrowLeft size={15} /></a></header><div className={styles.intentGrid}>{report.topIntents.length ? report.topIntents.map((row, index) => <article key={row.opportunityId}><div className={styles.intentTop}><span>#{index + 1} · {worlds[row.world] || row.world}</span><small>{dateTime(row.lastSeenAt)}</small></div><h3>{row.suggestedTitle}</h3><p><Filter size={14} /> {intentLine(row)}</p><div className={styles.intentNumbers}><span><strong>{number(row.searches || 0)}</strong> חיפושים</span><span><strong>{number(row.uniqueSessions || 0)}</strong> מפגשים</span><span><strong>{number(row.resultCount)}</strong> תוצאות</span></div><footer><a href={row.pagePath} target="_blank" rel="noreferrer">החיפוש המקורי <ExternalLink size={14} /></a><a href={`/admin/search-pages?id=${encodeURIComponent(row.opportunityId)}`}>עריכת העמוד <ArrowLeft size={14} /></a></footer></article>) : <div className={styles.empty}><Target size={28} /><h3>אין עדיין מספיק ביקוש לדירוג</h3><p>ההזדמנויות יופיעו לאחר קליטת חיפושי גולשים בהסכמה.</p></div>}</div></section>
      <footer className={styles.dataNote}><ShieldCheck size={15} /><p><strong>איך הנתונים עובדים:</strong> חיפוש ציבורי נספר רק לאחר הסכמה למדידה. חשבון מנהל מזוהה נשמר כבדיקה נפרדת. רובוטים מזוהים מסוננים. “מפגש” הוא מזהה דפדפן אנונימי ואינו אומדן של אנשים.</p></footer>
    </> : null}
  </main>;
}
