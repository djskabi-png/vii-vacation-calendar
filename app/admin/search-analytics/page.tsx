"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import styles from "./search-analytics.module.css";

type Report = { periodHours: number; since: string; generatedAt: string; total: number; dated: number;
  byWorld: Array<{ world: string; count: number }>;
  byLocation: Array<{ location: string; count: number }>;
  daily: Array<{ date: string; count: number }> };

const worlds: Record<string, string> = { vacation: "נופש", events: "אירועים", spa: "ספא", hourly: "חדרים לפי שעה" };
const number = (value: number) => value.toLocaleString("he-IL");

export default function SearchAnalyticsPage() {
  const [days, setDays] = useState(7);
  const [report, setReport] = useState<Report | null>(null);
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

  return <main className={styles.page} dir="rtl"><header className={styles.head}><div><h1>חיפושים באתר</h1><p>חיפושים שבוצעו בטופס לאחר הסכמה למדידה. לא כולל חשבונות מנהל מזוהים או רובוטים מזוהים.</p></div><button type="button" onClick={() => void load(days)} disabled={loading} title="רענון נתונים" aria-label="רענון נתונים"><RefreshCw size={18} aria-hidden="true" /></button></header>
    <div className={styles.period} role="group" aria-label="תקופת מדידה">{[{ value: 1, label: "24 שעות" }, { value: 7, label: "7 ימים" }, { value: 30, label: "30 ימים" }].map((option) => <button type="button" key={option.value} aria-pressed={days === option.value} onClick={() => setDays(option.value)}>{option.label}</button>)}</div>
    {forbidden ? <div className={styles.state}><p>יש להיכנס עם חשבון מנהל מורשה.</p><a href="/api/auth/google?returnTo=%2Fadmin%2Fsearch-analytics">כניסה עם Google</a></div> : null}
    {error ? <div className={styles.state} role="alert"><p>{error}</p><button type="button" onClick={() => void load(days)}>ניסיון חוזר</button></div> : null}
    {loading && !report ? <p role="status" className={styles.state}>טוענים נתוני חיפוש...</p> : null}
    {report && !forbidden ? <><div className={styles.summary}><article><small>חיפושים</small><strong>{number(report.total)}</strong></article><article><small>עם תאריך</small><strong>{number(report.dated)}</strong></article><article><small>בלי תאריך</small><strong>{number(report.total - report.dated)}</strong></article></div>
      <div className={styles.columns}><section><h2>לפי תחום</h2><div className={styles.rows}>{report.byWorld.length ? report.byWorld.map((item) => <div key={item.world}><span>{worlds[item.world] || item.world}</span><strong>{number(item.count)}</strong></div>) : <p>עדיין לא נקלטו חיפושים בתקופה זו.</p>}</div></section><section><h2>יעדים נבחרים</h2><div className={styles.rows}>{report.byLocation.length ? report.byLocation.map((item) => <div key={item.location}><span>{item.location}</span><strong>{number(item.count)}</strong></div>) : <p>עדיין אין נתוני יעדים לתקופה זו.</p>}</div></section></div>
      <section className={styles.daily}><h2>מגמה יומית לפי UTC</h2>{report.daily.length ? <div className={styles.bars}>{[...report.daily].reverse().map((item) => <div key={item.date}><time dateTime={item.date}>{new Date(`${item.date}T12:00:00Z`).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })}</time><span><i style={{ width: `${Math.max(2, item.count / Math.max(...report.daily.map((day) => day.count)) * 100)}%` }} /></span><strong>{number(item.count)}</strong></div>)}</div> : <p>עדיין אין חיפושים בתקופה זו.</p>}</section>
      <p className={styles.foot}>התקופה היא {report.periodHours} שעות אחורה מזמן הבדיקה, לא ימים קלנדריים. המגמה היומית מחושבת לפי UTC. החיפושים שנעשו לפני הפעלת המדידה אינם כלולים.</p></> : null}
  </main>;
}

