import test from 'node:test';
import assert from 'node:assert/strict';
import {qualityGateway} from '../services/vii-edge-delivery/src/quality-gateway.ts';

const post=(options={})=>new Request(options.url||'https://vii.spaplus.co/api/admin/quality',{method:'POST',headers:{cookie:'synthetic_session=fixture',origin:options.origin||'https://vii.spaplus.co','content-type':'application/json',...options.headers},body:JSON.stringify({action:'enqueue',idempotencyKey:'fixture-key-1',level:'full'})});
test('disabled or unrelated routes retain the existing edge path and make no authorization request',async()=>{
 const fetcher=async()=>{throw Error('must not call')};assert.equal(await qualityGateway(post(),{},fetcher),null);assert.equal(await qualityGateway(post({url:'https://vii.spaplus.co/api/admin/other'}),{QUALITY_CONTROL_ENABLED:'true'},fetcher),null);
});
test('gateway binds canonical body and target, sends cookies solely to the fixed source, and forwards no secrets to the private controller',async()=>{
 let source,privateRequest;const env={QUALITY_CONTROL_ENABLED:'true',QUALITY_CONTROL:{async fetch(r){privateRequest=r;return new Response('{"ok":true}',{headers:{'Set-Cookie':'must-not-forward=1','X-VII-Edge-Delivery':'HIT'}})}}};
 const response=await qualityGateway(post(),env,async r=>{source=r;const body=await r.json();assert.equal(body.path,'/api/admin/quality');assert.equal(body.method,'POST');assert.match(body.bodyHash,/^[a-f0-9]{64}$/);return Response.json({token:'synthetic-signed-token'})});
 assert.equal(response.status,200);assert.equal(source.url,'https://vii.spaplus.co/api/admin/quality-attestation');assert.equal(source.headers.get('cookie'),'synthetic_session=fixture');assert.equal(privateRequest.headers.get('cookie'),null);assert.equal(privateRequest.headers.get('authorization'),null);assert.equal(privateRequest.headers.get('X-VII-Quality-Attestation'),'synthetic-signed-token');assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('X-VII-Edge-Delivery'),null);assert.equal(response.headers.get('cache-control'),'private, no-store');
});
test('cross-origin writes and missing bindings fail closed before source or private calls',async()=>{
 let called=0;const source=async()=>{called++;return Response.json({})};const env={QUALITY_CONTROL_ENABLED:'true',QUALITY_CONTROL:{fetch:source}};
 assert.equal((await qualityGateway(post({origin:'https://evil.example'}),env,source)).status,403);assert.equal((await qualityGateway(post(),{QUALITY_CONTROL_ENABLED:'true'},source)).status,503);assert.equal(called,0);
});
test('source refusal is not retried and cannot invoke the controller',async()=>{
 let sourceCalls=0,privateCalls=0;const response=await qualityGateway(post(),{QUALITY_CONTROL_ENABLED:'true',QUALITY_CONTROL:{async fetch(){privateCalls++;return Response.json({})}}},async()=>{sourceCalls++;return new Response('private authorization failure',{status:403})});assert.equal(response.status,403);assert.equal(sourceCalls,1);assert.equal(privateCalls,0);assert.deepEqual(await response.json(),{error:'forbidden'});
});
test('evidence GET admits only bounded private JPEG and strips downstream headers',async()=>{
 const request=new Request('https://vii.spaplus.co/api/admin/quality?evidence=1&jobId=job-1234',{method:'GET',headers:{cookie:'synthetic_session=fixture'}});
 const env={QUALITY_CONTROL_ENABLED:'true',QUALITY_CONTROL:{async fetch(){return new Response(new Uint8Array([255,216,255,217]),{headers:{'Content-Type':'image/jpeg','Content-Length':'4','Set-Cookie':'nope','X-VII-Leak':'no'}})}}};
 const response=await qualityGateway(request,env,async r=>{const body=await r.json();assert.equal(body.method,'GET');assert.equal(body.path,'/api/admin/quality?evidence=1&jobId=job-1234');return Response.json({token:'synthetic-signed-token'});});
 assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/jpeg');assert.equal(response.headers.get('content-length'),'4');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('x-vii-leak'),null);
});
test('evidence GET rejects non-JPEG and oversized downstream responses',async()=>{
 const request=new Request('https://vii.spaplus.co/api/admin/quality?evidence=1&jobId=job-1234',{headers:{cookie:'synthetic_session=fixture'}});
 const source=async()=>Response.json({token:'synthetic-signed-token'});
 const bad={QUALITY_CONTROL_ENABLED:'true',QUALITY_CONTROL:{async fetch(){return new Response('x',{headers:{'Content-Type':'application/json','Content-Length':'1'}})}}};
 assert.equal((await qualityGateway(request,bad,source)).status,502);
 const large={QUALITY_CONTROL_ENABLED:'true',QUALITY_CONTROL:{async fetch(){return new Response('x',{headers:{'Content-Type':'image/jpeg','Content-Length':'1000001'}})}}};
 assert.equal((await qualityGateway(request,large,source)).status,502);
});
