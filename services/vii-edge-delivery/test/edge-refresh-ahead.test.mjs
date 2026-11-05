import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.ts';

function setup(path) {
  const old={fetch:globalThis.fetch,caches:globalThis.caches,now:Date.now};
  let time=1_800_000_000_000, calls=0, writes=0, responder;
  const entries=new Map(), pending=[], seen=[];
  const response=(body='old',extra={},status=200)=>new Response(body,{status,headers:{
    'Content-Type':'text/html','X-VII-Cache-Build':'ahead-build',
    'X-VII-Cache-Until':String(time+300_000),'Cache-Control':'public, max-age=60',...extra}});
  responder=()=>response(); Date.now=()=>time;
  globalThis.fetch=async request=>{calls++;seen.push(request);return responder(request);};
  globalThis.caches={default:{async match(key){return entries.get(key.url)?.clone();},async put(key,value){writes++;entries.set(key.url,value.clone());}}};
  const ctx={waitUntil(p){pending.push(p);}},env={EXPECTED_BUILD:'ahead-build',ORIGIN:'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site'};
  return {response,entries,seen,stats:()=>({calls,writes}),tick(ms){time+=ms;},set(fn){responder=fn;},
    read(suffix=''){return worker.fetch(new Request('https://edge.test'+path+suffix,{headers:{Accept:'text/html'}}),env,ctx);},
    async settle(){while(pending.length)await Promise.all(pending.splice(0));},
    restore(){globalThis.fetch=old.fetch;globalThis.caches=old.caches;Date.now=old.now;}};
}

test('concurrent aging HITs return immediately and coalesce through the same admission path',async()=>{
  const h=setup('/events?release=ahead-coalesce');let release;
  try{
    await h.read();await h.settle(); const oldExpiry=[...h.entries.values()][0].headers.get('X-VII-Cache-Until');
    h.tick(100_001);h.set(()=>new Promise(resolve=>{release=()=>resolve(h.response('new'));}));
    const [a,b]=await Promise.all([h.read(),h.read()]);
    assert.equal(await a.text(),'old');assert.equal(await b.text(),'old');assert.equal(h.stats().calls,2);
    assert.equal(a.headers.get('X-VII-Edge-Refresh-After'),null);
    assert.equal([...h.entries.values()][0].headers.get('X-VII-Cache-Until'),oldExpiry);
    assert.ok(h.seen[1].signal instanceof AbortSignal);assert.equal(h.seen[1].headers.get('Authorization'),null);
    release();await h.settle();
    const next=await h.read();assert.equal(await next.text(),'new');
    assert.equal(next.headers.get('X-VII-Cache-Until'),String(Date.now()+300_000));
    assert.equal(next.headers.get('X-VII-Edge-Refresh-After'),null);
  }finally{h.restore();}
});

test('failed ahead refresh preserves original hard expiry and has a retry cooldown',async()=>{
  const h=setup('/spas?release=ahead-failure');
  try{
    await h.read();await h.settle();const before=[...h.entries.values()][0].headers.get('X-VII-Cache-Until');
    h.tick(100_001);h.set(()=>h.response('failure',{},503));
    assert.equal(await (await h.read()).text(),'old');await h.settle();
    assert.equal(h.stats().calls,3);assert.equal(h.stats().writes,1);
    assert.equal([...h.entries.values()][0].headers.get('X-VII-Cache-Until'),before);
    await h.read();await h.settle();assert.equal(h.stats().calls,3);
    h.tick(200_000);const expired=await h.read();await h.settle();
    assert.equal(expired.status,503);assert.notEqual(expired.headers.get('X-VII-Edge-Delivery'),'HIT');
  }finally{h.restore();}
});

test('background refresh cannot admit private policy, unknown cookies, unsupported Vary or oversized bodies',async()=>{
  for(const [label,extra]of [['private',{'Cache-Control':'private, no-store'}],['cookie',{'Set-Cookie':'session=private'}],['vary',{Vary:'User-Agent'}],['size',{'Content-Length':String(3*1024*1024)}]]){
    const h=setup('/search?release=ahead-reject-'+label);
    try{
      await h.read();await h.settle();h.tick(100_001);h.set(()=>h.response('unsafe',extra));
      assert.equal(await (await h.read()).text(),'old');await h.settle();
      assert.equal(h.stats().writes,1,label);assert.equal(await (await h.read()).text(),'old');
    }finally{h.restore();}
  }
});

test('ahead refresh admission is globally capped at two distinct keys',async()=>{
  const h=setup('/search?release=ahead-cap');const releases=[];
  try{
    for(const suffix of ['1','2','3']){await h.read(suffix);await h.settle();}
    h.tick(100_001);h.set(()=>new Promise(resolve=>releases.push(()=>resolve(h.response('new')))));
    const hits=await Promise.all(['1','2','3'].map(suffix=>h.read(suffix)));
    assert.equal(h.stats().calls,5);assert.equal(releases.length,2);
    for(const hit of hits)assert.equal(await hit.text(),'old');
    releases.forEach(release=>release());await h.settle();
  }finally{h.restore();}
});
