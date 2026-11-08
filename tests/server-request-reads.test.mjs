import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes,createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {withServerRequestReads,readOnceInServerRequest} from '../app/lib/server-request-reads.ts';

test('concurrent requests share work only within their own async context and the next request rereads',async()=>{
 let calls=0;const request=label=>withServerRequestReads(async()=>{const load=async()=>{calls++;await new Promise(r=>setTimeout(r,2));return label};const values=await Promise.all([readOnceInServerRequest('same-key',load),readOnceInServerRequest('same-key',load)]);assert.deepEqual(values,[label,label]);});
 await Promise.all([request('first'),request('second')]);assert.equal(calls,2);await request('third');assert.equal(calls,3);
 await readOnceInServerRequest('same-key',async()=>++calls);await readOnceInServerRequest('same-key',async()=>++calls);assert.equal(calls,5);
});
test('a failed read is retained only for that request and the memory cap never removes requested information',async()=>{
 let failures=0;await withServerRequestReads(async()=>{const bad=()=>{failures++;return Promise.reject(Error('request failure'))};await assert.rejects(readOnceInServerRequest('failed',bad));await assert.rejects(readOnceInServerRequest('failed',bad));});assert.equal(failures,1);
 assert.equal(await withServerRequestReads(()=>readOnceInServerRequest('failed',async()=> 'fresh')), 'fresh');
 await withServerRequestReads(async()=>{for(let i=0;i<40;i++)assert.equal(await readOnceInServerRequest(`key-${i}`,async()=>i),i);});
});
test('actual published metadata read keeps publication precedence and halves duplicate SSR SQL reads without retaining the next generation',async()=>{
 const source=readFileSync(new URL('../app/lib/search-page-content.ts',import.meta.url),'utf8');const start=source.indexOf('export async function publishedSearchPage('),end=source.indexOf('\nexport async function searchPageInventory',start);const js=stripTypeScriptTypes(source.slice(start,end),{mode:'strip'}).replace(/^export /,'');
 const sqlite=new DatabaseSync(':memory:');sqlite.exec("CREATE TABLE vii_search_page_opportunities(canonical_path TEXT,title TEXT,meta_description TEXT,robots_index INTEGER,status TEXT,scheduled_at TEXT,version INTEGER);CREATE TABLE vii_search_page_versions(path TEXT,title TEXT,description TEXT,status TEXT,scheduled_at TEXT,version INTEGER)");let reads=0;
 const db={prepare(sql){let args=[];const q={bind(...values){args=values;return q},async first(){reads++;return sqlite.prepare(sql).get(...args)||null}};return q;}};
 const read=new Function('readOnceInServerRequest','searchPageDefinition','db','publicSearchContent',`${js};return publishedSearchPage`)(readOnceInServerRequest,path=>({path,title:'Definition',description:'Default description'}),async()=>db,async path=>db.prepare("SELECT title, meta_description AS metaDescription FROM vii_search_page_opportunities WHERE canonical_path = ? AND status = 'published'").bind(path).first());
 try{
 sqlite.prepare('INSERT INTO vii_search_page_versions VALUES(?,?,?,?,?,?)').run('/spas','Published version','Description','published',null,1);sqlite.prepare('INSERT INTO vii_search_page_versions VALUES(?,?,?,?,?,?)').run('/spas','Future version','Description','scheduled','2099-01-01',2);
 await withServerRequestReads(async()=>{const [metadata,page]=await Promise.all([read('/spas'),read('/spas')]);assert.equal(metadata.title,'Published version');assert.deepEqual(page,metadata);});assert.equal(reads,2);
 sqlite.prepare('INSERT INTO vii_search_page_opportunities VALUES(?,?,?,?,?,?,?)').run('/spas','New managed publication','Managed description',1,'published',null,3);
 const next=await withServerRequestReads(()=>read('/spas'));assert.equal(next.title,'New managed publication');assert.equal(reads,3);
 }finally{sqlite.close();}
});
test('request isolation executes under the bundled Worker runtime, not only Node async hooks',{timeout:20000},async()=>{
 const require=createRequire(import.meta.url);const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite/package.json')]}));const {Miniflare,Log,LogLevel}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}));
 const result=await build({stdin:{contents:`import{withServerRequestReads,readOnceInServerRequest}from'./app/lib/server-request-reads.ts';export default{async fetch(request){return withServerRequestReads(async()=>{let calls=0;const id=new URL(request.url).searchParams.get('id');const read=()=>{calls++;return Promise.resolve(id)};const values=await Promise.all([readOnceInServerRequest('shared',read),readOnceInServerRequest('shared',read)]);return Response.json({calls,values})})}}`,resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'esm',platform:'browser',write:false,external:['node:async_hooks']});
 const mf=new Miniflare({log:new Log(LogLevel.WARN),modules:[{type:'ESModule',path:'request-read-fixture.mjs',contents:result.outputFiles[0].text}],compatibilityDate:'2026-05-22',compatibilityFlags:['nodejs_compat']});
 try{const responses=await Promise.all(['one','two'].map(id=>mf.dispatchFetch(`https://fixture.invalid/?id=${id}`).then(r=>r.json())));assert.deepEqual(responses,[{calls:1,values:['one','one']},{calls:1,values:['two','two']}]);}finally{await mf.dispose();}
});
