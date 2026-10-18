import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalSearchLocation,normalizeGeographicName,uniqueSearchLocations,locationMatchesQuery} from '../app/lib/geographic-names.ts';
import {matchesSearchLocation} from '../app/data/search-taxonomy.ts';
import {geographyNodeForSelection,nearbyPlacesForSelection} from '../app/lib/geography-search.ts';

const haifa=['חיפה והכרמל','חיפה וחוף הכרמל','חיפה והסביבה','חיפה והקריות','Haifa and Hof HaCarmel'];
const dan=['גוש דן','תל אביב וגוש דן','תל אביב והסביבה','Tel Aviv Metropolitan Area'];
test('explicit metropolitan aliases agree without merging city and metro',()=>{
 for(const name of haifa) assert.equal(canonicalSearchLocation(name),'חיפה והכרמל');
 for(const name of dan) assert.equal(canonicalSearchLocation(name),'תל אביב וגוש דן');
 assert.equal(canonicalSearchLocation('תל־אביב - יפו'),'תל אביב');
 assert.equal(canonicalSearchLocation('ת״א'),'תל אביב');
 assert.notEqual(canonicalSearchLocation('חיפה'),canonicalSearchLocation('חיפה והסביבה'));
 assert.notEqual(canonicalSearchLocation('תל אביב'),canonicalSearchLocation('גוש דן'));
});
test('Haifa aliases include actual catalog area/city shapes and reject far places',()=>{
 const places=[{location:'עספיא',area:'חיפה וחוף הכרמל'},{location:'נשר',area:'חיפה וחוף הכרמל'},{location:'קריית אתא',area:'קריות'},{location:'חיפה',area:'חיפה'},{location:'אילת',area:'אילת והסביבה'}];
 for(const name of haifa) assert.deepEqual(places.map(p=>matchesSearchLocation(p,name)),[true,true,true,true,false]);
 assert.deepEqual(places.map(p=>matchesSearchLocation(p,'חיפה')),[false,false,false,true,false]);
});
test('GushDan aliases match cities despite supplier broad coastal area, not all coastal places',()=>{
 const places=['תל אביב','תל-אביב-יפו','בת ים','רמת גן','גבעתיים','נתניה','אשדוד','חיפה'].map(location=>({location,area:'מישור החוף והשפלה'}));
 for(const name of dan) assert.deepEqual(places.map(p=>matchesSearchLocation(p,name)),[true,true,true,true,true,false,false,false]);
 assert.deepEqual(places.map(p=>matchesSearchLocation(p,'תל אביב')),[true,true,false,false,false,false,false,false]);
});
test('normalization handles punctuation, spaces, diacritics and city spelling',()=>{
 assert.equal(normalizeGeographicName('  קריית־אתא  '),'קרית אתא');
 assert.equal(normalizeGeographicName('חֵיפָה'),'חיפה');
 assert.equal(matchesSearchLocation({location:'רמת־גן'},'רמת גן'),true);
 assert.equal(matchesSearchLocation({location:'נתניה'},'עיר שלא קיימת'),false);
});
test('picker deduplicates only equivalent scopes and searches alternate names',()=>{
 assert.deepEqual(uniqueSearchLocations(['חיפה','חיפה וחוף הכרמל','חיפה והסביבה','חיפה והכרמל','תל אביב','תל-אביב-יפו','גוש דן','תל אביב וגוש דן']),['חיפה','חיפה והכרמל','תל אביב','תל אביב וגוש דן']);
 assert.equal(locationMatchesQuery('תל אביב וגוש דן','גוש'),true);
 assert.equal(locationMatchesQuery('חיפה והכרמל','חוף הכרמל'),true);
 assert.equal(locationMatchesQuery('תל אביב','tel-aviv'),true);
});
const node=(key,level,title,parentKey=null,lat=null,lng=null)=>({key,level,title,parentKey,titleEn:'',slug:'',featured:false,gpsLat:lat,gpsLong:lng,unassigned:false});
const nodes=[node('area:24','area','גוש דן'),node('area:25','area','תל אביב וגוש דן'),node('area:5','area','חיפה וחוף הכרמל'),node('city:24','city','תל אביב','area:6',32.0853,34.7818),node('city:4','city','חיפה','area:5',32.794,34.9896),node('city:50','city','רמת גן','area:6',32.068,34.8248)];
test('known metro with empty authoritative hierarchy has a managed city anchor, not crosslevel ID join',()=>{
 const places=[{id:'near',location:'רמת גן'},{id:'north',location:'חיפה'}];
 for(const name of dan) assert.deepEqual(nearbyPlacesForSelection(places,nodes,name,{minimumResults:3,limit:3}).map(x=>x.place.id),['near','north']);
 assert.equal(geographyNodeForSelection(nodes,'city:24').level,'city');
 assert.equal(geographyNodeForSelection(nodes,'גוש דן').level,'area');
 assert.equal(geographyNodeForSelection(nodes,'חיפה והסביבה').key,'area:5');
 assert.equal(geographyNodeForSelection(nodes,'Tel Aviv - Yafo').key,'city:24');
});
test('unknown location cannot become a national fallback and missing coordinates are not invented',()=>{
 assert.deepEqual(nearbyPlacesForSelection([{location:'חיפה'}],nodes,'לא קיים',{minimumResults:3}),[]);
 assert.deepEqual(nearbyPlacesForSelection([{location:'עיר לא מוכרת'}],nodes,'גוש דן',{minimumResults:3}),[]);
});
test('bounded normalization memo preserves results after more labels than its capacity',()=>{
 for(let i=0;i<1400;i++)assert.equal(normalizeGeographicName(` label-${i} `),`label ${i}`);
 assert.equal(canonicalSearchLocation('תל־אביב-יפו'),'תל אביב');
 assert.equal(matchesSearchLocation({location:'קריית אתא',area:'קריות'},'חיפה והסביבה'),true);
});
