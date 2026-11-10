import test from 'node:test';
import assert from 'node:assert/strict';
import {providerSearchHref,providerCategorySearchHref,providerSearchBreadcrumbs} from '../app/lib/provider-search-state.ts';
import {providerTopicCategories,providerMatchesCategory} from '../app/data/provider-categories.ts';
import {providerServesRegion} from '../app/lib/provider-service-areas.ts';

test('every category destination preserves selected query, service area and sort without retaining obsolete pagination',()=>{
 for(const category of ['all',...providerTopicCategories.map(c=>c.id)]){
  const url=new URL(providerCategorySearchHref(category,'?page=4&utm_source=example',{query:' DJ מוזיקה ',region:'מרכז',sort:'nearest'}),'https://vii.test');
  assert.equal(url.pathname,category==='all'?'/providers':'/providers/'+category);
  assert.equal(url.searchParams.get('q'),'DJ מוזיקה');assert.equal(url.searchParams.get('region'),'מרכז');assert.equal(url.searchParams.get('sort'),'nearest');assert.equal(url.searchParams.get('page'),null);assert.equal(url.searchParams.get('utm_source'),'example');
 }
});
test('reset and service-area changes remove obsolete aliases without erasing unrelated search state',()=>{
 const href=providerSearchHref('/providers/music','?q=DJ&region=צפון&location=ישן&sort=name&page=3',{q:'',region:'',sort:''});
 assert.equal(href,'/providers/music');
 const url=new URL(providerSearchHref('/providers','?q=DJ&location=ישן',{region:'מרכז'}),'https://vii.test');assert.equal(url.searchParams.get('q'),'DJ');assert.equal(url.searchParams.get('region'),'מרכז');assert.equal(url.searchParams.get('location'),null);
});
test('a literal search query is preserved even when it equals an unfiltered region label',()=>{
 for(const query of ['all','כל הארץ']) {
  const href=providerSearchHref('/providers','',{q:query,region:'כל הארץ'});
  const url=new URL(href,'https://vii.test');
  assert.equal(url.searchParams.get('q'),query);assert.equal(url.searchParams.get('region'),null);
 }
});
test('provider breadcrumbs lead to a real matching category and verified service area rather than its office location',()=>{
 const item={id:'dj-kfir-w',name:'DJ Kfir W',location:'קריית עקרון',area:'לא מסונן',description:'',features:[],serviceAreas:['מרכז']};
 const crumbs=providerSearchBreadcrumbs(item);assert.equal(crumbs.category.path,'/providers/music');const url=new URL(crumbs.regions[0].path,'https://vii.test');assert.equal(url.pathname,'/providers/music');assert.equal(url.searchParams.get('region'),'מרכז');assert.equal(providerServesRegion(item.serviceAreas,url.searchParams.get('region')),true);assert.doesNotMatch(crumbs.regions[0].name,/קריית עקרון/);
});
test('whole-country service does not manufacture a local service-area breadcrumb from office geography',()=>{
 const item={id:'nissan-mukhtar',name:'Chef',location:'תל אביב',description:'',features:[],serviceAreas:['כל הארץ']};
 const crumbs=providerSearchBreadcrumbs(item);assert.equal(crumbs.category.path,'/providers/food');assert.deepEqual(crumbs.regions,[]);
});
test('multi-category provider breadcrumb still selects an actual supported category',()=>{
 const item={id:'argaman-events',name:'Argaman',description:'',features:[],serviceAreas:['כל הארץ']};const crumbs=providerSearchBreadcrumbs(item);const category=providerTopicCategories.find(c=>'/providers/'+c.id===crumbs.category.path);assert.ok(category);assert.equal(providerMatchesCategory(item,category),true);
});
