import type { D1Database } from "../../../types/cloudflare-runtime";
import { ensureSchedulerSchema, schedulerJobIntentKey } from "./scheduler.ts";
import { ensureQualityJobSchema, readQualityJobByIntent } from "../../../app/lib/quality-job-store.ts";
import { qualityRegistry } from "../../../app/lib/quality-platform.ts";
import { ensureControlAuxiliarySchema } from "./control-schema.ts";

type Admission = { checkId: string; bucket: number; generation: string; status: string; createdAt: number; runId: string | null };
const select = "SELECT check_id AS checkId,bucket,generation,status,created_at AS createdAt,run_id AS runId FROM quality_scheduler_admissions";
export async function readSchedulerAttention(db: D1Database) {
  await ensureSchedulerSchema(db);
  const rows = await db.prepare(`${select} WHERE status='unknown' ORDER BY created_at,check_id LIMIT 50`).all<Admission>();
  return { attention: rows.results };
}

export async function markScheduledAdmissionUnknown(db: D1Database, runId: string) {
  await ensureSchedulerSchema(db);
  await db.prepare("UPDATE quality_scheduler_admissions SET status='unknown' WHERE run_id=? AND status='linked'").bind(runId).run();
}

/** Reconciliation never sends a Queue message or repeats a check. A deliberate
 * release allows a new future admission; it never reuses the uncertain one. */
export async function reconcileSchedulerAdmission(db: D1Database, input: { actor: string; checkId: string; bucket: number; mode: "inspect" | "allow-next"; now?: number }) {
  if (!input.actor || !Number.isSafeInteger(input.bucket) || input.bucket < 0 || !['inspect','allow-next'].includes(input.mode) || !qualityRegistry.some(c=>c.checkId===input.checkId)) throw new Error("invalid_scheduler_reconciliation");
  await ensureSchedulerSchema(db);
  await ensureQualityJobSchema(db);
  const row = await db.prepare(`${select} WHERE check_id=? AND bucket=?`).bind(input.checkId,input.bucket).first<Admission>();
  if (!row) throw new Error("scheduler_admission_not_found");
  const auditId=`allow-next:${input.checkId}:${input.bucket}`;
  const clearedState=async(state:Admission)=>{
    await ensureControlAuxiliarySchema(db);
    const audit=await db.prepare("SELECT check_id AS checkId,bucket,actor,action FROM quality_scheduler_reconciliation_audit WHERE id=?").bind(auditId).first<{checkId:string;bucket:number;actor:string;action:string}>();
    if(!audit||audit.checkId!==input.checkId||audit.bucket!==input.bucket||audit.action!=='allow-next'||!audit.actor)throw new Error('scheduler_reconciliation_unverified');
    // Repeated requests retain the first accepted actor. Returning the stored
    // state does not manufacture another operator event or attribute it anew.
    return {status:state.status,runId:state.runId,appliedBy:audit.actor};
  };
  if(row.status==='operator-cleared')return clearedState(row);
  if (row.status !== "unknown") return { status: row.status, runId: row.runId };
  const job = await readQualityJobByIntent(db,"cloudflare-scheduler",schedulerJobIntentKey(input.checkId,input.bucket));
  if (input.mode === "inspect") {
    if (job) await db.prepare("UPDATE quality_scheduler_admissions SET status='linked',run_id=? WHERE check_id=? AND bucket=? AND status='unknown'").bind(job.runId,input.checkId,input.bucket).run();
    const saved=await db.prepare(`${select} WHERE check_id=? AND bucket=?`).bind(input.checkId,input.bucket).first<Admission>();
    if(saved?.status==='operator-cleared')return clearedState(saved);
    if(saved && ['linked','unknown'].includes(saved.status))return {status:saved.status,runId:saved.runId};
    throw new Error('scheduler_reconciliation_unverified');
  }
  if (job && ["queued","running"].includes(job.status)) throw new Error("scheduler_job_still_active");
  await ensureControlAuxiliarySchema(db);
  const now = input.now ?? Date.now();
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO quality_scheduler_reconciliation_audit(id,check_id,bucket,actor,action,run_id,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM quality_scheduler_admissions WHERE check_id=? AND bucket=? AND status='unknown')")
      .bind(auditId,input.checkId,input.bucket,input.actor,'allow-next',job?.runId??null,now,input.checkId,input.bucket),
    db.prepare("UPDATE quality_scheduler_admissions SET status='operator-cleared',run_id=? WHERE check_id=? AND bucket=? AND status='unknown'").bind(job?.runId??null,input.checkId,input.bucket),
  ]);
  const saved=await db.prepare(`${select} WHERE check_id=? AND bucket=?`).bind(input.checkId,input.bucket).first<Admission>();
  if(saved?.status==='operator-cleared')return clearedState(saved);
  if(saved?.status==='linked')return {status:saved.status,runId:saved.runId};
  throw new Error('scheduler_reconciliation_unverified');
}

export async function scheduledDispatchAdmission(db: D1Database, job: {runId:string;idempotencyKey:string;checks:Array<{checkId:string;configuration:Record<string,unknown>}>}) {
  if (job.checks[0]?.configuration.trigger !== "scheduled") return "allowed" as const;
  await ensureSchedulerSchema(db);
  const prefix=`scheduled:${job.checks[0].checkId.replaceAll('.','_')}:`;
  if (!job.idempotencyKey.startsWith(prefix)) return "superseded" as const;
  const bucket=Number(job.idempotencyKey.slice(prefix.length));
  if(!Number.isSafeInteger(bucket)||bucket<0)return "superseded" as const;
  const row=await db.prepare(`${select} WHERE check_id=? AND bucket=?`).bind(job.checks[0].checkId,bucket).first<Admission>();
  if(row?.status==='linked' && row.runId===job.runId)return "allowed" as const;
  if(row?.status==='admitted'||row?.status==='unknown')return "deferred" as const;
  return "superseded" as const;
}
