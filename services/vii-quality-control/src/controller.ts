import type { D1Database } from "../../../types/cloudflare-runtime";
import { readQualityDashboard, readQualityRunStatus, readQualityScopeOptions, persistQualityJobProgress, updateQualityIncident, updateQualitySchedule, type QualityRunLevel } from "../../../app/lib/quality-platform.ts";
import { ensureQualityJobSchema, readQualityJob, readQualityJobByIntent, requestQualityJobCancel, payloadHash, type QualityJob } from "../../../app/lib/quality-job-store.ts";
import { ensureDispatchSchema, reserveDispatch, dispatchWithTransport, recoverExpiredDispatches } from "./dispatch-outbox.ts";
import { readSchedulerAttention, reconcileSchedulerAdmission, scheduledDispatchAdmission, markScheduledAdmissionUnknown } from "./scheduler-recovery.ts";
import { browserProfiles } from "./browser-profiles.ts";
import { createBrowserQualityJob, consumeBrowserQualityJob, type BrowserJobEnvironment } from "./browser-job-platform.ts";
import { executeBrowserProfile } from "./browser-executor.ts";
import { evidenceKey } from "../../vii-quality-browser/src/evidence.ts";
import { readPrivateJpeg } from "../../../shared/private-jpeg.ts";
import {verifyHttpTargetBuild,type GenerationResult} from './http-generation.ts';
import { registerReleaseSubject, enqueueReleaseCheck, readReleaseSubjectEvidence, releaseJobContext, type ReleaseSubjectEnvironment } from './release-subject.ts';

export type QueueMessage = { version: 1; runId: string; expectedIndex: number; sourceVersion: string; priority: "release" | "monitor" };
export type ControllerEnvironment = Partial<BrowserJobEnvironment> & ReleaseSubjectEnvironment & { QUALITY_DB: D1Database; RELEASE_QUEUE: { send(message: QueueMessage): Promise<void> }; MONITOR_QUEUE: { send(message: QueueMessage): Promise<void> }; EXECUTION_ENABLED?: string; EXPECTED_BROWSER_SOURCE_VERSION?: string };
export type ControllerPlatform = {
  create(db: D1Database, input: { actor: string; idempotencyKey: string; origin: string; level: QualityRunLevel; scope?: { changedBoxes: string[]; consumers?: string[]; unknownOwner?: boolean } }, generation?: { targetBuildId?: string }): Promise<{ job: QualityJob; duplicate: boolean }>;
  consume(db: D1Database, runId: string, generation?: { targetBuildId?: string }): Promise<unknown>;
  verifyTarget?(input:{origin:string;buildId:string}):Promise<GenerationResult>;
};
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers });
export function jobView(job: QualityJob) {
  const configuration=job.checks[0]?.configuration;
  return { runId: job.runId, status: job.status, nextIndex: job.nextIndex, totalChecks: job.checks.length, sourceVersion: job.sourceVersion, reason: job.reason,
    executionKind:configuration?.executionKind==='browser'?'browser':'http',
    ...(configuration?.executionKind==='browser'?{profileId:configuration.profileId,buildId:configuration.buildId}:{}),
    passedCount: job.receipts.filter(r => r.status === "passed").length, attentionCount: job.receipts.filter(r => r.status !== "passed").length,
    receipts: ["queued", "running"].includes(job.status) ? [] : job.receipts };
}
function browserReady(env: ControllerEnvironment): env is ControllerEnvironment & BrowserJobEnvironment & { EXPECTED_BROWSER_SOURCE_VERSION: string } {
  return env.EXECUTION_ENABLED==='true' && env.BROWSER_ENABLED==='true' && typeof env.QUALITY_BROWSER?.fetch==='function'
    && env.PUBLIC_ORIGIN==='https://vii.spaplus.co' && /^[a-f0-9]{40}$/.test(env.EXPECTED_SOURCE_VERSION || '')
    && /^[a-f0-9]{40}$/.test(env.EXPECTED_BROWSER_SOURCE_VERSION || '')
    && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(env.EXPECTED_BUILD_ID || '');
}
function browserExecutionEnvironment(env: ControllerEnvironment): BrowserJobEnvironment {
  if (!browserReady(env)) throw new Error('browser_execution_disabled');
  // The runner's immutable source is independent of this controller's source.
  // A controller-only release must not relabel an unchanged browser artifact.
  return { QUALITY_BROWSER: env.QUALITY_BROWSER, BROWSER_ENABLED: env.BROWSER_ENABLED,
    EXPECTED_SOURCE_VERSION: env.EXPECTED_BROWSER_SOURCE_VERSION,
    EXPECTED_BUILD_ID: env.EXPECTED_BUILD_ID, PUBLIC_ORIGIN: env.PUBLIC_ORIGIN };
}
function browserOptions(env: ControllerEnvironment) {
  return {enabled:browserReady(env),profiles:browserProfiles};
}
function scopeValue(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("invalid_scope");
  const value = raw as Record<string, unknown>;
  const names = (items: unknown): items is string[] => Array.isArray(items) && items.length <= 100 && items.every(x => typeof x === "string" && x.length > 0 && x.length <= 160);
  if (!names(value.changedBoxes) || (value.consumers !== undefined && !names(value.consumers)) || (value.unknownOwner !== undefined && typeof value.unknownOwner !== "boolean")) throw new Error("invalid_scope");
  return { changedBoxes: value.changedBoxes.map(x => x === "world-landings" ? "vacations" : x), ...(value.consumers !== undefined ? { consumers: value.consumers as string[] } : {}), ...(value.unknownOwner !== undefined ? { unknownOwner: value.unknownOwner as boolean } : {}) };
}

/** The authenticated gateway supplies the actor only after a verified, request-bound
 * attestation. This module never reads a cookie, accepts a browser actor, executes
 * checks on GET/POST, or sends a notification from an HTTP request. */
export function createController(platform: ControllerPlatform) {
  async function releaseAllowed(env: ControllerEnvironment, job: QualityJob) {
    const context=await releaseJobContext(env,job);
    if (context.allowed) return true;
    await env.QUALITY_DB.prepare("UPDATE quality_jobs SET status='blocked',reason=?,updated_at=? WHERE run_id=? AND status='queued' AND active_index IS NULL")
      .bind(context.reason,new Date().toISOString(),job.runId).run();
    const saved=await readQualityJob(env.QUALITY_DB,job.runId);
    if(saved?.status==='blocked') await persistQualityJobProgress(env.QUALITY_DB,saved);
    return false;
  }
  async function dispatch(env: ControllerEnvironment, job: QualityJob, priority: QueueMessage["priority"] = "release") {
    if (env.EXECUTION_ENABLED !== "true" || job.status !== "queued") return;
    if (!await releaseAllowed(env,job)) return;
    const admission = await scheduledDispatchAdmission(env.QUALITY_DB,job);
    if(admission==='deferred')return;
    if(admission==='superseded') {
      await env.QUALITY_DB.prepare("UPDATE quality_jobs SET status='blocked',reason='scheduled_admission_superseded',updated_at=? WHERE run_id=? AND status='queued' AND active_index IS NULL").bind(new Date().toISOString(),job.runId).run();
      const blocked=await readQualityJob(env.QUALITY_DB,job.runId);
      if(blocked)await persistQualityJobProgress(env.QUALITY_DB,blocked);
      return;
    }
    await ensureDispatchSchema(env.QUALITY_DB);
    const row = await reserveDispatch(env.QUALITY_DB, { runId: job.runId, expectedIndex: job.nextIndex, sourceVersion: job.sourceVersion, priority });
    if (!row) throw new Error("dispatch_not_reserved");
    const message: QueueMessage = { version: 1, runId: job.runId, expectedIndex: job.nextIndex, sourceVersion: job.sourceVersion, priority };
    const sent = await dispatchWithTransport(env.QUALITY_DB, row.dispatchId, crypto.randomUUID(), () => (priority === "release" ? env.RELEASE_QUEUE : env.MONITOR_QUEUE).send(message));
    if (sent.status === "uncertain") {
      // A late delivery will observe blocked and execute nothing. Never change
      // a run already owned by an active consumer based on an unknown send ack.
      await env.QUALITY_DB.prepare("UPDATE quality_jobs SET status='blocked',reason='queue_dispatch_unverified',updated_at=? WHERE run_id=? AND status='queued' AND next_index=? AND active_index IS NULL")
        .bind(new Date().toISOString(), job.runId, job.nextIndex).run();
      const saved = await readQualityJob(env.QUALITY_DB, job.runId);
      if(saved?.status==='blocked' && saved.checks[0]?.configuration.trigger==='scheduled')await markScheduledAdmissionUnknown(env.QUALITY_DB,saved.runId);
      if (saved) await persistQualityJobProgress(env.QUALITY_DB, saved);
    }
  }
  async function handle(request: Request, env: ControllerEnvironment, actor: string, body?: Record<string, unknown> | null) {
    if (!actor || actor.length > 320) return json({ error: "forbidden" }, 403);
    const url = new URL(request.url);
    if (url.pathname !== "/api/admin/quality") return json({ error: "not_found" }, 404);
    if (!["GET", "POST"].includes(request.method)) return json({ error: "method_not_allowed" }, 405);
    try {
      const db = env.QUALITY_DB;
      if (request.method === "GET") {
        if (url.searchParams.has('releaseSubjectId')) {
          if ([...url.searchParams.keys()].some(key=>key!=='releaseSubjectId') || url.searchParams.getAll('releaseSubjectId').length!==1) return json({ error:'invalid_release_query' },400);
          return json(await readReleaseSubjectEvidence(env,url.searchParams.get('releaseSubjectId')));
        }
        if(url.searchParams.get('engine')==='browser')return json(browserOptions(env));
        if (url.searchParams.get("evidence") === "1") {
          // Evidence is addressable only through the durable job receipt. The
          // caller never supplies an R2 key, profile, source or browser URL.
          const id = url.searchParams.get("jobId") || "";
          if (!/^[A-Za-z0-9-]{8,120}$/.test(id)||[...url.searchParams.keys()].some(key=>!['evidence','jobId'].includes(key))||url.searchParams.getAll('evidence').length!==1||url.searchParams.getAll('jobId').length!==1) return json({ error: "invalid_job_id" }, 400);
          await ensureQualityJobSchema(db);
          const job = await readQualityJob(db, id);
          if (!job) return json({ error: "job_not_found" }, 404);
          if (["queued", "running"].includes(job.status)) return json({ error: "evidence_not_ready" }, 409);
          const entry = job.checks[0];
          const configuration = entry?.configuration;
          const profileId = typeof configuration?.profileId === "string" ? configuration.profileId : "";
          const profile = configuration?.profile as Record<string,unknown>|undefined;
          const receipt = job.receipts.find(item => item.checkId === entry?.checkId);
          if (!entry ||job.checks.length!==1||configuration?.executionKind !== "browser"||configuration.sourceVersion!==job.sourceVersion||configuration.origin!=='https://vii.spaplus.co'||!profile||profile.profileId!==profileId||entry.checkId!==`browser:${profileId}`||!['desktop','mobile'].includes(String(profile.device))||!['world-shell','map-open-close','responsive-shell','gallery-next'].includes(String(profile.scenario))||!receipt?.evidenceUrl||!['failed','blocked'].includes(receipt.status)||await payloadHash(entry)!==job.definitionVersion) return json({ error: "evidence_not_found" }, 404);
          let canonical: string;
          try { canonical = evidenceKey({ sourceVersion: job.sourceVersion, jobId: job.runId, device: String(profile.device), scenario: String(profile.scenario) }); }
          catch { return json({ error: "evidence_not_found" }, 404); }
          if (receipt.evidenceUrl !== canonical || !env.QUALITY_BROWSER) return json({ error: "evidence_not_found" }, 404);
          const browserUrl = new URL("https://vii-quality-browser.internal/evidence");
          browserUrl.searchParams.set("sourceVersion", job.sourceVersion);
          browserUrl.searchParams.set("jobId", job.runId);
          browserUrl.searchParams.set("device", String(profile.device));
          browserUrl.searchParams.set("scenario", String(profile.scenario));
          const signal=AbortSignal.any([request.signal,AbortSignal.timeout(3000)]);
          let late=false,onAbort:(()=>void)|undefined;
          try{
            const response=await Promise.race([env.QUALITY_BROWSER.fetch(browserUrl,{method:'GET',signal,headers:{'X-VII-Quality-Evidence-Source':job.sourceVersion}}).then(response=>{if(late)void response.body?.cancel().catch(()=>undefined);return response;}),new Promise<never>((_,reject)=>{onAbort=()=>reject(new Error('evidence_transport_timeout'));signal.addEventListener('abort',onAbort,{once:true});if(signal.aborted)onAbort();})]);
            if(response.status===404){void response.body?.cancel().catch(()=>undefined);return json({error:'evidence_not_found'},404);}
            return await readPrivateJpeg(response,{signal});
          }finally{late=true;if(onAbort)signal.removeEventListener('abort',onAbort);}
        }
        if (url.searchParams.get("scope") === "metadata") return json(readQualityScopeOptions());
        if (url.searchParams.has("intentKey")) {
          const key = url.searchParams.get("intentKey") || "";
          if (!/^[A-Za-z0-9:_-]{8,120}$/.test(key)) return json({ error: "invalid_idempotency_key" }, 400);
          const job = await readQualityJobByIntent(db, actor, key);
          return json({ job: job ? jobView(job) : null }, job ? 200 : 404);
        }
        if (url.searchParams.has("jobId")) {
          const id = url.searchParams.get("jobId") || "";
          if (!/^[A-Za-z0-9-]{8,120}$/.test(id)) return json({ error: "invalid_job_id" }, 400);
          await ensureQualityJobSchema(db);
          const job = await readQualityJob(db, id);
          return json({ job: job ? jobView(job) : null }, job ? 200 : 404);
        }
        if (url.searchParams.has("runId") || url.searchParams.get("active") === "1") {
          const id = url.searchParams.get("runId") || undefined;
          if (id && !/^[A-Za-z0-9:_-]{1,120}$/.test(id)) return json({ error: "invalid_run_id" }, 400);
          return json(await readQualityRunStatus(db, { runId: id, activeOnly: !id }));
        }
        const [dashboard,scheduler]=await Promise.all([readQualityDashboard(db),readSchedulerAttention(db)]);
        return json({...dashboard,scheduler,browser:browserOptions(env)});
      }
      if (!body) return json({ error: "invalid_request" }, 400);
      if (typeof body.idempotencyKey==='string' && body.idempotencyKey.startsWith('release:')) return json({error:'reserved_release_intent'},400);
      if (body.action==='release-register') {
        if (Object.keys(body).some(key=>!['action','descriptor'].includes(key))) return json({error:'invalid_release_request'},400);
        return json(await registerReleaseSubject(env,body.descriptor,actor),201);
      }
      if (body.action==='release-enqueue') {
        if (Object.keys(body).some(key=>!['action','subjectId','checkKey'].includes(key))) return json({error:'invalid_release_request'},400);
        if (!browserReady(env)) return json({error:'browser_runner_not_activated'},503);
        const queued=await enqueueReleaseCheck(env,body.subjectId,body.checkKey);
        await dispatch(env,queued.job);
        return json({job:jobView(await readQualityJob(db,queued.job.runId)??queued.job),duplicate:queued.duplicate},202);
      }
      if(body.action==='enqueue-browser') {
        if(!browserReady(env))return json({error:'browser_runner_not_activated'},503);
        if(typeof body.profileId!=='string' || typeof body.idempotencyKey!=='string')return json({error:'browser_job_definition_invalid'},400);
        const browser = browserExecutionEnvironment(env);
        const queued=await createBrowserQualityJob(db,{actor,idempotencyKey:body.idempotencyKey,profileId:body.profileId,sourceVersion:browser.EXPECTED_SOURCE_VERSION,buildId:browser.EXPECTED_BUILD_ID,origin:browser.PUBLIC_ORIGIN});
        await dispatch(env,queued.job);
        return json({job:jobView(await readQualityJob(db,queued.job.runId) ?? queued.job),duplicate:queued.duplicate},202);
      }
      if(body.action==='scheduler-reconcile' && typeof body.checkId==='string' && Number.isSafeInteger(body.bucket) && (body.mode==='inspect'||body.mode==='allow-next'))return json({reconciliation:await reconcileSchedulerAdmission(db,{actor,checkId:body.checkId,bucket:Number(body.bucket),mode:body.mode})});
      if (body.action === "enqueue") {
        // A disabled or incompletely provisioned controller cannot accept new
        // work and leave the interface reporting an indefinitely queued run.
        if (env.EXECUTION_ENABLED !== "true") return json({ error: "quality_job_runner_unavailable" }, 503);
        if (typeof body.idempotencyKey !== "string" || !/^[A-Za-z0-9:_-]{8,120}$/.test(body.idempotencyKey)) return json({ error: "invalid_idempotency_key" }, 400);
        if (body.level !== "full" && body.level !== "medium" && body.level !== "regular") return json({ error: "invalid_level" }, 400);
        const scope = Object.hasOwn(body, "scope") ? scopeValue(body.scope) : undefined;
        const queued = await platform.create(db, { actor, idempotencyKey: body.idempotencyKey, origin: url.origin, level: body.level, ...(scope ? { scope } : {}) }, { targetBuildId: env.EXPECTED_BUILD_ID });
        await dispatch(env, queued.job);
        const saved = await readQualityJob(db, queued.job.runId);
        return json({ job: jobView(saved ?? queued.job), duplicate: queued.duplicate }, 202);
      }
      if (body.action === "resume-job" || body.action === "cancel-job") {
        if (typeof body.jobId !== "string" || !/^[A-Za-z0-9-]{8,120}$/.test(body.jobId)) return json({ error: "invalid_job_id" }, 400);
        await ensureQualityJobSchema(db);
        const job = await readQualityJob(db, body.jobId);
        if (!job) return json({ error: "job_not_found" }, 404);
        if (body.action === "cancel-job") {
          await requestQualityJobCancel(db, job.runId);
          const saved = await readQualityJob(db, job.runId);
          if (saved) await persistQualityJobProgress(db, saved);
          return json({ job: saved ? jobView(saved) : null }, 202);
        }
        if (env.EXECUTION_ENABLED !== "true") return json({ error: "quality_job_runner_unavailable" }, 503);
        await dispatch(env, job);
        return json({ job: jobView(await readQualityJob(db, job.runId) ?? job) }, 202);
      }
      if (["acknowledge", "resolve", "reopen"].includes(String(body.action)) && typeof body.incidentId === "string" && body.incidentId.length < 100) return json({ incident: await updateQualityIncident(db, { incidentId: body.incidentId, action: body.action as "acknowledge" | "resolve" | "reopen", actor }) });
      if (body.action === "schedule" && typeof body.checkId === "string" && Number.isInteger(body.cadenceMinutes)) return json({ schedule: await updateQualitySchedule(db, { checkId: body.checkId, cadenceMinutes: Number(body.cadenceMinutes), actor }) });
      return json({ error: "invalid_request" }, 400);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (['release_descriptor_invalid','release_actor_invalid','release_check_unknown'].includes(code)) return json({error:code},400);
      if (['release_context_mismatch','release_subject_expired','release_registration_stale','release_subject_corrupt'].includes(code)) return json({error:code},409);
      if (code==='release_subject_not_registered') return json({error:code},404);
      if (code==='release_authority_not_activated') return json({error:code},503);
      if (code === "quality_job_idempotency_conflict" || code === "dispatch_immutable_conflict") return json({ error: code }, 409);
      if(code==='scheduler_job_still_active')return json({error:code},409);
      if (["invalid_scope", "invalid_quality_schedule", "invalid_quality_job", "browser_job_definition_invalid", "browser_profile_unsupported", "invalid_scheduler_reconciliation", "scheduler_admission_not_found", "quality_scope_unmapped", "quality_scope_level_incomplete", "quality_scope_empty"].includes(code)) return json({ error: code }, 400);
      return json({ error: "quality_unavailable" }, 503);
    }
  }
  async function consume(env: ControllerEnvironment, message: unknown) {
    if (env.EXECUTION_ENABLED !== "true") throw new Error("quality_execution_disabled");
    if (!message || typeof message !== "object") throw new Error("invalid_queue_message");
    const value = message as QueueMessage;
    if (value.version !== 1 || !/^[A-Za-z0-9-]{8,120}$/.test(value.runId) || !Number.isSafeInteger(value.expectedIndex) || value.expectedIndex < 0 || typeof value.sourceVersion !== "string" || !["release", "monitor"].includes(value.priority)) throw new Error("invalid_queue_message");
    await ensureQualityJobSchema(env.QUALITY_DB);
    const job = await readQualityJob(env.QUALITY_DB, value.runId);
    if (!job || job.sourceVersion !== value.sourceVersion || job.nextIndex !== value.expectedIndex || !["queued", "running"].includes(job.status)) return { status: "obsolete" };
    if (!await releaseAllowed(env,job)) return { status:'blocked',reason:'release_context_not_current' };
    // The durable runner owns the execution lease and commit fence. Duplicate
    // Queue deliveries cannot execute an already committed check again.
    const isBrowser=job.checks[0]?.configuration.executionKind==='browser';
    if(isBrowser&&!browserReady(env))throw new Error('browser_execution_disabled');
    if(!isBrowser){
      const generation=await(platform.verifyTarget??verifyHttpTargetBuild)({origin:env.PUBLIC_ORIGIN??'',buildId:env.EXPECTED_BUILD_ID??''});
      if(generation.status!=='passed'){
        await env.QUALITY_DB.prepare("UPDATE quality_jobs SET status='blocked',reason=?,updated_at=? WHERE run_id=? AND source_version=? AND status='queued' AND next_index=? AND active_index IS NULL AND cancel_requested_at IS NULL").bind(generation.reason,new Date().toISOString(),job.runId,job.sourceVersion,value.expectedIndex).run();
        const saved=await readQualityJob(env.QUALITY_DB,job.runId);if(saved?.status==='blocked')await persistQualityJobProgress(env.QUALITY_DB,saved);
        return{status:saved?.status==='running'?'not_claimed':saved?.status==='blocked'?'blocked':'obsolete',reason:saved?.reason??generation.reason};
      }
    }
    const result = isBrowser ? await consumeBrowserQualityJob(env.QUALITY_DB,job.runId,browserExecutionEnvironment(env),executeBrowserProfile) : await platform.consume(env.QUALITY_DB, job.runId, { targetBuildId: env.EXPECTED_BUILD_ID });
    const saved = await readQualityJob(env.QUALITY_DB, job.runId);
    if (saved && saved.nextIndex > value.expectedIndex) await dispatch(env, saved, value.priority);
    return result;
  }
  async function recover(env: ControllerEnvironment) {
    await ensureDispatchSchema(env.QUALITY_DB);
    await recoverExpiredDispatches(env.QUALITY_DB);
    // Repair the commit-before-dispatch gap only. An uncertain send keeps its
    // original reservation and is never converted into another network send.
    await ensureQualityJobSchema(env.QUALITY_DB);
    const {ensureSchedulerSchema}=await import('./scheduler.ts');
    await ensureSchedulerSchema(env.QUALITY_DB);
    const rows = await env.QUALITY_DB.prepare("SELECT jobs.run_id AS runId,COALESCE(outbox.priority,CASE WHEN json_extract(jobs.checks_json,'$[0].configuration.trigger')='scheduled' THEN 'monitor' ELSE 'release' END) AS priority FROM quality_jobs AS jobs LEFT JOIN quality_dispatch_outbox AS outbox ON outbox.run_id=jobs.run_id AND outbox.expected_index=jobs.next_index LEFT JOIN quality_scheduler_admissions AS admission ON jobs.idempotency_key='scheduled:'||REPLACE(admission.check_id,'.','_')||':'||admission.bucket WHERE jobs.status='queued' AND (COALESCE(json_extract(jobs.checks_json,'$[0].configuration.trigger'),'manual')<>'scheduled' OR admission.status IN ('linked','operator-cleared')) ORDER BY jobs.created_at LIMIT 2").all<{ runId: string; priority: QueueMessage['priority'] }>();
    for (const row of rows.results) { const job = await readQualityJob(env.QUALITY_DB, row.runId); if (job) await dispatch(env, job, row.priority); }
  }
  return { handle, consume, recover, dispatch };
}
