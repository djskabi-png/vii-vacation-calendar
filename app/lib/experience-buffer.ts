import type { ExperienceBatch, ExperienceContext, ExperienceMetric, ExperienceSample, ExperienceStatus } from '../../shared/experience-metrics.ts';

export type ExperiencePolicy = { buildId: string; sampleRateBps: number; serverTime: number };
export type ExperienceTransport = (body: ExperienceBatch, signal: AbortSignal) => Promise<unknown>;

/** Bounded, memory-only reporting. Uncertain sends are discarded, never retried. */
export function createExperienceBuffer(deps: { now: () => number; uuid: () => string; send: ExperienceTransport }) {
  const observations = new Map<string, { id: string; revision: number; context: ExperienceContext; metric: ExperienceMetric }>();
  const pending = new Map<string, { context: ExperienceContext; sample: ExperienceSample }>();
  const inFlight = new Set<AbortController>();
  const bornAt = deps.now();
  let policy: ExperiencePolicy | null = null;
  let grantedAt = 0;
  let sent = 0;
  const allowed = () => policy !== null && deps.now() - bornAt < 23 * 3600000 && sent < 32;
  return {
    grant(value: ExperiencePolicy) { if (!policy) { policy = value; grantedAt = deps.now(); } },
    revoke() { policy = null; pending.clear(); for (const controller of inFlight) controller.abort(); inFlight.clear(); },
    record(key: string, metric: ExperienceMetric, status: ExperienceStatus, value: number | null, context: ExperienceContext) {
      if (!allowed()) return;
      let observation = observations.get(key);
      if (!observation) {
        if (observations.size >= 128 || pending.size >= 64) return;
        observation = { id: deps.uuid(), revision: 0, context: { ...context }, metric };
        observations.set(key, observation);
      }
      if (observation.metric !== metric || observation.revision >= 1000) return;
      observation.revision++;
      pending.set(key, { context: observation.context, sample: { observationId: observation.id, revision: observation.revision, metric, status, value } });
    },
    async flush() {
      if (!allowed() || inFlight.size >= 2 || !pending.size || !policy) return;
      const selected: typeof pending extends Map<string, infer T> ? T[] : never = [];
      const metrics = new Set<string>();
      let context: ExperienceContext | undefined;
      for (const [key, item] of pending) {
        if (context && JSON.stringify(context) !== JSON.stringify(item.context) || metrics.has(item.sample.metric)) continue;
        context = item.context;
        metrics.add(item.sample.metric);
        selected.push(item);
        pending.delete(key);
        if (selected.length >= 16) break;
      }
      if (!context || !selected.length) return;
      const controller = new AbortController();
      inFlight.add(controller);
      const timeout = setTimeout(() => controller.abort(), 2000);
      const body: ExperienceBatch = { schemaVersion: 1, definitionVersion: 'experience-v1', batchId: deps.uuid(), buildId: policy.buildId, consent: 'granted', sampleRateBps: policy.sampleRateBps, sentAt: Math.floor((policy.serverTime + deps.now() - grantedAt) / 60000) * 60000, context, samples: selected.map(item => item.sample) };
      sent++;
      try { await deps.send(body, controller.signal); } catch { /* No retry or application error. */ }
      finally { clearTimeout(timeout); inFlight.delete(controller); }
    },
  };
}
