import assert from 'node:assert/strict';
import test from 'node:test';
import { nearbySearchRecommendations, completePlaceSearchResults } from '../app/lib/nearby-recommendations.ts';
import { distanceKm } from '../app/lib/geography-search.ts';
const jerusalem={lat:31.778,lng:35.235};
const nodes=[{key:'city:jerusalem',level:'city',parentKey:null,title:'ירושלים',titleEn:'Jerusalem',slug:'jerusalem-city',gpsLat:jerusalem.lat,gpsLong:jerusalem.lng,unassigned:false}];
const key=p=>p.id;
const northern=[{id:'tiberias',location:'טבריה',area:'כנרת',lat:32.794,lng:35.532},{id:'safed',location:'צפת',area:'גליל עליון',lat:32.965,lng:35.498}];
test('sparse accessible Jerusalem search never substitutes distant northern venues to reach18',()=>{
  assert.ok(northern.every(p=>distanceKm(jerusalem,p)>100));
  for(const geo of [nodes,[]])assert.deepEqual(nearbySearchRecommendations(northern,'ירושלים',geo,{key}),[]);
});
test('exact city results stay first and only genuine nearby supplemental matches are appended',()=>{
  const exact={id:'exact',location:'ירושלים',...jerusalem};const near={id:'near',location:'מבשרת ציון',lat:31.804,lng:35.15};
  const otherNear={id:'nearer',location:'מוצא',lat:31.795,lng:35.19};
  const result=completePlaceSearchResults([exact],nearbySearchRecommendations([...northern,near,exact,otherNear],'ירושלים',nodes,{key}),key);
  assert.deepEqual(result.map(key),['exact','nearer','near']);
  assert.ok(result.every(p=>distanceKm(jerusalem,p)<=35));
});
test('delayed managed geography uses exact catalog anchor without national fallback or unknown-position rows',()=>{
  const exact={id:'exact',location:'ירושלים',...jerusalem};
  const unknown={id:'unknown',location:'יישוב ללא נקודה',area:'ירושלים והרי יהודה'};
  const near={id:'near',location:'יישוב קרוב',lat:31.82,lng:35.2};
  const result=nearbySearchRecommendations([northern[0],unknown,exact,near],'ירושלים',[],{key});
  assert.deepEqual(result.map(key),['exact','near']);
});
test('nearby geographic boundary remains hard even with only one eligible result',()=>{
  const inside={id:'inside',location:'קרוב',lat:jerusalem.lat+34/111.195,lng:jerusalem.lng};
  const outside={id:'outside',location:'רחוק',lat:jerusalem.lat+36/111.195,lng:jerusalem.lng};
  assert.deepEqual(nearbySearchRecommendations([outside,inside],'ירושלים',nodes,{key}).map(key),['inside']);
});
test('an authoritative empty city radius cannot fall through to a different coarse region center',()=>{
  const west={id:'west-outside',location:'רחוק מהעיר',lat:jerusalem.lat,lng:jerusalem.lng-36/(111.195*Math.cos(jerusalem.lat*Math.PI/180))};
  assert.ok(distanceKm(jerusalem,west)>35);
  assert.deepEqual(nearbySearchRecommendations([west],'ירושלים',nodes,{key}),[]);
});
