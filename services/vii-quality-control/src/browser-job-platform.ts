import type { D1Database } from "../../../types/cloudflare-runtime";
import { browserProfile } from "./browser-profiles.ts";
import { browserWorldPaths } from "../../vii-quality-browser/src/public-world-contract.ts";
import { payloadHash } from "../../../app/lib/quality-job-store.ts";
import { persistQualityJobProgress } from "../../../app/lib/quality-platform.ts";
import {
  claimQualityJob, commitQualityJobCheck, enqueueQualityJob, ensureQualityJobSchema,
  finishQualityJobSlice, readQualityJob, startQualityJobCheck,
} from "../../../app/lib/quality-job-store.ts";

const SOURCE = /^[a-f0-9]{40}$/;
const BUILD = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const LEASE_MS = 55_000;

export type BrowserJobEnvironment = {
  QUALITY_BROWSER: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
  BROWSER_ENABLED?: string;
  EXPECTED_SOURCE_VERSION: string;
  EXPECTED_BUILD_ID: string;
  PUBLIC_ORIGIN: string;
};
export type BrowserJobExecutor = (input: { jobId: string; sourceSha: string; buildId: string; profileId: string; signal: AbortSignal; browser: BrowserJobEnvironment["QUALITY_BROWSER"] }) => Promise<{ jobId:string;status: "passed" | "failed" | "blocked"; reason?: string; requestCount: number; steps: number; evidenceKey?: string; elapsedMs: number; sourceVersion: string; buildId: string; profileId: string; failureStep?: string; attemptedWrites?: Array<{method:string;origin:string;path:string}> }>;

async function schema(db: D1Database) {
  await ensureQualityJobSchema(db);
  await db.prepare(`CREATE TABLE IF NOT EXISTS quality_browser_lane (lane TEXT PRIMARY KEY, lease_token TEXT NOT NULL, run_id TEXT NOT NULL, lease_until TEXT NOT NULL)`).run();
}
function validEnvironment(env: BrowserJobEnvironment) {
  if (env.BROWSER_ENABLED !== "true" || typeof env.QUALITY_BROWSER?.fetch!=='function' || env.PUBLIC_ORIGIN !== "https://vii.spaplus.co" || !SOURCE.test(env.EXPECTED_SOURCE_VERSION) || !BUILD.test(env.EXPECTED_BUILD_ID)) throw new Error("browser_environment_invalid");
}
async function laneClaim(db: D1Database, runId: string, token: string, until: string, now: string) {
  const result = await db.prepare(`INSERT INTO quality_browser_lane(lane,lease_token,run_id,lease_until) VALUES('global',?,?,?) ON CONFLICT(lane) DO UPDATE SET lease_token=excluded.lease_token,run_id=excluded.run_id,lease_until=excluded.lease_until WHERE quality_browser_lane.lease_until<=?`).bind(token, runId, until, now).run();
  return Number(result.meta?.changes ?? 0) === 1;
}
async function laneRelease(db: D1Database, runId: string, token: string) {
  await db.prepare("DELETE FROM quality_browser_lane WHERE lane='global' AND run_id=? AND lease_token=?").bind(runId, token).run();
}

export function browserQualityCheck(input:{sourceVersion:string;buildId:string;profileId:string;origin:string}) {
  const profile = browserProfile(input.profileId);
  if (!SOURCE.test(input.sourceVersion) || !BUILD.test(input.buildId) || input.origin !== "https://vii.spaplus.co" || !profile) throw new Error("browser_job_definition_invalid");
  const route=profile.scenario==='gallery-next'?'/business?id=vacation-116':browserWorldPaths[profile.world];
  return { checkId: `browser:${input.profileId}`, definitionVersion: profile.definitionVersion, timeoutMs: profile.timeoutMs, configuration: { executionKind: "browser", profile:structuredClone(profile),profileId: input.profileId, sourceVersion: input.sourceVersion, buildId: input.buildId, origin: input.origin,level:'full', check: { checkId: `browser:${input.profileId}`, family: "quality-browser", world: profile.world, route, viewport: profile.device, severity: "high", cadenceMinutes: 60, timeoutMs: profile.timeoutMs, expected: profile.scenario, releaseBlocking: true } } };
}
export async function createBrowserQualityJob(db: D1Database, input: { actor: string; idempotencyKey: string; sourceVersion: string; buildId: string; profileId: string; origin: string }) {
  const check=browserQualityCheck(input);
  const definitionVersion = await payloadHash(check);
  const queued = await enqueueQualityJob(db, { actor: input.actor, idempotencyKey: input.idempotencyKey, payload: { kind: "browser", profileId: input.profileId, buildId: input.buildId }, sourceVersion: input.sourceVersion, definitionVersion, checks: [check] });
  await persistQualityJobProgress(db, queued.job);
  return queued;
}

export async function consumeBrowserQualityJob(db: D1Database, runId: string, env: BrowserJobEnvironment, execute: BrowserJobExecutor, options: { clock?: () => Date } = {}) {
  validEnvironment(env); await schema(db);
  const clock = options.clock ?? (() => new Date()); const now = clock();
  const job = await readQualityJob(db, runId); if (!job) return { status: "not_found" as const };
  if(!['queued','running'].includes(job.status))return {status:'not_claimed' as const};
  const token = crypto.randomUUID(); const nowIso = now.toISOString(); const until = new Date(now.getTime() + LEASE_MS).toISOString();
  if (!(await laneClaim(db, runId, token, until, nowIso))) return { status: "not_claimed" as const, reason: "browser_lane_busy" };
  let releaseLane=true;
  const block=async(reason:string)=>{
    const updated=await finishQualityJobSlice(db,{runId,leaseToken:token,status:'blocked',reason,now:clock().toISOString()});
    if(!updated)await db.prepare("UPDATE quality_jobs SET status='blocked',reason=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE run_id=? AND status='running' AND lease_token=? AND lease_until<=? AND cancel_requested_at IS NULL").bind(reason,clock().toISOString(),runId,token,clock().toISOString()).run();
    const saved=await readQualityJob(db,runId);return {status:saved?.status==='cancelled'?'cancelled' as const:saved?.status==='blocked'?'blocked' as const:'not_claimed' as const,reason};
  };
  try {
    if (!(await claimQualityJob(db, runId, { leaseToken: token, leaseUntil: until, now: nowIso }))) return { status: "not_claimed" as const, reason: "job_lease_busy" };
    const entry = job.checks[job.nextIndex];
    if (!entry || job.activeIndex !== null || job.checks.length!==1 || job.nextIndex!==0) return await block('browser_interrupted_or_invalid_cursor');
    const profileId = typeof entry.configuration.profileId === "string" ? entry.configuration.profileId : "";
    let definition;try{definition=browserQualityCheck({profileId,sourceVersion:env.EXPECTED_SOURCE_VERSION,buildId:env.EXPECTED_BUILD_ID,origin:env.PUBLIC_ORIGIN});}catch{return await block('browser_job_identity_mismatch');}
    if(job.sourceVersion!==env.EXPECTED_SOURCE_VERSION||await payloadHash(entry)!==job.definitionVersion||await payloadHash(definition)!==job.definitionVersion)return await block('browser_source_or_definition_changed');
    if(!await startQualityJobCheck(db,{runId,leaseToken:token,index:0,now:clock().toISOString()}))return {status:'not_claimed' as const};
    const controller = new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
    const interrupted=new Promise<never>((_,reject)=>{controller.signal.addEventListener('abort',()=>reject(new Error('browser_interrupted')),{once:true});timer=setTimeout(()=>controller.abort(),50_000);});
    let polling=false;
    const cancelPoll = setInterval(() => {if(polling||controller.signal.aborted)return;polling=true;void readQualityJob(db,runId).then(latest=>{if(!latest||latest.status!=='running'||latest.leaseToken!==token||!latest.leaseUntil||latest.leaseUntil<=clock().toISOString())controller.abort();}).catch(()=>controller.abort()).finally(()=>{polling=false;});},2000);
    try {
      releaseLane=false;
      const result = await Promise.race([execute({ jobId: runId, sourceSha: env.EXPECTED_SOURCE_VERSION, buildId: env.EXPECTED_BUILD_ID, profileId, signal: controller.signal, browser: env.QUALITY_BROWSER }),interrupted]);
      if (result.jobId!==runId || result.sourceVersion !== env.EXPECTED_SOURCE_VERSION || result.buildId !== env.EXPECTED_BUILD_ID || result.profileId !== profileId)return await block('browser_result_identity_mismatch');
      releaseLane=true;
      const committed = await commitQualityJobCheck(db, { runId, leaseToken: token, index: job.nextIndex, now: clock().toISOString(), receipt: { checkId: entry.checkId, status: result.status, observed: result.reason ?? "browser_observed", checkedAt: clock().toISOString(), durationMs: result.elapsedMs, ...(result.evidenceKey ? { evidenceUrl: result.evidenceKey } : {}), ...(result.failureStep ? { failureStep: result.failureStep } : {}), ...(result.attemptedWrites ? { attemptedWrites: result.attemptedWrites } : {}) } });
      if (!committed)return await block('browser_commit_fenced');
      if(!await finishQualityJobSlice(db, { runId, leaseToken: token, status: "completed", now: clock().toISOString() }))return await block('browser_completion_fenced');
      const saved = await readQualityJob(db, runId); if (saved) await persistQualityJobProgress(db, saved);
      return { status: result.status };
    } catch {return await block('browser_execution_unverified');}
    finally {if(timer)clearTimeout(timer);clearInterval(cancelPoll);controller.abort();}
  } finally {if(releaseLane)await laneRelease(db, runId, token);const saved=await readQualityJob(db,runId);if(saved)await persistQualityJobProgress(db,saved);}
}
