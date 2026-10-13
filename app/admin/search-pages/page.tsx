"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, RefreshCw, Save } from "lucide-react";
import styles from "./search-pages.module.css";

type Content = { title: string; description: string; status: "draft" | "published" | "scheduled"; scheduledAt: string | null; version: number; updatedAt: string; updatedBy: string };
type Page = { path: string; world: "spa" | "events" | "hourly"; title: string; description: string; override: Content | null };
type Version = Content;
const worlds: Record<Page["world"], string> = { spa: "ספא", events: "אירועים", hourly: "חדרים לפי שעה" };

function localDateTimeInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const part = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
}

export default function SearchPagesAdmin() {
  const [pages, setPages] = useState<Page[]>([]);
  const [selected, setSelected] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [history, setHistory] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const current = pages.find((page) => page.path === selected);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/search-pages", { cache: "no-store" });
      if (response.status === 403) { setForbidden(true); setPages([]); return null; }
      if (!response.ok) throw new Error("עמודי החיפוש אינם זמינים כרגע.");
      const next = (await response.json() as { pages: Page[] }).pages;
      setForbidden(false); setPages(next); return next;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאת טעינה"); return null; }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load().then((next) => { const path = new URLSearchParams(window.location.search).get("path"); if (next && path) void selectPage(path, next); }); }, [load]);

  async function selectPage(path: string, source = pages) {
    const page = source.find((item) => item.path === path);
    if (!page) return;
    setSelected(path); setTitle(page.override?.title || page.title); setDescription(page.override?.description || page.description);
    setScheduledAt(localDateTimeInput(page.override?.scheduledAt));
    setHistory([]); setMessage("");
    try {
      const response = await fetch(`/api/admin/search-pages?history=${encodeURIComponent(path)}`, { cache: "no-store" });
      if (response.ok) setHistory((await response.json() as { history: Version[] }).history);
    } catch { /* History is supplemental; the editor remains usable. */ }
  }

  async function save(status: "draft" | "published" | "scheduled") {
    if (!selected) return;
    setSaving(true); setError(""); setMessage("");
    try {
      // datetime-local has no offset. Convert in the administrator's browser
      // so the API always receives an unambiguous UTC instant.
      const scheduledInstant = status === "scheduled" && scheduledAt ? new Date(scheduledAt).toISOString() : null;
      const response = await fetch("/api/admin/search-pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: selected, title, description, status, scheduledAt: scheduledInstant, expectedVersion: current?.override?.version || 0 }) });
      if (!response.ok) throw new Error(response.status === 409 ? "העמוד השתנה אצל מנהל אחר. רעננו ובדקו לפני שמירה מחדש." : response.status === 400 ? "הכותרת או התיאור קצרים מדי, ארוכים מדי או מכילים תווים לא נתמכים." : "השמירה נכשלה.");
      setMessage(status === "published" ? "העמוד פורסם. בדקו את הקישור הציבורי." : status === "scheduled" ? "העמוד אושר לתזמון. הוא יופיע אוטומטית במועד שנבחר." : "הטיוטה נשמרה. העמוד הציבורי לא השתנה.");
      const refreshed = await load(); if (refreshed) await selectPage(selected, refreshed);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאת שמירה"); }
    finally { setSaving(false); }
  }

  return <main className={styles.page} dir="rtl"><header className={styles.head}><div><h1>עמודי חיפוש</h1><p>כותרת ותיאור לעמודי נחיתה קבועים. העריכה אינה משנה תוצאות, סינון או מידע על ספקים.</p></div><button type="button" onClick={() => void load()} aria-label="רענון עמודים" title="רענון" disabled={loading}><RefreshCw size={18} /></button></header>
    {forbidden ? <div className={styles.notice}><p>יש להיכנס עם חשבון מנהל מורשה.</p><a href="/api/auth/google?returnTo=%2Fadmin%2Fsearch-pages">כניסה עם Google</a></div> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}{message ? <p className={styles.success} role="status">{message}</p> : null}
    {!forbidden ? <div className={styles.grid}><section className={styles.inventory}><h2>עמודים {loading ? "..." : `(${pages.length})`}</h2><div className={styles.items}>{pages.map((page) => <button type="button" key={page.path} className={selected === page.path ? styles.selected : ""} onClick={() => void selectPage(page.path)}><span><strong>{page.override?.title || page.title}</strong><small dir="ltr">{page.path}</small></span><em>{page.override?.status === "published" ? "פורסם" : page.override?.status === "scheduled" ? "מתוזמן" : page.override?.status === "draft" ? "טיוטה" : "ברירת מחדל"}</em></button>)}</div></section>
      <section className={styles.editor}>{current ? <><div className={styles.editorHead}><div><small>{worlds[current.world]}</small><h2>{current.path}</h2></div><a href={current.path} target="_blank" rel="noreferrer">פתיחת העמוד <ArrowUpRight size={16} /></a></div><label>כותרת העמוד<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={90} /></label><label>תיאור העמוד<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={300} rows={4} /></label><p className={styles.counter}>{title.length}/90 · {description.length}/300</p><div className={styles.preview}><small>תצוגה מקדימה למנועי חיפוש</small><strong>{title}</strong><span dir="ltr">vii.spaplus.co{current.path}</span><p>{description}</p></div><label>פרסום עתידי<input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label><div className={styles.actions}><button type="button" disabled={saving} onClick={() => void save("draft")}><Save size={16} /> שמירת טיוטה</button><button type="button" disabled={saving || !scheduledAt} onClick={() => void save("scheduled")}>אישור ותזמון</button><button type="button" disabled={saving} onClick={() => void save("published")}>פרסום עכשיו</button></div><p className={styles.hint}>פרסום מתוזמן מופיע אוטומטית במועד ישראל שנבחר. פרסמו רק טקסט שמבוסס על מידע מאומת. כדי לחזור לגרסה קודמת, בחרו אותה בהיסטוריה ופרסמו מחדש.</p>{history.length ? <div className={styles.history}><h3>גרסאות אחרונות</h3>{history.map((version) => <button key={version.version} type="button" onClick={() => { setTitle(version.title); setDescription(version.description); setScheduledAt(localDateTimeInput(version.scheduledAt)); setMessage(`גרסה ${version.version} נטענה לעורך. אשרו אותה מחדש כדי לשנות את הציבורי.`); }}><span>גרסה {version.version} · {version.status === "published" ? "פורסמה" : version.status === "scheduled" ? "מתוזמנת" : "טיוטה"}</span><time>{new Date(version.updatedAt).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}</time></button>)}</div> : null}</> : <p className={styles.empty}>בחרו עמוד מהרשימה כדי לערוך את הכותרת והתיאור שלו.</p>}</section></div> : null}
  </main>;
}
