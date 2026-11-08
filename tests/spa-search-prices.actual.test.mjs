import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spaPackagePriceIndex,pricedSpaSearchItem,spaPriceQuery} from '../app/lib/spa-search-prices.ts';
import {createSourceLoader} from './helpers/source-module-loader.mjs';
const load=createSourceLoader();
const {spaPlacesFromSites}=load('app/lib/spa-discovery-card.ts');
const {projectSpaViiSite}=load('app/lib/spa-editorial-policy.ts');
const {spaItemMatchesSearch,spaSearchStateFromValues}=load('app/data/spa-search-landings.ts');
const catalog=JSON.parse(fs.readFileSync('app/data/spaplus-public-catalog.json','utf8')).sites;
test('selected audience controls both visible minimum price and budget eligibility',()=>{
 const index=spaPackagePriceIndex([{title:'single',price:200,people:1},{title:'couple',price:600,people:2},{title:'couple',price:900,people:2},{title:'bad',price:0,people:2}]);
 const item={id:'spa-fixture',features:['חבילות זוגיות'],priceLabel:'החל מ־₪ 200',spaPackagePrices:index};
 assert.match(pricedSpaSearchItem(item,'couple').priceLabel,/600/);
 assert.equal(pricedSpaSearchItem(item,'couple',0,500),null);
 assert.match(pricedSpaSearchItem(item,'couple',700,1000).priceLabel,/900/);
 assert.equal(pricedSpaSearchItem(item,'couple',650,850),null,'min/max overlap is not proof of an actual package in range');
 assert.match(pricedSpaSearchItem(item,'single').priceLabel,/200/);
});
test('unknown old-client audience pricing never becomes a false selected-party price',()=>{
 const item={id:'legacy',features:['חבילות זוגיות'],priceLabel:'החל מ־₪ 200'};
 assert.equal(pricedSpaSearchItem(item,'couple').priceLabel,undefined);assert.equal(pricedSpaSearchItem(item,'couple',0,500),null);assert.equal(pricedSpaSearchItem(item,''),item);
});
test('budget query preserves date/sort and accepts clearing while rejecting invalid ranges',()=>{
 const q=spaPriceQuery(new URLSearchParams('date=2026-11-09&sort=nearest'),'250','500');assert.equal(q.get('date'),'2026-11-09');assert.equal(q.get('sort'),'nearest');assert.equal(q.get('minPrice'),'250');
 assert.equal(spaPriceQuery(q,'','').has('minPrice'),false);
 for(const [min,max]of [['501','500'],['-1','500'],['a','500'],['1','Infinity']])assert.equal(spaPriceQuery(q,min,max),null);
});
test('actual David and Kempinski cards use their selected couple package prices',async()=>{
 for(const id of [6,385]){
  const site=await projectSpaViiSite(catalog.find(row=>row.id===id)),card=spaPlacesFromSites([site])[0];
  assert.equal(spaItemMatchesSearch(card,spaSearchStateFromValues('תל אביב','couple',['pool'])),true);
  const expected=Math.min(...site.packages.filter(p=>p.people===2&&!p.group).map(p=>p.price));
  assert.match(pricedSpaSearchItem(card,'couple').priceLabel,new RegExp(expected.toLocaleString('he-IL')));
  assert.ok(card.spaPackagePrices.couple.every(value=>value>0));
 }
});
test('audience search uses source package categories rather than promotional words',()=>{
 const card={name:'ספא לקבוצות',features:['חבילות ליחיד'],searchTerms:['מתאים גם לאירוח קבוצות'],location:'ירושלים',area:'ירושלים והסביבה',description:''};
 assert.equal(spaItemMatchesSearch(card,spaSearchStateFromValues('ירושלים','group')),false);
 assert.equal(spaItemMatchesSearch(card,spaSearchStateFromValues('ירושלים','single')),true);
});
