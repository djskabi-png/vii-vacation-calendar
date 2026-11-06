import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {readExperienceSummary} from '../services/vii-quality-control/src/experience-summary.ts';

const require = createRequire(import.meta.url);
const { build } = require(require.resolve('esbuild', { paths: [require.resolve('vite/package.json')] }));
const { Miniflare, Log, LogLevel } = require(require.resolve('miniflare', { paths: [require.resolve('wrangler')] }));

const buildId = '11111111-2222-3333-4444-555555555555';
const sourceVersion = 'a'.repeat(40);
const batch = (overrides = {}) => ({
  schemaVersion: 1, definitionVersion: 'experience-v1', batchId: '11111111-1111-4111-8111-111111111111', buildId,
  consent: 'granted', sentAt: Math.floor(Date.now() / 60000) * 60000, sampleRateBps: 500,
  context: { world: 'global', routeKind: 'home', device: 'desktop', locale: 'he', network: '4g', cache: 'miss' },
  samples: [{ metric: 'lcp', status: 'measured', value: 100, observationId: '33333333-3333-4333-8333-333333333333', revision: 1 }],
  ...overrides,
});

const bundles = Promise.all([
    build({ entryPoints: ['tests/fixtures/experience-edge-workerd.ts'], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', write: false }),
    build({ entryPoints: ['services/vii-quality-control/src/index.ts'], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', write: false, external: ['cloudflare:workers'] }),
  ]);
async function runtime(controlSource = sourceVersion) {
  const [edge,control] = await bundles;
  return new Miniflare({ log: new Log(LogLevel.WARN), workers: [
    { name: 'edge', modules: [{ type: 'ESModule', path: 'edge.mjs', contents: edge.outputFiles[0].text }], compatibilityDate: '2026-05-22', compatibilityFlags: ['nodejs_compat'], serviceBindings: { QUALITY_CONTROL: 'control' }, bindings: { EXPERIENCE_ENABLED: 'true', EXPECTED_BUILD_ID: buildId, EXPECTED_APP_SOURCE_VERSION: sourceVersion, EXPERIENCE_SAMPLE_RATE_BPS: '500' } },
    { name: 'control', modules: [{ type: 'ESModule', path: 'control.mjs', contents: control.outputFiles[0].text }], compatibilityDate: '2026-05-22', compatibilityFlags: ['nodejs_compat'], d1Databases: { QUALITY_DB: 'experience-workerd-d1' }, bindings: { EXPERIENCE_ENABLED: 'true', EXPECTED_BUILD_ID: buildId, EXPECTED_APP_SOURCE_VERSION: controlSource, EXPERIENCE_SAMPLE_RATE_BPS: '500', PUBLIC_ORIGIN: 'https://vii.spaplus.co', AUTHORITY_ENABLED: 'false' } },
  ] });
}

test('workerd edge-to-control ingestion enforces consent and persists one deduplicated batch in D1', { timeout: 30000 }, async () => {
  const mf=await runtime();
  try {
    const worker = await mf.getWorker('edge');
    const post = (payload, headers = {}) => worker.fetch('http://localhost/__fixture/experience', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({url:'https://vii.spaplus.co/api/experience/metrics',headers:{origin:'https://vii.spaplus.co','content-type':'application/json',...headers},payload}) });
    assert.equal((await post(batch(),{origin:'https://other.invalid'})).status,403);
    assert.equal((await post(batch(),{cookie:'vii_admin_session=synthetic-admin'})).status,403);
    const denied=await post(batch({consent:'denied'}));assert.equal(denied.status,400,JSON.stringify(Object.fromEntries(denied.headers)));
    const accepted = await post(batch());
    assert.equal(accepted.status, 202, await accepted.clone().text());
    assert.deepEqual(await accepted.json(), { accepted: true });
    assert.equal((await post(batch())).status, 202);
    assert.equal((await post(batch({ buildId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }))).status, 400);
    assert.equal((await post({ ...batch(), email: 'person@example.com', batchId: '22222222-2222-4222-8222-222222222222' })).status, 400);
    const newer = batch({ batchId: '22222222-2222-4222-8222-222222222222', samples: [{ ...batch().samples[0], revision: 2, value: 3000 }] });
    assert.equal((await post(newer)).status, 202);
    const conflicting = { ...newer, batchId: '44444444-4444-4444-8444-444444444444', samples: [{ ...newer.samples[0], value: 2000 }] };
    assert.equal((await post(conflicting)).status, 503);
    const db = await mf.getD1Database('QUALITY_DB', 'control');
    const batchRow = await db.prepare('SELECT COUNT(*) AS n FROM quality_experience_batches').first();
    const observationRow = await db.prepare('SELECT COUNT(*) AS n FROM quality_experience_observations').first();
    const binRow = await db.prepare('SELECT COUNT(*) AS n FROM quality_experience_bins WHERE count>0').first();
    assert.equal(batchRow.n, 2);
    assert.equal(observationRow.n, 1);
    assert.equal(binRow.n, 1);
    const bin = await db.prepare('SELECT count, upper_bound FROM quality_experience_bins WHERE count>0').first();
    assert.equal(bin.count, 1);
    assert.equal(bin.upper_bound, 4000);
    const summary=await readExperienceSummary(db,{buildId,sourceVersion,now:Date.now()+300_000});
    assert.equal(summary.state,'ok');assert.equal(summary.sampleCount,1);assert.equal(summary.series[0].numericValueCount,1);assert.equal(summary.series[0].p75UpperBound,undefined);
  } finally {
    await mf.dispose();
  }
});

test('a private source mismatch is rejected before metric schema or observations are written', {timeout:30000}, async()=>{
  const mf=await runtime('b'.repeat(40));
  try {
    const worker=await mf.getWorker('edge');
    const response=await worker.fetch('http://localhost/__fixture/experience',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:'https://vii.spaplus.co/api/experience/metrics',headers:{Origin:'https://vii.spaplus.co','Content-Type':'application/json'},payload:batch()})});
    assert.equal(response.status,503,JSON.stringify(Object.fromEntries(response.headers)));
    const db=await mf.getD1Database('QUALITY_DB','control');
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='quality_experience_batches'").first()).n,0);
  } finally {await mf.dispose();}
});

test('the old private ingestion path cannot write through the new controller', {timeout:30000}, async()=>{
  const mf=await runtime();
  try {
    const worker=await mf.getWorker('control');
    const response=await worker.fetch('https://vii-quality-control.internal/__vii/experience',{method:'POST',headers:{'Content-Type':'application/json','X-VII-Experience-Source':sourceVersion},body:JSON.stringify(batch())});
    assert.equal(response.status,503);
    const db=await mf.getD1Database('QUALITY_DB','control');
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='quality_experience_batches'").first()).n,0);
  } finally {await mf.dispose();}
});
