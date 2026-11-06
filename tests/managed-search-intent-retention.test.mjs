import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {managedPresentationHref,managedSearchParams} from '../app/lib/managed-search-params.ts';
import {buildVacationSearchUrl} from '../app/lib/vacation-search-url.ts';

test('sorting an approved pool page retains semantic filters without a bare query',()=>{
 const current=managedSearchParams('',{type:'צימרים',pool:true,features:'pool,heated-pool'});
 const url=buildVacationSearchUrl(current.toString(),{sort:'price-asc'},['צימרים'],'כל הארץ');
 const params=new URL(url,'https://vii.spaplus.co').searchParams;
 assert.equal(params.get('pool'),'1');assert.equal(params.get('features'),'heated-pool');assert.equal(params.get('sort'),'price-asc');
});
test('sorting an approved landing keeps its canonical path and only carries presentation state',()=>{
 const href=managedPresentationHref('/search/vacations/israel-20770-4e3f6ed0','sort=price-desc&guests=4',{sort:'price-asc'});
 assert.equal(href,'/search/vacations/israel-20770-4e3f6ed0?sort=price-asc&guests=4');
});
test('semantic changes do not bypass the canonical search builder',()=>{
 assert.equal(managedPresentationHref('/search/vacations/israel-20770-4e3f6ed0','pool=1',{sort:'price-asc',pool:null}),null);
});
test('explicit visitor changes override semantic defaults and removing pool does not keep a hidden duplicate',()=>{
 const defaults={pool:true,type:'צימרים',features:'pool,heated-pool'};
 const current=managedSearchParams('pool=0&guests=4',defaults);assert.equal(current.get('pool'),'0');assert.equal(current.get('guests'),'4');
 const url=buildVacationSearchUrl(current.toString(),{pool:null,sort:'price-asc'},['צימרים'],'כל הארץ');const params=new URL(url,'https://vii.spaplus.co').searchParams;
 assert.equal(params.has('pool'),false);assert.equal(params.get('features'),'heated-pool');
});
test('state synchronization and URL updates use the same approved-page intent and do not freeze its initial result IDs',()=>{
 const source=readFileSync(new URL('../app/search/page.tsx',import.meta.url),'utf8');assert.match(source,/const params = managedSearchParams\(searchQuery, landing\?\.initialFilters\)/);assert.match(source,/buildVacationSearchUrl\(initialParams\.toString\(\), updates/);
 const managed=readFileSync(new URL('../app/components/managed-search-landing.tsx',import.meta.url),'utf8');assert.doesNotMatch(managed,/listingSlugs: results\.map/);
});

test('explicit semantic query overrides are retained when only presentation changes',()=>{
 assert.equal(managedPresentationHref('/search/vacations/approved','pool=0&guests=4',{sort:'price-asc'}),'/search/vacations/approved?pool=0&guests=4&sort=price-asc');
 assert.equal(managedPresentationHref(undefined,'pool=1',{sort:'price-asc'}),null);
});
