import type { D1Database } from '../../../types/cloudflare-runtime';
import { readJsonBody, RequestBodyError } from '../../../shared/request-body.ts';
import { EXPERIENCE_SOURCE_HEADER, EXPERIENCE_INGESTION_PATH, EXPERIENCE_INGESTION_VERSION, EXPERIENCE_PROTOCOL_HEADER } from '../../../shared/experience-metrics.ts';
import { ingestExperienceBatch } from './experience-store.ts';

export type ExperienceEnvironment = {
  QUALITY_DB: D1Database;
  EXPERIENCE_ENABLED?: string;
  EXPECTED_BUILD_ID: string;
  EXPECTED_APP_SOURCE_VERSION?: string;
  EXPERIENCE_SAMPLE_RATE_BPS?: string;
};
const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', [EXPERIENCE_PROTOCOL_HEADER]: EXPERIENCE_INGESTION_VERSION };
/** This URL has no public route. Only the Edge service binding may reach it. */
export async function experienceHandler(request: Request, env: ExperienceEnvironment): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== EXPERIENCE_INGESTION_PATH) return null;
  if (env.EXPERIENCE_ENABLED !== 'true' || !/^[0-9a-f]{40}$/.test(env.EXPECTED_APP_SOURCE_VERSION || '')) return Response.json({ accepted: false }, { status: 503, headers });
  if (url.origin !== 'https://vii-quality-control.internal' || url.search || request.method !== 'POST' || request.headers.has('cookie') || request.headers.has('authorization') || request.headers.get('content-type') !== 'application/json' || request.headers.get(EXPERIENCE_SOURCE_HEADER) !== env.EXPECTED_APP_SOURCE_VERSION || request.headers.get(EXPERIENCE_PROTOCOL_HEADER) !== EXPERIENCE_INGESTION_VERSION) return Response.json({ accepted: false }, { status: 403, headers });
  try {
    const body = await readJsonBody<{ sampleRateBps?: unknown }>(request);
    const rate = Number(env.EXPERIENCE_SAMPLE_RATE_BPS || 500);
    if (!Number.isInteger(rate) || rate < 1 || rate > 1000 || body?.sampleRateBps !== rate) return Response.json({ accepted: false }, { status: 400, headers });
    const result = await ingestExperienceBatch(env.QUALITY_DB, body, { sourceVersion: env.EXPECTED_APP_SOURCE_VERSION!, buildId: env.EXPECTED_BUILD_ID });
    const accepted = result.status === 'applied' || result.status === 'duplicate';
    return Response.json({ accepted }, { status: accepted ? 202 : result.status === 'conflict' ? 409 : result.status === 'invalid' ? 400 : 503, headers });
  } catch (error) {
    return Response.json({ accepted: false }, { status: error instanceof RequestBodyError ? error.status : 503, headers });
  }
}
