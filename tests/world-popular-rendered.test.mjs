import assert from 'node:assert/strict';
import test from 'node:test';
import {popularSearchWorlds} from '../app/lib/world-popular-search-defaults.ts';
const built=import(new URL('../dist/server/index.js',import.meta.url).href);
async function render(path){const {default:worker}=await built;return worker.fetch(new Request('https://vii.spaplus.co'+path),{ASSETS:{fetch:async()=>new Response('Not found',{status:404})}},{waitUntil(p){p.catch(()=>{})},passThroughOnException(){}})}
test('built world APIs isolate every configured default and reject unsupported worlds',async()=>{
 for(const world of popularSearchWorlds){const response=await render('/api/vii/homepage-presentation?world='+world.id);assert.equal(response.status,200,world.id);const body=await response.json();assert.equal(body.popular[0].action,'nearby',world.id);const href=new URL(body.popular[0].href,'https://vii.invalid');assert.equal(href.pathname,new URL(world.href,'https://vii.invalid').pathname,world.id);}
 assert.equal((await render('/api/vii/homepage-presentation?world=not-a-world')).status,400);
});
test('new spa semantic pages render real source matches and no fabricated whole-country city path',async()=>{
 for(const [path,title] of [['/spas/spa-with-lodging','ספא עם לינה'],['/spas/spa-hourly-room','ספא עם חדר לפי שעה']]){
 const response=await render(path);assert.equal(response.status,200);const html=await response.text();assert.ok(html.includes(title));assert.ok(html.includes('popular-searches-spa-track'));assert.ok(!html.includes('city-kl-harz'),path);assert.match(html,/discover\/place\/spa-\d+/);
 }
});

test('every default popular-search destination resolves to a real built page',async()=>{
 const {popularSearchesForWorld}=await import('../app/lib/world-popular-search-defaults.ts');const {parseHomepagePresentation}=await import('../app/lib/homepage-presentation.ts');const paths=[...new Set(popularSearchWorlds.flatMap(world=>[...popularSearchesForWorld(world.id),...parseHomepagePresentation(undefined,world.id).popular].map(item=>item.href)))];
 for(let start=0;start<paths.length;start+=4)await Promise.all(paths.slice(start,start+4).map(async path=>{
  let response=await render(path),hops=0;while(response.status>=300&&response.status<400&&hops++<3){const next=new URL(response.headers.get('location'),'https://vii.spaplus.co');response=await render(next.pathname+next.search)}
  assert.equal(response.status,200,path);const html=(await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');assert.ok(!html.includes('העמוד שחיפשתם לא נמצא'),path);assert.ok(!html.includes('העמוד לא נטען במלואו'),path);
 }));
});
