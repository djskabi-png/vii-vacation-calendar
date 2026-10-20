import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { regionalAvailabilityRegion, regionalAvailabilityTitle, regionalPublishedIds } from '../app/lib/regional-availability.ts';
import { matchesSearchLocation } from '../app/data/search-taxonomy.ts';
import { spaPlusArea } from '../app/data/spa-regions.ts';
import { selectSpaPackageDeals } from '../app/lib/spa-package-deals.ts';
import { getHomeDeals } from '../app/lib/vii-home-deals.ts';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('all current broad region labels have a scope, cities and nationwide selections do not', () => {
  for (const label of ['צפון','מרכז','דרום','דרום ונגב','כנרת','גליל מערבי','גליל עליון','רמת הגולן','חיפה והכרמל','חיפה','השרון','שרון','מישור החוף והשפלה','תל אביב','ירושלים והסביבה','ירושלים והרי יהודה','ים המלח','אילת והערבה','אילת והסביבה']) {
    const region = regionalAvailabilityRegion(label);
    assert.equal(region?.label, label);
    for (const world of ['vacation','events','spa']) for (const language of ['he','en','ru','fr']) {
      const title = regionalAvailabilityTitle(world,region,language);
      assert.ok(title.length > 10);
      if (language !== 'he') assert.doesNotMatch(title, /[\u0590-\u05ff]/);
    }
  }
  for (const label of ['',undefined,'הכל','כל הארץ','not-a-region','נתניה','ירכא']) assert.equal(regionalAvailabilityRegion(label),null);
});

test('regional allowlist joins only published IDs and never widens an empty region', () => {
  const places = [{supplierId:1,area:'מרכז',location:'נתניה'},{supplierId:2,area:'גליל מערבי',location:'ירכא'},{supplierId:3,area:'דרום ונגב',location:'אשקלון'},{supplierId:4,area:'צפון',location:'צפת'}];
  assert.deepEqual([...regionalPublishedIds(places,new Set([1,2,3]),'צפון')],[2]);
  assert.deepEqual([...regionalPublishedIds(places,new Set([1,2,3]),'מרכז')],[1]);
  assert.deepEqual([...regionalPublishedIds(places,new Set([1,2,3]),'ירושלים והסביבה')],[]);
  assert.deepEqual([...regionalPublishedIds(places,new Set([1,2,3]))],[1,2,3]);
});

test('regional vacation offers retain actual party, dates and exclude national leakage', async () => {
  const publicSiteIds=regionalPublishedIds([{supplierId:1,area:'מרכז'},{supplierId:2,area:'גליל מערבי'}],new Set([1,2]),'צפון');
  const fetchImpl=async (url,init)=>{
    if(url.endsWith('/locations'))return Response.json({});
    if(url.endsWith('/vacations'))return Response.json({places:[1,2].map(siteID=>({siteID,active:true,siteName:`Place ${siteID}`,galleries:[{pictures:[`/gallery/${siteID}.jpg`]}]}))});
    assert.equal(JSON.parse(init.body).rooms[0].adults,6);
    return Response.json({sites:[1,2].map(siteID=>({siteID,available:true,minTotal:100*siteID,cheapest:{from:'2026-10-18',till:'2026-10-19'}}))});
  };
  const result=await getHomeDeals({period:'tomorrow',now:new Date('2026-10-17T12:00:00Z'),guests:6,token:'test-only',publicSiteIds,fetchImpl});
  assert.deepEqual(result.deals.map(deal=>[deal.siteID,deal.priceGuests,deal.from,deal.till]),[[2,6,'2026-10-18','2026-10-19']]);
});

test('spa scope is applied before price sorting and national cap, without inventing availability',()=>{
  const image='https://www.spaplus.co.il/gallery/real.jpg';
  const sites=Array.from({length:24},(_,i)=>({id:i+1,title:`Spa ${i+1}`,city:i<20?'תל אביב':'צפת',image,packages:[{id:i+1,title:'Package',price:i+1,people:1,group:false,image}]}));
  const availability=sites.map(site=>({siteID:site.id,date:'2026-10-18',available:site.id===24?0:2}));
  const regional=sites.filter(site=>matchesSearchLocation({location:site.city,area:spaPlusArea(site.city)},'צפון'));
  const offers=selectSpaPackageDeals(regional,availability,'2026-10-18','single').slice(0,18);
  assert.deepEqual(offers.map(offer=>offer.siteId),[21,22,23]);
  assert.deepEqual(offers.map(offer=>offer.price),[21,22,23]);
});

test('event API applies regional eligibility before top20; scope travels through state and response',()=>{
  const route=read('app/api/vii/live-search/route.ts');
  assert.ok(route.indexOf('publishedSupplierIds(world)')<route.indexOf('liveSupplierSearch({'));
  assert.ok(route.indexOf('selectRegionalOffers(')<route.indexOf('.slice(0, 20)'));
  assert.match(route,/publishedIds: publicIds/);
  assert.match(route,/region: region.label/);
  assert.match(route,/area: place.area/);
  const hook=read('app/components/use-vii-live-search.ts');
  assert.match(hook,/\$\{region \|\| ""\}/);
  assert.match(hook,/includePlaces && result.region !== region/);
  const rail=read('app/components/event-last-minute.tsx');
  assert.match(rail,/orderDiscoveryRail\(\(search.places \|\| places\).flatMap/);
  assert.ok(rail.indexOf('matchesSearchLocation(place, scope.label)')<rail.indexOf('}), { id: item => item.place.slug'));
  assert.match(rail,/eventSearchHref\(scope\?\.label\)/);
});

test('shared integration covers the supported families but never claims availability for other worlds',()=>{
  const component=read('app/components/regional-availability.tsx');
  assert.match(component,/world: AvailabilityWorld/);
  for(const world of ['vacation','events','spa']) assert.ok(read('app/lib/regional-availability.ts').includes(`"${world}"`));
  assert.match(component,/key=\{`\$\{sectionId\}-\$\{guests/);
  assert.match(read('app/search/page.tsx'),/<RegionalAvailability world="vacation" region=\{area\}/);
  assert.match(read('app/events/search/page.tsx'),/<RegionalAvailability world="events" region=\{area\}/);
  assert.match(read('app/components/world-landing.tsx'),/<RegionalAvailability world="spa" region=\{initialSearchLocation\}/);
  assert.doesNotMatch(component,/<(?:Hourly|Provider|Trail|Attraction).*Deals/);
});

test('regional requests reject wrong scopes and booking links retain real guest basis',()=>{
  const vacation=read('app/components/home-live-deals.tsx');
  assert.match(vacation,/result.region !== regionLabel/);
  assert.match(vacation,/location: regionLabel/);
  assert.match(vacation,/guests: String\(deal.priceGuests\)/);
  const spa=read('app/components/spa-package-deals.tsx');
  assert.match(spa,/body.region!==regionLabel/);
  assert.match(spa,/spaSearchStateFromValues\(scope.label,audience\)/);
  assert.match(spa,/validSpaDealDate\(requestedDate\)\?normalizeDealDate\(requestedDate,clock.now\)/);
  assert.match(spa,/eligibleDealDate\(requestedDate,clock.now\)/);
  assert.match(spa,/new URLSearchParams\(\{date:linkDate\}\)/);
  for(const path of ['app/api/vii/home-deals/route.ts','app/api/spa/deals/route.ts']) assert.match(read(path),/invalid_region/);
});
