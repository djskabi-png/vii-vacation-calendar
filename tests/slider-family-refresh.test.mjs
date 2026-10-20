import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=path=>readFileSync(new URL(`../app/${path}`,import.meta.url),'utf8');
test('every static place/trail recommendation family explicitly opts in, semantic rails do not',()=>{
 for(const path of ['business/client-page.tsx','discover/place/client-page.tsx','events/place/client-page.tsx','trails/[slug]/page.tsx','activities/page.tsx']){
   const rails=read(path).match(/<HomeMobileRail[^>]+>/g)||[];
   assert.ok(rails.length,path);
   assert.ok(rails.every(rail=>rail.includes('shufflePlaces')),path);
 }
 assert.match(read('events/page.tsx'),/<EventRail shufflePlaces warmAheadImages title=\{translate\("מקומות לאירועים"\)\}>\{eventPlaces\.map/);
 assert.match(read('events/page.tsx'),/<EventRail shufflePlaces title=\{translate\("ספקים לאירוע"\)\}/);
 assert.doesNotMatch(read('world-editorial-links.tsx'.replace(/^/,'components/')),/<HomeMobileRail shufflePlaces/);
 assert.doesNotMatch(read('events/page.tsx'),/<EventRail shufflePlaces title="סוגי מקומות/);
});
test('quote rails reuse proof and managed rank without a daily tiebreaker shadowing refresh',()=>{
 for(const path of ['components/home-live-deals.tsx','components/holiday-live-deals.tsx']){
  const source=read(path);assert.match(source,/orderDiscovery(?:Rail|Items)/);assert.match(source,/useDocumentSeed/);
  assert.match(source,/isHomeDealOnlineEligible/);assert.match(source,/managedVacationPriority/);
  assert.doesNotMatch(source,/compareVacationPriority/);
 }
 const home=read('components/home-showcase.tsx');
 assert.match(home,/const featuredHourly = orderDiscoveryRail/);
 assert.match(home,/const featuredRatings = orderDiscoveryRail/);
 assert.match(home,/const featuredTours = orderDiscoveryRail/);
});
test('document seed is shared in memory, not persisted between full loads or sent upstream',()=>{
 const seed=read('components/use-document-seed.ts');
 assert.match(seed,/let sharedDocumentSeed/);assert.match(seed,/if \(!sharedDocumentSeed\)/);
 assert.match(seed,/useState\("0"\)/);
 assert.doesNotMatch(seed,/localStorage|sessionStorage|fetch\(|cookie/);
 for(const path of ['components/home-live-deals.tsx','components/holiday-live-deals.tsx','components/spa-package-deals.tsx','components/event-last-minute.tsx']){
  const source=read(path);assert.doesNotMatch(source,/new URLSearchParams\([^;]*documentSeed/);
 }
});
