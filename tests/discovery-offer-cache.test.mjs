import test from "node:test";
import assert from "node:assert/strict";
import { cachedDiscovery, readCachedDiscovery } from "../app/lib/discovery-offer-cache.ts";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { runWithExecutionContext } from "vinext/shims/request-context";

test("durable cache eviction SQL is portable to Aurora and D1", () => {
  const source = readFileSync(new URL("../app/lib/discovery-offer-cache.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /LIMIT -1/);
  assert.match(source, /LIMIT 512 OFFSET 511/);
  assert.match(source, /LIMIT 512 OFFSET 512/);
});

test("local cache reuses fresh value and accepts successful empty result", async () => {
  let now = 1_000_000; let calls = 0;
  const load = async () => { calls++; return calls === 1 ? [] : [{ id: 2 }]; };
  const first = await cachedDiscovery({ key: ["events", "2026-10-18", 2], load, now: () => now });
  const second = await cachedDiscovery({ key: ["events", "2026-10-18", 2], load, now: () => now });
  assert.deepEqual(first.value, []); assert.equal(second.cache.status, "fresh"); assert.equal(calls, 1);
  now += 16 * 60 * 1000;
  const third = await cachedDiscovery({ key: ["events", "2026-10-18", 2], load, now: () => now });
  assert.deepEqual(third.value, [{ id: 2 }]); assert.equal(third.cache.status, "refreshed"); assert.equal(calls, 2);
});

test("read-only discovery returns the accepted snapshot and never invokes a provider", async () => {
  const key = ["read-only-snapshot", Date.now()];
  await assert.rejects(readCachedDiscovery({ key }), /discovery_unavailable/);
  await cachedDiscovery({ key, load: async () => ({ places: [1] }) });
  assert.deepEqual((await readCachedDiscovery({ key })).value, { places: [1] });
});

test("daily policy persists capability across isolates, merges previous evidence, coalesces and retains failures", async () => {
  const { mf, db } = await d1(); let now = 700_000_000; let calls = 0;
  const policy = { freshMs: 86_400_000, staleMs: 7 * 86_400_000 };
  const options = { key: ["daily-capability-proof"], db, now: () => now, policy };
  const good = { "vacation-1": { checkedAt: now } };
  try {
    await cachedDiscovery({ ...options, load: async () => { calls++; return good; } });
    now += 86_399_999;
    const hit = await cachedDiscovery({ ...options, load: async () => { calls++; throw Error("must_not_fetch"); } });
    assert.deepEqual(hit.value, good); assert.equal(calls, 1);
    now += 2;
    const [a, b] = await Promise.all([0, 1].map(() => cachedDiscovery({ ...options, load: async previous => { calls++; assert.deepEqual(previous, good); throw Error("provider_down"); } })));
    assert.equal(calls, 2); assert.deepEqual(a.value, good); assert.deepEqual(b.value, good);
    // A new binding object represents another isolate; persisted row still wins.
    const isolate = { prepare: (...args) => db.prepare(...args) };
    assert.deepEqual((await cachedDiscovery({ ...options, db: isolate, load: async () => { throw Error("cooldown"); } })).value, good);
    now = 700_000_000 + policy.staleMs;
    await assert.rejects(cachedDiscovery({ ...options, load: async () => { throw Error("expired"); } }));
  } finally { await mf.dispose(); }
});

test("daily evidence survives short-lived offer cache churn without exceeding admission bound", async () => {
  const { mf, db } = await d1(); let now = 800_000_000, calls = 0;
  const options = { key: ["daily-churn-proof"], db, now: () => now, policy: { freshMs: 86_400_000, staleMs: 604_800_000 }, load: async () => { calls++; return [1]; } };
  try {
    await cachedDiscovery(options); now += 5000;
    await db.batch(Array.from({ length: 511 }, (_, i) => db.prepare('INSERT INTO vii_discovery_offer_cache_v1 (cache_key,payload,checked_at,stale_until) VALUES (?, ?, ?, ?)').bind(`offer-churn-${i}`, '[]', now, now + 86_400_000)));
    await cachedDiscovery({ key: ['another-short-offer'], db, now: () => now, load: async () => [] });
    assert.equal((await cachedDiscovery(options)).cache.status, 'fresh'); assert.equal(calls, 1);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM vii_discovery_offer_cache_v1').first()).n, 512);
  } finally { await mf.dispose(); }
});

test("local cache serves last good value on refresh failure", async () => {
  let now = 2_000_000; let calls = 0;
  const first = await cachedDiscovery({ key: ["spa", "today", "couple"], load: async () => ({ offers: [1] }), now: () => now });
  now += 16 * 60 * 1000; calls++;
  const stale = await cachedDiscovery({ key: ["spa", "today", "couple"], load: async () => { throw new Error("upstream"); }, now: () => now });
  assert.deepEqual(stale.value, first.value); assert.equal(stale.cache.status, "stale"); assert.equal(calls, 1);
});

test("key isolates party and date dimensions", async () => {
  let calls = 0; const load = async () => ++calls;
  await cachedDiscovery({ key: ["vacations", "2026-10-18", 2], load });
  await cachedDiscovery({ key: ["vacations", "2026-10-19", 2], load });
  assert.equal(calls, 2);
});

async function d1() {
  const req = createRequire(import.meta.url);
  const dependency = createRequire(req.resolve("wrangler"));
  const { Miniflare } = dependency("miniflare");
  const mf = new Miniflare({ modules: true, script: "export default {fetch(){return new Response('ok')}}", compatibilityDate: "2026-05-15", d1Databases: { DB: "discovery-cache-test" } });
  const db=await mf.getD1Database("DB");
  try { await db.prepare(readFileSync(new URL('../drizzle/0009_discovery_offer_cache.sql',import.meta.url),'utf8')).run(); }
  catch(error){await mf.dispose();throw error;}
  return { mf, db };
}

test("D1 cache persists fresh values and successful empty values", async () => {
  const { mf, db } = await d1(); let calls = 0; try {
    const opts = { key: ["events", "2026-10-20", 2], db, now: () => 10_000, load: async () => { calls++; return []; } };
    const a = await cachedDiscovery(opts); const b = await cachedDiscovery(opts);
    assert.deepEqual(a.value, []); assert.equal(b.cache.status, "fresh"); assert.equal(calls, 1);
  } finally { await mf.dispose(); }
});

test("D1 cache serves stale data after failure and expires it", async () => {
  const { mf, db } = await d1(); let now = 20_000; try {
    await cachedDiscovery({ key: ["spa", "2026-10-20", "single"], db, now: () => now, load: async () => ({ offers: [1] }) });
    now += 16 * 60 * 1000;
    const stale = await cachedDiscovery({ key: ["spa", "2026-10-20", "single"], db, now: () => now, load: async () => { throw Error("upstream"); } });
    assert.equal(stale.cache.status, "stale"); assert.deepEqual(stale.value, { offers: [1] });
    now += 25 * 60 * 60 * 1000;
    await assert.rejects(cachedDiscovery({ key: ["spa", "2026-10-20", "single"], db, now: () => now, load: async () => { throw Error("upstream"); } }));
  } finally { await mf.dispose(); }
});

test("D1 failure cooldown avoids repeated upstream calls", async () => {
  const { mf, db } = await d1(); let now = 30_000; let calls = 0; try {
    const opts = { key: ["vacations", "2026-10-20", 6], db, now: () => now, load: async () => { calls++; throw Error("down"); } };
    await assert.rejects(cachedDiscovery(opts)); await assert.rejects(cachedDiscovery(opts)); assert.equal(calls, 1);
  } finally { await mf.dispose(); }
});

test("D1 infrastructure failure falls back locally without retrying provider failures", async () => {
  let calls = 0;
  const db = { prepare() { throw new Error("VII AWS database bridge returned 503"); } };
  const key = ["database-bridge-fallback", Date.now()];
  const options = { key, db, load: async () => { calls++; return { online: true }; } };
  assert.deepEqual((await cachedDiscovery(options)).value, { online: true });
  assert.deepEqual((await cachedDiscovery(options)).value, { online: true });
  assert.equal(calls, 1);

  const failedKey = ["database-bridge-provider-failure", Date.now()];
  const failed = { key: failedKey, db, load: async () => { calls++; throw new Error("provider_down"); } };
  await assert.rejects(cachedDiscovery(failed), /discovery_unavailable/);
  await assert.rejects(cachedDiscovery(failed), /discovery_unavailable/);
  assert.equal(calls, 2);
});

test("D1 concurrent callers do not overwrite a lease owner", async () => {
  const { mf, db } = await d1(); let calls = 0; try {
    const opts = { key: ["events", "2026-10-21", 20], db, load: async () => { calls++; await new Promise(r => setTimeout(r, 20)); return { id: calls }; } };
    const [a, b] = await Promise.all([cachedDiscovery(opts), cachedDiscovery(opts)]);
    assert.equal(calls, 1); assert.deepEqual(a.value, b.value);
  } finally { await mf.dispose(); }
});

test("validate rejects malformed loaded values", async () => {
  await assert.rejects(cachedDiscovery({ key: ["invalid"], load: async () => ({ bad: true }), validate: value => Array.isArray(value) }));
});

test("local stale refresh has truthful timestamp, cooldown, isolation and immutable copies", async () => {
  let now = 100_000_000, calls = 0;
  const key = ['local-cooldown', 2];
  const initial = await cachedDiscovery({key,now:()=>now,load:async()=>({offers:[1]})});
  initial.value.offers.push(99);
  now += 901_000;
  const opts={key,now:()=>now,load:async()=>{calls++;throw Error('down');}};
  const stale = await cachedDiscovery(opts), again = await cachedDiscovery(opts);
  assert.deepEqual(stale.value,{offers:[1]}); assert.equal(stale.cache.status,'stale');
  assert.equal(stale.cache.checkedAt,initial.cache.checkedAt);assert.equal(again.cache.status,'stale');assert.equal(calls,1);
  await assert.rejects(cachedDiscovery({...opts,key:['local-cold-cooldown']}));
  await assert.rejects(cachedDiscovery({...opts,key:['local-cold-cooldown']}));assert.equal(calls,2);
});

test("D1 successful empty refresh replaces prior offers and different database never shares data", async () => {
  const {mf,db}=await d1();const other=await d1();let now=200_000_000;
  try {
    const key=['replace-empty'];await cachedDiscovery({key,db,now:()=>now,load:async()=>[1]});
    now+=901_000;
    assert.deepEqual((await cachedDiscovery({key,db,now:()=>now,load:async()=>[]})).value,[]);
    assert.deepEqual((await cachedDiscovery({key,db,now:()=>now,load:async()=>{throw Error('must not call');}})).value,[]);
    assert.deepEqual((await cachedDiscovery({key,db:other.db,now:()=>now,load:async()=>[2]})).value,[2]);
  } finally {await mf.dispose();await other.mf.dispose();}
});

test("D1 cross-isolate lease coalesces and expired older owner cannot overwrite newer result", async () => {
  const {mf,db}=await d1();let now=300_000_000,calls=0;
  const dbOther={prepare:sql=>db.prepare(sql)};
  let release,started; const began=new Promise(r=>started=r), gate=new Promise(r=>release=r);
  try {
    const first=cachedDiscovery({key:['expired-lease'],db,now:()=>now,load:async()=>{calls++;started();await gate;return [1];}});
    await began;now+=61_000;
    const second=await cachedDiscovery({key:['expired-lease'],db:dbOther,now:()=>now,load:async()=>{calls++;return [2];}});
    assert.deepEqual(second.value,[2]);release();assert.deepEqual((await first).value,[2]);assert.equal(calls,2);
    let simultaneous=0;
    const options={key:['cross-isolate'],now:()=>now,load:async()=>{simultaneous++;await new Promise(r=>setTimeout(r,40));return [3];}};
    const values=await Promise.all([cachedDiscovery({...options,db}),cachedDiscovery({...options,db:dbOther})]);
    assert.equal(simultaneous,1);assert.deepEqual(values[0].value,values[1].value);
  } finally {release?.();await mf.dispose();}
});

test("D1 malformed refresh and oversize payload preserve last accepted value",async()=>{
  const {mf,db}=await d1();let now=400_000_000;
  try {
    const base={key:['malformed-refresh'],db,now:()=>now,validate:Array.isArray};
    await cachedDiscovery({...base,load:async()=>[1]});now+=901_000;
    assert.deepEqual((await cachedDiscovery({...base,load:async()=>({error:'offline'})})).value,[1]);
    now+=121_000;
    assert.deepEqual((await cachedDiscovery({...base,load:async()=>['x'.repeat(1_048_577)]})).value,[1]);
  } finally {await mf.dispose();}
});

test('request execution context returns stale immediately and owns background refresh until completion',async()=>{
 const {mf,db}=await d1();let now=500_000_000,release;const pending=[];const gate=new Promise(r=>release=r);
 try{
  const options={key:['background-refresh'],db,now:()=>now};await cachedDiscovery({...options,load:async()=>[1]});now+=901_000;
  const stale=await runWithExecutionContext({waitUntil:p=>pending.push(p)},()=>cachedDiscovery({...options,load:async()=>{await gate;return [2];}}));
  assert.equal(stale.cache.status,'stale');assert.deepEqual(stale.value,[1]);assert.equal(pending.length,1);
  release();await Promise.all(pending);assert.deepEqual((await cachedDiscovery({...options,load:async()=>{throw Error('must not call');}})).value,[2]);
 }finally{release?.();await Promise.allSettled(pending);await mf.dispose();}
});

test('D1 admission bounds cold failures and never evicts active refresh leases',async()=>{
 const {mf,db}=await d1();let calls=0;const now=600_000_000;
 try{
  await db.prepare(`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<512) INSERT INTO vii_discovery_offer_cache_v1(cache_key) SELECT 'existing-'||x FROM n`).run();
  for(let i=0;i<3;i++)await assert.rejects(cachedDiscovery({key:['bounded-cold',i],db,now:()=>now,load:async()=>{calls++;throw Error('down');}}));
  assert.equal(calls,3);assert.equal((await db.prepare('SELECT count(*) AS count FROM vii_discovery_offer_cache_v1').first()).count,512);
  await db.prepare('UPDATE vii_discovery_offer_cache_v1 SET lease_until = ?').bind(now+60_000).run();
  await assert.rejects(cachedDiscovery({key:['bounded-active'],db,now:()=>now,load:async()=>{calls++;return [1];}}));
  assert.equal(calls,3);assert.equal((await db.prepare('SELECT count(*) AS count FROM vii_discovery_offer_cache_v1').first()).count,512);
 }finally{await mf.dispose();}
});
