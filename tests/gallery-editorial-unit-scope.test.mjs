import test from 'node:test';
import assert from 'node:assert/strict';
import {generalPlaceGallery,gallerySelectionScope,galleryTopicTabs,resolveGalleryTopic,uniqueGalleryItems,unitGalleryTopicKey,visibleGalleryItems} from '../app/components/gallery-selection.ts';

const item=(category,topic,src)=>({category,topic,src});
const media=uniqueGalleryItems([
 item('place','כללי','general.jpg'),item('place','בריכה','pool.jpg'),
 item('place','סוויטה','shared.jpg'),item('place','סוויטה','source-only.jpg'),
 item('units','סוויטה','shared.jpg'),item('units','סוויטה','unit-only.jpg'),
 item('units','יחידה אחרת','other.jpg'),item('bedrooms','חדרי השינה','bed.jpg'),
 item('guests','תמונות אורחים','guest.jpg'),item('units','סוויטה','unit-only.jpg')
]);

test('general topics/counts are exactly editorial groups, not generated room/bedroom copies',()=>{
 assert.deepEqual(galleryTopicTabs(media,'place'),[{title:'כללי',count:1},{title:'בריכה',count:1},{title:'סוויטה',count:2}]);
 assert.deepEqual(visibleGalleryItems(media,'all',null).map(x=>x.src),['general.jpg','pool.jpg','shared.jpg','source-only.jpg']);
 assert.deepEqual(visibleGalleryItems(media,'all','סוויטה').map(x=>x.src),['shared.jpg','source-only.jpg']);
});
test('same-name unit keeps its distinct exact gallery membership and count',()=>{
 assert.deepEqual(visibleGalleryItems(media,'units','סוויטה').map(x=>x.src),['shared.jpg','unit-only.jpg']);
 assert.deepEqual(galleryTopicTabs(media,'units'),[{title:'סוויטה',count:2},{title:'יחידה אחרת',count:1}]);
 assert.equal(visibleGalleryItems(media,'units','missing').length,0);
});
test('legacy all/topic unit links still work without importing other unit photos',()=>{
 assert.equal(gallerySelectionScope(media,'all','יחידה אחרת'),'units');
 assert.deepEqual(visibleGalleryItems(media,'all','יחידה אחרת').map(x=>x.src),['other.jpg']);
 assert.equal(gallerySelectionScope(media,'all','סוויטה'),'place');
});
test('the general opening exposes only general topic tabs',()=>{
 assert.deepEqual(galleryTopicTabs(media,gallerySelectionScope(media,'all')),[
  {title:'כללי',count:1},{title:'בריכה',count:1},{title:'סוויטה',count:2}
 ]);
});
test('supplier copies of unit galleries do not leak into the general image list',()=>{
 const general={title:'כללי',images:['pool.jpg','shared.jpg']};
 const unit={title:'סוויטה',images:['unit.jpg','unit-extra.jpg','shared.jpg']};
 const roomOptions=[{name:'סוויטה',images:['unit.jpg','shared.jpg']}];
 const images=['pool.jpg','unit.jpg','unit-extra.jpg','shared.jpg','extra.jpg'];
 assert.deepEqual(generalPlaceGallery({images,galleryGroups:[general,unit],roomOptions}),{
  images:['pool.jpg','shared.jpg','extra.jpg'],galleryGroups:[general],
  roomOptions:[{name:'סוויטה',images:['unit.jpg','shared.jpg','unit-extra.jpg']}],
 });
 assert.deepEqual(roomOptions[0].images,['unit.jpg','shared.jpg']);
});
test('guest, bedroom and video modes retain independent identities',()=>{
 assert.deepEqual(visibleGalleryItems(media,'bedrooms',null).map(x=>x.src),['bed.jpg']);
 assert.deepEqual(visibleGalleryItems(media,'guests',null).map(x=>x.src),['guest.jpg']);
 assert.deepEqual(visibleGalleryItems(media,'videos',null),[]);
 assert.equal(media.length,9);
});
test('entity keys keep same-title units and same-source images independently addressable',()=>{
 const collision=[
  item('place','סוויטה','place.jpg'),
  {...item('units','סוויטה','unit-a.jpg'),topicKey:'unit:4602:0'},
  {...item('units','סוויטה','unit-b.jpg'),topicKey:'unit:4603:1'},
  {...item('units','סוויטה','shared.jpg'),topicKey:'unit:4602:0'},
  {...item('place','סוויטה','shared.jpg'),topicKey:'place:0:סוויטה'},
 ];
 assert.deepEqual(galleryTopicTabs(collision,'units'),[
  {key:'unit:4602:0',title:'סוויטה',count:2},
  {key:'unit:4603:1',title:'סוויטה',count:1},
 ]);
 assert.deepEqual(visibleGalleryItems(collision,'all','unit:4602:0').map(x=>x.src),['unit-a.jpg','shared.jpg']);
 assert.deepEqual(visibleGalleryItems(collision,'all','unit:4603:1').map(x=>x.src),['unit-b.jpg']);
});
test('unit entry links use unique supplier IDs or distinct fallback keys',()=>{
 const rooms=[{supplierRoomID:15},{supplierRoomID:22},{supplierRoomID:22},{}];
 assert.deepEqual(rooms.map((_,index)=>unitGalleryTopicKey(rooms,index)),['unit:15','unit:index:1','unit:index:2','unit:index:3']);
});
test('legacy unit topic resolves to the unit entity when place shares its title',()=>{
 const items=[
  {src:'place.jpg',label:'',category:'place',topic:'סוויטה',topicKey:'place:0:סוויטה'},
  {src:'unit.jpg',label:'',category:'units',topic:'סוויטה',topicKey:'unit:4602'},
 ];
 assert.equal(resolveGalleryTopic(items,'סוויטה','units'),'unit:4602');
 assert.equal(resolveGalleryTopic(items,'סוויטה','all'),'place:0:סוויטה');
});
