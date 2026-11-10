import assert from 'node:assert/strict';
import test from 'node:test';
import { createGalleryAuditJob, stepGalleryAuditJob, readGalleryAuditItem, readGalleryAuditSource } from '../app/lib/gallery-api-audit-job.ts';
import { createSergeyPublicCatalogClient } from '../app/lib/sergey-public-catalog-client.ts';
import { normalizeSpaPlusCatalog } from '../app/lib/spaplus-catalog-client.ts';

class Bucket { objects = new Map(); revision = 0; reads = []; async get(key) { if (key.includes('/context/')) this.reads.push(key); const v = this.objects.get(key); return v ? { etag: v.etag, text: async () => v.text } : null; } async put(key, text, options = {}) { const old = this.objects.get(key); if (options.onlyIf?.etagDoesNotMatch === '*' && old) return null; if (options.onlyIf?.etagMatches && old?.etag !== options.onlyIf.etagMatches) return null; const v = { text: String(text), etag: String(++this.revision) }; this.objects.set(key, v); return { etag: v.etag }; } }
const ids = { vacations: 17, events: 18, rooms: 19, spa: 20 };
const locations = { cities: [{ id: 1, title: 'חיפה', area: 2 }], areas: [{ id: 2, title: 'חיפה והקריות' }] }; const types = { roomTypes: [], amenity_categories: [], amenities: [] };
const rawText = id => `{"id":${id},"active":true,"api_version":1.1,"name":"מקום בדיקה","location":{"city":1},"galleries":{"9":{"galleryID":9,"title":"כללי","pictures":["/gallery/place.jpg"]},"2":{"galleryID":2,"title":"נוסף","pictures":["/gallery/second.jpg"]}},"rooms":[{"roomID":55,"roomName":"יחידה","roomCount":1,"maxGuests":2,"amenities":[],"spaces":[],"galleries":[{"galleryID":2,"title":"יחידה","pictures":["/gallery/unit.jpg"]}]}]}`;
const listing = id => ({ places: [{ siteID: id, siteName: 'מקום בדיקה', active: true, rooms: [{ roomID: 55 }], galleries: [{ galleryID: 9, title: 'כללי', pictures: ['/gallery/place.jpg'] }] }] }); const response = x => new Response(typeof x === 'string' ? x : JSON.stringify(x), { headers: { 'Content-Type': 'application/json' } });

test('actual two-step audit scopes resumed reads and preserves provider gallery order', async () => {
  const bodies = { vacations: rawText(17), events: rawText(18) }; const calls = [];
  const fetchImpl = async input => { const url = new URL(input); const path = url.pathname.replace('/api/ai/vii', ''); calls.push(url.hostname + path); if (url.hostname === 'www.spaplus.co.il') return response({ status: 'ok', sites: { '20': { siteid: 20, title: 'ספא' } } }); if (path === '/locations' || path === '/rooms/locations') return response(locations); if (path.endsWith('/types')) return response(types); for (const world of ['vacations', 'events', 'rooms']) if (path === `/${world}`) return response(listing(ids[world])); if (path === '/vacations/17') return response(bodies.vacations); if (path === '/events/18') return response(bodies.events); throw Error('unexpected_fixture_endpoint:' + path); };
  const accepted = {}; for (const world of ['vacations', 'events']) accepted[world] = (await createSergeyPublicCatalogClient({ apiKey: 'fixture', fetchImpl }).fetchCandidate(world)).entries[0]; calls.length = 0;
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            first: async () => { if (sql.includes('JOIN supplier_catalog_entries')) { const entry = accepted[args[0]]; return { summaryJson: JSON.stringify(entry.summary), detailJson: JSON.stringify(entry.detail), acceptedAt: new Date().toISOString() }; } return { activeRunId: 'run-' + args[0], activeCount: 1 }; },
            all: async () => ({ results: [{ supplierId: ids[args[1]] }] }),
          };
        },
      };
    },
  };
  const bucket = new Bucket(); const jobId = '11111111-1111-4111-8111-111111111111'; const env = { SERGEY_VII_API_TOKEN: 'fixture', SPAPLUS_VII_API_KEY: 'fixture' }; await createGalleryAuditJob({ db, bucket, jobId });
  const first = await stepGalleryAuditJob({ db, bucket, jobId, env, fetchImpl }); assert.equal(first.completed, 1); const firstContextCalls = calls.filter(x => !x.endsWith('/vacations/17')); assert.equal(firstContextCalls.length, 3); assert.ok(!firstContextCalls.some(x => x.startsWith('www.spaplus.co.il')));
  const before = calls.length; bucket.reads.length = 0; const second = await stepGalleryAuditJob({ db, bucket, jobId, batchSize: 1, env, fetchImpl }); assert.equal(second.completed, 2); assert.ok(calls.slice(before).some(x => x.endsWith('/events/18'))); assert.ok(!calls.slice(before).some(x => x.includes('/vacations/'))); assert.deepEqual(new Set(bucket.reads.map(x => x.split('/context/')[1])), new Set(['locations.json', 'events.json', 'events-types.json']));
  const item = await readGalleryAuditItem(bucket, jobId, 'events', 18); assert.equal(item.finding.status, 'match', JSON.stringify(item.finding.issues)); assert.deepEqual(item.api.entities.map(x => x.imageIds), [['place.jpg', 'second.jpg'], ['unit.jpg']]);
  assert.equal(await readGalleryAuditSource(bucket, jobId, 'events', 18), bodies.events);
  const rawObject = bucket.objects.get(item.rawKey); bucket.objects.set(item.rawKey, { ...rawObject, text: rawObject.text + ' ' });
  await assert.rejects(() => readGalleryAuditSource(bucket, jobId, 'events', 18), /audit_source_hash_mismatch/);
  bucket.objects.set(item.rawKey, rawObject);
  const itemObjectKey = `vii-gallery-audit/v1/${jobId}/items/events-18.json`; const itemObject = bucket.objects.get(itemObjectKey); const forged = JSON.parse(itemObject.text); forged.rawKey = `vii-gallery-audit/v1/other-job/raw/events-18.json`; bucket.objects.set(itemObjectKey, { ...itemObject, text: JSON.stringify(forged) });
  await assert.rejects(() => readGalleryAuditSource(bucket, jobId, 'events', 18), /invalid_audit_source_reference/);
});
test('resumed SPA evidence retains the original capture time instead of processing time',async()=>{
 const bucket=new Bucket(),jobId='22222222-2222-4222-8222-222222222222',p='vii-gallery-audit/v1/'+jobId+'/',captured=new Date(Date.now()-600000).toISOString();
 const payload={status:'ok',sites:{'20':{siteid:20,title:'ספא בחיפה',city:'חיפה',spa_picture:'https://www.spaplus.co.il/gallery/site.jpg',gallery:['https://www.spaplus.co.il/gallery/site.jpg'],packages:{'7':{MainPageID:7,idPack:8,price:200,MainPageTitle:'חבילה',pack_picture:'https://www.spaplus.co.il/gallery/pack.jpg'}}}}};const entry=normalizeSpaPlusCatalog(payload)[0];
 await bucket.put(p+'context/spa.json',JSON.stringify(payload));await bucket.put(p+'context/spa.json.attempt-2',JSON.stringify({at:captured}));await bucket.put(p+'job.json',JSON.stringify({jobId,state:'running',total:1,cursor:0,deadline:new Date(Date.now()+3600000).toISOString(),createdAt:captured,contextsReady:true,sourceRetryUsed:true,sourceIssues:[],inventory:[{world:'spa',supplierId:20}],results:[],worldCounts:{vacations:0,events:0,rooms:0,spa:1}}));
 const db={prepare(){return{bind(){return{first:async()=>({summaryJson:JSON.stringify(entry.summary),detailJson:JSON.stringify(entry.detail??null),acceptedAt:captured})};}};}};
 let calls=0;await stepGalleryAuditJob({db,bucket,jobId,env:{},fetchImpl:async()=>{calls++;throw Error('unexpected_network');}});const item=await readGalleryAuditItem(bucket,jobId,'spa',20);assert.equal(calls,0);assert.equal(item.fetchedAt,captured);assert.ok(Date.parse(item.processedAt)>Date.parse(captured));assert.ok(item.api.entities.length>0);
});

test('actual targeted audit keeps one accepted ID and does not expand provider discovery', async () => {
  const calls = [], body = rawText(17), accepted = { supplierId: 17, summary: {}, detail: {} };
  const db = { prepare(sql) { return { bind(...args) { return {
    first: async () => sql.includes('JOIN supplier_catalog_entries') ? { summaryJson: JSON.stringify(accepted.summary), detailJson: JSON.stringify(accepted.detail), acceptedAt: new Date().toISOString() } : { activeRunId: 'run-vacations', activeCount: 2 },
    all: async () => ({ results: [{ supplierId: 17 }, { supplierId: 18 }] }),
  }; } }; } };
  const bucket = new Bucket(), jobId = '33333333-3333-4333-8333-333333333333';
  const fetchImpl = async input => { const url = new URL(input); const path = url.pathname.replace('/api/ai/vii', ''); calls.push(path); if (path === '/locations') return response(locations); if (path.endsWith('/types')) return response(types); if (path === '/vacations') return response(listing(17)); if (path === '/vacations/17') return response(body); throw Error(`unexpected_targeted_endpoint:${path}`); };
  const created = await createGalleryAuditJob({ db, bucket, jobId, scopeWorld: 'vacations', scopeSupplierId: 17, now: () => 1000 });
  assert.equal(created.total, 1); assert.equal(created.scopeWorld, 'vacations'); assert.equal(created.scopeSupplierId, 17);
  const done = await stepGalleryAuditJob({ db, bucket, jobId, env: { SERGEY_VII_API_TOKEN: 'fixture' }, fetchImpl, now: () => 2000 });
  assert.equal(done.total, 1); assert.equal(done.completed, 1); assert.equal(calls.filter(path => path === '/vacations/17').length, 1); assert.equal(calls.some(path => path === '/vacations/18'), false);
  await assert.rejects(() => createGalleryAuditJob({ db, bucket, jobId, scopeWorld: 'events', scopeSupplierId: 17 }), /gallery_audit_scope_changed/);
  await assert.rejects(() => createGalleryAuditJob({ db, bucket, jobId: '44444444-4444-4444-8444-444444444444', scopeWorld: 'vacations', scopeSupplierId: 999 }), /audit_scope_supplier_not_found/);
  await assert.rejects(() => createGalleryAuditJob({ db, bucket, jobId: '55555555-5555-4555-8555-555555555555', scopeSupplierId: 17 }), /invalid_audit_scope/);
});
