"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, RefreshCw, Save } from "lucide-react";
import styles from "./redirects.module.css";

type Redirect = { source_path: string; target_path: string | null; status: 301 | 410; active: number; updated_at: string; updated_by: string };
type Form = { sourcePath: string; targetPath: string; status: 301 | 410; active: boolean };
const blank: Form = { sourcePath: "", targetPath: "", status: 301, active: false };

export default function RedirectsPage() {
  const [rows, setRows] = useState<Redirect[]>([]);
  const [form, setForm] = useState<Form>(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/redirects", { cache: "no-store" });
      if (response.status === 403) { setForbidden(true); setRows([]); return; }
      if (!response.ok) throw new Error("רשימת ההפניות אינה זמינה כרגע.");
      setForbidden(false); setRows((await response.json() as { redirects: Redirect[] }).redirects);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאת טעינה"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/redirects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!response.ok) {
        const body = await response.json() as { error?: string };
        if (body.error === "redirect_chain") throw new Error("ההפניה תיצור שרשרת. בחרו יעד סופי ישיר.");
        if (body.error === "invalid_redirect") throw new Error("בדקו שהכתובת הישנה פנויה ושהיעד הוא עמוד קיים באתר.");
        throw new Error("השמירה נכשלה. לא שינינו את ההפניה.");
      }
      setForm(blank); setMessage("ההפניה נשמרה."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאת שמירה"); }
    finally { setSaving(false); }
  }

  return <main className={styles.page} dir="rtl"><header className={styles.head}><div><h1>כתובות והפניות</h1><p>הפניות קבועות 301 או תשובת 410 לכתובות ישנות. שינוי פעיל משפיע על גולשים ומנועי חיפוש.</p></div><button type="button" onClick={() => void load()} disabled={loading} aria-label="רענון רשימת ההפניות" title="רענון"><RefreshCw size={18} /></button></header>
    {loading ? <p className={styles.notice} role="status">טוענים הפניות והרשאות...</p> : null}
    {forbidden ? <div className={styles.notice}><p>יש להיכנס עם חשבון מנהל מורשה.</p><a href="/api/auth/google?returnTo=%2Fadmin%2Fredirects">כניסה עם Google</a></div> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}{message ? <p className={styles.success} role="status">{message}</p> : null}
    {!forbidden && !loading && !error ? <><section className={styles.editor} aria-labelledby="editor-title"><h2 id="editor-title">{rows.some((row) => row.source_path === form.sourcePath) ? "עריכת הפניה" : "הפניה חדשה"}</h2><div className={styles.fields}>
      <label>כתובת ישנה<input dir="ltr" value={form.sourcePath} onChange={(event) => setForm({ ...form, sourcePath: event.target.value })} placeholder="/old-page" /></label>
      <label>תוצאה<select value={form.status} onChange={(event) => setForm({ ...form, status: Number(event.target.value) as 301 | 410 })}><option value={301}>301 לכתובת חדשה</option><option value={410}>410 הוסר ללא תחליף</option></select></label>
      {form.status === 301 ? <label>יעד באתר<input dir="ltr" value={form.targetPath} onChange={(event) => setForm({ ...form, targetPath: event.target.value })} placeholder="/search" /></label> : null}
      <label className={styles.check}><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> הפעלה לציבור</label>
    </div><div className={styles.actions}><button type="button" onClick={() => void save()} disabled={saving || loading}><Save size={16} /> {saving ? "שומרים..." : "שמירה"}</button><button type="button" className={styles.secondary} onClick={() => setForm(blank)}>ניקוי</button></div><p className={styles.hint}>אין להפנות כתובת פעילה או להפנות לדף הבית ללא יעד שקול. יש לבדוק את הכתובת אחרי הפעלה.</p></section>
    <section className={styles.list} aria-labelledby="list-title"><div className={styles.listHead}><h2 id="list-title">הפניות שמורות</h2><span>{loading ? "טוענים..." : `${rows.length} רשומות`}</span></div>{rows.length ? <div className={styles.tableWrap}><table><thead><tr><th>מקור</th><th>יעד / תשובה</th><th>מצב</th><th>עודכן</th><th></th></tr></thead><tbody>{rows.map((row) => <tr key={row.source_path}><td dir="ltr">{row.source_path}</td><td dir="ltr">{row.status === 410 ? "410 Gone" : row.target_path}</td><td>{row.active ? "פעיל" : "טיוטה"}</td><td>{new Date(row.updated_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}</td><td><button type="button" onClick={() => { setForm({ sourcePath: row.source_path, targetPath: row.target_path || "", status: row.status, active: Boolean(row.active) }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>עריכה</button>{row.active ? <a href={row.source_path} target="_blank" rel="noreferrer" aria-label={`בדיקת ${row.source_path}`}><ArrowUpRight size={16} /></a> : null}</td></tr>)}</tbody></table></div> : !loading ? <p className={styles.empty}>עדיין אין הפניות שמורות.</p> : null}</section></> : null}
  </main>;
}

