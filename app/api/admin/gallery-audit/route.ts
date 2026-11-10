import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { cloudflareDatabaseForEnv } from "../../../lib/runtime-database.ts";
import { createGalleryAuditJob, continueGalleryAuditJob, downloadGalleryAuditJob, readGalleryAuditJob, readGalleryAuditItem, readGalleryAuditSource, readGalleryAuditDiagnostics, readGalleryAuditPendingDiagnostics, reconcileGalleryAuditJob, retryGalleryAuditSources, stepGalleryAuditJob } from "../../../lib/gallery-api-audit-job.ts";
import type { D1Database, R2Bucket } from "../../../../types/cloudflare-runtime";
import { readGalleryAuditApply } from "../../../lib/gallery-audit-apply.ts";
import { readBoundedGalleryApply, startBoundedGalleryApply, stepBoundedGalleryApply, recoverBoundedGalleryApply, continueBoundedGalleryApply } from "../../../lib/gallery-audit-bounded-apply.ts";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
const valid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
async function environment() {
  const module = await import(/* @vite-ignore */"cloudflare:workers");
  const env = module.env as unknown as { DB?: D1Database; UPLOADS?: R2Bucket; SERGEY_VII_API_TOKEN?: string; SPAPLUS_VII_API_KEY?: string };
  if (!env.DB || !env.UPLOADS) throw new Error("storage_unavailable"); return { db: cloudflareDatabaseForEnv(env)!, bucket: env.UPLOADS, env };
}
async function allowed(request: Request, write = false) {
  try { return !!await authorizedAdminSession(request) && (!write || request.headers.get("origin") === new URL(request.url).origin); } catch { return false; }
}
export async function GET(request: Request) {
  if (!await allowed(request)) return Response.json({ error: "forbidden" }, { status: 403, headers });
  const query = new URL(request.url).searchParams; const id = query.get("jobId");
  if (!valid(id)) return Response.json({ error: "invalid_job_id" }, { status: 400, headers });
  try {
    const { bucket } = await environment();
    if (query.get("diagnostics") === "1") return Response.json({ ok: true, contexts: await readGalleryAuditDiagnostics(bucket, id) }, { headers });
    if (query.get('pending') === '1') return Response.json({ok:true,pending:await readGalleryAuditPendingDiagnostics(bucket,id)},{headers});
    const applyWorld = query.get("applyWorld");
    if (applyWorld) {
      if (!["vacations", "events", "rooms", "spa"].includes(applyWorld)) return Response.json({ error: "invalid_world" }, { status: 400, headers });
      const world=applyWorld as "vacations" | "events" | "rooms" | "spa";
      return Response.json({ ok: true, apply: await readBoundedGalleryApply(bucket,id,world) || await readGalleryAuditApply(bucket,id,world) }, { headers });
    }
    if (query.get("download") === "1") return new Response(await downloadGalleryAuditJob(bucket, id), { headers: { ...headers, "Content-Type": "application/x-ndjson", "Content-Disposition": 'attachment; filename="gallery-audit.ndjson"' } });
    const target = query.get("item");
    if (target) {
      const parts = target.match(/^(vacations|events|rooms|spa):([1-9]\d{0,9})$/);
      if (!parts) return Response.json({ error: "invalid_item" }, { status: 400, headers });
      if (query.get("source") === "1") {
        const wire = await readGalleryAuditSource(bucket, id, parts[1] as "vacations" | "events" | "rooms" | "spa", Number(parts[2]));
        return wire ? new Response(wire, { headers: { ...headers, "Content-Type": "application/json" } }) : Response.json({ error: "item_not_found" }, { status: 404, headers });
      }
      const item = await readGalleryAuditItem(bucket, id, parts[1] as "vacations" | "events" | "rooms" | "spa", Number(parts[2]));
      return Response.json(item ? { ok: true, item } : { error: "item_not_found" }, { status: item ? 200 : 404, headers });
    }
    const job = await readGalleryAuditJob(bucket, id);
    return Response.json(job ? { ok: true, job } : { error: "job_not_found" }, { status: job ? 200 : 404, headers });
  } catch { return Response.json({ error: "gallery_audit_unavailable" }, { status: 503, headers }); }
}
export async function POST(request: Request) {
  if (!await allowed(request, true)) return Response.json({ error: "forbidden" }, { status: 403, headers });
  if (Number(request.headers.get("content-length")) > 1024) return Response.json({ error: "request_too_large" }, { status: 413, headers });
  let body: { jobId?: unknown; action?: unknown; world?: unknown; scopeWorld?: unknown; scopeSupplierId?: unknown; recovery?: unknown };
  try { const text = await request.text(); if (text.length > 1024) throw new Error("body_size"); body = JSON.parse(text); }
  catch { return Response.json({ error: "malformed_json" }, { status: 400, headers }); }
  if (!body || !valid(body.jobId) || !["start", "step", "apply", "apply-step", "apply-recover", "apply-continue", "retry", "continue", "reconcile"].includes(String(body.action))) return Response.json({ error: "invalid_request" }, { status: 400, headers });
  if (body.scopeWorld !== undefined && (body.action !== 'start' || !['vacations','events','rooms','spa'].includes(String(body.scopeWorld)))) return Response.json({error:'invalid_audit_scope'}, {status:400,headers});
  if (body.scopeSupplierId !== undefined && (body.action !== 'start' || body.scopeWorld === undefined || !Number.isSafeInteger(body.scopeSupplierId) || Number(body.scopeSupplierId) < 1 || Number(body.scopeSupplierId) > 9_999_999_999)) return Response.json({error:'invalid_audit_scope'}, {status:400,headers});
  try {
    const { db, bucket, env } = await environment();
    if (body.action === "apply" || body.action === "apply-step" || body.action === "apply-recover" || body.action === 'apply-continue') {
      if (!["vacations", "events", "rooms", "spa"].includes(String(body.world))) return Response.json({ error: "invalid_world" }, { status: 400, headers });
      const input={db,bucket,jobId:body.jobId,world:body.world as "vacations"|"events"|"rooms"|"spa"};
      const apply=body.action==='apply-step'?await stepBoundedGalleryApply(input):body.action==='apply-recover'?await recoverBoundedGalleryApply(input):body.action==='apply-continue'?await continueBoundedGalleryApply(input):await startBoundedGalleryApply({...input,recovery:body.recovery===true});
      return Response.json({ok:true,apply},{headers});
    }
    const job = body.action === "start" ? await createGalleryAuditJob({ db, bucket, jobId: body.jobId, scopeWorld: body.scopeWorld as 'vacations'|'events'|'rooms'|'spa'|undefined, scopeSupplierId: body.scopeSupplierId as number|undefined })
      : body.action === 'reconcile' ? await reconcileGalleryAuditJob({db,bucket,jobId:body.jobId})
      : body.action === "retry" ? await retryGalleryAuditSources({ db, bucket, jobId: body.jobId }) : body.action === "continue" ? await continueGalleryAuditJob({ db, bucket, jobId: body.jobId }) : await stepGalleryAuditJob({ db, bucket, jobId: body.jobId, env });
    return Response.json({ ok: true, job }, { headers });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "gallery_audit_unavailable";
    console.error("VII gallery audit unavailable", { action: body.action,
      reason: /^[a-z_0-9:.-]{3,150}$/.test(message) ? message : "audit_runtime_failure" });
    const status = message === "audit_step_in_progress" || message === "gallery_apply_step_in_progress" ? 409 : message === "gallery_audit_job_not_found" ? 404 : 503;
    return Response.json({ error: status === 503 ? "gallery_audit_unavailable" : message }, { status, headers });
  }
}
