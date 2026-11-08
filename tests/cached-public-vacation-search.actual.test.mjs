import assert from 'node:assert/strict';
import {test} from 'node:test';
import {reusePublicVacationSearch, PUBLIC_SEARCH_REUSE_MIN_REMAINING_MS} from '../app/lib/cached-public-vacation-search.ts';
import {publicCachePolicy} from '../worker/public-response-cache.ts';
import {withServerRequestReads, serverRequestContext} from '../app/lib/server-request-reads.ts';

let sequence=0;
const url='https://vii.spaplus.co/api/catalog?world=vacations&view=search';
const snapshot=(name='Accepted',entries)=>({world:'vacations',source:'runtime',fetchedAt:'2026-11-08T00:00:00Z',entries:entries??[{supplierId:7,summary:{slug:'vacation-7',name,location:'כנרת',area:'כנרת',type:'צימר',units:2,guests:6,bedrooms:2,features:['בריכה'],searchFilterIds:['pool','accessible'],images:['/a.jpg','/b.jpg'],lat:32.8,lng:35.5,price:600,contact:{phone:'055-0000000'},roomOptions:[{id:3,guests:6}]}}]});
function context(){const work=[];return{waitUntil(p){work.push(p);},async settle(){while(work.length)await Promise.allSettled(work.splice(0));}};}
async function fixture(value,remaining=300000){
 const build='shared-search-'+ ++sequence,request=new Request(url,{headers:{Accept:'application/json'}}),policy=await publicCachePolicy(request,new URL(url),build),objects=new Map();let reads=0,writes=0;
 const until=Date.now()+remaining;
 if(value!==undefined)objects.set(policy.key,{body:new TextEncoder().encode(JSON.stringify(value)).buffer,customMetadata:{expiresAt:String(until),headers:JSON.stringify([['Content-Type','application/json'],['Cache-Control','public, max-age=60, s-maxage=300']])}});
 const UPLOADS={async get(key){reads++;const row=objects.get(key);return row?{body:new Response(row.body).body,customMetadata:row.customMetadata}:null;},async put(key,body,options){writes++;objects.set(key,{body:body.slice(0),...options});}};
 return{build,env:{UPLOADS},policy,objects,until,reads:()=>reads,writes:()=>writes};
}

test('a cold isolate reuses the existing R2 public API snapshot with zero canonical reads and identical supplier facts',async()=>{
 const body=snapshot(),f=await fixture(body);let canonical=0;
 const result=await reusePublicVacationSearch({...f,readFresh:async()=>{canonical++;assert.fail('shared model should bypass canonical read');}});
 assert.deepEqual(result,body.entries.map(e=>e.summary));assert.equal(canonical,0);assert.equal(f.reads(),1);assert.equal(f.writes(),0);
 assert.equal(f.objects.get(f.policy.key).customMetadata.expiresAt,String(f.until),'reuse never restarts source lifetime');
});

test('a cold miss reads the canonical model once and fills the same API cache through the request context',async()=>{
 const f=await fixture(),ctx=context();let canonical=0;
 const first=await reusePublicVacationSearch({...f,context:ctx,readFresh:async()=>{canonical++;return snapshot();}});
 await ctx.settle();assert.equal(canonical,1);assert.equal(f.writes(),1);
 first[0].name='caller mutation';
 const second=await reusePublicVacationSearch({...f,context:ctx,readFresh:async()=>{canonical++;return snapshot('wrong');}});
 assert.equal(second[0].name,'Accepted');assert.equal(canonical,1);assert.equal(f.writes(),1);
});

test('source freshness is conservative at the exact reuse boundary and cannot be extended by an HTML cache',async t=>{
 t.mock.timers.enable({apis:['Date'],now:1794096000000});
 const accepted=await fixture(snapshot(),PUBLIC_SEARCH_REUSE_MIN_REMAINING_MS);
 assert.equal((await reusePublicVacationSearch({...accepted,readFresh:async()=>assert.fail('boundary still safe')}))[0].name,'Accepted');
 for(const path of ['/vacations/north','/vacations/kinneret?guests=4&sort=price-asc','/vacations/south-negev?from=2026-11-12&till=2026-11-14']){
  const request=new Request('https://vii.spaplus.co'+path,{headers:{Accept:'text/html'}}),policy=await publicCachePolicy(request,new URL(request.url),'document');
  assert.ok(policy.ttlSeconds<=180);assert.ok(Date.now()+policy.ttlSeconds*1000<accepted.until);
 }
 const old=await fixture(snapshot('Older'),PUBLIC_SEARCH_REUSE_MIN_REMAINING_MS-1),ctx=context();let reads=0;
 const fresh=await reusePublicVacationSearch({...old,context:ctx,readFresh:async()=>{reads++;return snapshot('Current');}});await ctx.settle();
 assert.equal(reads,1);assert.equal(fresh[0].name,'Current');assert.ok(Number(old.objects.get(old.policy.key).customMetadata.expiresAt)>old.until,'a new lifetime requires a real canonical read');
});

test('malformed, wrong-world and identity-mismatched cached bodies cannot become a search model',async()=>{
 for(const bad of [{world:'vacations',source:'runtime',entries:{}},{...snapshot(),world:'events'},snapshot('bad',[{supplierId:7,summary:{...snapshot().entries[0].summary,slug:'vacation-8'}}]),snapshot('bad',[{supplierId:0,summary:snapshot().entries[0].summary}])]){
  const f=await fixture(bad);let reads=0;const result=await reusePublicVacationSearch({...f,readFresh:async()=>{reads++;return snapshot('Recovered');}});
  assert.equal(reads,1);assert.equal(result[0].name,'Recovered');
 }
});

test('an unavailable or invalid canonical model is not stored as a false empty success; a genuinely empty model is accepted',async()=>{
 const f=await fixture(),ctx=context();let reads=0;
 assert.equal(await reusePublicVacationSearch({...f,context:ctx,readFresh:async()=>{reads++;return null;}}),null);await ctx.settle();assert.equal(f.writes(),0);
 assert.equal(await reusePublicVacationSearch({...f,context:ctx,readFresh:async()=>{reads++;return {...snapshot(),source:'bundled'};}}),null);await ctx.settle();assert.equal(f.writes(),0);
 assert.deepEqual(await reusePublicVacationSearch({...f,context:ctx,readFresh:async()=>{reads++;return snapshot('',[]);}}),[]);await ctx.settle();assert.equal(f.writes(),1);assert.equal(reads,3);
});

test('only the original public search JSON aliases and ordinary Accept variants share a key',async()=>{
 const key=async(origin,headers={},query='world=vacations&view=search')=>{const request=new Request(origin+'/api/catalog?'+query,{headers:{Accept:'application/json',...headers}});return publicCachePolicy(request,new URL(request.url),'identity');};
 const canonical=await key('https://vii.spaplus.co');
 for(const origin of ['https://vii.spaplus.co','https://www.vii.co.il','https://vii-vacation-calendar.adir-naor-7510.chatgpt.site'])for(const Accept of ['application/json','*/*',''])assert.equal((await key(origin,{Accept})).key,canonical.key);
 assert.notEqual((await key('https://foreign.test')).key,canonical.key);
 for(const headers of [{Accept:'text/html'},{RSC:'1'},{'Next-Router-State-Tree':'[]'},{'X-Vinext-Rsc-Render-Mode':'refresh'}])assert.notEqual((await key('https://vii.spaplus.co',headers))?.key,canonical.key);
 for(const headers of [{Cookie:'vii_admin_session=fixture'},{Authorization:'Bearer fixture'}])assert.equal(await key('https://vii.spaplus.co',headers),null);
 assert.notEqual((await key('https://vii.spaplus.co',{},'world=vacations&view=lookup')).key,canonical.key);
});

test('request lifetime context stays isolated across overlapping async requests and is absent outside them',async()=>{
 const a=context(),b=context();let release;const gate=new Promise(r=>release=r);
 const first=withServerRequestReads(async()=>{assert.equal(serverRequestContext(),a);await gate;assert.equal(serverRequestContext(),a);},a);
 await withServerRequestReads(async()=>{assert.equal(serverRequestContext(),b);await Promise.resolve();assert.equal(serverRequestContext(),b);},b);
 assert.equal(serverRequestContext(),undefined);release();await first;assert.equal(serverRequestContext(),undefined);
});

test('concurrent cold requests share one canonical read and one fill, without retaining a failed operation',async()=>{
 const f=await fixture(),ctx=context();let release,started,reads=0;
 const gate=new Promise(r=>release=r),begin=new Promise(r=>started=r);
 const readFresh=async()=>{reads++;started();await gate;return snapshot();};
 const a=reusePublicVacationSearch({...f,context:ctx,readFresh}),b=reusePublicVacationSearch({...f,context:ctx,readFresh});
 await begin;await new Promise(r=>setImmediate(r));assert.equal(reads,1);release();
 const [one,two]=await Promise.all([a,b]);await ctx.settle();assert.deepEqual(one,two);assert.notEqual(one,two);assert.equal(f.writes(),1);
 const failed=await fixture();let attempts=0;
 await assert.rejects(reusePublicVacationSearch({...failed,readFresh:async()=>{attempts++;throw Error('canonical failed');}}),/canonical failed/);
 assert.equal((await reusePublicVacationSearch({...failed,readFresh:async()=>{attempts++;return snapshot('recovered');}}))[0].name,'recovered');assert.equal(attempts,2);
});
