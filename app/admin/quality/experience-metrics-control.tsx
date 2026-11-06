"use client";

import { useEffect, useRef, useState } from 'react';
import type { readExperienceSummary } from '../../../services/vii-quality-control/src/experience-summary';
import styles from './quality.module.css';

type Summary = Awaited<ReturnType<typeof readExperienceSummary>>;
const worlds: Record<string, string> = { vacation: 'נופש', events: 'אירועים', spa: 'ספא', hourly: 'לפי שעה', activities: 'אטרקציות', trails: 'טיולים', providers: 'ספקים', global: 'כללי' };
const routes: Record<string, string> = { home: 'בית', world: 'עולם', results: 'תוצאות', place: 'מקום', editorial: 'תוכן' };
const metrics: Record<string, string> = { lcp: 'תוכן מרכזי', inp: 'תגובה לפעולה', cls: 'יציבות התצוגה', ttfb: 'תחילת תגובת השרת', navigation_commit: 'מעבר לעמוד', results_ready: 'תוצאות מוצגות', map_ready: 'מפה מוכנה', gallery_ready: 'גלריה מוצגת', client_error: 'שגיאות דפדפן' };
const states: Record<string, string> = { disabled: 'המדידה עדיין לא הופעלה.', insufficient_data: 'עדיין אין מדידות בחלון הזמן הזה.', truncated: 'יש יותר נתונים ממגבלת הדוח. הדוח לא מוצג באופן חלקי.', invalid_data: 'הנתונים לא עברו אימות ולכן לא מוצגים מדדי מהירות.', invalid_generation: 'גרסת האתר למדידה עדיין לא הוגדרה.' };

/** Separate, on-demand read. It never delays the initial quality dashboard. */
export default function ExperienceMetricsControl() {
  const [data, setData] = useState<Summary | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); }, []);
  async function load() {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 8000);
    setLoading(true); setMessage(''); setData(null); setPageIndex(0);
    try {
      const response = await fetch('/api/admin/quality?experience=1', { cache: 'no-store', headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) throw Error('unavailable');
      const payload = await response.json();
      if (typeof payload?.state !== 'string') throw Error('invalid');
      if (payload.state !== 'ok') { setMessage(states[payload.state] || 'נתוני המדידה אינם זמינים כרגע.'); return; }
      if (!Array.isArray(payload.series) || !Number.isSafeInteger(payload.sampleCount) || payload.sampleCount < 0 || !Number.isSafeInteger(payload.windowStart) || !Number.isSafeInteger(payload.windowEnd)) throw Error('invalid');
      setData(payload);
    } catch { if (!controller.signal.aborted || request.current === controller) setMessage('לא הצלחנו לטעון את המדדים. אפשר לנסות שוב.'); }
    finally { clearTimeout(timeout); if (request.current === controller) { request.current = null; setLoading(false); } }
  }
  return <details className={`${styles.section} ${styles.experiencePanel}`}>
    <summary>מהירות וחוויית גלישה בפועל</summary>
    <p>מדידות מהגלישה באתר, לפי עולם, סוג עמוד ומכשיר.</p>
    <button className={styles.experienceLoad} type="button" onClick={() => void load()} disabled={loading} aria-busy={loading}>{loading ? 'טוענים מדדים...' : 'טעינת המדדים'}</button>
    {message ? <p role="status">{message}</p> : null}
    {data ? <>
      <p>{data.sampleCount?.toLocaleString('he-IL')} מדידות בחלון של 24 שעות</p>
      <p><bdi>{new Date(data.windowStart!).toLocaleString('he-IL')}</bdi> עד <bdi>{new Date(data.windowEnd!).toLocaleString('he-IL')}</bdi></p>
      <details><summary>איך לקרוא את המדדים?</summary><p>המדידה נעשית בדגימה לאחר הסכמה. הספירה היא של מדידות, ולא של גולשים, ונכללים רק חלונות זמן שהסתיימו. האחוזונים הם אומדנים לפי טווחי מדידה ומוצגים מ־20 מדידות מספריות. זמני המתנה וכשל נכללים כשמשך הזמן נמדד.</p></details>
      <div className={styles.experienceTableScroll}><table className={styles.experienceTable}>
        <caption>מדידות בגרסת האתר הנוכחית</caption>
        <thead><tr><th scope="col">מסלול</th><th scope="col">מדד</th><th scope="col">מדידות</th><th scope="col">אומדן ל־75%</th><th scope="col">אומדן ל־95%</th><th scope="col">שגיאות והמתנות</th></tr></thead>
        <tbody>{data.series.slice(pageIndex * 25, (pageIndex + 1) * 25).map((row, index) => {
          const value = (bound: number | undefined) => row.unit === 'error_count' ? 'אינו מדד זמן' : bound === undefined ? 'אין מספיק מדידות' : row.unit === 'cls_score_x1000' ? (bound / 1000).toLocaleString('he-IL') : `${bound.toLocaleString('he-IL')} מילישניות`;
          return <tr key={index}><th scope="row">{worlds[row.world] || 'כללי'}, {routes[row.routeKind] || 'עמוד'}, {row.device === 'mobile' ? 'נייד' : 'מחשב'}</th><td>{metrics[row.metric] || 'מדד'}</td><td>{Object.values(row.statusCounts).reduce((sum, count) => sum + count, 0).toLocaleString('he-IL')}</td><td>{value(row.p75UpperBound)}</td><td>{value(row.p95UpperBound)}</td><td>{row.statusCounts.error || 0} שגיאות, {row.statusCounts.timeout || 0} המתנות, {row.statusCounts.cancelled || 0} בוטלו, {row.statusCounts.unsupported || 0} ללא תמיכה</td></tr>;
        })}</tbody>
      </table></div>
      <p aria-live="polite">{data.series.length ? pageIndex * 25 + 1 : 0} עד {Math.min((pageIndex + 1) * 25, data.series.length)} מתוך {data.series.length} מסלולי מדידה</p>
      {data.series.length > 25 ? <div className={styles.experiencePagination}>
        <button className={styles.experienceLoad} type="button" disabled={pageIndex === 0} onClick={() => setPageIndex(index => Math.max(0, index - 1))}>המדדים הקודמים</button>
        <button className={styles.experienceLoad} type="button" disabled={(pageIndex + 1) * 25 >= data.series.length} onClick={() => setPageIndex(index => Math.min(Math.ceil(data.series.length / 25) - 1, index + 1))}>המדדים הבאים</button>
      </div> : null}
    </> : null}
  </details>;
}
