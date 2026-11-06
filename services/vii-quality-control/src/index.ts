import { createController, type ControllerEnvironment } from "./controller.ts";
import { createManualQualityJob, createScheduledQualityJob, consumeQualityJob, qualityBuildIdentity } from "../../../app/lib/quality-job-platform.ts";
import { verifyQualityAttestation } from "../../../app/lib/quality-attestation.ts";
import { readJsonBody, RequestBodyError } from "../../../shared/request-body.ts";
import { handleQueueDelivery, type QueueDelivery } from "./queue-consumer.ts";
import { admitScheduledChecks, schedulerJobIntentKey } from "./scheduler.ts";
import { readQualityJob } from "../../../app/lib/quality-job-store.ts";
import { ensureControlAuxiliarySchema } from "./control-schema.ts";

type Env = ControllerEnvironment & { PUBLIC_ORIGIN: string; EXPECTED_BUILD_ID: string; AUTHORITY_ENABLED?: string; SCHEDULE_ENABLED?: string };
const controller = createController({ create: createManualQualityJob, consume: consumeQualityJob });
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
let cachedKey: { key: JsonWebKey; until: number } | undefined;

async function publicKey() {
  if (cachedKey && cachedKey.until > Date.now()) return cachedKey.key;
  const response = await fetch("https://vii.spaplus.co/.well-known/vii-quality-jwks.json", { redirect: "manual", signal: AbortSignal.timeout(3000), headers: { "Accept": "application/json" } });
  if (!response.ok) throw new Error("quality_verifier_unavailable");
  const payload = await readJsonBody<{ keys?: JsonWebKey[] }>(new Request("https://private.invalid", { method: "POST", body: response.body, duplex: "half" } as RequestInit));
  const key = payload.keys?.length === 1 ? payload.keys[0] : undefined;
  if (!key || key.kty !== "OKP" || key.crv !== "Ed25519" || !key.x || key.d) throw new Error("invalid_quality_public_key");
  cachedKey = { key, until: Date.now() + 60_000 };
  return key;
}

export default {
  async fetch(request: Request, env: Env) {
    if (env.AUTHORITY_ENABLED !== "true") return Response.json({ error: "quality_authority_not_activated" }, { status: 503, headers });
    const url = new URL(request.url);
    if (env.PUBLIC_ORIGIN !== "https://vii.spaplus.co" || url.origin !== env.PUBLIC_ORIGIN || url.pathname !== "/api/admin/quality" || !["GET", "POST"].includes(request.method) || request.headers.has("cookie") || request.headers.has("authorization")) return Response.json({ error: "forbidden" }, { status: 403, headers });
    let stage = "request_body";
    try {
      const body = request.method === "POST" ? await readJsonBody<Record<string, unknown>>(request) : null;
      const bytes = new TextEncoder().encode(body ? JSON.stringify(body) : "");
      const bodyHash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(x => x.toString(16).padStart(2, "0")).join("");
      const nonce = request.headers.get("X-VII-Quality-Nonce") || "";
      const token = request.headers.get("X-VII-Quality-Attestation") || "";
      stage = "public_key";
      const key = await publicKey();
      stage = "signature";
      const claims = await verifyQualityAttestation(token, { origin: url.origin, target: url.pathname + url.search, method: request.method as "GET" | "POST", bodyHash, nonce, buildId: env.EXPECTED_BUILD_ID }, key);
      if (!claims) return Response.json({ error: "forbidden" }, { status: 403, headers });
      // Nonces are consumed before any mutation. A replay or uncertain result
      // cannot repeat acknowledge/reopen/schedule operations under a new job key.
      stage = "nonce_store";
      await ensureControlAuxiliarySchema(env.QUALITY_DB);
      const consumed = await env.QUALITY_DB.prepare("INSERT OR IGNORE INTO quality_authorization_nonces(nonce,expires_at) VALUES(?,?)").bind(nonce, claims.exp).run();
      if (Number(consumed.meta?.changes) !== 1) return Response.json({ error: "authorization_replayed" }, { status: 409, headers });
      return controller.handle(request, env, claims.email, body);
    } catch (error) {
      const code = error instanceof Error && ["quality_verifier_unavailable", "invalid_quality_public_key"].includes(error.message) ? error.message : error instanceof RequestBodyError ? error.message : error instanceof Error ? error.name : "unknown_error";
      console.error("VII quality authorization failed", stage, code);
      return Response.json({ error: error instanceof RequestBodyError ? error.message : "quality_authorization_unavailable" }, { status: error instanceof RequestBodyError ? error.status : 503, headers });
    }
  },
  async queue(batch: { messages: QueueDelivery[] }, env: Env) {
    for (const message of batch.messages) {
      await handleQueueDelivery(message, env, controller.consume);
    }
  },
  async scheduled(_event: unknown, env: Env) {
    if (env.AUTHORITY_ENABLED !== "true" || env.EXECUTION_ENABLED !== "true") return;
    await ensureControlAuxiliarySchema(env.QUALITY_DB);
    await controller.recover(env);
    const admissions=await admitScheduledChecks(env.QUALITY_DB, { enabled: env.SCHEDULE_ENABLED === 'true', now: Date.now(), generation: qualityBuildIdentity(), createScheduledJob: async (admission) => {
      const queued = await createScheduledQualityJob(env.QUALITY_DB, { actor: 'cloudflare-scheduler', idempotencyKey: schedulerJobIntentKey(admission.checkId,admission.bucket), origin: env.PUBLIC_ORIGIN, checkId: admission.checkId });
      return queued.job.runId;
    } });
    for(const admission of admissions) {
      if(admission.status!=='linked'||!admission.runId)continue;
      const job=await readQualityJob(env.QUALITY_DB,admission.runId);
      if(job)await controller.dispatch(env,job,'monitor');
    }
    await env.QUALITY_DB.prepare("DELETE FROM quality_authorization_nonces WHERE expires_at < ?").bind(Math.floor(Date.now() / 1000) - 60).run();
  },
};
