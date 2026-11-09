"use client";

import { useEffect, useRef, useState } from "react";
import { useAdminCanEdit } from "../admin-access-context.tsx";
import type { GalleryAuditJobSummary } from "../../lib/gallery-api-audit-job.ts";
import { reviewableGallerySourceFailure } from "../../lib/gallery-source-media-failure.ts";

const savedJobKey = "vii.gallery-audit.job.v1";
const validId = (value: string | null) => !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const terminal = (job: GalleryAuditJobSummary) => ["complete", "deadline", "error"].includes(job.state);
const labels = { vacations: "נופש", events: "אירועים", rooms: "חדרים לפי שעה", spa: "ספא" } as const;
type ApplyResult={version?:number;state:string;phase?:string;cursor?:number;verifyCursor?:number;total?:number;changed:number;skipped:number;verified:number;lease?:{until:string};errorCode?:string;verificationIssues:unknown[]};
const recoverableApply=(value?:ApplyResult)=>value?.version===1&&value.state==='not_accepted'&&(value.errorCode==='gallery_nonmedia_facts_changed'||reviewableGallerySourceFailure(value.errorCode));

export default function GalleryAuditPage() {
  const canEdit = useAdminCanEdit();
  const [job, setJob] = useState<GalleryAuditJobSummary | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [jobMissing, setJobMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [applying, setApplying] = useState<string | null>(null);
  const [applyResults, setApplyResults] = useState<Record<string, ApplyResult>>({});
  const runRef = useRef<AbortController | null>(null);

  async function request(id: string, action?: "start" | "step" | "retry" | "continue", signal?: AbortSignal) {
    const timeout = AbortSignal.timeout(90_000);
    const response = await fetch(`/api/admin/gallery-audit${action ? "" : `?jobId=${encodeURIComponent(id)}`}`, {
      method: action ? "POST" : "GET", cache: "no-store", credentials: "same-origin",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      ...(action ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, jobId: id }) } : {}),
    });
    const body = await response.json() as { ok?: boolean; job?: GalleryAuditJobSummary; error?: string };
    if (!response.ok || !body.ok || !body.job || body.job.jobId !== id) {
      if (response.status === 404) setJobMissing(true);
      throw new Error(response.status === 403 ? "אין הרשאה לפעולה הזאת. יש להיכנס כמנהל עם הרשאת קטלוגים." : response.status === 404 ? "הבדיקה עדיין לא נשמרה בשרת. אפשר להתחיל בדיקה חדשה." : "לא התקבל מצב בדיקה תקין. הפעולה נעצרה כדי למנוע הרצה כפולה.");
    }
    setJobMissing(false);
    setJob(body.job);
    return body.job;
  }

  useEffect(() => {
    const controller = new AbortController();
    const id = localStorage.getItem(savedJobKey);
    if (validId(id)) {
      setSavedId(id);
      void request(id!, undefined, controller.signal).catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "לא ניתן לקרוא את הבדיקה השמורה.");
      });
    }
    return () => { controller.abort(); runRef.current?.abort(); runRef.current = null; };
  }, []);

  async function run(start: boolean, retrySource = false, continueWindow = false) {
    if (!canEdit || runRef.current) return;
    const controller = new AbortController();
    runRef.current = controller;
    setBusy(true); setError(""); setNotice("");
    const id = start ? crypto.randomUUID() : savedId;
    if (!id) { runRef.current = null; setBusy(false); return; }
    if (start) {
      // Reserve the operation identity before the first network mutation.
      localStorage.setItem(savedJobKey, id);
      setSavedId(id);
      setJob(null);
      setJobMissing(false);
    }
    const deadline = Date.now() + 60 * 60_000;
    try {
      let current = await request(id, continueWindow ? "continue" : retrySource ? "retry" : start ? "start" : undefined, controller.signal);
      for (let step = 0; step < 1024 && !terminal(current); step++) {
        if (controller.signal.aborted) break;
        if (Date.now() >= deadline || Date.now() >= Date.parse(current.deadline)) {
          setNotice("חלון הבדיקה הסתיים. התוצאות שהתקבלו נשמרו; זו אינה בדיקה מלאה.");
          break;
        }
        const cursor = current.cursor;
        current = await request(id, "step", controller.signal);
        if (!terminal(current) && current.cursor <= cursor) {
          setNotice("הבדיקה נעצרה ללא התקדמות נוספת. התוצאות נשמרו; יש לרענן מצב לפני המשך.");
          break;
        }
      }
    } catch (cause) {
      // A disconnected POST may already have completed. Read the reserved job;
      // never resend the mutation until its persisted result is known.
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "הבדיקה נעצרה.");
        try {
          await request(id);
          setNotice("נקרא המצב האחרון שנשמר בשרת. אפשר להמשיך ממנו בלי להתחיל מחדש.");
        } catch { setNotice("לא ניתן לאמת כעת את תוצאת הפעולה. יש לרענן מצב לפני פעולה נוספת."); }
      }
    } finally {
      if (runRef.current === controller) runRef.current = null;
      setBusy(false);
    }
  }

  async function applyWorld(world: keyof typeof labels) {
    if (!canEdit || !job || applying || busy || job.state !== "complete") return;
    const controller=new AbortController();runRef.current=controller;
    setApplying(world); setError("");setNotice("");
    const url = `/api/admin/gallery-audit?jobId=${encodeURIComponent(job.jobId)}&applyWorld=${world}`;
    const read=async(action?:'apply'|'apply-step'|'apply-recover',recovery=false):Promise<ApplyResult|null>=>{
      const response=await fetch(action?'/api/admin/gallery-audit':url,{method:action?'POST':'GET',cache:'no-store',credentials:'same-origin',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(90_000)]),...(action?{headers:{'Content-Type':'application/json'},body:JSON.stringify({action,world,jobId:job.jobId,recovery})}:{})});
      let result:{ok?:boolean;apply?:ApplyResult|null};try{result=await response.json();}catch{throw Error('השרת לא החזיר אישור תקין. התקדמות שנשמרה לא תישלח מחדש.');}
      if(!response.ok||!result.ok)throw Error('לא התקבל אישור לצעד. יש לרענן את המצב לפני המשך.');
      if(result.apply)setApplyResults(current=>({...current,[world]:result.apply!}));return result.apply||null;
    };
    try {
      let value=await read();
      if(!value||value.state==='reserved'&&value.version!==1)value=await read('apply',!!value);
      if(recoverableApply(value||undefined))value=await read('apply-recover');
      const deadline=Date.now()+55*60_000;
      for(let step=0;value?.state==='reserved'&&step<2400;step++){
        if(controller.signal.aborted||Date.now()>=deadline){setNotice('ההתקדמות נשמרה. אפשר להמשיך מהצעד האחרון.');break;}
        if(value.lease&&Date.parse(value.lease.until)>Date.now()){setNotice('צעד קודם עדיין רשום כפעיל. יש לרענן מצב לפני המשך; הפעולה לא נשלחה שוב.');break;}
        const before=JSON.stringify([value.phase,value.cursor,value.verifyCursor]);
        value=await read('apply-step');
        if(!value)throw Error('מצב התיקון חסר.');
        if(value.errorCode||value.state==='reserved'&&before===JSON.stringify([value.phase,value.cursor,value.verifyCursor])){setNotice('ההרצה נעצרה לבדיקה. התוצאות שנשמרו נשארו במערכת.');break;}
      }
    } catch (cause) {
      try { const result = await fetch(url, { cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(20_000) }).then(response => response.json());
        if (result.ok && result.apply) setApplyResults(current => ({ ...current, [world]: result.apply }));
      } catch { /* An uncertain write is never repeated automatically. */ }
      setError(cause instanceof Error ? cause.message : "לא ניתן לאמת כעת את מצב התיקון. הפעולה לא נשלחה שוב.");
    } finally {if(runRef.current===controller)runRef.current=null;setApplying(null);}
  }

  const passed = job?.state === "complete" && job.total > 0 && job.completed === job.total && job.matched === job.total && job.unverified === 0 && job.mismatched === 0 && job.sourceIssues.length === 0;
  const buttonStyle = { minHeight: 44, padding: "10px 18px", border: "1px solid #137b7e", borderRadius: 12, font: "inherit", cursor: "pointer", background: "#fff", color: "#13505b" };
  return <main dir="rtl" style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 20px", minHeight: "75vh", fontFamily: '"VII Heebo", Heebo, Arial, sans-serif', color: "#153c46" }}>
    <a href="/admin/catalog-sync" style={{ color: "#126d75" }}>חזרה לקטלוגים</a>
    <h1 style={{ fontSize: "clamp(1.6rem, 4vw, 2.3rem)", marginBottom: 8 }}>גלריות מול המקור</h1>
    <p>השוואת התמונות, הסדר והשיוך למקום, ליחידה ולחבילה מול נתוני הספק. הבדיקה שומרת תיעוד פרטי ואינה משנה את הגלריות באתר.</p>
    <section aria-label="הרצת בדיקה" style={{ padding: 20, marginBlock: 24, border: "1px solid #cde0e2", borderRadius: 18, background: "#fff" }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {canEdit && !busy && !applying && (!savedId || jobMissing || !!job && terminal(job)) ? <button type="button" style={{ ...buttonStyle, background: "#147c7f", color: "#fff" }} onClick={() => void run(true)}>התחלת בדיקה מלאה</button> : null}
        {canEdit && !busy && !applying && job?.state === "error" && !job.sourceRetryUsed && job.sourceIssues.includes("provider_context:spa:provider_timeout") ? <button type="button" style={buttonStyle} onClick={() => void run(false, true)}>ניסיון נוסף למקור הספא</button> : null}
        {canEdit && !busy && !applying && job && job.state !== "complete" && job.state !== "error" && !job.continuationUsed && job.cursor > 0 && Date.now() >= Date.parse(job.deadline) ? <button type="button" style={buttonStyle} onClick={() => void run(false, false, true)}>המשך מהתוצאות השמורות בחלון נוסף</button> : null}
        {canEdit && savedId && !busy && job && !terminal(job) ? <button type="button" style={{ ...buttonStyle, background: "#147c7f", color: "#fff" }} onClick={() => void run(false)}>המשך הבדיקה השמורה</button> : null}
        {busy ? <button type="button" style={buttonStyle} onClick={() => { runRef.current?.abort(); setNotice("ההרצה נעצרה בדפדפן. הצעד שכבר נשלח עשוי להסתיים בשרת; יש לרענן את המצב לפני המשך."); }}>עצירה ושמירת התקדמות</button> : null}
        {savedId && !busy ? <button type="button" style={buttonStyle} onClick={() => { setError(""); void request(savedId).catch((cause) => setError(cause instanceof Error ? cause.message : "לא ניתן לרענן כעת.")); }}>רענון מצב</button> : null}
        {!savedId && !canEdit ? <p>הפעלת בדיקה דורשת הרשאת עריכה של קטלוגים.</p> : null}
      </div>
      {busy ? <p role="status">בודקים מול הספקים. אפשר לעצור ולהמשיך מהתוצאות שנשמרו.</p> : null}
      {error ? <p role="alert" style={{ color: "#9f273c" }}>{error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {job ? <>
        <p aria-live="polite"><strong>{job.completed.toLocaleString("he-IL")} מתוך {job.total.toLocaleString("he-IL")}</strong> מקומות נבדקו</p>
        <progress aria-label="התקדמות בדיקת גלריות" max={Math.max(1, job.total)} value={job.completed} style={{ width: "100%", height: 16, accentColor: "#147c7f" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBlock: 18 }}>
          {[["תואם למקור", job.matched], ["נמצאו פערים", job.mismatched], ["לא אומת", job.unverified]].map(([label, count]) => <div key={label} style={{ padding: 16, borderRadius: 12, background: "#f1f7f7" }}><span>{label}</span><strong style={{ display: "block", fontSize: "1.6rem" }}>{Number(count).toLocaleString("he-IL")}</strong></div>)}
        </div>
        <p>{Object.entries(job.worldCounts).map(([world, count]) => `${labels[world as keyof typeof labels]}: ${count.toLocaleString("he-IL")}`).join(" · ")}</p>
        {passed ? <p role="status">כל המקומות בבדיקה הזאת תואמים לנתוני הספק שנמשכו. בדיקת קובצי התמונות והעותקים השמורים נפרדת מהשוואת הסדר.</p> : job.state === "complete" ? <p role="alert">ההשוואה הסתיימה ויש תוצאות שדורשות טיפול. אין עדיין אישור שכל הגלריות תואמות.</p> : terminal(job) ? <p role="alert">הבדיקה לא הושלמה. אין אישור לכלל הגלריות.</p> : null}
        <details style={{ marginTop: 20 }}><summary>תיעוד הבדיקה</summary><p>הדוח כולל שיוך תמונות ותוצאות השוואה. הגישה מוגנת בהרשאות הניהול.</p><a href={`/api/admin/gallery-audit?jobId=${encodeURIComponent(job.jobId)}&download=1`} download>הורדת דוח מפורט</a><p><a href={`/api/admin/gallery-audit?jobId=${encodeURIComponent(job.jobId)}&diagnostics=1`}>אבחון מקורות</a></p></details>
        {canEdit && job.state === "complete" ? <section aria-label="תיקון גלריות מאומתות" style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #cde0e2" }}>
          <h2 style={{ fontSize: "1.25rem" }}>תיקון גלריות מאומתות</h2>
          <p>יעודכנו רק תמונות וקבוצות תמונות שניתן לאמת מול הספק. מידע חסר או שיוך לא ודאי יישמרו לבדיקה, בלי למחוק את המידע הקיים.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{(Object.keys(labels) as Array<keyof typeof labels>).map(world => <button key={world} type="button" style={buttonStyle} disabled={!!applying || !!applyResults[world]&&applyResults[world].state!=='reserved'&&!recoverableApply(applyResults[world])} onClick={() => void applyWorld(world)}>{applying === world ? "מעדכנים..." : `${applyResults[world]?.state==='reserved'||recoverableApply(applyResults[world])?'המשך תיקון':'תיקון'} ${labels[world]}`}</button>)}</div>
          {applying?<button type="button" style={{...buttonStyle,marginTop:12}} onClick={()=>{runRef.current?.abort();setNotice('ההרצה נעצרה בדפדפן. יש לקרוא מצב שמור לפני המשך.');}}>עצירה ושמירת התקדמות</button>:null}
          {Object.entries(applyResults).map(([world, value]) => <p key={world} role="status"><strong>{labels[world as keyof typeof labels]}: </strong>{value.state === "accepted" ? `${value.changed} מקומות עודכנו; ${value.verified} אומתו לאחר העדכון; ${value.skipped} נשמרו לבדיקה נוספת.` : value.state === "reserved"&&value.version===1 ? value.phase==='verify'?`בודקים את הדור שפורסם: ${value.verifyCursor} מתוך ${value.total}.`:`מכינים עדכון: ${value.cursor} מתוך ${value.total}. הגרסה הפעילה תוחלף רק בסיום ההכנה.` : value.state==='reserved' ? 'הפעולה הקודמת דורשת בדיקת מצב לפני המשך.' : "העדכון לא אושר. יש לבדוק את הדוח; המידע הפעיל לא מוחלף במקרה של הכנה שנכשלה."}{value.verificationIssues?.length || value.errorCode ? " נדרש לבדוק את הדוח לפני אישור הגלריות." : ""}</p>)}
        </section> : null}
      </> : null}
    </section>
  </main>;
}
