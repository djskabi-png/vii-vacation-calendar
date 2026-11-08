import test from 'node:test';
import assert from 'node:assert/strict';
import {servePublicGalleryMedia} from '../worker/public-gallery-media.ts';
import {validGalleryFilename, PUBLIC_GALLERY_OBJECT_PREFIX} from '../app/lib/gallery-media-identity.ts';
import manifest from '../app/data/legacy-gallery-media.json' with {type:'json'};

test('newly accepted immutable objects work before a new static media manifest is built',async()=>{
 const filename='accepted-after-bundle-20261108.JPG';assert.equal(manifest.files.includes(filename),false);
 const reads=[];const bucket={get:async key=>{reads.push(key);return{body:'verified-image-bytes',httpMetadata:{contentType:'IMAGE/JPEG; charset=binary'},httpEtag:'exact-object'};}};
 for(const method of ['GET','HEAD']){
  const r=await servePublicGalleryMedia(new Request('https://vii.spaplus.co/api/vii/media/'+filename,{method}),bucket);
  assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/jpeg');assert.equal(r.headers.get('x-vii-media'),'stored');
  assert.equal(await r.text(),method==='HEAD'?'':'verified-image-bytes');
 }
 assert.deepEqual(reads,['legacy-gallery/v1/'+filename,'legacy-gallery/v1/'+filename]);
});

test('unsafe media identities cannot read storage and all previous accepted identities remain valid',async()=>{
 assert.equal(PUBLIC_GALLERY_OBJECT_PREFIX, manifest.objectPrefix);
 let reads=0;const bucket={get:async()=>{reads++;throw Error('must not read');}};
 for(const value of ['bad%2fpath.jpg','%2e%2e%2fprivate.jpg','bad%5cpath.JPG','bad.svg','name..jpg','%GG.jpg']){
  const r=await servePublicGalleryMedia(new Request('https://vii.spaplus.co/api/vii/media/'+value,{method:'HEAD'}),bucket);assert.equal(r.status,404);assert.equal(await r.text(),'');
 }
 assert.equal(reads,0);assert.deepEqual(manifest.files.filter(name=>!validGalleryFilename(name)),[]);
});

test('responsive derivatives share the fixed public namespace and raster metadata policy',async()=>{
 const {optimizedMediaSource,localGalleryFilename}=await import('../worker/optimized-media-source.ts');
 assert.equal(localGalleryFilename('/api/vii/media/'+'a'.repeat(256)+'.jpg'),null);
 const reads=[];const bucket={get:async key=>{reads.push(key);return{body:'stored',httpMetadata:{contentType:'IMAGE/JPEG; charset=binary'}};}};
 const response=await optimizedMediaSource('/api/vii/media/new-safe.jpg',bucket);
 assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/jpeg');
 assert.deepEqual(reads,['legacy-gallery/v1/new-safe.jpg']);
 for(const type of ['image/svg+xml','application/json',undefined]){
  const r=await optimizedMediaSource('/api/vii/media/new-safe.jpg',{get:async()=>({body:'not an image',httpMetadata:{contentType:type}})});
  assert.equal(r.status,404);assert.equal(r.headers.get('cache-control'),'no-store');
 }
});

test('public fast path rejects non-raster metadata and retains truthful absent/storage states',async()=>{
 for(const contentType of ['image/svg+xml','text/html','application/json',undefined]){
  const r=await servePublicGalleryMedia(new Request('https://vii.spaplus.co/api/vii/media/fake.jpg'),{get:async()=>({body:'not an image',httpMetadata:{contentType}})});
  assert.equal(r.status,404);assert.equal(r.headers.get('cache-control'),'no-store');assert.doesNotMatch(await r.text(),/not an image/);
 }
 const missing=await servePublicGalleryMedia(new Request('https://vii.spaplus.co/api/vii/media/unregistered.jpg'),{get:async()=>null});assert.equal(missing.status,404);
 const failure=await servePublicGalleryMedia(new Request('https://vii.spaplus.co/api/vii/media/new.jpg'),{get:async()=>{throw Error('private details');}});assert.equal(failure.status,503);assert.doesNotMatch(await failure.text(),/private details/);
});
