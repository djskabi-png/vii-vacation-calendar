"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, Plus, ShieldCheck, Users } from "lucide-react";
import { adminModules, type AdminPermissions } from "../../lib/admin-permissions.ts";
import type { AdminGrant } from "../../lib/admin-grants.ts";
import styles from "./users.module.css";

type Dashboard = { actor: string; grants: AdminGrant[]; protectedAccounts: { email: string; manageUsers: boolean }[]; audit: { id: string; email: string; action: string; actor: string; createdAt: string }[] };
type Draft = { email: string; name: string; active: boolean; manageUsers: boolean; permissions: AdminPermissions; version: number };
const blank = (): Draft => ({ email: "", name: "", active: true, manageUsers: false, permissions: {}, version: 0 });
const errors: Record<string, string> = {
  forbidden: "אין לכם הרשאה לניהול משתמשים. בדקו שאתם מחוברים לחשבון המתאים.",
  invalid_origin: "הבקשה לא נשלחה מהאתר. רעננו את העמוד ונסו שוב.",
  invalid_input: "בדקו את כתובת האימייל, השם ותחומי הגישה שבחרתם.",
  protected_account: "אי אפשר לשנות חשבון מוגן או את ההרשאות של החשבון שלכם כאן.",
  version_conflict: "ההרשאות השתנו מאז שפתחתם אותן. טענו מחדש ובדקו את הגרסה העדכנית לפני שמירה.",
};
const failure = (code?: string) => errors[code || ""] || "לא הצלחנו לשמור או לטעון את ההרשאות. בדקו את הרשימה לפני ניסיון נוסף.";

export default function AdminUsersPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [review, setReview] = useState(false);
  const submitLock = useRef(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setData(payload);
      return payload as Dashboard;
    } catch (cause) { setData(null); setError(failure(cause instanceof Error ? cause.message : undefined)); return null; }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function edit(grant?: AdminGrant) {
    setDraft(grant ? { ...grant, permissions: { ...grant.permissions } } : blank());
    setError(""); setMessage(""); setReview(false);
  }
  async function save() {
    if (!draft || submitLock.current) return;
    submitLock.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/users", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, confirmed: true }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      const fresh = await load();
      const stored = fresh?.grants.find((grant) => grant.email === payload.grant.email);
      if (!stored || stored.version !== payload.grant.version || !fresh?.audit.some((entry) => entry.id === payload.auditId)) throw new Error("readback_failed");
      setDraft(null); setReview(false);
      setMessage(stored.active ? "הגישה נשמרה. חשבון Google בכתובת שאישרתם יזוהה בכניסה הראשונה." : "הגישה בוטלה. בקשות נוספות של המשתמש לא יקבלו גישה לניהול.");
    } catch (cause) { setReview(false); setError(failure(cause instanceof Error ? cause.message : undefined)); }
    finally { setBusy(false); submitLock.current = false; }
  }
  const selected = draft ? adminModules.filter((item) => draft.permissions[item.id]) : [];
  const protectedDraft = draft && (data?.actor === draft.email.trim().toLowerCase() || data?.protectedAccounts.some((item) => item.email === draft.email.trim().toLowerCase()));

  return <main className={styles.page} dir="rtl">
    <header className={styles.heading}><div><span><Users size={18} aria-hidden="true" /> ניהול הצוות</span><h1>משתמשים והרשאות</h1><p>מחליטים למי יש גישה ולמה. השינויים חלים על מערכת הניהול בלבד.</p></div>{!draft && data ? <button type="button" onClick={() => edit()}><Plus size={18} aria-hidden="true" /> הוספת גישה</button> : null}</header>
    {error ? <div className={styles.notice} role="alert"><p>{error}</p><button type="button" disabled={busy || loading} onClick={() => void load()}>טעינת הרשאות מחדש</button></div> : null}
    {message ? <p className={styles.success} role="status">{message}</p> : null}
    {loading ? <p role="status"><LoaderCircle size={18} aria-hidden="true" /> טוענים הרשאות...</p> : null}
    {draft && data ? <section className={styles.editor} aria-labelledby="access-title">
      <h2 id="access-title">{review ? "בדיקת הגישה לפני שמירה" : draft.version ? "עריכת גישה" : "גישה חדשה"}</h2>
      {!review ? <form onSubmit={(event) => { event.preventDefault(); setReview(true); }}>
        <div className={styles.fields}><label>שם<input value={draft.name} required maxLength={100} autoComplete="name" disabled={busy} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>אימייל של חשבון Google<input type="email" dir="ltr" value={draft.email} required maxLength={254} autoComplete="email" disabled={busy || draft.version > 0} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label></div>
        <p className={styles.help}>הגישה תופעל בכניסה הראשונה עם חשבון Google בכתובת הזאת ותיקשר אליו. לא נשלחת הודעה אוטומטית.</p>
        <fieldset className={styles.permissions}><legend>לאילו תחומים לתת גישה?</legend><p>כל תחום כולל את כל עולמות האתר. עריכה כוללת גם פרסום או הפעלת סנכרון, כשהפעולות קיימות בתחום.</p>{adminModules.map((module) => <label key={module.id}><span>{module.label}</span><select aria-label={`הרשאה: ${module.label}`} disabled={busy} value={draft.permissions[module.id] || "none"} onChange={(event) => { const permissions = { ...draft.permissions }; if (event.target.value === "none") delete permissions[module.id]; else permissions[module.id] = event.target.value as "view" | "edit"; setDraft({ ...draft, permissions }); }}><option value="none">ללא גישה</option><option value="view">צפייה בלבד</option>{module.editable ? <option value="edit">צפייה ועריכה</option> : null}</select></label>)}</fieldset>
        <p className={styles.help}>ניהול משתמשים והרשאות שמור לשני בעלי המערכת המוגנים בלבד. לכל שאר החשבונות אפשר להעניק רק את תחומי הצפייה והעריכה שנבחרו כאן.</p>
        {draft.version ? <label className={styles.toggle}><input type="checkbox" checked={draft.active} disabled={busy} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /><span>גישה פעילה <small>ביטול הסימון חוסם גם משתמש שכבר מחובר.</small></span></label> : null}
        {protectedDraft ? <p role="alert">זהו חשבון מוגן או החשבון שלכם. לא ניתן לשנות אותו כאן.</p> : null}
        <div className={styles.actions}><button type="submit" disabled={busy || !!protectedDraft || (!selected.length && draft.active)}>בדיקה לפני שמירה</button><button type="button" className={styles.secondary} disabled={busy} onClick={() => setDraft(null)}>ביטול</button></div>
      </form> : <div className={styles.review}><p><strong>{draft.name}</strong><br /><bdi dir="ltr">{draft.email}</bdi></p><p>{draft.active ? "הגישה תאושר לחשבון Google שצוין" : "הגישה תבוטל"}</p>{draft.active ? <><ul>{selected.map((module) => <li key={module.id}>{module.label}: {draft.permissions[module.id] === "edit" ? "צפייה ועריכה" : "צפייה בלבד"}</li>)}</ul><p>ללא הרשאה לניהול משתמשים.</p></> : null}<div className={styles.actions}><button type="button" disabled={busy} aria-busy={busy} onClick={() => void save()}>{busy ? <><LoaderCircle size={18} aria-hidden="true" /> שומרים...</> : draft.active ? "אישור ושמירת גישה" : "אישור ביטול גישה"}</button><button type="button" className={styles.secondary} disabled={busy} onClick={() => setReview(false)}>חזרה לעריכה</button></div></div>}
    </section> : null}
    {data && !draft ? <>
      <section className={styles.list} aria-label="חשבונות עם גישה"><h2>גישה קיימת</h2>{data.protectedAccounts.map((item) => <article key={item.email}><ShieldCheck size={20} aria-hidden="true" /><div><bdi dir="ltr">{item.email}</bdi><small>בעל מערכת מוגן, כולל ניהול כל התחומים וההרשאות</small></div><span>חשבון מוגן</span></article>)}{data.grants.map((grant) => <article key={grant.email}><div><strong>{grant.name}</strong><bdi dir="ltr">{grant.email}</bdi><small>{!grant.active ? "הגישה בוטלה" : !grant.identityBound ? "ממתין לכניסה עם Google" : `${Object.keys(grant.permissions).length} תחומים`}</small></div><button type="button" className={styles.secondary} disabled={grant.email === data.actor} onClick={() => edit(grant)}>עריכת גישה</button></article>)}{!data.grants.length ? <p>עדיין לא נוספו משתמשים לצוות. אפשר להתחיל עם „הוספת גישה”.</p> : null}</section>
      <details className={styles.history}><summary>היסטוריית שינויי גישה</summary>{data.audit.length ? data.audit.map((entry) => <article key={entry.id}><bdi dir="ltr">{entry.email}</bdi><span>{entry.action === "revoke" ? "ביטול גישה" : entry.action === "grant" ? "הענקת גישה" : entry.action === "identity_bound" ? "חיבור לחשבון Google" : "עדכון הרשאות"}</span><small>על ידי <bdi dir="ltr">{entry.actor}</bdi></small><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}</time></article>) : <p>טרם נשמרו שינויים.</p>}</details>
    </> : null}
  </main>;
}
