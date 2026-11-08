import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { incidentTransition, qualityHeartbeatWindow, qualityNotificationProviderStatus, qualityRegistry, readQualityDashboard, readQualityRunStatus, runQualityChecks, shouldStartQualityHeartbeat, updateQualitySchedule } from "../app/lib/quality-platform.ts";
import { homeDealDates } from '../app/lib/home-deal-dates.ts';

test("small run polling performs one fresh SELECT after shared schema initialization", async () => {
  const {sqlite,db}=fixture();let statements=0;
  const tracked={prepare(sql){statements++;return db.prepare(sql)},batch:db.batch};
  try{
    assert.equal((await readQualityRunStatus(tracked,{activeOnly:true})).run,null);
    const initialized=statements;
    sqlite.prepare(`INSERT INTO quality_runs (id,operation_key,trigger_kind,status,started_at,total_checks)
      VALUES ('poll-run','poll-op','manual_full','running','2026-11-05T20:00:00Z',2)`).run();
    const active=await readQualityRunStatus(tracked,{activeOnly:true});
    assert.equal(active.run.id,'poll-run');assert.equal(active.run.totalChecks,2);
    assert.equal(statements-initialized,1,'polling must not repeat schema DDL or load dashboard history');
    sqlite.prepare("UPDATE quality_runs SET passed_count=1 WHERE id='poll-run'").run();
    const changed=await readQualityRunStatus(tracked,{runId:'poll-run'});
    assert.equal(changed.run.passedCount,1,'query results are not cached with schema readiness');
  }finally{sqlite.close()}
});

test("crash after provider acceptance preserves uncertain delivery and never repeats the opened message", async () => {
  const {sqlite,db}=fixture();let providerCalls=0,crash=true;
  const wrapped={batch:db.batch,prepare(sql){
    const statement=db.prepare(sql);
    if(sql.includes('UPDATE quality_notification_deliveries SET status=?')){
      const original=statement.run;
      statement.run=async()=>{if(crash){crash=false;throw Error('synthetic_crash_after_provider_acceptance')}return original()};
    }
    return statement;
  }};
  const env={VII_QUALITY_EMAIL_PROVIDER:'resend',VII_QUALITY_EMAIL_API_KEY:'synthetic-only',VII_QUALITY_EMAIL_FROM:'qa@example.test',VII_QUALITY_EMAIL_RECIPIENTS:'owner@example.test'};
  const fetcher=async url=>{
    if(String(url).includes('api.resend.com')){providerCalls++;return Response.json({id:'synthetic-provider-id'})}
    return new Response('synthetic source failure',{status:503});
  };
  const options={origin:'https://example.test',trigger:'manual',level:'full',scope:{changedBoxes:[],consumers:['content.guides']},notificationEnv:env,fetcher};
  try{
    await assert.rejects(runQualityChecks(wrapped,options),/synthetic_crash_after_provider_acceptance/);
    assert.equal(providerCalls,1);
    const pending=sqlite.prepare("SELECT id,status FROM quality_notification_deliveries").get();assert.equal(pending.status,'pending');
    sqlite.prepare('UPDATE quality_notification_deliveries SET created_at=? WHERE id=?').run(new Date(Date.now()-20*60_000).toISOString(),pending.id);
    await runQualityChecks(wrapped,options);
    assert.equal(sqlite.prepare('SELECT status FROM quality_notification_deliveries WHERE id=?').get(pending.id).status,'unknown');
    assert.equal(providerCalls,1,'uncertain provider acceptance cannot be retried automatically');
  }finally{sqlite.close()}
});

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  const db = {
    prepare(sql) {
      let args = [];
      const statement = {
        bind(...values) { args = values; return statement; },
        async first() { return sqlite.prepare(sql).get(...args) || null; },
        async all() { return { success: true, results: sqlite.prepare(sql).all(...args) }; },
        async run() { const result = sqlite.prepare(sql).run(...args); return { success: true, meta: { changes: Number(result.changes) } }; },
      };
      return statement;
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try { const output = []; for (const statement of statements) output.push(await statement.run()); sqlite.exec("COMMIT"); return output; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  return { sqlite, db };
}

const success = async (url, options) => {
  if(options?.method==='HEAD')return new Response(null,{headers:{'content-type':'image/jpeg','content-length':'1000'}});
  if(url.includes('/api/catalog?world=')&&new URL(url).searchParams.has('id'))return Response.json({entry:{supplierId:Number(new URL(url).searchParams.get('id')),detail:{images:['/api/vii/media/general.jpg'],rooms:[{images:['/api/vii/media/unit.jpg']}]}}});
  if(url.includes('/api/catalog?world='))return Response.json({entries:[{supplierId:1},{supplierId:2},{supplierId:3}],world:new URL(url).searchParams.get('world')});
  if(url.endsWith('/.well-known/vii-quality-jwks.json'))return Response.json({keys:[{kty:'OKP',crv:'Ed25519',x:'synthetic-public-key'}]});
  if(url.includes('/api/vii/home-deals?')){const period=new URL(url).searchParams.get('period');return Response.json({period,dates:homeDealDates(period),availabilityStatus:'verified',cache:{checkedAt:new Date().toISOString()},deals:[]});}
  if(url.endsWith('/api/vii/live-search')){const request=JSON.parse(options.body);return Response.json({world:'events',discoveryVersion:3,scope:{date:request.from,guests:20},cache:{checkedAt:new Date().toISOString()},results:[],places:[]});}
  if (url.includes("/api/vii/business-amenities")) return Response.json({ source: "biz-shared-amenities", groups: [{ title: "מתחם חיצוני", items: ["בריכה"] }, { title: "מתחם פנימי", items: ["מזגן"] }] });
  if (url.includes("/api/")) return Response.json({ world: url.includes("events") ? "events" : url.includes("rooms") ? "rooms" : url.includes("spa") ? "spa" : "vacations", entries: [{ id: "vacation-1" }], prices: {}, review: null, authenticated: false, reviews: [], items: [], slider: [], section: [], popular: [], cities: [], types: [], capabilities: {}, coordinatesReady: true, interactiveMap: true });
  if (url.endsWith("/sitemap.xml")) return new Response("<?xml version=\"1.0\"?><sitemapindex><sitemap><loc>https://example.test/sitemaps/core/1.xml</loc></sitemap><sitemap><loc>https://example.test/sitemaps/vacations/1.xml</loc></sitemap>" + "x".repeat(500) + "</sitemapindex>", { status: 200, headers: { "content-type": "application/xml" } });
  if (url.endsWith(".xml")) return new Response("<?xml version=\"1.0\"?><urlset><loc>https://example.test/</loc>" + "x".repeat(1_200) + "</urlset>", { status: 200, headers: { "content-type": "application/xml" } });
  const tokens = ["<main", "discovery-card", "results-list", "חיפוש", "נופש", "property-gallery", "tel:", "חוות דעת", "מיקום", "וואטסאפ", "אירועים", "אירועים ברגע האחרון", "אירועים פנויים לחמישי", "אירועים פנויים לשישי", "מקומות לאירועים בצפון", "חדרים לפי שעה", "ספא", "ספא להיום", "ספא למחר", "חבילות", "אטרקציות", "event-booking", "טיולים", "ספקים", "חגים", "רגע האחרון", "שאלות", "מצטרפים", "פרסום עסק", "תקנון", "פרטיות", "id=\"sleeping\"", "איפה תשנו?", "חדר שינה אחד", "מיטה זוגית", "חדר שינה 1 - סוויטת הורים", "מתחם חיצוני", "מתחם פנימי", "מטבח מאובזר", "חדרי הרחצה", "לציבור הדתי", "במיוחד לילדים", "ניתן להזמין"];
  const locale = new URL(url).pathname.match(/^\/(en|fr|ru)(?:\/|$)/)?.[1] || "he";
  return new Response(`<!doctype html><html lang="${locale}"><head><link rel="alternate" hreflang="${locale}"></head><body>${tokens.join(" ")}${"x".repeat(3_000)}</body></html>`, { status: 200, headers: { "content-type": "text/html" } });
};

test("the first dashboard exposes the real registry without a run, incident or notification", async () => {
  const {sqlite,db}=fixture();
  try {
    const dashboard=await readQualityDashboard(db);
    assert.equal(dashboard.checks.length,qualityRegistry.length);
    assert.ok(dashboard.checks.every(check=>check.active===1));
    assert.equal(dashboard.runs.length,0);
    assert.equal(dashboard.incidents.length,0);
    assert.equal(dashboard.deliveries.length,0);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM quality_checks').get().n,0);
    await updateQualitySchedule(db,{checkId:qualityRegistry[0].checkId,cadenceMinutes:30,actor:'fixture'});
    const reloaded=await readQualityDashboard(db);
    assert.equal(reloaded.checks.find(check=>check.checkId===qualityRegistry[0].checkId).cadenceMinutes,30);
    assert.equal(reloaded.runs.length,0);
    assert.equal(reloaded.deliveries.length,0);
  } finally {sqlite.close();}
});

test('deployed key route check rejects a missing route and private key material',async()=>{
  for(const [response,expected] of [
    [new Response('not found',{status:404}),'failed'],
    [Response.json({keys:[{kty:'OKP',crv:'Ed25519',x:'public',d:'synthetic-private-must-reject'}]}),'failed'],
    [Response.json({keys:[{kty:'OKP',crv:'Ed25519',x:'public'}]}),'passed'],
  ]){
    const {sqlite,db}=fixture();
    try{const result=await runQualityChecks(db,{origin:'https://example.test',trigger:'manual',level:'full',scope:{changedBoxes:[],consumers:['quality.public-verification-keys']},fetcher:async()=>response});assert.equal(result.status,expected);assert.equal(result.checkCount,1);}finally{sqlite.close();}
  }
});

test("recurring registry is comprehensive, read-only and excludes accessibility and typography audits", () => {
  assert.ok(qualityRegistry.length >= 30);
  assert.equal(new Set(qualityRegistry.map((check) => check.checkId)).size, qualityRegistry.length);
  for (const check of qualityRegistry) {
    assert.ok(check.route.startsWith("/"));
    assert.doesNotMatch(`${check.checkId} ${check.family}`, /accessibility|typography/i);
    assert.ok(check.cadenceMinutes >= 5);
  }
  assert.equal(qualityRegistry.find((check) => check.checkId === "world.vacations.semantic")?.route, "/search");
  assert.deepEqual(qualityRegistry.find((check) => check.checkId === "world.vacations.semantic")?.requiredAll, ["<main", "results-list"]);
  assert.deepEqual(qualityRegistry.find((check) => check.checkId === "search.location.semantic")?.requiredAll, ["<main", "results-list"]);
  assert.equal(qualityRegistry.find((check) => check.checkId === "world.events.region.north.semantic")?.route, "/events/search/north");
  assert.deepEqual(qualityRegistry.find((check) => check.checkId === "world.events.region.north.semantic")?.requiredAny, ["מקומות לאירועים בצפון", "Event venues in the north"]);
  assert.deepEqual(qualityRegistry.find((check) => check.checkId === "api.home.presentation")?.requiredAll, ["\"popular\":", "\"cities\":", "\"types\":"]);
  assert.deepEqual(qualityRegistry.find((check) => check.checkId === "api.reviews.read")?.requiredAll, ["\"review\":", "\"authenticated\":"]);
  assert.deepEqual(qualityRegistry.find((check) => check.checkId === "content.contact")?.requiredAny, ["מצטרפים", "פרסום עסק"]);
  assert.equal(qualityRegistry.find((check) => check.checkId === "seo.sitemap.xml")?.minBytes, 500);
  assert.equal(qualityRegistry.find((check) => check.checkId === "seo.sitemap.xml")?.timeoutMs, 45_000);
  assert.deepEqual(qualityRegistry.find((check) => check.checkId === "seo.sitemap.xml")?.requiredAll, ["<sitemapindex", "<loc>"]);
  assert.ok(qualityRegistry.filter((check) => check.family === "seo-legacy").every((check) => check.timeoutMs === 45_000));
  assert.ok(qualityRegistry.filter((check) => check.family === "maps").length >= 4);
  assert.ok(new Set(qualityRegistry.map((check) => check.family)).size >= 10);
});

test("visitor heartbeat uses a stable five-minute bucket and cannot recurse", () => {
  assert.equal(qualityHeartbeatWindow(new Date("2026-10-23T18:53:42.000Z")).toISOString(), "2026-10-23T18:50:00.000Z");
  assert.equal(shouldStartQualityHeartbeat(new Request("https://vii.spaplus.co/", {
    headers: { accept: "text/html,application/xhtml+xml", "user-agent": "Mozilla/5.0" },
  })), true);
  assert.equal(shouldStartQualityHeartbeat(new Request("https://vii.spaplus.co/", {
    headers: { accept: "text/html", "user-agent": "VII-Quality-Monitor/1.0" },
  })), false);
  assert.equal(shouldStartQualityHeartbeat(new Request("https://vii.spaplus.co/api/admin/quality", {
    method: "POST", headers: { accept: "text/html" },
  })), false);
});

test("incident transition deduplicates repeated failures and recovers the same incident", () => {
  assert.deepEqual(incidentTransition(null, "failed"), { action: "open", occurrences: 1 });
  assert.deepEqual(incidentTransition({ status: "open", occurrences: 1 }, "failed"), { action: "update", occurrences: 2 });
  assert.deepEqual(incidentTransition({ status: "open", occurrences: 2 }, "passed"), { action: "recover", occurrences: 2 });
  assert.deepEqual(incidentTransition(null, "passed"), { action: "none", occurrences: 0 });
});

test("resolved incidents start a new cycle while repeated failures stay in the same cycle", () => {
  assert.deepEqual(incidentTransition({ status: "resolved", occurrences: 4 }, "failed"), { action: "open", occurrences: 1 });
  assert.deepEqual(incidentTransition({ status: "open", occurrences: 4 }, "failed"), { action: "update", occurrences: 5 });
});

test("notification event keys preserve legacy cycle one and distinguish later cycles", () => {
  const eventKey = (kind, cycle) => cycle > 1 ? `${kind}:${cycle}` : kind;
  assert.equal(eventKey("opened", 1), "opened");
  assert.equal(eventKey("opened", 2), "opened:2");
  assert.notEqual(eventKey("opened", 1), eventKey("opened", 2));
});

test("two identical failures open one incident, recovery resolves it, and email fails closed", async () => {
  const { sqlite, db } = fixture();
  try {
    const failing = async (url, options) => url.includes("/search?") ? new Response("failure".repeat(60), { status: 503, headers: { "content-type": "text/html" } }) : success(url, options);
    await runQualityChecks(db, { origin: "https://example.test", trigger: "manual", fetcher: failing, actor: "test" });
    await runQualityChecks(db, { origin: "https://example.test", trigger: "manual", fetcher: failing, actor: "test" });
    let dashboard = await readQualityDashboard(db);
    const open = dashboard.incidents.filter((incident) => incident.status === "open");
    assert.equal(open.length, 1);
    assert.equal(open[0].occurrences, 2);
    assert.equal(dashboard.deliveries.length, 1);
    assert.equal(dashboard.deliveries[0].status, "disabled");
    assert.equal(dashboard.deliveries[0].providerMessageId, null);
    sqlite.prepare("UPDATE quality_incidents SET fingerprint='legacy-route-config'").run();
    await runQualityChecks(db, { origin: "https://example.test", trigger: "manual", fetcher: success, actor: "test" });
    dashboard = await readQualityDashboard(db);
    assert.equal(dashboard.incidents.length, 1);
    assert.equal(dashboard.incidents[0].status, "resolved");
    assert.ok(dashboard.incidents[0].recoveredAt);
    assert.equal(dashboard.deliveries.length, 2);
    assert.ok(dashboard.deliveries.every((delivery) => delivery.status === "disabled" && delivery.providerMessageId === null));
  } finally { sqlite.close(); }
});

test("scheduled tick runs only the due risk-tier probes", async () => {
  const { sqlite, db } = fixture();
  try {
    const scheduledAt = new Date("2026-10-23T10:10:00.000Z");
    const result = await runQualityChecks(db, { origin: "https://example.test", trigger: "scheduled", scheduledAt, fetcher: success });
    assert.equal(result.checkCount, qualityRegistry.filter((check) => 10 % check.cadenceMinutes === 0).length);
    assert.equal(result.status, "passed");
    const duplicate = await runQualityChecks(db, { origin: "https://example.test", trigger: "scheduled", scheduledAt, fetcher: async () => { throw new Error("duplicate must not fetch"); } });
    assert.equal(duplicate.status, "skipped");
    assert.equal(duplicate.runId, result.runId);
  } finally { sqlite.close(); }
});

test("an administrator schedule override persists and controls the next scheduled run", async () => {
  const { sqlite, db } = fixture();
  try {
    const check = qualityRegistry.find((entry) => entry.cadenceMinutes === 5);
    assert.ok(check);
    await updateQualitySchedule(db, { checkId: check.checkId, cadenceMinutes: 1440, actor: "adir@example.test" });
    const scheduledAt = new Date("2026-10-23T10:10:00.000Z");
    const baseline = qualityRegistry.filter((entry) => 10 % entry.cadenceMinutes === 0).length;
    const result = await runQualityChecks(db, { origin: "https://example.test", trigger: "scheduled", scheduledAt, fetcher: success });
    assert.equal(result.checkCount, baseline - 1);
    const dashboard = await readQualityDashboard(db);
    assert.equal(dashboard.checks.find((entry) => entry.checkId === check.checkId)?.cadenceMinutes, 1440);
    await assert.rejects(() => updateQualitySchedule(db, { checkId: check.checkId, cadenceMinutes: 7, actor: "adir@example.test" }), /invalid_quality_schedule/);
  } finally { sqlite.close(); }
});

test("semantic checks reject generic HTML and map snapshots reject non-images", async () => {
  const { sqlite, db } = fixture();
  try {
    const generic = async (url) => url.includes("/api/map-health")
      ? Response.json({ coordinatesReady: false, interactiveMap: false })
      : url.includes("/api/") ? Response.json({ ok: true })
        : new Response(`<!doctype html><html><body>${"x".repeat(3_000)}</body></html>`, { status: 200, headers: { "content-type": "text/html" } });
    const result = await runQualityChecks(db, { origin: "https://example.test", trigger: "manual", fetcher: generic, actor: "semantic-negative" });
    assert.equal(result.status, "failed");
    const dashboard = await readQualityDashboard(db);
    assert.ok(dashboard.incidents.some((incident) => incident.checkId === "map.snapshot.vacation"));
    assert.ok(dashboard.incidents.some((incident) => incident.checkId === "global.home.semantic"));
  } finally { sqlite.close(); }
});

test("quality runs use bounded concurrency and close abandoned running records", async () => {
  const { sqlite, db } = fixture();
  try {
    await runQualityChecks(db, { origin: "https://example.test", trigger: "scheduled", scheduledAt: new Date("2026-10-24T09:10:00.000Z"), fetcher: success });
    sqlite.prepare(`INSERT INTO quality_runs (id,operation_key,trigger_kind,status,started_at,passed_count,failed_count,degraded_count,blocked_count)
      VALUES ('stale-run','stale-operation','scheduled','running','2026-10-24T08:00:00.000Z',0,0,0,0)`).run();
    let active = 0; let maximum = 0;
    const bounded = async (url, options) => {
      active += 1; maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      try { return await success(url, options); } finally { active -= 1; }
    };
    const result = await runQualityChecks(db, { origin: "https://example.test", trigger: "manual", scheduledAt: new Date("2026-10-24T09:20:00.000Z"), fetcher: bounded });
    assert.equal(result.status, "passed");
    assert.ok(maximum > 1 && maximum <= 3, `expected bounded concurrency, observed ${maximum}`);
    const stale = sqlite.prepare("SELECT status,finished_at,blocked_count FROM quality_runs WHERE id='stale-run'").get();
    assert.equal(stale.status, "blocked");
    assert.ok(stale.finished_at);
    assert.equal(stale.blocked_count, 1);
  } finally { sqlite.close(); }
});

test("a scheduled run with no due checks is blocked instead of falsely passing", async () => {
  const { sqlite, db } = fixture();
  try {
    for (const check of qualityRegistry) {
      await updateQualitySchedule(db, { checkId: check.checkId, cadenceMinutes: 1440, actor: "test" });
    }
    const result = await runQualityChecks(db, {
      origin: "https://example.test",
      trigger: "scheduled",
      scheduledAt: new Date("2026-10-23T10:10:00.000Z"),
      fetcher: async () => { throw new Error("no network call expected"); },
    });
    assert.equal(result.status, "blocked");
    assert.equal(result.checkCount, 0);
    const row = sqlite.prepare("SELECT status,total_checks,blocked_count FROM quality_runs WHERE id=?").get(result.runId);
    assert.equal(row.status, "blocked");
    assert.equal(row.total_checks, 0);
    assert.equal(row.blocked_count, 1);
  } finally { sqlite.close(); }
});

test("a run that loses ownership during a network batch writes no late result or incident", async () => {
  const { sqlite, db } = fixture();
  try {
    let swept = false;
    const fetcher = async (url, options) => {
      if (!swept) {
        swept = true;
        const running = sqlite.prepare("SELECT id FROM quality_runs WHERE status='running' ORDER BY started_at DESC LIMIT 1").get();
        sqlite.prepare("UPDATE quality_runs SET status='blocked',finished_at='2026-10-23T10:10:01.000Z',blocked_count=1 WHERE id=?").run(running.id);
      }
      return success(url, options);
    };
    const result = await runQualityChecks(db, { origin: "https://example.test", trigger: "manual", level: "regular", fetcher });
    assert.equal(result.status, "blocked");
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM quality_results").get().n, 0);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM quality_incidents").get().n, 0);
    assert.equal(sqlite.prepare("SELECT status FROM quality_runs WHERE id=?").get(result.runId).status, "blocked");
  } finally { sqlite.close(); }
});

test("incident recovery keeps a sibling route incident open", async () => {
  const { sqlite, db } = fixture();
  try {
    await runQualityChecks(db, { origin: "https://example.test", trigger: "manual", level: "regular", fetcher: async (url, options) => url.includes("/search?") ? new Response("failure".repeat(60), { status: 503, headers: { "content-type": "text/html" } }) : success(url, options) });
    const base = sqlite.prepare("SELECT * FROM quality_incidents WHERE check_id='search.location.semantic' LIMIT 1").get();
    assert.ok(base);
    sqlite.prepare(`INSERT INTO quality_incidents
      (id,fingerprint,check_id,family,world,route,viewport,severity,status,first_seen_at,last_seen_at,occurrences,last_result_id,last_observed)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run("sibling-incident", "sibling", base.check_id, base.family, base.world, "/different-route", base.viewport, base.severity, "open", base.first_seen_at, base.last_seen_at, 1, base.last_result_id, base.last_observed);
    await runQualityChecks(db, { origin: "https://example.test", trigger: "manual", level: "regular", fetcher: success });
    assert.equal(sqlite.prepare("SELECT status FROM quality_incidents WHERE id='sibling-incident'").get().status, "open");
    assert.equal(sqlite.prepare("SELECT status FROM quality_incidents WHERE id=?").get(base.id).status, "resolved");
  } finally { sqlite.close(); }
});

test("conditional result write stops an ownership change between observation and insert", async () => {
  const { sqlite, db: baseDb } = fixture();
  let swept = false;
  const db = {
    prepare(sql) {
      const statement = baseDb.prepare(sql);
      if (!swept && sql.includes("INSERT INTO quality_results")) {
        const originalBind = statement.bind;
        statement.bind = (...values) => {
          const bound = originalBind.apply(statement, values);
          if (!swept) {
            swept = true;
            const running = sqlite.prepare("SELECT id FROM quality_runs WHERE status='running' ORDER BY started_at DESC LIMIT 1").get();
            sqlite.prepare("UPDATE quality_runs SET status='blocked',finished_at='2026-10-23T10:10:02.000Z',blocked_count=1 WHERE id=?").run(running.id);
          }
          return bound;
        };
      }
      return statement;
    },
    batch: (...args) => baseDb.batch(...args),
  };
  try {
    const result = await runQualityChecks(db, { origin: "https://example.test", trigger: "manual", level: "regular", fetcher: success });
    assert.equal(result.status, "blocked");
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM quality_results").get().n, 0);
  } finally { sqlite.close(); }
});

test("disabled notifications can be promoted once, while unknown delivery is never retried", async () => {
  const { sqlite, db } = fixture();
  try {
    const failing = async (url, options) => url.includes("/search?")
      ? new Response("failure".repeat(60), { status: 503, headers: { "content-type": "text/html" } })
      : success(url, options);
    const env = { VII_QUALITY_EMAIL_PROVIDER: "resend", VII_QUALITY_EMAIL_API_KEY: "secret", VII_QUALITY_EMAIL_FROM: "VII QA <qa@example.test>", VII_QUALITY_EMAIL_RECIPIENTS: "adir@example.test" };
    await runQualityChecks(db, { origin: "https://example.test", trigger: "manual", level: "regular", fetcher: failing });
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM quality_notification_deliveries WHERE status='disabled'").get().n > 0, true);
    let providerCalls = 0;
    const uncertain = async (url, options) => {
      if (url === "https://api.resend.com/emails") { providerCalls += 1; throw new Error("network timeout"); }
      return success(url, options);
    };
    await runQualityChecks(db, { origin: "https://example.test", trigger: "manual", level: "regular", fetcher: uncertain, notificationEnv: env });
    const firstCount = providerCalls;
    assert.ok(firstCount > 0);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM quality_notification_deliveries WHERE status='unknown'").get().n, firstCount);
    await runQualityChecks(db, { origin: "https://example.test", trigger: "manual", level: "regular", fetcher: uncertain, notificationEnv: env });
    assert.equal(providerCalls, firstCount);
  } finally { sqlite.close(); }
});

test("a crash after reserving notification leaves pending, then expires to unknown without retry", async () => {
  const { sqlite, db: baseDb } = fixture();
  const env = { VII_QUALITY_EMAIL_PROVIDER: "resend", VII_QUALITY_EMAIL_API_KEY: "secret", VII_QUALITY_EMAIL_FROM: "VII QA <qa@example.test>", VII_QUALITY_EMAIL_RECIPIENTS: "adir@example.test" };
  let crashed = false;
  const db = {
    prepare(sql) {
      const statement = baseDb.prepare(sql);
      if (!crashed && sql.includes("INSERT INTO quality_notification_deliveries")) {
        const originalRun = statement.run;
        statement.run = async () => { const result = await originalRun(); crashed = true; throw new Error("synthetic_worker_crash"); };
      }
      return statement;
    },
    batch: (...args) => baseDb.batch(...args),
  };
  const failing = async (url, options) => url.includes("location=") ? new Response("failure".repeat(60), { status: 503, headers: { "content-type": "text/html" } }) : success(url, options);
  try {
    const scope = { changedBoxes: [], consumers: ["search.location.semantic"] };
    await assert.rejects(() => runQualityChecks(db, { origin: "https://example.test", trigger: "manual", level: "full", fetcher: failing, notificationEnv: env, scope }));
    assert.equal(sqlite.prepare("SELECT status FROM quality_notification_deliveries WHERE status='pending'").get()?.status, "pending");
    sqlite.prepare("UPDATE quality_notification_deliveries SET created_at=? WHERE status='pending'").run("2026-10-23T09:00:00.000Z");
    let providerCalls = 0;
    const noRetry = async (url, options) => { if (url === "https://api.resend.com/emails") { providerCalls += 1; return success(url, options); } return url.includes("location=") ? new Response("failure".repeat(60), { status: 503, headers: { "content-type": "text/html" } }) : success(url, options); };
    await runQualityChecks(db, { origin: "https://example.test", trigger: "manual", level: "full", scheduledAt: new Date("2026-10-23T10:00:00.000Z"), fetcher: noRetry, notificationEnv: env, scope });
    assert.equal(providerCalls, 0, JSON.stringify(sqlite.prepare("SELECT incident_id,event_kind,status,reason FROM quality_notification_deliveries").all()));
    assert.equal(sqlite.prepare("SELECT status,reason FROM quality_notification_deliveries WHERE status='unknown'").get()?.reason, "orphaned_reservation");
  } finally { sqlite.close(); }
});

test("manual scope selection runs the mapped checks and reports their ids", async () => {
  const { sqlite, db } = fixture();
  try {
    const result = await runQualityChecks(db, {
      origin: "https://example.test", trigger: "manual", level: "full", fetcher: success,
      scope: { changedBoxes: ["world-landings"] },
    });
    assert.equal(result.selectionStatus, "selected");
    assert.ok(result.selectedCheckIds.includes("world.vacations.semantic"));
    assert.ok(result.selectedCheckIds.includes("search.location.semantic"));
    assert.equal(result.checkCount, result.selectedCheckIds.length);
    assert.equal(result.status, "passed");
  } finally { sqlite.close(); }
});

test("unknown scope ownership is blocked rather than reported green", async () => {
  const { sqlite, db } = fixture();
  try {
    const result = await runQualityChecks(db, { origin: "https://example.test", trigger: "manual", level: "regular", fetcher: success, scope: { changedBoxes: [], unknownOwner: true } });
    assert.equal(result.status, "blocked");
    assert.equal(result.selectionStatus, "unmapped");
    assert.equal(result.checkCount, 0);
  } finally { sqlite.close(); }
});

test("notification provider fails closed until every verified Resend setting exists", () => {
  assert.equal(qualityNotificationProviderStatus({}), "not_configured");
  assert.equal(qualityNotificationProviderStatus({ VII_QUALITY_EMAIL_PROVIDER: "smtp" }), "unsupported_provider");
  assert.equal(qualityNotificationProviderStatus({ VII_QUALITY_EMAIL_PROVIDER: "resend", VII_QUALITY_EMAIL_API_KEY: "secret" }), "incomplete_configuration");
  assert.equal(qualityNotificationProviderStatus({
    VII_QUALITY_EMAIL_PROVIDER: "resend", VII_QUALITY_EMAIL_API_KEY: "secret",
    VII_QUALITY_EMAIL_FROM: "VII QA <qa@example.test>", VII_QUALITY_EMAIL_RECIPIENTS: "adir@example.test,liran@example.test",
  }), "configured");
});
