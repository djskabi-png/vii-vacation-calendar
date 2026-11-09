"use client";

import { useAdminCanEdit } from "../admin-access-context.tsx";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { readGrowthEndpoint } from "../growth/growth-read.ts";
import type { CatalogSyncDiagnostics } from "../../lib/supplier-catalog-diagnostics.ts";
import { catalogDiagnosticLabels, catalogRunExplanation, catalogRunSourceLabel,
  catalogRunStatusLabel } from "../../lib/catalog-sync-presentation.ts";

type World = "vacations" | "events" | "rooms" | "spa";
type State = { world: World; activeCount: number; acceptedAt: string | null; lockRunId: string | null; lockUntil: string | null };
type Run = { id: string; world: World; source: string; status: string; startedAt: string;
  finishedAt: string | null; beforeCount: number | null; candidateCount: number | null;
  addedCount: number | null; changedCount: number | null; errorCode: string | null; diagnostics?: CatalogSyncDiagnostics };
type RetryJob = { id: string; rootRunId: string; world: World; attempt: number; dueAt: string; status: string;
  resultStatus: string | null; errorCode: string | null };
type Alert = { id: string; world: World; severity: "warning" | "critical"; kind: "review_required" | "retries_exhausted" | "stale"; status: "open" | "resolved"; errorCode: string | null; lastSeenAt: string };
type OnlineCapabilities = { status: "fresh" | "refreshed" | "stale"; checkedAt: string; count: number; targetFreshMinutes: number; lastGoodMaxDays: number };
type Dashboard = { states: State[]; runs: Run[]; retryJobs: RetryJob[]; alerts: Alert[]; onlineCapabilities: OnlineCapabilities | null };

const worlds: { id: World; name: string }[] = [
  { id: "vacations", name: "נופש" }, { id: "events", name: "אירועים" },
  { id: "rooms", name: "חדרים לפי שעה" }, { id: "spa", name: "ספא" },
];

function date(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }) : "טרם עודכן";
}

function RunDiagnostics({ world, runId }: { world: World; runId: string }) {
  const [state, setState] = useState<{ loading: boolean; loaded: boolean; available: boolean; value?: CatalogSyncDiagnostics; error?: string }>({ loading: false, loaded: false, available: false });
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setState({ loading: false, loaded: false, available: false });
    return () => { requestRef.current?.abort(); requestRef.current = null; };
  }, [world, runId]);
  const load = useCallback(async () => {
    if (state.loaded || state.loading || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setState((current) => ({ ...current, loading: true, error: undefined }));
    try {
      const response = await readGrowthEndpoint<{ diagnosticsAvailable?: boolean; diagnostics?: CatalogSyncDiagnostics }>(fetch, `/api/admin/catalog-sync?world=${encodeURIComponent(world)}&runId=${encodeURIComponent(runId)}`, "json", controller, 10_000);
      if (requestRef.current !== controller) return;
      if (!response.ok || !response.value) throw new Error(response.status === 403 ? "אין הרשאת מנהל לקריאת האבחון" : response.status === 404 ? "האבחון לא נשמר במשיכה זו" : "לא ניתן לטעון את האבחון כרגע");
      const result = response.value;
      setState({ loading: false, loaded: true, available: result.diagnosticsAvailable === true, value: result.diagnostics });
    } catch (cause) {
      if (requestRef.current === controller) setState({ loading: false, loaded: false, available: false, error: cause instanceof Error ? cause.message : "לא ניתן לטעון את האבחון כרגע" });
    } finally { if (requestRef.current === controller) requestRef.current = null; }
  }, [runId, state.loaded, state.loading, world]);
  const labels = catalogDiagnosticLabels(world);
  const value = state.value;
  return <details onToggle={(event) => { if (event.currentTarget.open) void load(); else { requestRef.current?.abort(); requestRef.current = null; setState((current) => ({ ...current, loading: false })); } }}>
    <summary>אבחון {worlds.find((item) => item.id === world)?.name}</summary>
    {state.loading ? <small role="status">טוענים אבחון...</small> : null}
    {state.error ? <small role="alert">{state.error}</small> : null}
    {state.loaded && !state.available ? <small>לא נשמר אבחון במשיכה זו</small> : null}
    {!value ? null : <>
    {value.deferredDetails?.supplierIds.length ? <p>נשמרו הפרטים התקינים הקודמים במקומות הבאים, כי רענון הפרטים לא הושלם: <span dir="ltr">{value.deferredDetails.supplierIds.join(", ")}{value.deferredDetails.truncated ? "..." : ""}</span></p> : null}
    {value.contentIntegrity ? <><p>נתונים שדורשים בדיקה: {value.contentIntegrity.total}{value.contentIntegrity.truncated ? " ומעלה" : ""}</p><ul>{value.contentIntegrity.issues.map((issue, index) => <li key={`${issue.supplierId}-${index}`}><span>מזהה מקום: </span><span dir="ltr">{issue.supplierId} · {issue.path} · {issue.reason}</span></li>)}</ul></> : null}
    {value.failure ? <p><strong>שלב הכשל:</strong> <code dir="ltr">{value.failure.stage}</code> · <strong>סוג:</strong> <code dir="ltr">{value.failure.category}</code> · <strong>משך:</strong> {(value.failure.elapsedMs / 1000).toLocaleString("he-IL", { maximumFractionDigits: 1 })} שניות{value.failure.total !== undefined ? <> · <strong>הושלמו:</strong> {value.failure.completed || 0} מתוך {value.failure.total}</> : null} · {value.failure.retryable ? "מתאים לניסיון חוזר" : "דורש תיקון לפני ניסיון נוסף"}</p> : null}
    {value.before !== undefined ? <p><span>{labels.places.plural} לפני:</span> {value.before} · <span>התקבלו מהספק:</span> {value.candidate}</p> : null}
    {value.addedIds ? <p><span>נוספו:</span> {value.addedCount} · <span dir="ltr" style={{ overflowWrap: "anywhere" }}>{value.addedIds.join(", ") || "—"}</span></p> : null}
    {value.removedIds ? <p><span>נגרעו:</span> {value.removedCount} · <span dir="ltr" style={{ overflowWrap: "anywhere" }}>{value.removedIds.join(", ") || "—"}</span></p> : null}
    {value.units ? <>
      <p><span>{labels.children.plural} לפני:</span> {value.units.before} · <span>התקבלו מהספק:</span> {value.units.candidate}</p>
      <p><span>{labels.children.plural} שלא התקבלו:</span> {value.units.removedTotal} · <span>במקומות שנגרעו:</span> {value.units.removedWithPlaces} · <span>במקומות שנותרו:</span> {value.units.removedFromRetainedPlaces}</p>
      <ul>{value.units.removed.map((row, index) => <li key={`${row.supplierId}-${row.childId}-${index}`}>
        <span>{labels.places.singular}:</span> <span dir="ltr">{row.supplierId}</span> · <span>{labels.children.singular}:</span> <span dir="ltr">{row.childId}</span>
        {row.placeRemoved ? <> · <span>המקום נגרע</span></> : null}
      </li>)}</ul>
    </> : null}
    {value.addedIdsTruncated || value.removedIdsTruncated || value.units?.truncated ? <p>הרשימה קוצרה; מוצגים עד 100 מזהים בכל רשימה</p> : null}
    {value.redirect ? <p><span>הפניית ספק:</span> <span dir="ltr">{value.redirect.status} · {value.redirect.hostname || "—"}</span></p> : null}
    {value.spaJsonFailure ? <>
      <p><span>אבחון פענוח ספא:</span> <span dir="ltr">HTTP {value.spaJsonFailure.httpStatus} · {value.spaJsonFailure.contentType || "—"}</span></p>
      <p><span>אורך גוף התשובה בבתים:</span> {value.spaJsonFailure.responseBytes ?? "—"}</p>
      <p><span>סיווג תו ראשון:</span> <code dir="ltr">{value.spaJsonFailure.firstCharacterKind}</code> · <span>סוג כשל:</span> <code dir="ltr">{value.spaJsonFailure.parseErrorKind}</code></p>
    </> : null}
    </>}
  </details>;
}

type CandidateInspection = {
  fetchedAt: string;
  sourceInventory?: { listedCount: number; activeCount: number; inactiveIds: number[]; inactiveIdsTruncated: boolean; unknownActivityIds: number[]; unknownActivityIdsTruncated: boolean; previousInactiveIds?: number[]; previousInactiveIdsTruncated?: boolean; previousUnknownActivityIds?: number[]; previousUnknownActivityIdsTruncated?: boolean };
  diff: { before: number; candidate: number; added: number; changed: number; removed: number[]; removedTruncated: boolean; removalWithinGuard?: boolean };
  contentIssues: Array<{ supplierId: number; path: string; reason: string }>;
  contentIssuesTruncated: boolean;
  missingMediaEvidence?: Array<{ supplierId: number; oldImageCount: number; newImageCount: number; removedTrustedFilenames: string[]; removedTrustedFilenamesTruncated: boolean }>;
  missingMediaEvidenceTotal?: number;
  missingMediaEvidenceTruncated?: boolean;
  deferredDetailIds?:number[];deferredDetailIdsTruncated?:boolean;
  detailProofIssues?:Array<{supplierId:number;code:string}>;
};

function CandidateComparison({ world,onRefresh,disabled }: { world: "vacations" | "events"; onRefresh:(id:number)=>void; disabled:boolean }) {
  const [targetId,setTargetId]=useState('');
  const [result, setResult] = useState<CandidateInspection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => { requestRef.current?.abort(); requestRef.current = null; }, [world]);
  const inspect = async () => {
    if (requestRef.current) return;
    if(targetId&&!/^[1-9]\d{0,9}$/.test(targetId)){setError('יש להזין מספר מקום תקין');return;}
    const controller = new AbortController(); requestRef.current = controller;
    setLoading(true); setError(""); setResult(null);
    const response = await readGrowthEndpoint<CandidateInspection>(fetch, `/api/admin/catalog-sync?candidate=1&world=${world}${targetId?`&supplierId=${targetId}`:''}`, "json", controller, 45_000);
    if (requestRef.current !== controller) return;
    requestRef.current = null; setLoading(false);
    if (response.ok && response.value) setResult(response.value);
    else setError(response.status === 403 ? "אין הרשאת מנהל לבדיקת הספק" : "לא הצלחנו להשלים את בדיקת הספק. אפשר לנסות שוב.");
  };
  return <section aria-label="השוואה מול הספק" style={{ marginBlock: 12 }}>
    <label>מספר מקום לבדיקה מפורטת (לא חובה)<input type="text" inputMode="numeric" value={targetId} onChange={event=>{setTargetId(event.target.value);setResult(null);}} disabled={loading} /></label>
    <button type="button" onClick={() => void inspect()} disabled={loading}>{loading ? "בודקים את נתוני הספק..." : "בדיקת השינויים מהספק"}</button>
    <small style={{ display: "block", marginBlock: 8 }}>השוואה בלבד, ללא פרסום שינויים בקטלוג</small>
    {result && targetId ? <button type="button" disabled={disabled||loading} onClick={()=>onRefresh(Number(targetId))}>רענון פרטי המקום שנבדק</button> : null}
    {error ? <p role="alert">{error}</p> : null}
    {result ? <div role="status"><p>נבדק: {date(result.fetchedAt)}</p><p>מקומות בקטלוג: {result.diff.before} · מהספק: {result.diff.candidate}</p><p>נוספו: {result.diff.added} · השתנו: {result.diff.changed} · לא התקבלו: {result.diff.removed.length}{result.diff.removedTruncated ? " ומעלה" : ""}</p>
      {result.sourceInventory ? <><p>רשומות ברשימת הספק: {result.sourceInventory.listedCount} · פעילות במפורש: {result.sourceInventory.activeCount}</p><details><summary>סימון פעילות אצל הספק</summary><p>סומנו כלא פעילים:</p><p dir="ltr" style={{ overflowWrap: "anywhere" }}>{result.sourceInventory.inactiveIds.join(", ") || "0"}{result.sourceInventory.inactiveIdsTruncated ? "..." : ""}</p><p>מתוך הקטלוג הקודם:</p><p dir="ltr" style={{ overflowWrap: "anywhere" }}>{result.sourceInventory.previousInactiveIds?.join(", ") || "0"}{result.sourceInventory.previousInactiveIdsTruncated ? "..." : ""}</p><p>ללא סימון פעילות:</p><p dir="ltr" style={{ overflowWrap: "anywhere" }}>{result.sourceInventory.unknownActivityIds.join(", ") || "0"}{result.sourceInventory.unknownActivityIdsTruncated ? "..." : ""}</p><p>מתוך הקטלוג הקודם ללא סימון:</p><p dir="ltr" style={{ overflowWrap: "anywhere" }}>{result.sourceInventory.previousUnknownActivityIds?.join(", ") || "0"}{result.sourceInventory.previousUnknownActivityIdsTruncated ? "..." : ""}</p></details></> : null}
      {result.diff.removalWithinGuard === false ? <p>היקף הגריעה מחייב בדיקה לפני פרסום</p> : null}
      {result.diff.removed.length ? <details><summary>מזהי המקומות שלא התקבלו</summary><p dir="ltr" style={{ overflowWrap: "anywhere" }}>{result.diff.removed.join(", ")}</p></details> : null}
      <p>{result.contentIssues.length ? "נמצאו נתונים שדורשים בדיקה" : "לא נמצא אובדן תוכן במקומות שנבדקו"}</p>
      {result.contentIssues.length ? <ul>{result.contentIssues.map((issue, index) => <li key={`${issue.supplierId}-${index}`}><span>מזהה מקום: </span><span dir="ltr">{issue.supplierId} · {issue.path} · {issue.reason}</span></li>)}</ul> : null}
      {result.contentIssuesTruncated ? <small>מוצגים עד 100 ממצאים</small> : null}
      {result.detailProofIssues?.length ? <details><summary>סיבת אי־אימות פרטי הספק</summary><ul>{result.detailProofIssues.map(issue=><li key={issue.supplierId}><span dir="ltr">{issue.supplierId}: {issue.code}</span></li>)}</ul></details> : null}
      {result.missingMediaEvidence?.length ? <details><summary>ראיות תמונות שהוסרו <span dir="ltr">({result.missingMediaEvidence.length}/{result.missingMediaEvidenceTotal ?? result.missingMediaEvidence.length})</span></summary><ul>{result.missingMediaEvidence.map((item) => <li key={item.supplierId}>מקום <span dir="ltr">{item.supplierId}</span>: {item.oldImageCount} לפני, {item.newImageCount} אחרי · <span dir="ltr">{item.removedTrustedFilenames.join(", ")}</span>{item.removedTrustedFilenamesTruncated ? "..." : ""}</li>)}</ul></details> : null}
    </div> : null}
  </section>;
}

export default function CatalogSyncPage() {
  const canEdit = useAdminCanEdit();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [busy, setBusy] = useState<World | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [observedAt, setObservedAt] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/catalog-sync", { cache: "no-store" });
      if (response.status === 403) setForbidden(true);
      if (!response.ok) throw new Error(response.status === 403 ? "אין הרשאת מנהל" : "לא ניתן לטעון את מצב הקטלוגים");
      setDashboard(await response.json() as Dashboard);
      setObservedAt(Date.now());
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאת טעינה"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);

  async function pull(world: World,supplierId?:number) {
    if (!canEdit) return;
    if (busy) return;
    setBusy(world);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/admin/catalog-sync", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ world,...(supplierId===undefined?{}:{supplierId}) }),
      });
      const result = await response.json() as { world?: World; status?: string; errorCode?: string; error?: string; diagnostics?: CatalogSyncDiagnostics };
      setNotice(result.status === "accepted" ? "הנתונים נבדקו ופורסמו" :
        result.status === "rejected" || result.status === "failed"
          ? catalogRunExplanation(result.world || world, result.errorCode, result.diagnostics) :
          result.status === "skipped" ? "משיכה אחרת כבר פועלת בתחום הזה" :
            "המשיכה נכשלה. הנתונים הקודמים נשמרו.");
      if (!result.status) setError(result.error || "המשיכה לא בוצעה");
      await refresh();
    } catch { setError("הקשר נותק. בדקו את יומן המשיכות לפני ניסיון נוסף."); }
    finally { setBusy(null); }
  }

  return <main dir="rtl" style={{ maxWidth: 1120, minHeight: "80vh", margin: "0 auto", padding: "32px 20px" }}>
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <div><h1 style={{ margin: 0, fontSize: "1.8rem" }}>סנכרון קטלוגים</h1><p>מקומות, חדרים וחבילות לפי הנתונים שהתקבלו מהספקים.</p>
        <nav aria-label="מסכי ניהול" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <a href="/admin/gallery-audit" style={{ color: "#126d75", textDecoration: "underline" }}>בדיקת גלריות מול המקור</a>
          <a href="/admin/discovery-promotions" style={{ color: "#126d75", textDecoration: "underline" }}>ניהול חשיפה</a>
          <a href="/admin/operations" style={{ color: "#126d75", textDecoration: "underline" }}>הזמנות וחוות דעת</a>
          <a href="/admin/whatsapp-leads" style={{ color: "#126d75", textDecoration: "underline" }}>פניות וואטסאפ</a>
        </nav></div>
      <button type="button" onClick={() => void refresh()} disabled={loading || !!busy} title="רענון מצב" aria-label="רענון מצב"><RefreshCw size={18} aria-hidden="true" /></button>
    </header>
    {error ? <p role="alert">{error} {forbidden ? <a href="/api/auth/google?returnTo=%2Fadmin%2Fcatalog-sync">כניסה עם Google</a> : null}</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {loading && !dashboard ? <p role="status">טוענים נתונים...</p> : null}
    {dashboard ? <>
      <section aria-labelledby="online-capabilities-title" style={{ marginBlock: 24, padding: 18, border: "1px solid #dce4e2", borderRadius: 12 }}>
        <h2 id="online-capabilities-title" style={{ marginTop: 0, fontSize: "1.25rem" }}>רשימת הזמנה אונליין ללא תאריך</h2>
        {dashboard.onlineCapabilities ? <>
          <p><strong>{dashboard.onlineCapabilities.count.toLocaleString("he-IL")} מקומות</strong> עם יכולת הזמנה אונליין מאומתת נשמרים ברשימה המהירה.</p>
          <p>בדיקה אחרונה שהתקבלה: {date(dashboard.onlineCapabilities.checkedAt)}. הרענון המתוזמן מוגדר פעם בשעה.</p>
          {dashboard.onlineCapabilities.status === "stale" ? <p role="status">מוצגת הרשימה התקינה האחרונה שנשמרה. בדיקת מחיר וזמינות להזמנה מתבצעת בנפרד מול הספק.</p> : <p role="status">הרשימה עדכנית. תקלה רגעית אצל הספק לא מוחקת את הדור התקין האחרון.</p>}
          <small>דור תקין אחרון נשמר עד {dashboard.onlineCapabilities.lastGoodMaxDays} ימים לצורכי גילוי בלבד, ולעולם אינו משמש כאישור זמינות לתאריך.</small>
        </> : <p role="alert">אין כרגע רשימת יכולת הזמנה תקינה. חיפוש עם תאריך ובדיקת הזמנה סופית ממשיכים להשתמש בבדיקה חיה.</p>}
      </section>
      <section aria-labelledby="catalog-alerts-title" style={{ marginBlock: 24, padding: 18, border: "1px solid #dce4e2", borderRadius: 12 }}>
        <h2 id="catalog-alerts-title" style={{ marginTop: 0, fontSize: "1.25rem" }}>התראות תפעול</h2>
        {dashboard.alerts.filter((item) => item.status === "open").length ? <ul>{dashboard.alerts.filter((item) => item.status === "open").map((alert) => <li key={alert.id}>
          <strong>{worlds.find((item) => item.id === alert.world)?.name}:</strong> {alert.kind === "stale" ? "הקטלוג לא פורסם בהצלחה ב־24 השעות האחרונות." : alert.kind === "retries_exhausted" ? "הסנכרון נכשל וגם שני הניסיונות האוטומטיים מוצו." : "העדכון נעצר לבדיקת בטיחות והקטלוג הקודם נשמר."} <small>{date(alert.lastSeenAt)}</small>
        </li>)}</ul> : <p role="status">אין כרגע התראות פתוחות בארבעת התחומים.</p>}
      </section>
      <section aria-labelledby="catalog-backup-title" style={{ marginBlock: 24, padding: 18, border: "1px solid #dce4e2", borderRadius: 12 }}>
        <h2 id="catalog-backup-title" style={{ marginTop: 0, fontSize: "1.25rem" }}>גיבויים להורדה</h2>
        <p>כל קובץ נוצר בקריאה עקבית, כולל ספירות וחתימת שלמות בסופו. הקבצים נשמרים רק במחשב שמוריד אותם.</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}><a href="/api/admin/catalog-snapshot" download>הורדת ארבעת הקטלוגים הפעילים</a><a href="/api/admin/public-cms-snapshot" download>הורדת התוכן הציבורי הפעיל</a></div>
        <small>הגיבויים האלה אינם כוללים חשבונות, הזמנות, פניות, הודעות או קובצי מדיה.</small>
      </section>
      <section aria-label="מצב התחומים" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))", gap: 16, marginBlock: 24 }}>
        {worlds.map(({ id, name }) => {
          const state = dashboard.states.find((item) => item.world === id);
          const run = dashboard.runs.find((item) => item.world === id);
          const retry = dashboard.retryJobs.find((item) => item.world === id && (item.status === "pending" || item.status === "running"));
          const exhausted = dashboard.retryJobs.find((item) => item.world === id && item.status === "exhausted");
          const running = busy === id || (!!state?.lockRunId && !!state.lockUntil && Date.parse(state.lockUntil) > observedAt);
          return <article key={id} style={{ border: "1px solid #dce4e2", borderRadius: 8, padding: 18 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: "1.2rem" }}>{name}</h2>
            <p>מקומות: {state?.activeCount ?? "טרם נמשך"}</p>
            <p>עדכון אחרון: {date(state?.acceptedAt)}</p>
            <p>משיכה אחרונה: {catalogRunStatusLabel(run?.status)}</p>
            {retry ? <p role="status"><strong>ניסיון אוטומטי {retry.attempt} מתוך 2:</strong> {retry.status === "running" ? "מתבצע עכשיו" : date(retry.dueAt)}</p> : null}
            {!retry && exhausted && run?.status === "failed" ? <p role="alert">שני הניסיונות האוטומטיים מוצו. הקטלוג האחרון שאושר נשאר פעיל.</p> : null}
            {run?.status === "rejected" ? <p>לא יתבצע ניסיון אוטומטי נוסף, משום שהנתונים נעצרו לבדיקת בטיחות ולא בגלל תקלה זמנית.</p> : null}
            {run?.errorCode ? <><p><strong>למה העדכון נעצר:</strong> {catalogRunExplanation(id, run.errorCode, run.diagnostics)}</p><small>קוד טכני: <code dir="ltr">{run.errorCode}</code></small></> : null}
            {run?.status === "failed" || run?.status === "rejected" ? <RunDiagnostics world={id} runId={run.id} /> : null}
            {id === "vacations" || id === "events" ? <CandidateComparison world={id} onRefresh={supplierId=>void pull(id,supplierId)} disabled={!canEdit||!!busy||running} /> : null}
            <button type="button" disabled={!canEdit || (!!busy || running)} onClick={() => void pull(id)}>
              <RefreshCw size={17} aria-hidden="true" /> {running ? "מושכים נתונים..." : "משוך עכשיו"}
            </button>
          </article>;
        })}
      </section>
      <section aria-label="יומן משיכות">
        <h2 style={{ fontSize: "1.25rem" }}>יומן משיכות</h2>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
          <thead><tr>{["זמן", "תחום", "מקור", "מצב", "לפני", "אחרי", "נוספו", "השתנו", "סיבה", "אבחון"].map((label) =>
            <th key={label} scope="col" style={{ padding: 10, borderBottom: "1px solid #dce4e2" }}>{label}</th>)}</tr></thead>
          <tbody>{dashboard.runs.map((run) => <tr key={run.id}>
            {[date(run.startedAt), worlds.find((item) => item.id === run.world)?.name || run.world,
              catalogRunSourceLabel(run.source), catalogRunStatusLabel(run.status), run.beforeCount, run.candidateCount, run.addedCount,
              run.changedCount, run.errorCode].map((value, index) =>
              <td key={index} style={{ padding: 10, borderBottom: "1px solid #edf0ef" }}>{value ?? ""}</td>)}
            <td style={{ padding: 10, borderBottom: "1px solid #edf0ef", minWidth: 200 }}>
              {run.status === "failed" || run.status === "rejected" ? <RunDiagnostics world={run.world} runId={run.id} /> : "—"}
            </td>
          </tr>)}</tbody>
        </table></div>
      </section>
    </> : null}
  </main>;
}
