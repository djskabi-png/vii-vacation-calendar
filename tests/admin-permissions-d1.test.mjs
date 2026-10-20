import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { adminUsersHandler } from '../app/lib/admin-users-handler.ts';
import { authorizedAdminSession } from '../app/lib/admin-session.ts';
import { adminGrantSchema, ensureAdminGrantSchema, resolveAdminAccess, readAdminGrant } from '../app/lib/admin-grants.ts';
import { createSignedValue, SESSION_COOKIE } from '../app/lib/google-auth.ts';
const require=createRequire(import.meta.url),dependency=createRequire(require.resolve('wrangler'));
const {Miniflare}=dependency('miniflare');
const origin='https://synthetic.example.test',secret='synthetic-only-access-session-secret-at-least-32';
async function request(email,method='GET',body,requestOrigin=origin,subject=`google:${email}`){
  const token=await createSignedValue({email,sub:subject,name:'Synthetic QA',provider:'google',exp:Math.floor(Date.now()/1000)+600},secret);
  return new Request(origin+'/api/admin/users',{method,headers:{cookie:`${SESSION_COOKIE}=${encodeURIComponent(token)}`,...(requestOrigin?{origin:requestOrigin}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
}
test('actual D1 users handler persists grant/audit, pins Google identity, enforces origin and revokes existing sessions',{timeout:30000},async()=>{
  process.env.VII_ADMIN_EMAILS='owner@example.test,second-owner@example.test';delete process.env.VII_ADMIN_EMAILS_EXTRA;process.env.VII_ACCESS_MANAGER_EMAILS='owner@example.test,second-owner@example.test';process.env.VII_AUTH_SECRET=secret;
  const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("synthetic-only")}}',compatibilityDate:'2026-05-15',d1Databases:{DB:'synthetic-admin-access'}});
  try{
    const db=await mf.getD1Database('DB');
    await db.prepare(adminGrantSchema[0].replace(', google_sub TEXT','')).run();
    await ensureAdminGrantSchema(db);await ensureAdminGrantSchema(db);
    assert.ok((await db.prepare('PRAGMA table_info(vii_admin_grants)').all()).results.some(c=>c.name==='google_sub'));
    const handlers=adminUsersHandler({authorize:r=>authorizedAdminSession(r,undefined,async()=>db),database:async()=>db});
    const change={email:'member@example.test',name:'Synthetic Member',active:true,manageUsers:false,permissions:{content:'view'},version:0,confirmed:true};
    for(const badOrigin of [null,'https://attacker.example.test'])assert.equal((await handlers.POST(await request('owner@example.test','POST',change,badOrigin))).status,403);
    assert.equal((await handlers.GET(new Request(origin+'/api/admin/users'))).status,403);
    const saved=await handlers.POST(await request('owner@example.test','POST',change));assert.equal(saved.status,200);
    const receipt=await saved.json();assert.equal(receipt.grant.identityBound,false);assert.ok(receipt.auditId);
    const persisted=await db.prepare('SELECT * FROM vii_admin_grants WHERE email=?').bind(change.email).first();assert.equal(persisted.version,1);assert.equal(persisted.google_sub,null);
    assert.equal(await resolveAdminAccess(change.email,async()=>db),null);
    const session=await request(change.email);
    assert.equal((await handlers.GET(session.clone())).status,403);
    const bound=await readAdminGrant(db,change.email);assert.equal(bound.identityBound,true);assert.equal(bound.version,2);
    assert.equal((await handlers.GET(await request(change.email,'GET',undefined,origin,'a-different-google-sub'))).status,403);
    const fresh=await (await handlers.GET(await request('second-owner@example.test'))).json();assert.equal(fresh.audit.length,2);assert.ok(fresh.audit.some(a=>a.id===receipt.auditId));
    assert.equal((await handlers.POST(await request('owner@example.test','POST',change))).status,409);
    const revoked=await handlers.POST(await request('owner@example.test','POST',{...change,version:bound.version,active:false}));assert.equal(revoked.status,200);
    assert.equal((await handlers.GET(session.clone())).status,403);
    assert.equal((await handlers.GET(await request(change.email,'GET',undefined,origin,'a-different-google-sub'))).status,403);
    const audit=await db.prepare('SELECT action FROM vii_admin_grant_audit ORDER BY created_at').all();assert.deepEqual(audit.results.map(r=>r.action),['grant','identity_bound','revoke']);
  }finally{await mf.dispose();}
});
