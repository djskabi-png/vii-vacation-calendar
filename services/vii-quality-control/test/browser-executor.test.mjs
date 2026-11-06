import test from 'node:test'; import assert from 'node:assert/strict';
import * as api from '../src/browser-executor.ts';
import {browserEngineVersion} from '../src/browser-profiles.ts';
const good={jobId:'job-1234',sourceSha:'a'.repeat(40),buildId:'11111111-2222-3333-4444-555555555555',profileId:'vacations-mobile-gallery-next'};
function response(value,status=200){return new Response(JSON.stringify({engineVersion:browserEngineVersion,...value}),{status,headers:{'Content-Type':'application/json'}})}
function binding(value=good){return {fetch:async(_url,init)=>{assert.equal(init.method,'POST');assert.equal(new URL(_url).pathname,'/run');assert.equal((init.headers).Authorization,undefined);return response({jobId:value.jobId,sourceVersion:value.sourceSha,buildId:value.buildId,world:'vacations',device:'mobile',scenario:'gallery-next',status:'passed',requestCount:4,steps:2,durationMs:12});}}}
test('posts fixed private contract and validates full identity',async()=>{const out=await api.executeBrowserProfile({...good,browser:binding()});assert.equal(out.status,'passed');assert.equal(out.profileId,good.profileId);});
test('rejects unsupported profile and identity mismatch',async()=>{await assert.rejects(api.executeBrowserProfile({...good,browser:{fetch:async()=>response({...good,world:'events',device:'mobile',scenario:'gallery-next',status:'passed',requestCount:0,steps:0,durationMs:0})}}),/identity_mismatch/);await assert.rejects(api.executeBrowserProfile({...good,profileId:'unknown',browser:binding()}),/unsupported/);});
test('rejects malformed status and oversized response',async()=>{const bad={...good,browser:{fetch:async()=>response({jobId:good.jobId,sourceVersion:good.sourceSha,buildId:good.buildId,world:'vacations',device:'mobile',scenario:'gallery-next',status:'mystery',requestCount:0,steps:0,durationMs:0})}};await assert.rejects(api.executeBrowserProfile(bad),/result_invalid/);const huge={...good,browser:{fetch:async()=>new Response('x'.repeat(70000),{status:200})}};await assert.rejects(api.executeBrowserProfile(huge),/response_too_large/);});
test('caller cancellation bounds an uncooperative fetch without an automatic resend',async()=>{
 const ac=new AbortController();let calls=0;const pending=api.executeBrowserProfile({...good,browser:{fetch:async()=>{calls++;return new Promise(()=>{});}},signal:ac.signal});ac.abort();await assert.rejects(pending,/cancelled/);assert.equal(calls,1);
});
test('caller cancellation also bounds a stalled response body after headers arrived',async()=>{
 const ac=new AbortController();let opened;const headers=new Promise(resolve=>opened=resolve);
 const pending=api.executeBrowserProfile({...good,browser:{fetch:async()=>{opened();return new Response(new ReadableStream({pull(){return new Promise(()=>{});}}));}},signal:ac.signal});await headers;ac.abort();await assert.rejects(pending,/cancelled/);
});
test('private evidence belongs to this exact source, job, viewport and scenario',async()=>{
 const expected=`qqqaaa/failures/${good.sourceSha}/${good.jobId}/mobile-gallery-next.jpg`;
 const payload={jobId:good.jobId,sourceVersion:good.sourceSha,buildId:good.buildId,world:'vacations',device:'mobile',scenario:'gallery-next',status:'failed',reason:'gallery_image_missing',requestCount:4,steps:2,durationMs:12,evidenceKey:expected};
 assert.equal((await api.executeBrowserProfile({...good,browser:{fetch:async()=>response(payload)}})).evidenceKey,expected);
 await assert.rejects(api.executeBrowserProfile({...good,browser:{fetch:async()=>response({...payload,evidenceKey:expected.replace(good.jobId,'other-job')})}}),/result_invalid/);
});
