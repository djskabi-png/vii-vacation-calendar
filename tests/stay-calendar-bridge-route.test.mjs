import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {supplierStayCalendar} from '../app/lib/vii-stay-calendar.ts';

function routeHarness({fail=false}={}) {
 const calls=[], exports={};
 const modules={
  '../../../lib/published-supplier-ids.ts':{publishedSupplierIds:async world=>{assert.equal(world,'vacations');return new Set([2566]);}},
  '../../../lib/vii-supplier-token':{supplierToken:async()=>'SYNTHETIC_SERVER_ONLY'},
  '../../../lib/vii-stay-calendar.ts':{supplierStayCalendar:async options=>{calls.push(options);if(fail)throw Error('PRIVATE_SUPPLIER_FAILURE');return {siteID:options.siteID,from:options.from,till:options.till,rooms:[]};}},
 };
 const code=ts.transpileModule(readFileSync(new URL('../app/api/vii/stay-calendar/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',code)(id=>{assert.ok(modules[id],id);return modules[id];},exports);
 return {GET:exports.GET,calls};
}

test('additive calendar route projects only availability and preserves no-store',async()=>{
 const h=routeHarness();
 const r=await h.GET(new Request('https://vii.spaplus.co/api/vii/stay-calendar?siteID=2566&from=2026-10-23&till=2026-10-26'));
 assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
 assert.deepEqual(await r.json(),{siteID:2566,from:'2026-10-23',till:'2026-10-26',rooms:[]});
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].token,'SYNTHETIC_SERVER_ONLY');
 assert.deepEqual([...h.calls[0].publishedIds],[2566]);
});

test('unknown or duplicate query fields cause no supplier access',async()=>{
 for(const query of ['siteID=2566&siteID=7','siteID=2566&from=a&from=b','siteID=2566&token=x','siteID=2566&url=https://example.test']) {
  const h=routeHarness();const r=await h.GET(new Request('https://vii.spaplus.co/api/vii/stay-calendar?'+query));
  assert.equal(r.status,400);assert.equal(h.calls.length,0);assert.equal(r.headers.get('cache-control'),'no-store');
 }
});

test('provider failure is actionable and contains no private error details',async()=>{
 const h=routeHarness({fail:true});const r=await h.GET(new Request('https://vii.spaplus.co/api/vii/stay-calendar?siteID=2566&from=2026-10-23&till=2026-10-26'));
 assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'supplier_unavailable'});assert.equal(r.headers.get('cache-control'),'no-store');
});

test('malformed, oversize and unavailable supplier bodies cannot become calendar results',async()=>{
 const options={siteID:2566,from:'2026-10-23',till:'2026-10-26',token:'SYNTHETIC',publishedIds:new Set([2566])};
 for(const body of ['{bad','x'.repeat(5_000_001)])await assert.rejects(supplierStayCalendar({...options,fetchImpl:async()=>new Response(body)}));
 await assert.rejects(supplierStayCalendar({...options,fetchImpl:async()=>new Response('unavailable',{status:503})}),/supplier_unavailable/);
 await assert.rejects(supplierStayCalendar({...options,fetchImpl:async()=>{throw new DOMException('synthetic timeout','TimeoutError');}}),/synthetic timeout/);
});

test('staging frontier has no consumer in baseline pages, quote or booking',()=>{
 const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
 for(const path of ['app/business/client-page.tsx','app/booking/client-page.tsx','app/lib/vii-stay-quote.ts'])assert.doesNotMatch(read(path),/supplierStayCalendar|useViiStayCalendar|\/api\/vii\/stay-calendar/);
});
