import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function requestPayload(file, variables) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let payload;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'fetch' && node.arguments[0]?.getText(tree) === '"/api/leads/"') {
      const body = node.arguments[1].properties.find(property => property.name?.getText(tree) === 'body');
      payload = body.initializer.arguments[0].getText(tree);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(payload, 'actual lead request body found');
  return Function(...Object.keys(variables), `return (${payload});`)(...Object.values(variables));
}

const values = { get: key => ({ name: 'QA fixture', phone: '0500000000', date: '2026-11-23', till: '2026-11-24', guests: '2', privacy: 'on' })[key] || '' };
const window = { location: { href: 'https://vii.spaplus.co/fixture' } };

test('actual event and general booking requests carry stable business identity and structured dates', async () => {
  const event = requestPayload('app/events/place/client-page.tsx', {
    id: 'event-fixture', values, window, eventSlot: '', eventSlotCopy: { he: { both: 'both' } },
    place: { slug: 'event-1400', name: 'Event fixture', location: 'city', area: 'region' },
  });
  const activity = requestPayload('app/booking/client-page.tsx', {
    id: 'activity-fixture', values, window, isManage: false, supplierSiteID: undefined, supplierQuote: {}, details: 'fixture details',
    props: { world: 'activities', placeId: 'museum-fixture', placeName: 'Museum fixture', offerId: 'entry' },
  });
  assert.equal(event.placeId, 'event-1400');
  assert.equal(activity.placeId, 'museum-fixture');
  assert.equal(event.placeName, 'Event fixture');
  assert.equal(activity.placeName, 'Museum fixture');
  for (const payload of [event, activity]) {
    assert.equal(payload.requestedDate, '2026-11-23');
    assert.equal(payload.guests, '2');
    assert.equal(payload.privacyAccepted, true);
  }
  assert.equal(activity.requestedTill, '2026-11-24');

  const source = fs.readFileSync(new URL('../app/api/leads/route.ts', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const forwarded = [], audits = [];
  const context = { exports: {}, Response, Request, AbortSignal, console, process: { env: { VII_LEADS_SECRET: 'test-only-placeholder-not-a-real-key-12345' } },
    saveWhatsAppLead: async () => {}, recordBookingAudit: async entry => audits.push(entry),
    fetch: async (url, init) => { forwarded.push(JSON.parse(init.body)); return Response.json({ success: true, reference: `QA-${forwarded.length}` }); },
  };
  vm.runInNewContext(js, context);
  for (const payload of [event, activity]) {
    const response = await context.exports.POST(new Request('https://example.test/api/leads/', { method: 'POST', body: JSON.stringify(payload) }));
    assert.equal(response.status, 200);
  }
  assert.deepEqual(forwarded.map(row => row.placeId), ['event-1400', 'museum-fixture']);
  assert.deepEqual(audits.map(row => row.placeId), ['event-1400', 'museum-fixture']);
  assert.ok(audits.every(row => row.status === 'lead_service_accepted'), 'acceptance is not relabeled supplier delivery');
});
