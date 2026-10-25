"use client";

import { useAdminCanEdit } from "../admin-access-context.tsx";
import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, RefreshCw, Save, Search, Trash2, X } from "lucide-react";
import styles from "./redirects.module.css";

type Redirect = { source_path: string; target_path: string | null; status: 301 | 410; active: number; deleted: number;
  updated_at: string; updated_by: string; origin: "legacy" | "managed"; bundled: boolean };
type Form = { sourcePath: string; targetPath: string; status: 301 | 410; active: boolean };
type InventoryMeta = { page: number; pageSize: number; pages: number; total: number; allTotal: number;
  baselineTotal: number; deleted: number; counts: { redirects: number; gone: number; active: number; draft: number; legacy: number; managed: number } };
type InventoryResponse = InventoryMeta & { redirects: Redirect[] };
const blank: Form = { sourcePath: "", targetPath: "", status: 301, active: false };
const emptyMeta: InventoryMeta = { page: 1, pageSize: 100, pages: 1, total: 0, allTotal: 0,
  baselineTotal: 0, deleted: 0, counts: { redirects: 0, gone: 0, active: 0, draft: 0, legacy: 0, managed: 0 } };

export default function RedirectsPage() {
  const canEdit = useAdminCanEdit();
  const [rows, setRows] = useState<Redirect[]>([]);
  const [meta, setMeta] = useState<InventoryMeta>(emptyMeta);
  const [form, setForm] = useState<Form>(blank);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<Redirect | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "100", status: statusFilter, state: stateFilter, origin: originFilter });
      if (query.trim()) params.set("q", query.trim());
      const response = await fetch(`/api/admin/redirects?${params}`, { cache: "no-store" });
      if (response.status === 403) { setForbidden(true); setRows([]); return; }
      if (!response.ok) throw new Error("רשימת ההפניות אינה זמינה כרגע.");
      const payload = await response.json() as InventoryResponse;
      const { redirects, ...nextMeta } = payload;
      setForbidden(false); setRows(redirects); setMeta(nextMeta);
      if (payload.page !== page) setPage(payload.page);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאת טעינה"); }
    finally { setLoading(false); }
  }, [originFilter, page, query, stateFilter, statusFilter]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 220); return () => window.clearTimeout(timer); }, [load]);

  async function save() {
    if (!canEdit) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/redirects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!response.ok) {
        const body = await response.json() as { error?: string };
        if (body.error === "redirect_chain") throw new Error("ההפניה תיצור שרשרת. בחרו יעד סופי ישיר.");
        if (body.error === "invalid_redirect") throw new Error("בדקו שהכתובת הישנה פנויה ושהיעד הוא עמוד קיים באתר.");
        throw new Error("השמירה נכשלה. לא שינינו את ההפניה.");
      }
      setForm(blank); setMessage("ההפניה נשמרה ותועדה."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאת שמירה"); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!canEdit || !deleteCandidate) return;
    setDeleting(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/redirects", { method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePath: deleteCandidate.source_path }) });
      if (!response.ok) throw new Error("המחיקה נכשלה. ההפניה נשארה ללא שינוי.");
      setDeleteCandidate(null); setForm((current) => current.sourcePath === deleteCandidate.source_path ? blank : current);
      setMessage("ההפניה נמחקה, תועדה ולא תחזור ממיפוי ישן נסתר."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאת מחיקה"); }
    finally { setDeleting(false); }
  }

  function edit(row: Redirect) {
    setForm({ sourcePath: row.source_path, targetPath: row.target_path || "", status: row.status, active: Boolean(row.active) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return <main className={styles.page} dir="rtl"><header className={styles.head}><div><h1>כתובות והפניות</h1><p>מלאי מאוחד של כל הפניות 301 וכתובות 410, כולל המיפוי שהועבר מהאתר הישן ושינויים שנעשו במערכת.</p></div><button type="button" onClick={() => void load()} disabled={loading} aria-label="רענון רשימת ההפניות" title="רענון"><RefreshCw size={18} /></button></header>
    {loading && !rows.length ? <p className={styles.notice} role="status">טוענים את מלאי הכתובות המלא...</p> : null}
    {forbidden ? <div className={styles.notice}><p>יש להיכנס עם חשבון מנהל מורשה.</p><a href="/api/auth/google?returnTo=%2Fadmin%2Fredirects">כניסה עם Google</a></div> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}{message ? <p className={styles.success} role="status">{message}</p> : null}
    {!forbidden ? <><section className={styles.summary} aria-label="סיכום מלאי ההפניות"><article><span>סה״כ במערכת</span><strong>{meta.allTotal.toLocaleString("he-IL")}</strong><small>מתוך {meta.baselineTotal.toLocaleString("he-IL")} במיפוי המקורי</small></article><article><span>הפניות 301</span><strong>{meta.counts.redirects.toLocaleString("he-IL")}</strong><small>ליעד חלופי פעיל או בטיוטה</small></article><article><span>כתובות 410</span><strong>{meta.counts.gone.toLocaleString("he-IL")}</strong><small>הוסרו ללא תחליף</small></article><article><span>שינויים מנוהלים</span><strong>{meta.counts.managed.toLocaleString("he-IL")}</strong><small>{meta.deleted.toLocaleString("he-IL")} נמחקו ותועדו</small></article></section>
    <section className={styles.editor} aria-labelledby="editor-title"><h2 id="editor-title">{rows.some((row) => row.source_path === form.sourcePath) ? "עריכת הפניה" : "הפניה חדשה"}</h2><div className={styles.fields}>
      <label>כתובת ישנה<input dir="ltr" value={form.sourcePath} onChange={(event) => setForm({ ...form, sourcePath: event.target.value })} placeholder="/old-page" /></label>
      <label>תוצאה<select value={form.status} onChange={(event) => setForm({ ...form, status: Number(event.target.value) as 301 | 410 })}><option value={301}>301 לכתובת חדשה</option><option value={410}>410 הוסר ללא תחליף</option></select></label>
      {form.status === 301 ? <label>יעד באתר<input dir="ltr" value={form.targetPath} onChange={(event) => setForm({ ...form, targetPath: event.target.value })} placeholder="/search" /></label> : null}
      <label className={styles.check}><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> הפעלה לציבור</label>
    </div><div className={styles.actions}><button type="button" onClick={() => void save()} disabled={!canEdit || saving || loading}><Save size={16} /> {saving ? "שומרים..." : "שמירה"}</button><button type="button" className={styles.secondary} onClick={() => setForm(blank)}>ניקוי</button></div><p className={styles.hint}>עריכת רשומה מהמיפוי הישן יוצרת גרסה מנוהלת ומתועדת. אין להפנות לדף הבית ללא יעד שקול.</p></section>
    <section className={styles.list} aria-labelledby="list-title"><div className={styles.listHead}><div><h2 id="list-title">כל הכתובות וההפניות</h2><span>{meta.total.toLocaleString("he-IL")} תוצאות מתוך {meta.allTotal.toLocaleString("he-IL")}</span></div>{loading ? <span role="status">מעדכנים...</span> : null}</div>
      <div className={styles.filters}><label className={styles.search}><Search size={16} /><input dir="ltr" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="חיפוש כתובת מקור או יעד" /></label><label><span>תוצאה</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="all">301 ו־410</option><option value="301">301 בלבד</option><option value="410">410 בלבד</option></select></label><label><span>מצב</span><select value={stateFilter} onChange={(event) => { setStateFilter(event.target.value); setPage(1); }}><option value="all">פעיל וטיוטה</option><option value="active">פעיל</option><option value="draft">טיוטה</option></select></label><label><span>מקור</span><select value={originFilter} onChange={(event) => { setOriginFilter(event.target.value); setPage(1); }}><option value="all">כל המקורות</option><option value="legacy">מיפוי האתר הישן</option><option value="managed">שונה במערכת</option></select></label></div>
      {rows.length ? <div className={styles.tableWrap}><table><thead><tr><th>מקור</th><th>יעד / תשובה</th><th>מצב</th><th>מקור הנתון</th><th>עודכן</th><th>פעולות</th></tr></thead><tbody>{rows.map((row) => <tr key={row.source_path}><td dir="ltr">{row.source_path}</td><td dir="ltr">{row.status === 410 ? "410 Gone" : row.target_path}</td><td>{row.active ? "פעיל" : "טיוטה"}</td><td><span className={row.origin === "managed" ? styles.managed : styles.legacy}>{row.origin === "managed" ? "שונה במערכת" : "הועבר מהאתר הישן"}</span></td><td className={styles.updated}><time dateTime={row.updated_at}>{new Date(row.updated_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}</time><small dir={row.origin === "managed" ? "ltr" : "rtl"}>{row.origin === "managed" ? row.updated_by : "מיפוי מאושר"}</small></td><td><div className={styles.rowActions}><button type="button" onClick={() => edit(row)}>עריכה</button>{row.active ? <a href={row.source_path} target="_blank" rel="noreferrer" aria-label={`בדיקת ${row.source_path}`}><ArrowUpRight size={16} /></a> : null}<button type="button" className={styles.deleteAction} disabled={!canEdit} onClick={() => setDeleteCandidate(row)} aria-label={`מחיקת ${row.source_path}`}><Trash2 size={15} /> מחיקה</button></div></td></tr>)}</tbody></table></div> : !loading ? <p className={styles.empty}>{meta.allTotal ? "לא נמצאו כתובות במסננים שבחרתם." : "עדיין אין הפניות שמורות."}</p> : null}
      <nav className={styles.pagination} aria-label="עמודי הפניות"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={meta.page <= 1 || loading}><ChevronRight size={16} /> הקודם</button><span>עמוד {meta.page.toLocaleString("he-IL")} מתוך {meta.pages.toLocaleString("he-IL")}</span><button type="button" onClick={() => setPage((value) => Math.min(meta.pages, value + 1))} disabled={meta.page >= meta.pages || loading}>הבא <ChevronLeft size={16} /></button></nav>
    </section></> : null}
    {deleteCandidate ? <div className={styles.dialogBackdrop} role="presentation"><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="delete-title"><button type="button" className={styles.dialogClose} onClick={() => setDeleteCandidate(null)} aria-label="סגירה"><X size={18} /></button><Trash2 size={24} /><h2 id="delete-title">למחוק את ההפניה?</h2><code dir="ltr">{deleteCandidate.source_path}</code><p>המחיקה תתועד ותמנע מהמיפוי הישן להפעיל שוב את אותה הפניה מאחורי הקלעים.</p><div><button type="button" className={styles.danger} onClick={() => void remove()} disabled={deleting}>{deleting ? "מוחקים..." : "כן, למחוק"}</button><button type="button" className={styles.secondary} onClick={() => setDeleteCandidate(null)} disabled={deleting}>ביטול</button></div></section></div> : null}
  </main>;
}
