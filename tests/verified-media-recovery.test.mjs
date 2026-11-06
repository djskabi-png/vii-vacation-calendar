import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {servePublicGalleryMedia} from '../worker/public-gallery-media.ts';
import manifest from '../app/data/verified-media-recovery.json' with {type:'json'};
const absent={get:async()=>null};
for(const file of manifest.files)test(`exact missing supplier image ${file.filename} recovers with verified bytes and HEAD`,async()=>{
 const bytes=readFileSync(new URL('../public'+file.path,import.meta.url));assert.equal(bytes.length,file.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);assert.equal(bytes.subarray(0,3).toString('hex'),'ffd8ff');
 const seen=[];const assets={fetch:async request=>{seen.push(request);return new Response(bytes,{headers:{'Content-Type':file.contentType,'Content-Length':String(bytes.length)}})}};
 const response=await servePublicGalleryMedia(new Request('https://vii.spaplus.co/api/vii/media/'+file.filename,{headers:{Cookie:'private=must-not-forward'}}),absent,assets);
 assert.equal(response.status,200);assert.equal(response.headers.get('X-VII-Media'),'recovered');assert.equal(response.headers.get('Content-Type'),'image/jpeg');assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);assert.equal(seen[0].headers.get('Cookie'),null);assert.equal(seen[0].url,'https://vii.spaplus.co'+file.path);
 const head=await servePublicGalleryMedia(new Request('https://vii.spaplus.co/api/vii/media/'+file.filename,{method:'HEAD'}),absent,assets);assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('Content-Length'),String(file.bytes));
});
test('existing R2 object remains primary and never requests recovery',async()=>{
 let reads=0;const bucket={get:async()=>({body:'stored',httpMetadata:{contentType:'image/jpeg'}})};
 const response=await servePublicGalleryMedia(new Request('https://vii.spaplus.co/api/vii/media/'+manifest.files[0].filename),bucket,{fetch:async()=>{reads++;throw Error('must not read')}});
 assert.equal(await response.text(),'stored');assert.equal(response.headers.get('X-VII-Media'),'stored');assert.equal(reads,0);
});
test('recovery rejects wrong image bytes and unknown paths without origin or object writes',async()=>{
 const file=manifest.files[0];const bytes=readFileSync(new URL('../public'+file.path,import.meta.url));bytes[50]^=1;
 const response=await servePublicGalleryMedia(new Request('https://vii.spaplus.co/api/vii/media/'+file.filename),absent,{fetch:async()=>new Response(bytes,{headers:{'Content-Type':file.contentType}})});assert.equal(response.status,404);
 let reads=0;const unknown=await servePublicGalleryMedia(new Request('https://vii.spaplus.co/api/vii/media/not-approved.jpg'),absent,{fetch:async()=>{reads++;throw Error('must not read')}});assert.equal(unknown.status,404);assert.equal(reads,0);
});
