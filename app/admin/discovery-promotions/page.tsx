"use client";

import { useAdminCanEdit } from "../admin-access-context.tsx";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Archive, Pencil, RotateCcw, Search, Save } from "lucide-react";
import styles from "./promotions.module.css";

type World = "vacations" | "events" | "rooms" | "spa";
type Kind = "manual" | "new_place" | "ending_contract";
type Draft = {
  eventId: string; campaignId: string; version: number; world: World; supplierId: number; placeName: string;
  kind: Kind; weight: number; startsOn: string; endsOn: string; contractEndsOn: string | null;
  contractSource: string | null; note: string; status: "draft" | "archived";
  actorEmail: string; savedAt: string;
};
type Dashboard = { drafts: Draft[]; activity: Draft[]; publicRankingEnabled: false };
type Form = {
  campaignId: string | null; expectedVersion: number | null; world: World; supplierId: string;
  kind: Kind; weight: number; startsOn: string; endsOn: string; contractEndsOn: string;
  contractSource: string; note: string;
};

const worlds: Record<World, string> = { vacations: "נופש", events: "אירועים", rooms: "חדרים לפי שעה", spa: "ספא" };
const kinds: Record<Kind, string> = { manual: "קידום יזום", new_place: "מקום חדש", ending_contract: "פרסום לקראת סיום" };
const emptyForm = (): Form => ({ campaignId: null, expectedVersion: null, world: "vacations", supplierId: "",
  kind: "manual", weight: 2, startsOn: "", endsOn: "", contractEndsOn: "", contractSource: "", note: "" });
const date = (value: string) => new Date(value).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
const errors: Record<string, string> = {
  forbidden: "אין הרשאת מנהל.", invalid_origin: "הבקשה נחסמה. רעננו את העמוד ונסו שוב.",
  invalid_period: "בדקו שתאריכי ההתחלה והסיום תקינים.", invalid_contract_end: "תאריך סיום הפרסום אינו תקין.",
  contract_end_required: "יש להזין תאריך סיום פרסום.", contract_source_required: "יש לציין מאיפה הגיע תאריך סיום הפרסום.",
  invalid_contract_source: "מקור התאריך ארוך מדי.", invalid_note: "ההערה מוגבלת ל־500 תווים.",
  place_not_published: "המקום אינו מופיע בקטלוג הפעיל. לא נשמרה טיוטה.",
  version_conflict: "מישהו עדכן את הטיוטה. רעננו לפני שמירה נוספת.",
  promotion_storage_unavailable: "שמירת הטיוטות אינה זמינה כרגע.",
};

export default function DiscoveryPromotionsPage() {
  const canEdit = useAdminCanEdit();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [resolvedName, setResolvedName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pendingRequest = useRef<{ key: string; id: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/discovery-promotions", { cache: "no-store" });
      if (response.status === 403) setForbidden(true);
      const result = await response.json() as Dashboard & { error?: string };
      if (!response.ok) throw new Error(errors[result.error || ""] || "לא ניתן לטעון את הטיוטות.");
      setDashboard(result);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאת טעינה."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  function change<K extends keyof Form>(field: K, value: Form[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === "world" || field === "supplierId") setResolvedName("");
    pendingRequest.current = null;
  }

  async function lookup() {
    const supplierId = Number(form.supplierId);
    if (!Number.isSafeInteger(supplierId) || supplierId < 1) { setError("יש להזין מזהה ספק תקין."); return; }
    setLookingUp(true); setError(""); setResolvedName("");
    try {
      const response = await fetch(`/api/admin/discovery-promotions?world=${form.world}&id=${supplierId}`, { cache: "no-store" });
      const result = await response.json() as { name?: string; error?: string };
      if (!response.ok || !result.name) throw new Error(errors[result.error || ""] || "המקום לא נמצא בקטלוג הפעיל.");
      setResolvedName(result.name);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "בדיקת המקום נכשלה."); }
    finally { setLookingUp(false); }
  }

  function edit(draft: Draft) {
    setForm({ campaignId: draft.campaignId, expectedVersion: draft.version, world: draft.world,
      supplierId: String(draft.supplierId), kind: draft.kind, weight: draft.weight,
      startsOn: draft.startsOn, endsOn: draft.endsOn, contractEndsOn: draft.contractEndsOn || "",
      contractSource: draft.contractSource || "", note: draft.note });
    setResolvedName(draft.placeName); setError(""); setNotice(""); pendingRequest.current = null;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(status: "draft" | "archived", sourceForm = form) {
    if (!canEdit) return;
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    const requestKey = JSON.stringify({ sourceForm, status });
    if (pendingRequest.current?.key !== requestKey) pendingRequest.current = { key: requestKey, id: crypto.randomUUID() };
    try {
      const response = await fetch("/api/admin/discovery-promotions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sourceForm, supplierId: Number(sourceForm.supplierId), status,
          requestId: pendingRequest.current.id }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(errors[result.error || ""] || "הטיוטה לא נשמרה.");
      pendingRequest.current = null;
      setForm(emptyForm()); setResolvedName("");
      await refresh();
      setNotice(status === "archived" ? "הטיוטה הועברה לארכיון." : "הטיוטה נשמרה. היא אינה משנה את תוצאות האתר.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "תוצאת השמירה אינה ידועה. בדקו את היומן לפני ניסיון נוסף.");
    } finally { setBusy(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void save("draft"); }

  return <main dir="rtl" className={styles.page}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>V · ניהול</p><h1>ניהול חשיפה</h1>
        <p>טיוטות קידום למקומות פעילים. כללי הדירוג הציבוריים עדיין אינם מופעלים.</p></div>
      <button type="button" className={styles.iconButton} onClick={() => void refresh()} disabled={loading || busy}
        title="רענון מצב" aria-label="רענון מצב"><RotateCcw size={19} /></button>
    </header>
    <div className={styles.statusBar} role="status"><span className={styles.statusDot} /> מצב ציבורי: ללא קידום יזום
      <a href="/admin/catalog-sync">סנכרון קטלוגים</a></div>
    {error ? <p className={styles.error} role="alert">{error} {forbidden ? <a href="/api/auth/google?returnTo=%2Fadmin%2Fdiscovery-promotions">כניסה עם Google</a> : null}</p> : null}
    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
    {loading && !dashboard ? <p role="status">טוענים טיוטות...</p> : null}
    {dashboard ? <div className={styles.layout}>
      <section className={styles.editor} aria-labelledby="promotion-editor-title">
        <div className={styles.sectionHeading}><h2 id="promotion-editor-title">{form.campaignId ? "עריכת טיוטה" : "טיוטה חדשה"}</h2>
          {form.campaignId ? <button type="button" onClick={() => { setForm(emptyForm()); setResolvedName(""); pendingRequest.current = null; }}>ביטול עריכה</button> : null}</div>
        <form onSubmit={submit} className={styles.form}>
          <div className={styles.fieldRow}><label>תחום<select value={form.world} disabled={!!form.campaignId || busy || lookingUp}
            onChange={(event) => change("world", event.target.value as World)}>
            {Object.entries(worlds).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>
            <label>מזהה ספק<input type="number" min="1" step="1" required value={form.supplierId}
              disabled={!!form.campaignId || busy || lookingUp} onChange={(event) => change("supplierId", event.target.value)} /></label></div>
          <button type="button" className={styles.lookup} disabled={lookingUp || busy || !!form.campaignId}
            onClick={() => void lookup()}><Search size={17} aria-hidden="true" /> {lookingUp ? "בודקים..." : "בדיקת מקום"}</button>
          {resolvedName ? <p className={styles.resolved}>המקום בקטלוג הפעיל: <strong>{resolvedName}</strong></p> : null}
          <label>סיבת הקידום<select value={form.kind} onChange={(event) => change("kind", event.target.value as Kind)} disabled={busy}>
            {Object.entries(kinds).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>
          <label>משקל מוצע <strong>{form.weight} מתוך 5</strong><input type="range" min="1" max="5" step="1"
            value={form.weight} onChange={(event) => change("weight", Number(event.target.value))} disabled={busy} /></label>
          <div className={styles.fieldRow}><label>מתאריך<input type="date" required value={form.startsOn}
            onChange={(event) => change("startsOn", event.target.value)} disabled={busy} /></label>
            <label>עד תאריך<input type="date" required min={form.startsOn} value={form.endsOn}
              onChange={(event) => change("endsOn", event.target.value)} disabled={busy} /></label></div>
          <div className={styles.fieldRow}><label>סיום פרסום ידוע<input type="date" value={form.contractEndsOn}
            required={form.kind === "ending_contract"} onChange={(event) => change("contractEndsOn", event.target.value)} disabled={busy} /></label>
            <label>מקור התאריך<input maxLength={200} value={form.contractSource} required={!!form.contractEndsOn}
              onChange={(event) => change("contractSource", event.target.value)} disabled={busy} placeholder="למשל: מערכת חוזים" /></label></div>
          <label>הערה פנימית<textarea rows={3} maxLength={500} value={form.note}
            onChange={(event) => change("note", event.target.value)} disabled={busy} /></label>
          <button type="submit" className={styles.primary} disabled={!canEdit || (busy || !resolvedName)}><Save size={17} aria-hidden="true" />{busy ? "שומרים..." : "שמירת טיוטה"}</button>
        </form>
      </section>
      <div className={styles.records}>
        <section aria-labelledby="promotion-list-title"><div className={styles.sectionHeading}><h2 id="promotion-list-title">טיוטות שמורות</h2><span>{dashboard.drafts.length}</span></div>
          {dashboard.drafts.length ? <div className={styles.tableWrap}><table><thead><tr><th>מקום</th><th>סיבה</th><th>תקופה</th><th>משקל</th><th>מצב</th><th>פעולות</th></tr></thead>
            <tbody>{dashboard.drafts.map((draft) => <tr key={draft.campaignId}>
              <td><strong>{draft.placeName}</strong><small>{worlds[draft.world]} · {draft.supplierId}</small></td>
              <td>{kinds[draft.kind]}</td><td><span dir="ltr">{draft.startsOn}</span> עד <span dir="ltr">{draft.endsOn}</span></td>
              <td>{draft.weight}/5</td><td>{draft.status === "draft" ? "טיוטה" : "ארכיון"}</td>
              <td><div className={styles.actions}><button type="button" title="עריכת טיוטה" aria-label={`עריכת ${draft.placeName}`}
                onClick={() => edit(draft)} disabled={busy}><Pencil size={17} /></button>
                {draft.status === "draft" ? <button type="button" title="העברה לארכיון" aria-label={`העברת ${draft.placeName} לארכיון`}
                  onClick={() => void save("archived", { campaignId: draft.campaignId, expectedVersion: draft.version,
                    world: draft.world, supplierId: String(draft.supplierId), kind: draft.kind, weight: draft.weight,
                    startsOn: draft.startsOn, endsOn: draft.endsOn, contractEndsOn: draft.contractEndsOn || "",
                    contractSource: draft.contractSource || "", note: draft.note })} disabled={!canEdit || (busy)}><Archive size={17} /></button> : null}</div></td>
            </tr>)}</tbody></table></div> : <p className={styles.empty}>עדיין אין טיוטות קידום.</p>}
        </section>
        <section aria-labelledby="promotion-log-title"><div className={styles.sectionHeading}><h2 id="promotion-log-title">יומן שינויים</h2></div>
          {dashboard.activity.length ? <div className={styles.tableWrap}><table><thead><tr><th>זמן</th><th>מקום</th><th>שינוי</th><th>עודכן על ידי</th></tr></thead>
            <tbody>{dashboard.activity.map((entry) => <tr key={entry.eventId}><td>{date(entry.savedAt)}</td>
              <td>{entry.placeName}</td><td>גרסה {entry.version} · {entry.status === "archived" ? "ארכיון" : "טיוטה"}</td>
              <td dir="ltr">{entry.actorEmail}</td></tr>)}</tbody></table></div> : <p className={styles.empty}>אין פעולות מתועדות.</p>}
        </section>
      </div>
    </div> : null}
  </main>;
}
