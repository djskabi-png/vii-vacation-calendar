import assert from 'node:assert/strict';
import {test} from 'node:test';
import {catalogNavigationFetch} from '../app/lib/catalog-navigation-fetch.ts';
import {PUBLIC_CATALOG_NAVIGATION_HEADER as header} from '../shared/public-catalog-navigation.ts';

test('actual fetch adapter annotates only fresh same-origin regional navigation and preserves every fetch option',async()=>{
 const calls=[];let fresh=true,probes=0;
 const fetch=catalogNavigationFetch(async(...args)=>{calls.push(args);return new Response('ok');},'https://vii.test',()=>{probes++;return fresh;});
 const controller=new AbortController();
 const input=new Request('https://vii.test/vacations/kinneret.rsc?guests=3&sort=price-asc',{headers:{Accept:'text/x-component',RSC:'1','Next-Url':'/vacations/north'}});
 const init={signal:controller.signal,credentials:'same-origin',cache:'default'};
 await fetch(input,init);
 assert.equal(calls[0][0],input);assert.equal(calls[0][1].signal,controller.signal);
 assert.equal(calls[0][1].credentials,init.credentials);assert.equal(calls[0][1].cache,init.cache);
 assert.equal(calls[0][1].headers.get(header),'search-v1');assert.equal(calls[0][1].headers.get('Next-Url'),'/vacations/north');
 assert.equal(input.headers.has(header),false,'original Request is never mutated');
 fresh=false;await fetch(input,init);assert.equal(calls.at(-1)[1],init,'expired/missing catalog uses original request unchanged');
 for(const [url,extra]of [
  ['https://other.test/vacations/kinneret.rsc',{}],['/api/catalog',{}],['/vacations/kinneret',{}],['/vacations/not-known.rsc',{}],
  ['/vacations/kinneret.rsc',{'Next-Router-Prefetch':'1'}],['/vacations/kinneret.rsc',{'Next-Router-Segment-Prefetch':'1'}],
  ['/vacations/kinneret.rsc',{'X-Vinext-Rsc-Render-Mode':'refresh'}],['/vacations/kinneret.rsc',{Authorization:'Bearer fixture'}],
 ]){
  const opts={headers:{Accept:'text/x-component',RSC:'1',...extra},signal:controller.signal};
  const before=probes;await fetch(url,opts);assert.equal(probes,before);assert.equal(calls.at(-1)[0],url);assert.equal(calls.at(-1)[1],opts);
 }
});

test('actual adapter respects init header overrides, methods, actions and unknown native input failures',async()=>{
 let call;const fetch=catalogNavigationFetch(async(...args)=>{call=args;return new Response('ok');},'https://vii.test',()=>true);
 const input=new Request('https://vii.test/vacations/north.rsc',{headers:{Accept:'text/x-component',RSC:'1'}});
 for(const init of [{method:'POST',body:'private'},{headers:{Accept:'text/html'}},{headers:{Accept:'text/x-component','Next-Action':'private'}}]){
  await fetch(input,init);assert.equal(call[1],init);
 }
});
