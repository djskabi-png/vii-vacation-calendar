import assert from 'node:assert/strict';
import test from 'node:test';
import {nearbySearchRecommendations} from '../app/lib/nearby-recommendations.ts';
const node=(key,level,title,lat,lng,parentKey=null)=>({key,level,title,titleEn:title,slug:'',gpsLat:lat,gpsLong:lng,parentKey,featured:false,unassigned:false});
const jerusalem={id:'jerusalem',location:'ירושלים',area:'ירושלים והרי יהודה',lat:31.768319,lng:35.21371};
const center={id:'center',location:'הרצליה',area:'מישור החוף והשפלה',lat:32.1673827,lng:34.8549909};
test('region without its own point uses matching catalog origin rather than a displaced child-city centroid',()=>{
 const nodes=[node('area:7','area',jerusalem.area,null,null),node('city:wrong','city','עיר משויכת',center.lat,center.lng,'area:7')];
 assert.deepEqual(nearbySearchRecommendations([center,jerusalem],jerusalem.area,nodes,{key:p=>p.id,origin:jerusalem}).map(p=>p.id),['jerusalem']);
});
test('an authoritative city point still wins over a caller origin',()=>{
 const nodes=[node('city:20','city','ירושלים',jerusalem.lat,jerusalem.lng)];
 assert.deepEqual(nearbySearchRecommendations([center,jerusalem],'ירושלים',nodes,{key:p=>p.id,origin:center}).map(p=>p.id),['jerusalem']);
});
