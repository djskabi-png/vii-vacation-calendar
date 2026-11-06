"use client";
import { useState } from "react";
import { useAdminCanEdit } from "../admin-access-context.tsx";
import styles from "./quality.module.css";

export type SchedulerAttentionRow = { checkId: string; bucket: number; createdAt: number; runId: string | null };
export default function SchedulerAttention({ rows, labels, refresh }: { rows: SchedulerAttentionRow[]; labels: Record<string,string>; refresh: () => Promise<void> }) {
  const canEdit=useAdminCanEdit();
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  async function reconcile(row: SchedulerAttentionRow, mode: "inspect" | "allow-next") {
    if(busy||!canEdit)return;
    setBusy(`${row.checkId}:${row.bucket}`);setError("");setNotice("");
    try {
      const response=await fetch('/api/admin/quality',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(8000),body:JSON.stringify({action:'scheduler-reconcile',checkId:row.checkId,bucket:row.bucket,mode})});
      if(response.status===409)throw new Error('הריצה הקודמת עדיין פעילה. בדקו את התקדמותה לפני פתיחת בדיקה חדשה.');
      if(!response.ok)throw new Error('לא הצלחנו לאמת את העדכון. רעננו את מצב הבקרה לפני ניסיון נוסף.');
      const payload=await response.json() as {reconciliation?:{status?:string}};
      if(payload.reconciliation?.status==='unknown')setNotice('עדיין לא נמצאה ריצה תואמת. אפשר לאפשר בדיקה חדשה במועד הבא.');
      await refresh();
    } catch(cause) { setError(cause instanceof Error && cause.message.startsWith('הריצה')?cause.message:'לא התקבלה תשובה. רעננו את מצב הבקרה לפני ניסיון נוסף.'); }
    finally {setBusy(null);}
  }
  if(!rows.length)return null;
  return <section className={styles.section} aria-label="בדיקות מתוזמנות שממתינות לבירור" aria-busy={Boolean(busy)}>
    <h2>בדיקות מתוזמנות שממתינות לבירור</h2>
    <p>לא התקבלה תשובה על פתיחת הריצות האלה. אפשר לבדוק אם נפתחו, או לאפשר בדיקה חדשה במועד הבא.</p>
    {error?<p role="alert" className={styles.error}>{error}</p>:null}
    {notice?<p role="status">{notice}</p>:null}
    <ul>{rows.map(row=><li key={`${row.checkId}:${row.bucket}`}><strong dir="auto" style={{overflowWrap:'anywhere'}}>{labels[row.checkId]||row.checkId}</strong><p><time dateTime={new Date(row.createdAt).toISOString()}>{new Date(row.createdAt).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem'})}</time></p><div className={styles.actions}><button type="button" disabled={!canEdit||Boolean(busy)} onClick={()=>void reconcile(row,'inspect')}>בדיקת מצב הריצה</button><button type="button" disabled={!canEdit||Boolean(busy)} onClick={()=>void reconcile(row,'allow-next')}>אפשרו בדיקה חדשה במועד הבא</button></div></li>)}</ul>
  </section>;
}
