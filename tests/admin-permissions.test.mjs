import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { adminModules, adminRouteAllowed, parseAdminPermissions } from '../app/lib/admin-permissions.ts';
import { adminGrantSchema, ensureAdminGrantSchema, parseAdminGrantChange, saveAdminGrant, readAdminGrant, readAdminGrantDashboard, resolveAdminAccess } from '../app/lib/admin-grants.ts';
import { authorizedAdminSession } from '../app/lib/admin-session.ts';
import { createSignedValue, SESSION_COOKIE } from '../app/lib/google-auth.ts';

const origin = 'https://vii.spaplus.co';
const secret = 'test-only-admin-permission-secret-longer-than-32-characters';
function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  const db = { prepare(sql) {
    let args=[];
    const statement = { bind(...values){args=values;return statement;},
      async first(){return sqlite.prepare(sql).get(...args)||null;},
      async all(){return {success:true,results:sqlite.prepare(sql).all(...args)};},
      async run(){const r=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}};}
    }; return statement;
  }, async batch(statements) {sqlite.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
  for(const sql of adminGrantSchema)sqlite.exec(sql);
  return {db,sqlite};
}
function configure() {process.env.VII_ADMIN_EMAILS='owner@example.test,second-owner@example.test';process.env.VII_ADMIN_EMAILS_EXTRA='legacy@example.test';process.env.VII_ACCESS_MANAGER_EMAILS='owner@example.test,second-owner@example.test,outsider@example.test';process.env.VII_AUTH_SECRET=secret;}
const change = (overrides={}) => parseAdminGrantChange({email:'editor@example.test',name:'Test Editor',permissions:{content:'view'},active:true,manageUsers:false,version:0,confirmed:true,...overrides});
async function signed(email,path,method='GET') {
  const value=await createSignedValue({sub:`google:${email}`,email,name:'Test',provider:'google',exp:Math.floor(Date.now()/1000)+600},secret);
  return new Request(origin+path,{method,headers:{cookie:`${SESSION_COOKIE}=${encodeURIComponent(value)}`,origin}});
}

test('scope parser rejects unknown modules, escalation and invalid read-only edit levels',()=>{
  assert.equal(parseAdminPermissions({users:'edit'}),null);
  assert.equal(parseAdminPermissions({overview:'edit'}),null);
  assert.equal(parseAdminPermissions({content:'owner'}),null);
  assert.deepEqual(parseAdminPermissions({content:'view',geography:'edit'}),{content:'view',geography:'edit'});
  assert.equal(change({confirmed:false}),null);
  assert.equal(change({permissions:{}}),null);
  assert.equal(change({manageUsers:true}),null);
  assert.equal(change({email:'bad address'}),null);
});
test('every delegated module gates exact routes and verbs, technical/new routes stay owner-only',()=>{
  for(const module of adminModules){
    const viewer={fullAccess:false,manageUsers:false,permissions:{[module.id]:'view'}};
    for(const path of [...module.pages,...module.apis.map(a=>`/api/admin/${a}`)]){
      assert.equal(adminRouteAllowed(viewer,path),true,path);
      assert.equal(adminRouteAllowed(viewer,path,'POST'),false,path);
      assert.equal(adminRouteAllowed({...viewer,permissions:{[module.id]:'edit'}},path,'POST'),module.editable,path);
    }
    for(const path of ['/api/admin/users','/api/admin/source-schema-inventory','/api/admin/staging-private-health','/api/admin/new-feature','/admin/content-studio/unknown'])assert.equal(adminRouteAllowed(viewer,path),false,path);
  }
});
test('grant, audit and reload are persisted together; stale edits do not overwrite newer data',async()=>{
  configure();const f=fixture();try{
    await ensureAdminGrantSchema(f.db);
    const first=await saveAdminGrant(f.db,change(),'owner@example.test');
    assert.equal(first.grant.version,1);assert.ok(first.auditId);
    assert.equal((await readAdminGrant(f.db,'EDITOR@example.test')).permissions.content,'view');
    const fresh=await readAdminGrantDashboard(f.db);
    assert.equal(fresh.grants[0].version,1);assert.equal(fresh.audit[0].id,first.auditId);
    await assert.rejects(saveAdminGrant(f.db,change(),'owner@example.test'),{code:'version_conflict'});
    assert.equal((await readAdminGrantDashboard(f.db)).audit.length,1);
    assert.equal(await resolveAdminAccess('legacy@example.test',async()=>f.db),null);
    assert.deepEqual(await resolveAdminAccess('second-owner@example.test',async()=>f.db),{fullAccess:true,manageUsers:true,permissions:{}});
    assert.equal(await resolveAdminAccess('outsider@example.test',async()=>f.db),null);
  }finally{f.sqlite.close();}
});
test('signed viewer can read only selected API, cannot write or manage users; revoke blocks same session immediately',async()=>{
  configure();const f=fixture();try{
    await saveAdminGrant(f.db,change(),'owner@example.test');
    const req=await signed('editor@example.test','/api/admin/content-studio');
    assert.ok(await authorizedAdminSession(req,undefined,async()=>f.db));
    for(const [path,method] of [['/api/admin/content-studio','POST'],['/api/admin/whatsapp-leads','GET'],['/api/admin/users','GET'],['/api/admin/source-schema-inventory','GET']])assert.equal(await authorizedAdminSession(await signed('editor@example.test',path,method),undefined,async()=>f.db),null);
    await saveAdminGrant(f.db,change({version:2,active:false}),'owner@example.test');
    assert.equal(await authorizedAdminSession(req,undefined,async()=>f.db),null);
    assert.equal((await readAdminGrantDashboard(f.db)).audit[0].action,'revoke');
  }finally{f.sqlite.close();}
});
test('only the two configured owners can manage access; delegated accounts cannot be promoted',async()=>{
  configure();const f=fixture();try{
    for(const actor of ['legacy@example.test','outsider@example.test','editor@example.test'])await assert.rejects(saveAdminGrant(f.db,change(),actor),{code:'forbidden'});
    for(const email of ['owner@example.test','second-owner@example.test'])await assert.rejects(saveAdminGrant(f.db,change({email}),'owner@example.test'),{code:'protected_account'});
    assert.equal(change({manageUsers:true}),null);
    await saveAdminGrant(f.db,change(),'second-owner@example.test');
    const session=await signed('editor@example.test','/api/admin/content-studio');
    assert.ok(await authorizedAdminSession(session,undefined,async()=>f.db));
    assert.equal(await authorizedAdminSession(await signed('editor@example.test','/api/admin/users'),undefined,async()=>f.db),null);
    await assert.rejects(saveAdminGrant(f.db,change({version:2}),'editor@example.test'),{code:'forbidden'});
    await saveAdminGrant(f.db,change({email:'second@example.test'}),'owner@example.test');
    assert.ok(await readAdminGrant(f.db,'second@example.test'));
    const dashboard=await readAdminGrantDashboard(f.db);
    assert.deepEqual(dashboard.protectedAccounts.map((item)=>item.email),['owner@example.test','second-owner@example.test']);
  }finally{f.sqlite.close();}
});
test('audit failure rolls back the access write and unavailable storage never reuses permissions',async()=>{
  configure();const f=fixture();try{
    f.sqlite.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON vii_admin_grant_audit BEGIN SELECT RAISE(ABORT,'audit failure'); END;");
    await assert.rejects(saveAdminGrant(f.db,change(),'owner@example.test'),/audit failure/);
    assert.equal(await readAdminGrant(f.db,'editor@example.test'),null);
    assert.equal(await resolveAdminAccess('editor@example.test',async()=>{throw new Error('offline')}),null);
  }finally{f.sqlite.close();}
});
test('every admin API uses the central authorization gate and mutating routes validate origin',()=>{
  const root=new URL('../app/api/admin/',import.meta.url);
  for(const dir of readdirSync(root,{withFileTypes:true}).filter(d=>d.isDirectory())){
    const source=readFileSync(new URL(`${dir.name}/route.ts`,root),'utf8');
    assert.match(source,/authorizedAdminSession/,dir.name);
    assert.doesNotMatch(source,/isAdminEmail|readSession\(/,dir.name);
    if(source.includes('export async function POST')) {
      const mutationSource = dir.name === 'users' ? readFileSync(new URL('../app/lib/admin-users-handler.ts',import.meta.url),'utf8') : source;
      assert.match(mutationSource,/invalid_origin|origin/,dir.name);
    }
  }
});
