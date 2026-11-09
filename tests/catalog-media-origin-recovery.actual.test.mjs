import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {catalogReferencesGallery,recoverCatalogMedia} from '../app/lib/catalog-media-origin-recovery.ts';
import {servePublicGalleryMedia} from '../worker/public-gallery-media.ts';
import {optimizedMediaSource} from '../worker/optimized-media-source.ts';

const photo=Uint8Array.from([255,216,255,...Array(61).fill(7)]);
const request=(file='new.jpg',method='GET')=>new Request('https://vii.spaplus.co/api/vii/media/'+file,{method});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function database(summary={images:['/api/vii/media/new.jpg']},active=true){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec('CREATE TABLE supplier_catalog_state(world TEXT,active_run_id TEXT);CREATE TABLE supplier_catalog_entries(world TEXT,run_id TEXT,summary_json TEXT,detail_json TEXT);');
 sqlite.prepare('INSERT INTO supplier_catalog_state VALUES (?,?)').run('rooms','current');
 sqlite.prepare('INSERT INTO supplier_catalog_entries VALUES (?,?,?,?)').run('rooms',active?'current':'old',JSON.stringify(summary),null);
 return {prepare(sql){const statement=sqlite.prepare(sql);return{bind(...values){return{all:async()=>({results:statement.all(...values)})}}}}};
}
function bucket(){
 const data=new Map(),puts=[];
 return{data,puts,async get(key){const v=data.get(key);return v?{size:v.bytes.length,body:new Blob([v.bytes]).stream(),httpMetadata:{contentType:v.type},httpEtag:'"stored"'}:null},async put(key,bytes,options){puts.push({key,options});assert.equal(options.onlyIf.get('If-None-Match'),'*');if(data.has(key))return null;data.set(key,{bytes:Uint8Array.from(bytes),type:options.httpMetadata.contentType});return{httpEtag:'"new"'}}};
}
const image=()=>new Response(photo,{headers:{'Content-Type':'image/jpeg','Content-Length':String(photo.length)}});

test('recovery diagnostics distinguish catalog, source status and conditional storage without logging raw errors',async t=>{
 const logs=[];t.mock.method(console,'error',(...args)=>logs.push(args));
 const db=database();
 await assert.rejects(()=>recoverCatalogMedia(request(),'new.jpg',{DB:{prepare(){throw Error('secret-token=never-log')}},UPLOADS:bucket()},async()=>image()));
 await assert.rejects(()=>recoverCatalogMedia(request(),'new.jpg',{DB:db,UPLOADS:bucket()},async()=>new Response('blocked',{status:403})));
 const b=bucket();b.put=async()=>{throw Error('private-password=never-log')};
 await assert.rejects(()=>recoverCatalogMedia(request(),'new.jpg',{DB:db,UPLOADS:b},async()=>image()));
 assert.deepEqual(logs.map(x=>x[1].stage),['catalog','source-fetch','r2-conditional-write']);
 assert.deepEqual(logs.map(x=>x[1].code),['operation_failed','source_http_403','operation_failed']);
 assert.ok(logs.every(x=>x[0]==='[VII_MEDIA_RECOVERY_FAILURE]'));
 assert.doesNotMatch(JSON.stringify(logs),/secret-token|private-password|never-log/);
});

test('public Worker GET and HEAD import an accepted missing image through the shared authority',async t=>{
 const b=bucket(),db=database();let reads=0;
 t.mock.method(globalThis,'fetch',async(url,options)=>{reads++;assert.equal(url,'https://www.vii.co.il/gallery/new.jpg');assert.equal(options.headers.Cookie,undefined);return image()});
 const result=await servePublicGalleryMedia(request(),b,undefined,db);
 assert.equal(result.status,200);assert.equal(result.headers.get('X-VII-Media'),'catalog-imported');assert.deepEqual(new Uint8Array(await result.arrayBuffer()),photo);
 const head=await servePublicGalleryMedia(request('new.jpg','HEAD'),b,undefined,db);
 assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(reads,1);assert.equal(b.puts.length,1);
});

test('Worker derivative source imports accepted bytes and rejects unreferenced filenames without a fetch',async t=>{
 const b=bucket(),db=database();let reads=0;
 t.mock.method(globalThis,'fetch',async()=>{reads++;return image()});
 const result=await optimizedMediaSource('/api/vii/media/new.jpg',b,undefined,db);
 assert.equal(result.status,200);assert.deepEqual(new Uint8Array(await result.arrayBuffer()),photo);
 const missing=await optimizedMediaSource('/api/vii/media/unknown.jpg',b,undefined,db);
 assert.equal(missing.status,404);assert.equal(reads,1);assert.equal(b.puts.length,1);
});

test('a failed catalog authority becomes retryable Worker 503 without source fetch or write',async t=>{
 const b=bucket();let reads=0;
 t.mock.method(globalThis,'fetch',async()=>{reads++;return image()});
 const result=await servePublicGalleryMedia(request(),b,undefined,{prepare(){throw Error('database unavailable')}});
 assert.equal(result.status,503);assert.equal(result.headers.get('Cache-Control'),'no-store');assert.equal(reads,0);assert.equal(b.puts.length,0);
});

test('SQL authorization excludes previous generations, descriptions and foreign origins',async()=>{
 assert.equal(await catalogReferencesGallery(database(undefined,false),'new.jpg'),false);
 assert.equal(await catalogReferencesGallery(database({description:'/api/vii/media/new.jpg'}),'new.jpg'),false);
 assert.equal(await catalogReferencesGallery(database({images:['https://evil.example/gallery/new.jpg']}),'new.jpg'),false);
 assert.equal(await catalogReferencesGallery(database({rooms:[{id:12,images:['/api/vii/media/new.jpg']}]}),'new.jpg'),true);
 assert.equal(await catalogReferencesGallery(database(),'../new.jpg'),false);
});
test('authorization cache never crosses database bindings',async()=>{
 assert.equal(await catalogReferencesGallery(database(),'new.jpg'),true);
 assert.equal(await catalogReferencesGallery(database({images:[]}),'new.jpg'),false);
});
test('an unreferenced filename makes no source request or storage write',async()=>{
 const b=bucket();let fetches=0;
 assert.equal(await recoverCatalogMedia(request('other.jpg'),'other.jpg',{DB:database(),UPLOADS:b},async()=>{fetches++;return image()}),null);
 assert.equal(fetches,0);assert.equal(b.puts.length,0);
});
test('imports exact bytes from the fixed origin with SHA and conditional create',async()=>{
 const b=bucket();const response=await recoverCatalogMedia(request(),'new.jpg',{DB:database(),UPLOADS:b},async(url,options)=>{
  assert.equal(url,'https://www.vii.co.il/gallery/new.jpg');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');assert.ok(options.signal);return image();
 });
 assert.deepEqual(new Uint8Array(await response.arrayBuffer()),photo);assert.equal(response.headers.get('X-VII-Media'),'catalog-imported');
 assert.match(b.puts[0].options.customMetadata.sha256,/^[a-f0-9]{64}$/);assert.equal(b.puts[0].key,'legacy-gallery/v1/new.jpg');
});
test('HEAD coalesces with GET without sharing a consumed response body',async()=>{
 const b=bucket(),env={DB:database(),UPLOADS:b};let release,fetches=0;const gate=new Promise(resolve=>release=resolve);
 const fetcher=async()=>{fetches++;await gate;return image()};
 const head=recoverCatalogMedia(request('new.jpg','HEAD'),'new.jpg',env,fetcher);
 const get=recoverCatalogMedia(request(),'new.jpg',env,fetcher);
 await tick();assert.equal(fetches,1);release();const [h,g]=await Promise.all([head,get]);
 assert.equal((await h.arrayBuffer()).byteLength,0);assert.equal(h.headers.get('Content-Length'),String(photo.length));
 assert.deepEqual(new Uint8Array(await g.arrayBuffer()),photo);assert.equal(b.puts.length,1);
});
test('a stored image is served without fetching or overwriting the origin',async()=>{
 const b=bucket();b.data.set('legacy-gallery/v1/new.jpg',{bytes:photo,type:'image/jpeg'});
 const response=await recoverCatalogMedia(request(),'new.jpg',{DB:database(),UPLOADS:b},async()=>{throw Error('unexpected source fetch')});
 assert.equal(response.status,200);assert.equal(b.puts.length,0);
});
test('only two transfers run while a third waits and then completes',async()=>{
 const b=bucket(),env={DB:database({images:['a.jpg','b.jpg','c.jpg'].map(x=>'/api/vii/media/'+x)}),UPLOADS:b};let fetches=0,third;const releases=[];
 const thirdStarted=new Promise(resolve=>third=resolve);
 const fetcher=async()=>{fetches++;if(fetches===3)third();await new Promise(resolve=>releases.push(resolve));return image()};
 const jobs=['a.jpg','b.jpg','c.jpg'].map(f=>recoverCatalogMedia(request(f),f,env,fetcher));
 await tick();assert.equal(fetches,2);releases.shift()();
 let timer;try{await Promise.race([thirdStarted,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('third transfer did not start')),1000))]);assert.equal(fetches,3);}finally{clearTimeout(timer);releases.splice(0).forEach(r=>r());}
 assert.equal((await Promise.all(jobs)).filter(Boolean).length,3);
});
test('rejects mislabeled HTML, a redirect and an oversized declared body without PUT',async()=>{
 for(const reply of [()=>new Response('<html>not an image</html>',{headers:{'Content-Type':'image/jpeg'}}),()=>new Response(null,{status:302,headers:{Location:'https://evil.example/'}}),()=>new Response(photo,{headers:{'Content-Type':'image/jpeg','Content-Length':'8000001'}})]){
  const b=bucket();await assert.rejects(()=>recoverCatalogMedia(request(),'new.jpg',{DB:database(),UPLOADS:b},async()=>reply()));assert.equal(b.puts.length,0);
 }
});
test('enforces the streaming limit even when content-length is absent',async()=>{
 const b=bucket();let canceled=false;
 const stream=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(1_000_000))},cancel(){canceled=true}});
 await assert.rejects(()=>recoverCatalogMedia(request(),'new.jpg',{DB:database(),UPLOADS:b},async()=>new Response(stream,{headers:{'Content-Type':'image/jpeg'}})),/too_large/);
 assert.equal(canceled,true);assert.equal(b.puts.length,0);
});
test('a conditional race reads the winner without a second PUT',async()=>{
 const b=bucket(),winner=photo.map((x,i)=>i>5?9:x);let calls=0;
 b.put=async(key,bytes,options)=>{calls++;assert.equal(options.onlyIf.get('If-None-Match'),'*');b.data.set(key,{bytes:winner,type:'image/jpeg'});return null};
 const response=await recoverCatalogMedia(request(),'new.jpg',{DB:database(),UPLOADS:b},async()=>image());
 assert.deepEqual(new Uint8Array(await response.arrayBuffer()),winner);assert.equal(calls,1);
});
test('an uncertain PUT is resolved by the next read, without blindly writing again',async()=>{
 const b=bucket(),env={DB:database(),UPLOADS:b};let puts=0,fetches=0;
 b.put=async(key,bytes)=>{puts++;b.data.set(key,{bytes:Uint8Array.from(bytes),type:'image/jpeg'});throw Error('transport outcome uncertain')};
 const fetcher=async()=>{fetches++;return image()};
 await assert.rejects(()=>recoverCatalogMedia(request(),'new.jpg',env,fetcher),/uncertain/);
 const response=await recoverCatalogMedia(request(),'new.jpg',env,fetcher);
 assert.deepEqual(new Uint8Array(await response.arrayBuffer()),photo);assert.equal(puts,1);assert.equal(fetches,1);
});
