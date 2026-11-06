import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {eventLastMinuteProps} from '../app/lib/event-last-minute-props.ts';
import {acceptedSergeySummaries} from '../app/lib/accepted-bundled-catalog.ts';
import {eventPlaceHref,eventOfferHref} from '../app/lib/event-place-href.ts';
import {eventDealPlaceLabels} from '../app/lib/event-deal-labels.ts';
import {supplierStartingPrice} from '../app/lib/supplier-starting-price.ts';
import {matchesSearchLocation} from '../app/data/search-taxonomy.ts';
import {homeEventPhotography} from '../app/lib/home-preview-content.ts';

test('rail projection preserves all business, contact, price, geography, locale and gallery identities',()=>{
 const source={slug:'event-123',name:'Venue original',location:'נשר',area:'חיפה וחוף הכרמל',type:'לופט',guests:80,image:'/gallery/586acca721dc46e.jpg',images:['/gallery/586acca721dc46e.jpg','/actual-photo.jpg','/another.jpg'],sourceUrl:'https://www.vii.co.il/original_venue',sourcePropertySlug:'vacation-456',contact:{phone:'055-1111111',whatsapp:'972501111111',email:'not-used-in-this-rail@example.invalid'},startPriceWinter:900,startPriceSummer:1300,description:'Full source content',galleryGroups:[{title:'Full supplier gallery',images:['/details-only.jpg']}],featureGroups:[{title:'Full taxonomy',items:['Feature']}],roomOptions:[{id:999}]};
 const original=structuredClone(source),[projected]=eventLastMinuteProps([source]);
 for(const key of ['slug','name','location','area','type','guests','image','images','sourceUrl','sourcePropertySlug','startPriceWinter','startPriceSummer'])assert.deepEqual(projected[key],source[key],key);
 assert.deepEqual(projected.contact,{phone:source.contact.phone,whatsapp:source.contact.whatsapp});assert.equal(supplierStartingPrice(projected),supplierStartingPrice(source));
 assert.equal(eventPlaceHref(projected),eventPlaceHref(source));const selection=new URLSearchParams({from:'2026-11-06',guests:'80',slot:'evening'});assert.equal(eventOfferHref(projected,selection),eventOfferHref(source,selection));
 for(const language of ['he','en','fr','ru'])assert.deepEqual(eventDealPlaceLabels(projected,language,x=>x),eventDealPlaceLabels(source,language,x=>x));
 for(const location of ['צפון','חיפה','מרכז','כל הארץ'])assert.equal(matchesSearchLocation(projected,location),matchesSearchLocation(source,location));
 assert.deepEqual(homeEventPhotography(projected).images,homeEventPhotography(source).images);assert.equal(homeEventPhotography(projected).image,homeEventPhotography(source).image);
 assert.deepEqual(source,original,'source catalog/detail is never edited');
 for(const key of ['description','galleryGroups','featureGroups','roomOptions'])assert.equal(Object.hasOwn(projected,key),false,key);
 const [minimal]=eventLastMinuteProps([{slug:'event-2',name:'Venue',location:'',type:'',guests:0,image:'',images:[]}]);assert.equal(Object.hasOwn(minimal,'contact'),false);assert.deepEqual(minimal.images,[]);
});
test('actual accepted event inventory keeps every venue while bounding hydrated rail data',()=>{
 const source=acceptedSergeySummaries('events').map(place=>({...place,images:(place.images?.length?place.images:[place.image]).slice(0,3),description:place.description?.slice(0,260)||'',features:place.features?.slice(0,6)||[]}));
 const projected=eventLastMinuteProps(source);
 assert.ok(source.length>100);assert.equal(projected.length,source.length);assert.deepEqual(projected.map(p=>p.slug),source.map(p=>p.slug));
 for(let i=0;i<source.length;i++){assert.deepEqual(projected[i].images,source[i].images);assert.equal(eventPlaceHref(projected[i]),eventPlaceHref(source[i]));assert.equal(supplierStartingPrice(projected[i]),supplierStartingPrice(source[i]));}
 const bytes=value=>Buffer.byteLength(JSON.stringify(value));assert.ok(bytes(projected)<bytes(source)*0.4,'actual rail payload retains identities without detail/catalog duplication');
});
test('both server entrypoints use the projection without shortening the complete venue catalog',()=>{
 const page=readFileSync(new URL('../app/events/page.tsx',import.meta.url),'utf8'),preset=readFileSync(new URL('../app/events/deal-preset-page.tsx',import.meta.url),'utf8'),client=readFileSync(new URL('../app/components/event-last-minute.tsx',import.meta.url),'utf8');
 assert.match(page,/<EventLastMinute places=\{eventLastMinuteProps\(eventPlaces\)\}/);assert.match(preset,/<EventLastMinute places=\{eventLastMinuteProps\(places\)\}/);
 assert.match(page,/sourceEventPlaces\.map/);assert.doesNotMatch(page,/sourceEventPlaces\.slice/);assert.match(client,/places: EventLastMinutePlace\[\]/);
 assert.match(client,/const availablePlaces = search\.places \|\| places/);assert.match(client,/search\.resultOrder\.length/);
});
