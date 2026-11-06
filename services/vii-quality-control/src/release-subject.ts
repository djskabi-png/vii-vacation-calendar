import type { D1Database } from '../../../types/cloudflare-runtime';
import { initializeSchemaOnce } from '../../../app/lib/schema-initializer.ts';
import { payloadHash, readQualityJobByIntent, type QualityJob, type QualityJobCheck } from '../../../app/lib/quality-job-store.ts';
import { createManualQualityJob, qualityHttpJobCheckSnapshot } from '../../../app/lib/quality-job-platform.ts';
import { selectManualQualityChecks } from '../../../app/lib/quality-platform.ts';
import { browserProfiles } from './browser-profiles.ts';
import { browserQualityCheck, createBrowserQualityJob } from './browser-job-platform.ts';
import { discoveryReceiptCurrent } from '../../../app/lib/quality-readiness.ts';

const SOURCE = /^[a-f0-9]{40}$/, DIGEST = /^[a-f0-9]{64}$/;
const BUILD = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const ORIGIN = 'https://vii.spaplus.co';
const DAY = 86_400_000;
// Existing HTTP slices have a 20s budget and browser transport a 50s deadline.
// Do not start/recover work near expiry; evidence itself still expires exactly.
const EXECUTION_WINDOW_MS = 70_000;
export type ReleaseSubjectEnvironment = {
  QUALITY_DB: D1Database; RELEASE_AUTHORITY_ENABLED?: string;
  EXPECTED_SOURCE_VERSION?: string; EXPECTED_APP_SOURCE_VERSION?: string;
  EXPECTED_BROWSER_SOURCE_VERSION?: string; EXPECTED_BUILD_ID?: string; PUBLIC_ORIGIN?: string;
};
export type ReleaseDescriptor = {
  schemaVersion: 1; candidateSource: string; candidateTree: string;
  applicationSource: string; controllerSource: string; browserSource: string;
  buildId: string; artifactSetSha256: string; environmentSetSha256: string;
  definitionSetSha256: string; issuedAt: string; expiresAt: string;
};
type Subject = { subjectId: string; descriptorJson: string; registeredAt: string; registeredBy: string };
type Definition = { key: string; checks: QualityJobCheck[]; definitionVersion: string; sourceVersion: string; payload: unknown };

function ready(env: ReleaseSubjectEnvironment) {
  if (env.RELEASE_AUTHORITY_ENABLED !== 'true' || !SOURCE.test(env.EXPECTED_SOURCE_VERSION ?? '') || !SOURCE.test(env.EXPECTED_APP_SOURCE_VERSION ?? '')
    || !SOURCE.test(env.EXPECTED_BROWSER_SOURCE_VERSION ?? '') || !BUILD.test(env.EXPECTED_BUILD_ID ?? '')
    || env.PUBLIC_ORIGIN !== ORIGIN) throw Error('release_authority_not_activated');
}
function descriptorValue(raw: unknown): ReleaseDescriptor {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('release_descriptor_invalid');
  const d = raw as ReleaseDescriptor;
  const keys = ['schemaVersion','candidateSource','candidateTree','applicationSource','controllerSource','browserSource','buildId','artifactSetSha256','environmentSetSha256','definitionSetSha256','issuedAt','expiresAt'];
  if (Object.keys(d).length !== keys.length || keys.some(key => !Object.hasOwn(d, key)) || d.schemaVersion !== 1
    || ![d.candidateSource,d.candidateTree,d.applicationSource,d.controllerSource,d.browserSource].every(x => typeof x === 'string' && SOURCE.test(x))
    || typeof d.buildId !== 'string' || !BUILD.test(d.buildId)
    || ![d.artifactSetSha256,d.environmentSetSha256,d.definitionSetSha256].every(x => typeof x === 'string' && DIGEST.test(x))
    || ![d.issuedAt,d.expiresAt].every(x => typeof x === 'string' && Number.isFinite(Date.parse(x)) && new Date(x).toISOString() === x)
    || Date.parse(d.expiresAt) <= Date.parse(d.issuedAt) || Date.parse(d.expiresAt)-Date.parse(d.issuedAt) > DAY) throw Error('release_descriptor_invalid');
  return d;
}

/** Required work is selected from the server registry, never a caller's list. */
export async function releaseRuntimeDefinitions(env: ReleaseSubjectEnvironment): Promise<Definition[]> {
  const checks = selectManualQualityChecks('full').map(check => qualityHttpJobCheckSnapshot(check, ORIGIN, 'full'));
  const definitions: Definition[] = [{ key: 'http-full', checks, definitionVersion: await payloadHash(checks), sourceVersion: env.EXPECTED_BUILD_ID!, payload: { level: 'full', scope: null } }];
  for (const profile of browserProfiles) {
    const check = browserQualityCheck({ profileId: profile.profileId, buildId: env.EXPECTED_BUILD_ID!, sourceVersion: env.EXPECTED_BROWSER_SOURCE_VERSION!, origin: ORIGIN });
    definitions.push({ key: `browser:${profile.profileId}`, checks: [check], definitionVersion: await payloadHash(check), sourceVersion: env.EXPECTED_BROWSER_SOURCE_VERSION!, payload: { kind: 'browser', profileId: profile.profileId, buildId: env.EXPECTED_BUILD_ID } });
  }
  if (!checks.length || definitions.length > 100 || new Set(definitions.map(x=>x.key)).size !== definitions.length) throw Error('release_definition_invalid');
  return definitions;
}
export async function releaseDefinitionSetSha256(env: ReleaseSubjectEnvironment) { return payloadHash(await releaseRuntimeDefinitions(env)); }
async function validateContext(env: ReleaseSubjectEnvironment, raw: unknown, now: number) {
  ready(env);
  const descriptor = descriptorValue(raw), subjectId = await payloadHash(descriptor);
  if (descriptor.controllerSource !== env.EXPECTED_SOURCE_VERSION
    || descriptor.applicationSource !== env.EXPECTED_APP_SOURCE_VERSION || descriptor.browserSource !== env.EXPECTED_BROWSER_SOURCE_VERSION
    || descriptor.buildId !== env.EXPECTED_BUILD_ID || descriptor.definitionSetSha256 !== await releaseDefinitionSetSha256(env)) throw Error('release_context_mismatch');
  if (Date.parse(descriptor.issuedAt) > now || Date.parse(descriptor.expiresAt) <= now) throw Error('release_subject_expired');
  return { descriptor, subjectId };
}
async function schema(db: D1Database) {
  await initializeSchemaOnce(db, 'quality-release-subject-v1', async () => {
    await db.batch([
      db.prepare('CREATE TABLE IF NOT EXISTS quality_release_subjects(subject_id TEXT PRIMARY KEY,descriptor_json TEXT NOT NULL,registered_at TEXT NOT NULL,registered_by TEXT NOT NULL)'),
      db.prepare("CREATE TRIGGER IF NOT EXISTS quality_release_subjects_immutable BEFORE UPDATE ON quality_release_subjects BEGIN SELECT RAISE(ABORT,'release_subject_immutable'); END"),
    ]);
  });
}
async function load(env: ReleaseSubjectEnvironment, subjectId: unknown, now: number, initializeSchema = true) {
  ready(env);
  if (typeof subjectId !== 'string' || !DIGEST.test(subjectId)) throw Error('release_context_mismatch');
  if (initializeSchema) await schema(env.QUALITY_DB);
  const row = await env.QUALITY_DB.prepare('SELECT subject_id AS subjectId,descriptor_json AS descriptorJson,registered_at AS registeredAt,registered_by AS registeredBy FROM quality_release_subjects WHERE subject_id=?').bind(subjectId).first<Subject>();
  if (!row) throw Error('release_subject_not_registered');
  const context = await validateContext(env, JSON.parse(row.descriptorJson), now);
  if (context.subjectId !== subjectId || !Number.isFinite(Date.parse(row.registeredAt)) || Date.parse(row.registeredAt) < Date.parse(context.descriptor.issuedAt) || Date.parse(row.registeredAt) > now) throw Error('release_subject_corrupt');
  return { ...context, registeredAt: row.registeredAt };
}

/** Authenticated context registration is not evidence and cannot turn a local
 * receipt into a durable execution result. Artifact/environment digests are
 * caller-registered context until independently compared to provider readback. */
export async function registerReleaseSubject(env: ReleaseSubjectEnvironment, raw: unknown, actor: string, now = Date.now()) {
  if (!actor || actor.length > 320) throw Error('release_actor_invalid');
  const { descriptor, subjectId } = await validateContext(env, raw, now);
  await schema(env.QUALITY_DB);
  const existing = await env.QUALITY_DB.prepare('SELECT subject_id FROM quality_release_subjects WHERE subject_id=?').bind(subjectId).first();
  if (!existing && now - Date.parse(descriptor.issuedAt) > 300_000) throw Error('release_registration_stale');
  await env.QUALITY_DB.prepare('INSERT OR IGNORE INTO quality_release_subjects(subject_id,descriptor_json,registered_at,registered_by) VALUES(?,?,?,?)')
    .bind(subjectId,JSON.stringify(descriptor),new Date(now).toISOString(),actor).run();
  const saved = await load(env, subjectId, now);
  return { subjectId, registeredAt: saved.registeredAt, contextRegistered: true, publicationApproved: false };
}
async function intent(subjectId: string, key: string) { return `release:${subjectId}:${(await payloadHash(key)).slice(0,32)}`; }
const releaseActor = (subjectId: string) => `release:${subjectId}`;

async function matchesDefinition(job: QualityJob, definition: Definition) {
  return job.sourceVersion === definition.sourceVersion && job.definitionVersion === definition.definitionVersion
    && await payloadHash(job.checks) === await payloadHash(definition.checks)
    && job.payloadHash === await payloadHash({ payload: definition.payload, sourceVersion: definition.sourceVersion, definitionVersion: definition.definitionVersion, checks: definition.checks });
}

/** Release work remains fenced on recovery and consumption, not just admission.
 * Turning its flag off or expiring/changing context cannot start queued work. */
export async function releaseJobContext(env: ReleaseSubjectEnvironment, job: QualityJob, now = Date.now()) {
  if (!job.idempotencyKey.startsWith('release:')) return { allowed: true };
  try {
    const match = /^release:([a-f0-9]{64}):([a-f0-9]{32})$/.exec(job.idempotencyKey);
    if (!match || job.actor !== releaseActor(match[1])) throw Error('release_job_context_invalid');
    const subject = await load(env, match[1], now);
    if (Date.parse(subject.descriptor.expiresAt)-now < EXECUTION_WINDOW_MS) throw Error('release_window_closing');
    const definitions = await releaseRuntimeDefinitions(env);
    for (const definition of definitions) if (await intent(subject.subjectId, definition.key) === job.idempotencyKey) {
      if (!await matchesDefinition(job, definition) || !Number.isFinite(Date.parse(job.createdAt)) || Date.parse(job.createdAt) < Date.parse(subject.registeredAt)) throw Error('release_job_context_invalid');
      return { allowed: true };
    }
    throw Error('release_check_unknown');
  } catch (error) {
    const reason = error instanceof Error && ['release_authority_not_activated','release_subject_not_registered','release_subject_expired','release_context_mismatch','release_subject_corrupt','release_check_unknown','release_job_context_invalid','release_window_closing'].includes(error.message) ? error.message : 'release_context_unverified';
    return { allowed: false, reason };
  }
}

/** One explicit admission creates at most one bounded job. Deterministic keys
 * bind context before enqueue, including crash/recovery before Queue dispatch. */
export async function enqueueReleaseCheck(env: ReleaseSubjectEnvironment, subjectId: unknown, key: unknown, now = Date.now()) {
  const subject = await load(env, subjectId, now);
  const definitions = await releaseRuntimeDefinitions(env), definition = definitions.find(x => x.key === key);
  if (!definition) throw Error('release_check_unknown');
  const input = { actor: releaseActor(subject.subjectId), idempotencyKey: await intent(subject.subjectId, definition.key), origin: ORIGIN };
  return definition.key === 'http-full'
    ? createManualQualityJob(env.QUALITY_DB, { ...input, level: 'full' }, { targetBuildId: subject.descriptor.buildId })
    : createBrowserQualityJob(env.QUALITY_DB, { ...input, profileId: definition.key.slice('browser:'.length), sourceVersion: subject.descriptor.browserSource, buildId: subject.descriptor.buildId });
}

async function validJob(job: QualityJob, definition: Definition, registeredAt: string, now: number) {
  if (!await matchesDefinition(job, definition)
    || Date.parse(job.createdAt) < Date.parse(registeredAt) || !Number.isFinite(Date.parse(job.createdAt))
    || !Number.isFinite(Date.parse(job.updatedAt)) || Date.parse(job.updatedAt) < Date.parse(job.createdAt) || Date.parse(job.updatedAt) > now
    || job.nextIndex !== definition.checks.length || job.activeIndex !== null || job.cancelRequestedAt !== null || job.leaseToken !== null || job.leaseUntil !== null
    || job.receipts.length !== definition.checks.length) return false;
  return job.receipts.every((receipt, index) => receipt.checkId === definition.checks[index].checkId && receipt.status === 'passed'
    && (!(definition.checks[index].configuration.check as {semanticContract?:string}|undefined)?.semanticContract||discoveryReceiptCurrent(receipt,now))
    && Number.isFinite(Date.parse(receipt.checkedAt)) && Date.parse(receipt.checkedAt) >= Date.parse(job.createdAt) && Date.parse(receipt.checkedAt) <= Date.parse(job.updatedAt));
}

/** Read only original durable jobs. No receipt-import or caller-result path.
 * Runtime suite success is deliberately not complete release approval. */
export async function readReleaseSubjectEvidence(env: ReleaseSubjectEnvironment, subjectId: unknown, now = Date.now(), options: { initializeSchema?: boolean } = {}) {
  const subject = await load(env, subjectId, now, options.initializeSchema !== false), definitions = await releaseRuntimeDefinitions(env);
  const jobs: { key: string; runId: string | null; status: string }[] = [];
  for (const definition of definitions) {
    const job = await readQualityJobByIntent(env.QUALITY_DB, releaseActor(subject.subjectId), await intent(subject.subjectId, definition.key), options);
    let status = !job ? 'missing' : job.status === 'completed'
      ? await validJob(job, definition, subject.registeredAt, now) ? 'passed' : 'invalid'
      : ['queued','running'].includes(job.status) ? 'pending' : 'blocked';
    jobs.push({ key: definition.key, runId: job?.runId ?? null, status });
  }
  const passed = jobs.filter(job=>job.status==='passed').length;
  return { schemaVersion: 1, subjectId: subject.subjectId, descriptor: subject.descriptor, registeredAt: subject.registeredAt,
    observedAt: new Date(now).toISOString(), runtimeEvidenceStatus: passed === definitions.length ? 'passed' : jobs.some(job=>['invalid','blocked'].includes(job.status)) ? 'blocked' : 'incomplete',
    requiredJobs: definitions.length, passedJobs: passed, jobs, publicationApproved: false, publicReleaseVerified: false };
}
