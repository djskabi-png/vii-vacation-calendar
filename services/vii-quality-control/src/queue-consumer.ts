import { readQualityJob } from "../../../app/lib/quality-job-store.ts";
import { persistQualityJobProgress } from "../../../app/lib/quality-platform.ts";
import type { ControllerEnvironment } from "./controller.ts";

export type QueueDelivery = { id: string; body: unknown; ack(): void; retry(options: { delaySeconds: number }): void; attempts: number };
export async function handleQueueDelivery(message: QueueDelivery, env: ControllerEnvironment, consume: (env: ControllerEnvironment, body: unknown) => Promise<unknown>) {
  try {
    const outcome = await consume(env, message.body) as { status?: string } | null;
    if (outcome?.status === "not_claimed") throw new Error("quality_job_lease_busy");
    message.ack();
  } catch (error) {
    const malformed = error instanceof Error && error.message === "invalid_queue_message";
    if (!malformed && message.attempts < 3) { message.retry({ delaySeconds: 30 }); return; }
    const raw = message.body && typeof message.body === "object" ? message.body as Record<string, unknown> : {};
    const runId = typeof raw.runId === "string" && /^[A-Za-z0-9-]{8,120}$/.test(raw.runId) ? raw.runId : null;
    const source = typeof raw.sourceVersion === "string" && raw.sourceVersion.length <= 160 ? raw.sourceVersion : null;
    const reason = malformed ? "invalid_queue_message" : "queue_attempt_budget_exhausted";
    await env.QUALITY_DB.prepare("CREATE TABLE IF NOT EXISTS quality_queue_failures (message_id TEXT PRIMARY KEY,run_id TEXT,source_version TEXT,reason TEXT NOT NULL,attempts INTEGER NOT NULL,recorded_at TEXT NOT NULL)").run();
    await env.QUALITY_DB.prepare("INSERT OR IGNORE INTO quality_queue_failures(message_id,run_id,source_version,reason,attempts,recorded_at) VALUES(?,?,?,?,?,?)")
      .bind(message.id, runId, source, reason, message.attempts, new Date().toISOString()).run();
    if (runId && !malformed) {
      // An exhausted delivery cannot revoke a newer active execution lease.
      await env.QUALITY_DB.prepare("UPDATE quality_jobs SET status='blocked',reason=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE run_id=? AND source_version=? AND (status='queued' OR (status='running' AND lease_until<=?))")
        .bind(reason, new Date().toISOString(), runId, source, new Date().toISOString()).run();
      const job = await readQualityJob(env.QUALITY_DB, runId);
      if (job) await persistQualityJobProgress(env.QUALITY_DB, job);
    }
    // Classification is durable before acknowledgement. A DB failure leaves
    // the message unacknowledged for Cloudflare's bounded retry/deadletter owner.
    message.ack();
  }
}
