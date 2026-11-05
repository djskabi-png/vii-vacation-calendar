import type { D1Database } from "../../types/cloudflare-runtime";
import { claimQualityJob, readQualityJob, startQualityJobCheck, commitQualityJobCheck, finishQualityJobSlice,
  type QualityJobCheck, type QualityJobReceipt } from "./quality-job-store.ts";

/** Executors are read-only. Notifications remain a separate idempotent owner.
 * The executor receives no database or unfenced write hook. */
export async function runQualityJobSlice(db: D1Database, input: {
  runId: string; leaseToken: string; sourceVersion: string; definitionVersion: string;
  budgetMs?: number; checkTimeoutMs?: number; clock?: () => number;
  execute: (check: QualityJobCheck, signal: AbortSignal) => Promise<Omit<QualityJobReceipt, "checkId" | "checkedAt">>;
}) {
  const clock = input.clock ?? Date.now;
  const budget = Math.max(10, Math.min(input.budgetMs ?? 20_000, 24_000));
  const started = clock(), deadline = started + budget;
  const iso = () => new Date(clock()).toISOString();
  const executedCheckIds: string[] = [];
  const outcome = (status: "not_claimed" | "blocked" | "cancelled" | "yielded" | "completed") => ({ status, executedCheckIds });
  if (!input.sourceVersion || !input.definitionVersion) throw new Error("quality_job_source_required");
  if (!await claimQualityJob(db, input.runId, { leaseToken: input.leaseToken, leaseUntil: new Date(deadline + 2000).toISOString(), now: iso() })) return outcome("not_claimed");
  const finish = async (status: "queued" | "completed" | "blocked", reason?: string) =>
    finishQualityJobSlice(db, { runId: input.runId, leaseToken: input.leaseToken, status, reason, now: iso() });
  const job = await readQualityJob(db, input.runId);
  if (!job) return outcome("not_claimed");
  if (job.sourceVersion !== input.sourceVersion || job.definitionVersion !== input.definitionVersion) {
    await finish("blocked", "source_or_definition_changed"); return outcome("blocked");
  }
  if (job.activeIndex !== null) {
    await finish("blocked", "interrupted_check_uncommitted"); return outcome("blocked");
  }
  for (let index = job.nextIndex; index < job.checks.length; index++) {
    const checkBudget = job.checks[index].timeoutMs ?? input.checkTimeoutMs ?? 5000;
    if (executedCheckIds.length >= 3 || clock() >= deadline || executedCheckIds.length > 0 && deadline - clock() < checkBudget) return outcome(await finish("queued") ? "yielded" : "not_claimed");
    const current = await readQualityJob(db, input.runId);
    if (current?.status === "cancelled") return outcome("cancelled");
    if (!await startQualityJobCheck(db, { runId: job.runId, leaseToken: input.leaseToken, index, now: iso() })) return outcome("not_claimed");
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const remaining = Math.max(1, Math.min(deadline - clock(), checkBudget));
      const observation = await Promise.race([
        Promise.resolve().then(() => input.execute(structuredClone(job.checks[index]), controller.signal)),
        new Promise<never>((_, reject) => { timer = setTimeout(() => {
          const error = new Error("quality_check_timeout"); controller.abort(error); reject(error);
        }, remaining); }),
      ]);
      const committed = await commitQualityJobCheck(db, { runId: job.runId, leaseToken: input.leaseToken, index,
        receipt: { ...observation, checkId: job.checks[index].checkId, checkedAt: iso() }, now: iso() });
      if (!committed) return outcome((await readQualityJob(db, job.runId))?.status === "cancelled" ? "cancelled" : "not_claimed");
      executedCheckIds.push(job.checks[index].checkId);
    } catch (error) {
      if ((await readQualityJob(db, job.runId))?.status === "cancelled") return outcome("cancelled");
      const reason = error instanceof Error && error.message === "quality_check_timeout" ? "check_timeout" : "check_execution_unverified";
      return outcome(await finish("blocked", reason) ? "blocked" : "not_claimed");
    } finally { if (timer) clearTimeout(timer); controller.abort(); }
  }
  return outcome(await finish("completed") ? "completed" : "not_claimed");
}
