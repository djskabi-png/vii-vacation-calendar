import { readJsonBody, RequestBodyError } from '../../../shared/request-body.ts';
import { parseExperienceBatch, EXPERIENCE_SOURCE_HEADER, EXPERIENCE_INGESTION_PATH, EXPERIENCE_INGESTION_VERSION, EXPERIENCE_PROTOCOL_HEADER } from '../../../shared/experience-metrics.ts';

const ORIGIN = 'https://vii.spaplus.co';
const PRIVATE = `https://vii-quality-control.internal${EXPERIENCE_INGESTION_PATH}`;
const safeHeaders = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
export type ExperienceGatewayEnvironment = { EXPERIENCE_ENABLED?: string; EXPECTED_BUILD_ID?: string; EXPECTED_APP_SOURCE_VERSION?: string; EXPERIENCE_SAMPLE_RATE_BPS?: string; QUALITY_CONTROL?: { fetch(request: Request): Promise<Response> } };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: safeHeaders });
const validBuild = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
const validSource = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);

async function forwardBounded(binding: NonNullable<ExperienceGatewayEnvironment['QUALITY_CONTROL']>, body: string, sourceVersion: string, signal: AbortSignal) {
  const controller = new AbortController();
  let discarded = false, timer: ReturnType<typeof setTimeout> | undefined;
  let abort = () => {};
  const interruption = new Promise<never>((_, reject) => {
    abort = () => { discarded = true; controller.abort(); reject(Error('measurement_interrupted')); };
    signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(abort, 2000);
    if (signal.aborted) abort();
  });
  try {
    if (signal.aborted) return await interruption;
    const work = binding.fetch(new Request(PRIVATE, { method: 'POST', headers: { 'Content-Type': 'application/json', [EXPERIENCE_SOURCE_HEADER]: sourceVersion, [EXPERIENCE_PROTOCOL_HEADER]: EXPERIENCE_INGESTION_VERSION }, body, signal: controller.signal })).then(response => {
      if (discarded) { void response.body?.cancel().catch(() => undefined); throw Error('late_measurement_response'); }
      return response;
    });
    return await Promise.race([work, interruption]);
  } finally { if (timer) clearTimeout(timer); signal.removeEventListener('abort', abort); }
}

export async function experienceGateway(request: Request, env: ExperienceGatewayEnvironment): Promise<Response | null> {
  const url = new URL(request.url);
  if (!['/api/experience/policy', '/api/experience/metrics'].includes(url.pathname)) return null;
  const policy = url.pathname.endsWith('/policy');
  if (env.EXPERIENCE_ENABLED !== 'true') return policy && request.method === 'GET' && url.origin === ORIGIN && !url.search ? json({ enabled: false }) : json({ accepted: false }, 503);
  const cookie = request.headers.get('cookie') || '';
  if (url.origin !== ORIGIN || url.search || /automation|playwright|qqqaaa|bot/i.test(request.headers.get('user-agent') || '') || request.headers.has('authorization') || request.headers.has('next-action') || request.headers.has('x-server-action') || /(?:^|;)\s*(?:vii_admin_session|vii_session)\s*=/i.test(cookie)) return json({ accepted: false }, 403);
  if (request.method !== (policy ? 'GET' : 'POST')) return json({ accepted: false }, 405);
  const rate = Number(env.EXPERIENCE_SAMPLE_RATE_BPS ?? '500');
  const configured = validBuild(env.EXPECTED_BUILD_ID) && validSource(env.EXPECTED_APP_SOURCE_VERSION) && env.QUALITY_CONTROL && Number.isInteger(rate) && rate >= 1 && rate <= 1000;
  if (policy) return configured ? json({ enabled: true, buildId: env.EXPECTED_BUILD_ID, serverTime: Date.now(), sampleRateBps: rate }) : json({ enabled: false });
  if (!configured) return json({ accepted: false }, 503);
  if (request.headers.get('origin') !== ORIGIN || request.headers.has('sec-fetch-site') && request.headers.get('sec-fetch-site') !== 'same-origin' || !/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) return json({ accepted: false }, 403);
  try {
    const payload = await readJsonBody(request, { maxBytes: 8192, deadlineMs: 2000 });
    const parsed = parseExperienceBatch(payload);
    if (!parsed || parsed.buildId !== env.EXPECTED_BUILD_ID || parsed.sampleRateBps !== rate) return json({ accepted: false }, 400);
    const response = await forwardBounded(env.QUALITY_CONTROL!, JSON.stringify(parsed), env.EXPECTED_APP_SOURCE_VERSION!, request.signal);
    if (response.status !== 202 || response.headers.get(EXPERIENCE_PROTOCOL_HEADER) !== EXPERIENCE_INGESTION_VERSION) { void response.body?.cancel().catch(() => undefined); return json({ accepted: false }, 503); }
    const result = await readJsonBody<{ accepted?: unknown }>(new Request(PRIVATE, { method: 'POST', body: response.body, duplex: 'half' } as RequestInit), { maxBytes: 1024, deadlineMs: 2000, signal: request.signal });
    return json({ accepted: result?.accepted === true }, result?.accepted === true ? 202 : 503);
  } catch (error) { return json({ accepted: false }, error instanceof RequestBodyError ? error.status : 503); }
}
