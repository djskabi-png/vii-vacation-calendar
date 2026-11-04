import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import {popularSearchWorlds,popularSearchesForWorld} from '../app/lib/world-popular-search-defaults.ts';
import {parseHomepagePresentation,worldPopularSearchItems,readHomepagePresentation} from '../app/lib/homepage-presentation.ts';
import {validManagedSearchList} from '../app/lib/homepage-search-href.ts';
import {spaHasLodging,spaHasHourlyRoom,spaSourceServiceTerms} from '../app/data/spa-landings.ts';
import {normalizeEventVenueType,eventVenueTypeOrder} from '../app/lib/event-search-taxonomy.ts';
test('all8worlds have a nearby action and truthful result-world destinations with local media',()=>{
 assert.equal(popularSearchWorlds.length,8);
 for(const world of popularSearchWorlds){
 const rows=parseHomepagePresentation(undefined,world.id).popular;
 assert.ok(rows.length>=4,world.id);const nearby=rows.find(row=>row.action==='nearby');assert.ok(nearby,world.id);assert.equal(new URL(nearby.href,'https://vii.invalid').searchParams.get('sort'),'nearest');
 for(const row of rows)assert.ok(existsSync(new URL('../public'+row.image,import.meta.url)),row.image);
 }
});
test('world overrides retain order and explicit hidden/empty states without contaminating other worlds',()=>{
 const rows=popularSearchesForWorld('spa');const attr={homePopularSearchesSpa:JSON.stringify([rows[2],{...rows[0],visible:false},rows[1]])};
 assert.deepEqual(parseHomepagePresentation(attr,'spa').popular.map(r=>r.id),[rows[2].id,rows[1].id]);
 assert.equal(parseHomepagePresentation({homePopularSearchesSpa:'[]'},'spa').popular.length,0);
 assert.ok(parseHomepagePresentation(attr,'hourly').popular.some(row=>row.href.includes('independent')));
 assert.equal(parseHomepagePresentation({homePopularSearchesSpa:'broken'},'spa').popular[0].action,'nearby');
});
test('legacy vacation content gains nearby once; current schema respects deliberate removal',()=>{
 const row=popularSearchesForWorld('vacation')[1];const attr={homePopularSearches:JSON.stringify([row])};assert.equal(worldPopularSearchItems(attr)[0].action,'nearby');
 assert.deepEqual(worldPopularSearchItems({...attr,homePopularSearchesVersion:'2'}).map(row=>row.id),[row.id]);
});
test('server list validation rejects malformed,duplicate,external or oversized values without truncation',()=>{
 const rows=popularSearchesForWorld('spa');assert.ok(JSON.stringify(rows).length>1200);assert.ok(validManagedSearchList(JSON.stringify(rows)));
 for(const value of ['broken',JSON.stringify([rows[0],rows[0]]),JSON.stringify([{...rows[0],href:'//evil.example'}]),JSON.stringify([{...rows[0],href:'/\\evil'}]),' '.repeat(24001)])assert.equal(validManagedSearchList(value),false);
});
test('spa service predicates use positive supplier evidence rather than hotel/treatment-room inference',()=>{
 assert.equal(spaHasLodging('ספא בבית מלון'),false);assert.equal(spaHasLodging('חבילת ספא ללא לינה'),false);assert.equal(spaHasLodging('החבילה לא כוללת לינה'),false);assert.equal(spaHasLodging('לינה אינה כלולה'),false);assert.equal(spaHasLodging('ספא אלינה'),false);assert.equal(spaHasLodging('חבילות לינה'),true);
 assert.equal(spaHasHourlyRoom('חדרי טיפולים וחדר כושר פתוח 5 שעות'),false);
 assert.equal(spaHasHourlyRoom('חדרי טיפולים, חדר פרטי למשך 4 שעות'),true);
 assert.equal(spaHasHourlyRoom('חדר לשימוש יומי למשך 5 שעות'),true);
 assert.equal(spaHasHourlyRoom('ללא חדר לפי שעה'),false);
 const catalog=JSON.parse(readFileSync(new URL('../app/data/spaplus-public-catalog.json',import.meta.url)));
 assert.ok(catalog.sites.some(site=>spaSourceServiceTerms(site).includes('חדר לפי שעה')));
 assert.ok(catalog.sites.some(site=>spaSourceServiceTerms(site).includes('לינה')));
});
test('popular event links use actual plural facets and corporate occasion rather than ignored values',()=>{
 for(const row of popularSearchesForWorld('events')){const value=new URL(row.href,'https://vii.invalid').searchParams.get('type');if(value)assert.ok(eventVenueTypeOrder.includes(value),value);}
 assert.equal(normalizeEventVenueType('לופט'),'לופטים');assert.equal(normalizeEventVenueType('וילה'),'וילות');
 assert.equal(new URL(popularSearchesForWorld('corporate')[0].href,'https://vii.invalid').searchParams.get('eventType'),'אירועי חברה');
});
