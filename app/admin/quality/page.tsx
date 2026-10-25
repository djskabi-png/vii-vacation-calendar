"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Eye, Play, RefreshCw, ShieldCheck, WifiOff } from "lucide-react";
import styles from "./quality.module.css";

type Run = { id: string; triggerKind: string; releaseId: string | null; status: string; startedAt: string; finishedAt: string | null; passedCount: number; failedCount: number; degradedCount: number; blockedCount: number; durationMs: number | null; totalChecks: number; currentCheckId: string | null };
type Incident = { id: string; checkId: string; family: string; world: string; route: string; viewport: string; severity: string; status: string; firstSeenAt: string; lastSeenAt: string; recoveredAt: string | null; occurrences: number; lastObserved: string };
type Check = { checkId: string; family: string; world: string; route: string; viewport: string; severity: string; cadenceMinutes: number; expected: string; active: number };
type Dashboard = { generatedAt: string; notificationProvider: { email: string }; checks: Check[]; runs: Run[]; incidents: Incident[]; deliveries: Array<{ incidentId: string; status: string; reason: string | null; createdAt: string }> };

const dt = (value: string | null) => value ? new Date(value).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "short" }) : "—";
const statusLabel: Record<string, string> = { passed: "עבר", failed: "נכשל", degraded: "חלקי", blocked: "נעצר בבטחה", running: "רץ", open: "פתוח", acknowledged: "בטיפול", resolved: "נסגר" };
const notificationLabel: Record<string, string> = { configured: "מחובר", not_configured: "לא הוגדר", incomplete_configuration: "חסרה הגדרה", unsupported_provider: "ספק לא נתמך" };
const cadenceLabel = (minutes: number) => minutes < 60 ? `כל ${minutes} דקות` : minutes < 1440 ? `כל ${minutes / 60} שעות` : "פעם ביום";
const cadenceOptions = [5, 10, 30, 60, 180, 360, 720, 1440] as const;
type RunLevel = "full" | "medium" | "regular";
const levelCopy: Record<RunLevel, { title: string; detail: string }> = {
  full: { title: "מלאה", detail: "כל הבדיקות: תפקוד, נראות, עולמות, מפות, סליידרים, חיפוש, API, SEO ותוכן." },
  medium: { title: "בינונית", detail: "כל הבדיקות הקריטיות ובדיקות הנראות והמשפחות החשובות." },
  regular: { title: "רגילה", detail: "בדיקות קריטיות בלבד, כדי לזהות במהירות תקלה שמשביתה מסלול מרכזי." },
};
const familyLabel: Record<string, string> = { "global-shell": "מעטפת האתר", "multilingual-shell": "שפות", "multilingual-pages": "עמודים בשפות", search: "חיפוש", "place-pages": "עמודי מקום", maps: "מפות", "catalog-apis": "נתוני עסקים", "home-sliders": "סליידרים בדף הבית", pricing: "מחירים", reviews: "חוות דעת", "content-pages": "עמודי תוכן", "public-trust": "עמודי אמון", "seo-legacy": "קידום והפניות", "world-landings": "עמודי עולמות", "editorial-landings": "עמודי מבצעים וחגים" };
const worldLabel: Record<string, string> = { all: "כל האתר", vacations: "נופש", events: "אירועים", hourly: "חדרים לפי שעה", spa: "ספא", attractions: "אטרקציות", trails: "טיולים", providers: "ספקים" };
const runKind = (value: string) => value === "scheduled" ? "מתוזמנת" : value.endsWith("_regular") ? "ידנית רגילה" : value.endsWith("_medium") ? "ידנית בינונית" : "ידנית מלאה";
const simpleIncident = (incident: Incident) => `הבדיקה של ${familyLabel[incident.family] || incident.family} ב${worldLabel[incident.world] || incident.world} לא קיבלה את התוצאה התקינה שציפינו לה.`;
const incidentImpact = (incident: Incident) => incident.severity === "critical"
  ? "ההשפעה: מסלול מרכזי עלול לא לעבוד לגולשים או למנהלים, ולכן האירוע דורש טיפול מיידי."
  : incident.severity === "high" ? "ההשפעה: חלק חשוב באתר עלול להיות חסר או לא תקין לחלק מהמשתמשים."
  : "ההשפעה: האתר ממשיך לעבוד, אך קיימת חריגה שצריך לבדוק ולתקן.";
const plainCheckDescription = (check: Check) => {
  if (check.checkId === "global.home.semantic") return "דף הבית נפתח עם החיפוש וכרטיסי התוכן המרכזיים.";
  if (check.checkId.startsWith("global.home.")) return `דף הבית בשפת ${check.checkId.includes(".en.") ? "אנגלית" : check.checkId.includes(".fr.") ? "צרפתית" : "רוסית"} נפתח בכתובת הייחודית שלו ומציג תוכן בשפה הנכונה.`;
  if (check.checkId.startsWith("locale.")) return "עמוד מתורגם נפתח בכתובת השפה שלו ושומר על כל הרכיבים החשובים של העמוד המקורי.";
  if (check.checkId === "search.location.semantic") return "חיפוש במקום שיש בו מעט תוצאות נפתח בלי שגיאה וממשיך להציג את המקומות הקרובים.";
  if (check.checkId.startsWith("place.")) return `עמוד מקום בעולם ${worldLabel[check.world] || check.world} מציג את התמונה, פרטי המקום והפעולות החשובות לגולש.`;
  if (check.checkId.startsWith("world.")) return `עמוד העולם ${worldLabel[check.world] || check.world} נפתח ומציג את החיפוש או כרטיסי התוצאות שלו.`;
  if (check.checkId.startsWith("map.snapshot.")) return `המפה בעולם ${worldLabel[check.world] || check.world} מקבלת מיקום תקין ויכולה להיפתח כמפה פעילה.`;
  if (check.checkId.startsWith("api.catalog.")) return `קטלוג ${worldLabel[check.world] || check.world} מחזיר רשימת עסקים תקינה ולא תשובה ריקה או שבורה.`;
  if (check.checkId === "api.home.presentation") return "הסליידרים בדף הבית מקבלים את כל הרשימות שמערכת הניהול מגדירה להם.";
  if (check.checkId === "api.starting-prices") return "מחירי ההתחלה של מקומות הנופש מתקבלים בפורמט תקין.";
  if (check.checkId === "api.reviews.read") return "חוות הדעת של מקום נקראות לפי החוזה התקין בלי לפרסם חוות דעת חדשה.";
  if (check.checkId.startsWith("content.")) return "עמוד התוכן נפתח ומציג את התוכן המרכזי שלו.";
  if (check.checkId.startsWith("legal.")) return "עמוד המידע המשפטי נפתח ומציג את התוכן הנדרש.";
  if (check.checkId.startsWith("seo.sitemap.")) return "קובץ מפת האתר מחזיר כתובות תקינות למנועי החיפוש.";
  if (check.checkId === "seo.sitemap.xml") return "אינדקס מפות האתר נפתח ומפנה לכל מפות האתר הפעילות.";
  return `${familyLabel[check.family] || check.family}: הבדיקה מאמתת שהעמוד או המידע הדרוש זמינים ותקינים.`;
};
const checksForLevel = (checks: Check[], level: RunLevel) => checks.filter((check) => check.active && (level === "full" || level === "medium" && (check.severity === "critical" || check.severity === "high") || level === "regular" && check.severity === "critical"));

export default function QualityPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [level, setLevel] = useState<RunLevel>("full");
  const [error, setError] = useState("");
  const [clock, setClock] = useState(Date.now());
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/quality", { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(response.status === 403 ? "אין הרשאה למסך האיכות." : "נתוני האיכות אינם זמינים כרגע.");
      setData(await response.json() as Dashboard);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאת טעינה"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!running && !data?.runs.some((run) => run.status === "running")) return;
    const timer = window.setInterval(() => { setClock(Date.now()); void load(); }, 1_000);
    return () => window.clearInterval(timer);
  }, [data?.runs, load, running]);
  const active = useMemo(() => data?.incidents.filter((incident) => incident.status !== "resolved") || [], [data]);
  const activeRun = data?.runs.find((run) => run.status === "running") || null;
  const selectedChecks = data ? checksForLevel(data.checks, level) : [];
  const processed = activeRun ? activeRun.passedCount + activeRun.failedCount + activeRun.degradedCount + activeRun.blockedCount : 0;
  const activeCheck = activeRun?.currentCheckId ? data?.checks.find((check) => check.checkId === activeRun.currentCheckId) : null;
  const runNow = async () => {
    if (running || activeRun) return;
    setRunning(true); setError("");
    try {
      const response = await fetch("/api/admin/quality", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "run", level }) });
      if (!response.ok) throw new Error("הרצת הבדיקה נכשלה. לא נשמרה הצלחה מדומה.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאת הרצה"); }
    finally { setRunning(false); }
  };
  const act = async (incidentId: string, action: "acknowledge" | "resolve" | "reopen") => {
    const response = await fetch("/api/admin/quality", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, incidentId }) });
    if (!response.ok) { setError("העדכון לא נשמר."); return; }
    await load();
  };
  const changeCadence = async (checkId: string, cadenceMinutes: number) => {
    setError("");
    const response = await fetch("/api/admin/quality", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "schedule", checkId, cadenceMinutes }) });
    if (!response.ok) { setError("שינוי לוח הזמנים לא נשמר."); return; }
    await load();
  };
  return <main className={styles.page} dir="rtl">
    <header className={styles.header}><div><p>V Quality Control</p><h1>איכות ויציבות</h1><span>QQQAAA בודקת את האתר ומערכת הניהול בלי ליצור הזמנות, פניות, חוות דעת או תשלומים.</span></div><div className={styles.actions}><button type="button" onClick={() => void load()} disabled={loading || running} aria-label="רענון"><RefreshCw size={18} className={loading ? styles.spin : ""} /></button><button type="button" className={styles.run} onClick={() => void runNow()} disabled={running || Boolean(activeRun)} aria-busy={running || Boolean(activeRun)}>{running || activeRun ? <RefreshCw size={18} className={styles.spin} /> : <Play size={18} />} {running || activeRun ? "QQQAAA רצה עכשיו..." : "הפעלת QQQAAA"}</button></div></header>
    {error ? <div className={styles.error} role="alert"><WifiOff size={18} />{error}</div> : null}
    {loading && !data ? <div className={styles.loading} role="status"><RefreshCw className={styles.spin} />טוענים את מצב האיכות...</div> : null}
    {data ? <>
      <section className={styles.runPanel} aria-labelledby="run-panel-title"><div><Eye size={22} /><div><h2 id="run-panel-title">איזו בדיקה לבצע?</h2><p>{levelCopy[level].detail}</p></div></div><div className={styles.levels}>{(Object.keys(levelCopy) as RunLevel[]).map((value) => <button key={value} type="button" data-active={level === value} onClick={() => setLevel(value)} disabled={running || Boolean(activeRun)}><strong>{levelCopy[value].title}</strong><small>{checksForLevel(data.checks, value).length} בדיקות</small></button>)}</div>{activeRun ? <div className={styles.progress} role="status"><span><i style={{ width: `${activeRun.totalChecks ? Math.round(processed / activeRun.totalChecks * 100) : 0}%` }} /></span><b>{activeCheck ? `הבדיקה שמתבצעת עכשיו: ${plainCheckDescription(activeCheck)}` : "מכינים את הבדיקה הראשונה..."}</b><small>{processed} הושלמו · {activeRun.passedCount || 0} עברו · {(activeRun.failedCount || 0) + (activeRun.blockedCount || 0)} נכשלו · {Math.max(0, (activeRun.totalChecks || selectedChecks.length) - processed)} נותרו · זמן שעבר: {Math.max(0, Math.round((clock - Date.parse(activeRun.startedAt)) / 1000))} שניות</small></div> : null}</section>
      <section className={styles.summary} aria-label="סיכום איכות"><article data-tone={active.length ? "danger" : "success"}><span>{active.length ? <AlertTriangle /> : <CheckCircle2 />}</span><div><strong>{active.length}</strong><small>אירועים פעילים</small></div></article><article><span><ShieldCheck /></span><div><strong>{data.checks.filter((check) => check.active).length}</strong><small>בדיקות פעילות</small></div></article><article><span><Clock3 /></span><div><strong>{data.runs[0] ? statusLabel[data.runs[0].status] || data.runs[0].status : "טרם רץ"}</strong><small>ריצה אחרונה, {dt(data.runs[0]?.finishedAt || null)}</small></div></article><article data-tone="notice"><span><WifiOff /></span><div><strong>{notificationLabel[data.notificationProvider.email] || data.notificationProvider.email}</strong><small>התראות מייל</small></div></article></section>
      <section className={styles.section}><div className={styles.sectionHead}><div><h2>אירועים</h2><p>כל אירוע מוסבר תחילה בעברית פשוטה. המידע המקצועי נשאר זמין לפתיחה.</p></div><span>{active.length} דורשים טיפול</span></div>{data.incidents.length ? <div className={styles.incidents}>{data.incidents.map((incident) => <article key={incident.id} data-status={incident.status}><div className={styles.incidentTop}><span data-severity={incident.severity}>{incident.severity === "critical" ? "קריטי" : incident.severity === "high" ? "גבוה" : incident.severity === "medium" ? "בינוני" : "נמוך"}</span><b>{statusLabel[incident.status] || incident.status}</b><time>{dt(incident.lastSeenAt)}</time></div><h3 dir="rtl">{familyLabel[incident.family] || incident.family}</h3><p className={styles.simpleExplanation}>{simpleIncident(incident)}</p><p>{incidentImpact(incident)}</p><p>מה עושים עכשיו: פותחים את הכתובת, בודקים את הרכיב המתואר ומריצים את הבדיקה מחדש אחרי התיקון.</p><details><summary>מידע מקצועי</summary><bdi dir="ltr">{incident.checkId}</bdi><p><bdi dir="ltr">{incident.route}</bdi> · {incident.world} · {incident.viewport}</p><code>{incident.lastObserved}</code></details><footer><span>{incident.occurrences} הופעות</span><div>{incident.status === "open" ? <button onClick={() => void act(incident.id, "acknowledge")}>קיבלתי, בטיפול</button> : null}{incident.status !== "resolved" ? <button onClick={() => void act(incident.id, "resolve")}>סגירה ידנית</button> : <button onClick={() => void act(incident.id, "reopen")}>פתיחה מחדש</button>}</div></footer></article>)}</div> : <div className={styles.clear}><CheckCircle2 /><strong>אין אירועים</strong><span>כשתתגלה תקלה היא תופיע כאן עם הסבר פשוט והמידע המקצועי.</span></div>}</section>
      <section className={styles.grid}><div className={styles.section}><div className={styles.sectionHead}><div><h2>ריצות אחרונות</h2><p>רואים איזה סוג בדיקה בוצע, מתי ומה הייתה התוצאה.</p></div></div><div className={styles.table}>{data.runs.map((run) => <div key={run.id}><span data-run={run.status}>{statusLabel[run.status] || run.status}</span><b>{runKind(run.triggerKind)}</b><small>{run.passedCount} עברו, {run.failedCount} נכשלו</small><time>{dt(run.startedAt)}</time></div>)}</div></div><div className={styles.section}><div className={styles.sectionHead}><div><h2>מה נבדק ומתי?</h2><p>הלו״ז האוטומטי נקבע לפי חומרת התקלה האפשרית, ואפשר לשנות אותו לכל בדיקה.</p></div></div><div className={styles.table}>{data.checks.map((check) => <div key={check.checkId}><b>{plainCheckDescription(check)}</b><small>{worldLabel[check.world] || check.world} · {check.viewport === "mobile" ? "נייד" : check.viewport === "desktop" ? "מחשב" : "שרת"}</small><label><span className="sr-only">תדירות הבדיקה</span><select value={check.cadenceMinutes} onChange={(event) => void changeCadence(check.checkId, Number(event.target.value))} disabled={Boolean(activeRun)}>{cadenceOptions.map((minutes) => <option key={minutes} value={minutes}>{cadenceLabel(minutes)}</option>)}</select></label><details><summary>מידע מקצועי</summary><p>{check.expected}</p><bdi dir="ltr">{check.checkId} · {check.route}</bdi></details></div>)}</div></div></section>
      <p className={styles.note}>{data.notificationProvider.email === "configured" ? "התראות פתיחה והתאוששות נשלחות פעם אחת לכל אירוע, עם מזהה משלוח שנשמר לבקרה." : "האירועים נשמרים ומוצגים כאן. מייל אינו מסומן כנשלח עד שספק, שולח ונמענים מאומתים מוגדרים במלואם."}</p>
    </> : null}
  </main>;
}
