import { qualityRegistry, type QualityCheck } from "../../../app/lib/quality-platform.ts";

import type { D1Database } from "../../../types/cloudflare-runtime";
import { ensureQualitySchema } from "../../../app/lib/quality-platform.ts";
import { ensureQualityJobSchema } from "../../../app/lib/quality-job-store.ts";
export type SchedulerDb = D1Database;
export type ScheduledAdmission = { checkId: string; bucket: number; priority: "monitor"; generation: string; status?: "linked" | "unknown"; runId?: string };
type Existing = { checkId: string; status: string };

export function schedulerWindowOpen(raw:string|undefined,now=Date.now()){
 if(raw===undefined||raw==='')return true;
 const until=Date.parse(raw);
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(raw)||!Number.isFinite(until)||until-now>10*60_000)throw new Error('invalid_scheduler_window');
 return until>now;
}

export function scheduledCheckSelection(raw:string|undefined):readonly string[]|undefined{
 if(raw===undefined||raw==='')return undefined;
 if(raw.length>4096)throw new Error('invalid_scheduler_selection');
 let values;try{values=JSON.parse(raw);}catch{throw new Error('invalid_scheduler_selection');}
 if(!Array.isArray(values)||values.length>qualityRegistry.length||values.some(value=>typeof value!=='string'||!qualityRegistry.some(check=>check.checkId===value))||new Set(values).size!==values.length)throw new Error('invalid_scheduler_selection');
 return Object.freeze([...values]);
}

export function schedulerJobIntentKey(checkId: string, bucket: number) {
  // Registry IDs are dot-separated and cannot contain underscores. Replacing
  // dots is therefore injective and keeps the durable job key's safe alphabet.
  if(!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/.test(checkId)||!Number.isSafeInteger(bucket)||bucket<0)throw new Error('invalid_scheduler_intent');
  const key=`scheduled:${checkId.replaceAll('.','_')}:${bucket}`;
  if(key.length>120)throw new Error('invalid_scheduler_intent');
  return key;
}

export async function ensureSchedulerSchema(db: SchedulerDb) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS quality_scheduler_admissions (
    check_id TEXT NOT NULL, bucket INTEGER NOT NULL, generation TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'admitted', created_at INTEGER NOT NULL, run_id TEXT,
    PRIMARY KEY(check_id,bucket)
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS quality_scheduler_slots (minute INTEGER NOT NULL, slot INTEGER NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(minute,slot))`).run();
}

function cadence(check: QualityCheck, overrides: ReadonlyMap<string, number>) { return Math.max(1, overrides.get(check.checkId) || check.cadenceMinutes) * 60_000; }

export async function admitScheduledChecks(db: SchedulerDb, input: { now: number; generation: string; enabled: boolean; checkIds?:readonly string[];maxAdmissions?: number; overrides?: ReadonlyMap<string, number>; existing?: readonly Existing[]; createScheduledJob: (admission: ScheduledAdmission, check: QualityCheck) => Promise<string> }) {
  if (!input.enabled) return [] as ScheduledAdmission[];
  if (!Number.isSafeInteger(input.now) || input.now < 0 || !input.generation || input.generation.length > 160) throw new Error("invalid_scheduler_generation");
  const selection=input.checkIds===undefined?undefined:new Set(scheduledCheckSelection(JSON.stringify(input.checkIds)));
  if(selection?.size===0)return [];
  await ensureSchedulerSchema(db);
  await ensureQualitySchema(db);
  await ensureQualityJobSchema(db);
  const orphaned = await db.prepare("SELECT check_id AS checkId,bucket,created_at AS createdAt FROM quality_scheduler_admissions WHERE status='admitted' ORDER BY created_at LIMIT 2").all<{checkId:string;bucket:number;createdAt:number}>();
  for(const row of orphaned.results) {
    const job = await db.prepare("SELECT run_id AS runId FROM quality_jobs WHERE actor='cloudflare-scheduler' AND idempotency_key=?").bind(schedulerJobIntentKey(row.checkId,row.bucket)).first<{runId:string}>();
    if(job) await db.prepare("UPDATE quality_scheduler_admissions SET status='linked',run_id=? WHERE check_id=? AND bucket=? AND status='admitted'").bind(job.runId,row.checkId,row.bucket).run();
    else if(input.now-row.createdAt>60000) await db.prepare("UPDATE quality_scheduler_admissions SET status='unknown' WHERE check_id=? AND bucket=? AND status='admitted'").bind(row.checkId,row.bucket).run();
  }
  const max = Math.min(2, Math.max(0, input.maxAdmissions ?? 2)); if (!max) return [];
  const overrideRows = await db.prepare("SELECT check_id AS checkId,cadence_minutes AS cadenceMinutes FROM quality_schedule_overrides").all<{checkId:string;cadenceMinutes:number}>();
  const overrides = new Map(overrideRows.results.map(row => [row.checkId,row.cadenceMinutes]));
  for(const [key,value] of input.overrides || []) overrides.set(key,value);
  const activeRows = await db.prepare(`SELECT DISTINCT json_extract(entry.value,'$.checkId') AS checkId, jobs.status FROM quality_jobs AS jobs,json_each(jobs.checks_json) AS entry WHERE jobs.status IN ('queued','running')`).all<Existing>();
  const stored = await db.prepare(`SELECT check_id AS checkId,MAX(created_at) AS lastAt,MAX(CASE WHEN status='unknown' THEN 1 ELSE 0 END) AS unknown FROM quality_scheduler_admissions GROUP BY check_id`).all<{ checkId: string; lastAt: number; unknown: number }>();
  const last = new Map(stored.results.map(row => [row.checkId, row]));
  const existing = new Map([...activeRows.results, ...(input.existing || [])].map(row => [row.checkId, row.status]));
  const candidates = qualityRegistry.filter(check => check.cadenceMinutes > 0&&(!selection||selection.has(check.checkId))).map(check => ({check,lastAt:last.get(check.checkId)?.lastAt ?? -Infinity})).sort((a,b) => a.lastAt-b.lastAt || a.check.checkId.localeCompare(b.check.checkId)).map(x=>x.check);
  const minute = Math.floor(input.now / 60_000);
  const slots = await db.prepare(`SELECT slot FROM quality_scheduler_slots WHERE minute=?`).bind(minute).all<{ slot: number }>();
  const usedSlots = new Set(slots.results.map(row => row.slot));
  let nextSlot = 0;
  const admitted: ScheduledAdmission[] = [];
  for (const check of candidates) {
    if (admitted.length >= max) break;
    const active = existing.get(check.checkId);
    if (active === "queued" || active === "running" || active === "unknown") continue;
    const interval = cadence(check, overrides); const prior = last.get(check.checkId); const bucket = Math.floor(input.now / interval);
    if (prior?.unknown || (prior && input.now - prior.lastAt < interval)) continue;
    while (usedSlots.has(nextSlot) && nextSlot < 2) nextSlot++;
    if (nextSlot >= 2) break;
    const slotResult = await db.prepare(`INSERT INTO quality_scheduler_slots(minute,slot,created_at) VALUES(?,?,?) ON CONFLICT(minute,slot) DO NOTHING`).bind(minute, nextSlot, input.now).run();
    if (Number((slotResult as {meta?:{changes?:number}}).meta?.changes ?? 0) !== 1) { usedSlots.add(nextSlot); nextSlot++; continue; }
    const admission = { checkId: check.checkId, bucket, generation: input.generation, priority: "monitor" as const };
    const result = await db.prepare(`INSERT INTO quality_scheduler_admissions(check_id,bucket,generation,status,created_at) VALUES(?,?,?,'admitted',?) ON CONFLICT(check_id,bucket) DO NOTHING`).bind(admission.checkId, bucket, input.generation, input.now).run();
    const changes = Number((result as { meta?: { changes?: number } }).meta?.changes ?? 0);
    if (changes !== 1) continue;
    usedSlots.add(nextSlot); nextSlot++;
    try {
      const runId=await input.createScheduledJob(admission, check);
      if(!runId) throw new Error('scheduled_job_identity_missing');
      await db.prepare("UPDATE quality_scheduler_admissions SET status='linked',run_id=? WHERE check_id=? AND bucket=? AND status='admitted'").bind(runId,admission.checkId,bucket).run();
      admitted.push({...admission,status:'linked',runId});
    } catch {
      await db.prepare(`UPDATE quality_scheduler_admissions SET status='unknown' WHERE check_id=? AND bucket=? AND status='admitted'`).bind(admission.checkId, bucket).run();
      // One failed admission consumes one slot but cannot cancel unrelated due
      // checks. Its explicit unknown state remains operator-visible.
      admitted.push({...admission,status:'unknown'});
    }
  }
  return admitted;
}
