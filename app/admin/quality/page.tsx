"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Play, RefreshCw, ShieldCheck, WifiOff } from "lucide-react";
import styles from "./quality.module.css";

type Run = { id: string; triggerKind: string; releaseId: string | null; status: string; startedAt: string; finishedAt: string | null; passedCount: number; failedCount: number; durationMs: number | null };
type Incident = { id: string; checkId: string; family: string; world: string; route: string; viewport: string; severity: string; status: string; firstSeenAt: string; lastSeenAt: string; recoveredAt: string | null; occurrences: number; lastObserved: string };
type Check = { checkId: string; family: string; world: string; route: string; viewport: string; severity: string; cadenceMinutes: number; expected: string; active: number };
type Dashboard = { generatedAt: string; notificationProvider: { email: string }; checks: Check[]; runs: Run[]; incidents: Incident[]; deliveries: Array<{ incidentId: string; status: string; reason: string | null; createdAt: string }> };

const dt = (value: string | null) => value ? new Date(value).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "short" }) : "—";
const statusLabel: Record<string, string> = { passed: "עבר", failed: "נכשל", degraded: "חלקי", running: "רץ", open: "פתוח", acknowledged: "בטיפול", resolved: "נסגר" };

export default function QualityPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
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
  const active = useMemo(() => data?.incidents.filter((incident) => incident.status !== "resolved") || [], [data]);
  const runNow = async () => {
    if (running) return;
    setRunning(true); setError("");
    try {
      const response = await fetch("/api/admin/quality", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "run" }) });
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
  return <main className={styles.page} dir="rtl">
    <header className={styles.header}><div><p>VII Quality Control</p><h1>איכות ויציבות</h1><span>בדיקות קריאה בטוחות שרצות אוטומטית. אין יצירת הזמנות, פניות, חוות דעת או תשלומים.</span></div><div className={styles.actions}><button type="button" onClick={() => void load()} disabled={loading || running} aria-label="רענון"><RefreshCw size={18} className={loading ? styles.spin : ""} /></button><button type="button" className={styles.run} onClick={() => void runNow()} disabled={running} aria-busy={running}>{running ? <RefreshCw size={18} className={styles.spin} /> : <Play size={18} />} {running ? "בודקים עכשיו..." : "בדיקה בטוחה עכשיו"}</button></div></header>
    {error ? <div className={styles.error} role="alert"><WifiOff size={18} />{error}</div> : null}
    {loading && !data ? <div className={styles.loading} role="status"><RefreshCw className={styles.spin} />טוענים את מצב האיכות...</div> : null}
    {data ? <>
      <section className={styles.summary} aria-label="סיכום איכות"><article data-tone={active.length ? "danger" : "success"}><span>{active.length ? <AlertTriangle /> : <CheckCircle2 />}</span><div><strong>{active.length}</strong><small>אירועים פעילים</small></div></article><article><span><ShieldCheck /></span><div><strong>{data.checks.filter((check) => check.active).length}</strong><small>בדיקות פעילות</small></div></article><article><span><Clock3 /></span><div><strong>{data.runs[0] ? statusLabel[data.runs[0].status] || data.runs[0].status : "טרם רץ"}</strong><small>ריצה אחרונה, {dt(data.runs[0]?.finishedAt || null)}</small></div></article><article data-tone="notice"><span><WifiOff /></span><div><strong>{data.notificationProvider.email === "not_configured" ? "לא מחובר" : "מחובר"}</strong><small>התראות מייל</small></div></article></section>
      <section className={styles.section}><div className={styles.sectionHead}><div><h2>אירועים</h2><p>כשל חוזר מעדכן את אותו אירוע. מעבר תקין סוגר אותו אוטומטית.</p></div><span>{active.length} דורשים טיפול</span></div>{data.incidents.length ? <div className={styles.incidents}>{data.incidents.map((incident) => <article key={incident.id} data-status={incident.status}><div className={styles.incidentTop}><span data-severity={incident.severity}>{incident.severity}</span><b>{statusLabel[incident.status] || incident.status}</b><time>{dt(incident.lastSeenAt)}</time></div><h3>{incident.checkId}</h3><p><bdi dir="ltr">{incident.route}</bdi> · {incident.world} · {incident.viewport}</p><code>{incident.lastObserved}</code><footer><span>{incident.occurrences} הופעות</span><div>{incident.status === "open" ? <button onClick={() => void act(incident.id, "acknowledge")}>קיבלתי, בטיפול</button> : null}{incident.status !== "resolved" ? <button onClick={() => void act(incident.id, "resolve")}>סגירה ידנית</button> : <button onClick={() => void act(incident.id, "reopen")}>פתיחה מחדש</button>}</div></footer></article>)}</div> : <div className={styles.clear}><CheckCircle2 /><strong>אין אירועים</strong><span>כשתתגלה תקלה היא תופיע כאן עם הנתיב והראיה.</span></div>}</section>
      <section className={styles.grid}><div className={styles.section}><div className={styles.sectionHead}><div><h2>ריצות אחרונות</h2><p>תזמון אוטומטי והרצות ידניות.</p></div></div><div className={styles.table}>{data.runs.map((run) => <div key={run.id}><span data-run={run.status}>{statusLabel[run.status] || run.status}</span><b>{run.triggerKind === "manual" ? "ידנית" : "מתוזמנת"}</b><small>{run.passedCount} עברו, {run.failedCount} נכשלו</small><time>{dt(run.startedAt)}</time></div>)}</div></div><div className={styles.section}><div className={styles.sectionHead}><div><h2>כיסוי קבוע</h2><p>הבדיקות הפעילות לפי עולם וקצב.</p></div></div><div className={styles.table}>{data.checks.map((check) => <div key={check.checkId}><b>{check.checkId}</b><small>{check.world} · {check.viewport}</small><span>כל {check.cadenceMinutes} דק׳</span><bdi dir="ltr">{check.route}</bdi></div>)}</div></div></section>
      <p className={styles.note}>מיילים אינם מסומנים כנשלחו: טרם חובר ספק משלוח מאומת. האירועים נשמרים ומוצגים כאן כבר עכשיו.</p>
    </> : null}
  </main>;
}
