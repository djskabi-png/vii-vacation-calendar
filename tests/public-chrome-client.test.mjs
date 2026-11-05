import test from 'node:test';
import assert from 'node:assert/strict';
import {publicChrome} from '../app/lib/public-chrome-client.ts';

test('header and footer share one public request while aborting one does not cancel the other',async(t)=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original});let calls=0,finish,networkSignal;
 globalThis.fetch=async(url,init)=>{calls++;networkSignal=init.signal;return new Promise(resolve=>{finish=()=>resolve(Response.json({primary:[],service:[]}))})};
 const header=new AbortController(),footer=new AbortController();
 const a=publicChrome('he',header.signal);const b=publicChrome('he',footer.signal);
 assert.equal(calls,1);header.abort();await assert.rejects(a,{name:'AbortError'});assert.equal(networkSignal.aborted,false);
 finish();assert.deepEqual(await b,{primary:[],service:[]});assert.equal(calls,1);
 globalThis.fetch=async()=>{calls++;return Response.json({primary:[],service:[]})};
 await publicChrome('he');assert.equal(calls,2,'completed data has no extra application-cache lifetime');
});

test('unmounting all consumers cancels their shared request and a new navigation starts cleanly',async(t)=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original});let calls=0;
 globalThis.fetch=async(_url,init)=>{calls++;return new Promise((_resolve,reject)=>{init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true})})};
 const one=new AbortController(),two=new AbortController();const a=publicChrome('fr',one.signal),b=publicChrome('fr',two.signal);
 one.abort();two.abort();await Promise.all([assert.rejects(a),assert.rejects(b)]);assert.equal(calls,1);
 globalThis.fetch=async()=>{calls++;return Response.json({worlds:[]})};assert.deepEqual(await publicChrome('fr'),{worlds:[]});assert.equal(calls,2);
});

test('locales remain independent and malformed responses cannot replace managed links',async(t)=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original});const seen=[];
 globalThis.fetch=async(url)=>{seen.push(url);return Response.json(url.endsWith('en')?{primary:'invalid'}:{primary:[]})};
 const [en,ru]=await Promise.all([publicChrome('en'),publicChrome('ru')]);assert.equal(en,null);assert.deepEqual(ru,{primary:[]});assert.equal(seen.length,2);
});
