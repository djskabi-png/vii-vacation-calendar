import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeHomepageSearchHref as normalize,normalizeHomepageItems} from '../app/lib/homepage-search-href.ts';
test('legacy managed pool quick search activates the actual pool query contract',()=>{
 assert.equal(normalize('/search?feature=בריכה'),'/search?pool=1');
 assert.equal(normalize('/search?feature=%D7%91%D7%A8%D7%99%D7%9B%D7%94'),'/search?pool=1');
});
test('pool shortcut preserves locale, location, dates, party, other filters and fragment',()=>{
 for(const prefix of ['','/en','/fr','/ru']){
  const href=normalize(`${prefix}/search?location=haifa&feature=בריכה&from=2026-10-20&till=2026-10-22&guests=6&online=1#results`);
  const url=new URL(href,'https://vii.invalid');
  assert.equal(url.pathname,`${prefix}/search`);assert.equal(url.searchParams.get('pool'),'1');assert.equal(url.searchParams.has('feature'),false);
  for(const [key,value] of Object.entries({location:'haifa',from:'2026-10-20',till:'2026-10-22',guests:'6',online:'1'}))assert.equal(url.searchParams.get(key),value);
  assert.equal(url.hash,'#results');
 }
});
test('explicit pool choices are not overridden',()=>{
 assert.equal(normalize('/search?pool=0&feature=בריכה'),'/search?pool=0');
 assert.equal(normalize('/search?pool=1&feature=בריכה'),'/search?pool=1');
});
test('unrelated links, arbitrary features, external links and ambiguous repeated features remain byte-identical',()=>{
 for(const href of ['/search','/search?pool=1','/search?feature=סאונה','/search?feature=בריכה&feature=סאונה','/events/search?feature=בריכה','/spas?feature=בריכה','//other.example/search?feature=בריכה','https://other.example/search?feature=בריכה'])assert.equal(normalize(href),href);
});
test('defaults and managed CMS records use the same correct search contract',()=>{
 const source=readFileSync('app/lib/homepage-presentation.ts','utf8');
 assert.match(source,/id: "pool"[^\n]*href: "\/search\?pool=1"/);
 assert.match(source,/href: normalizeHomepageSearchHref\(href\)/);
});
test('the browser also normalizes cached old presentation responses before rendering links',()=>{
 const source=readFileSync('app/components/home-discovery-sections.tsx','utf8');
 for(const group of ['popular','cities','types'])assert.ok(source.includes(`${group}: normalizeHomepageItems(value.${group})`),`${group} old cached response needs normalization`);
});
test('cached legacy items are repaired without mutating managed content or dropping metadata',()=>{
 const input=[{id:'pool',href:'/search?feature=בריכה&guests=6',label:'נופש עם בריכה',image:'/media/pool.jpg',visible:true},{id:'north',href:'/vacations/north',label:'נופש בצפון'}];
 const output=normalizeHomepageItems(input);
 assert.equal(output[0].href,'/search?guests=6&pool=1');
 assert.deepEqual({...output[0],href:input[0].href},input[0]);
 assert.deepEqual(output[1],input[1]);
 assert.equal(input[0].href,'/search?feature=בריכה&guests=6');
 assert.deepEqual(normalizeHomepageItems([]),[]);
});
