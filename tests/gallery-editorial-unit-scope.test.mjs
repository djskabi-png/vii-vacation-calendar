import test from 'node:test';
import assert from 'node:assert/strict';
import {gallerySelectionScope,galleryTopicTabs,uniqueGalleryItems,visibleGalleryItems} from '../app/components/gallery-selection.ts';

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
test('all gallery mode exposes each unit topic after the general groups',()=>{
 assert.deepEqual(galleryTopicTabs(media,'all'),[
  {title:'כללי',count:1},{title:'בריכה',count:1},{title:'סוויטה',count:4},
  {title:'יחידה אחרת',count:1},{title:'חדרי השינה',count:1}
 ]);
});
test('guest, bedroom and video modes retain independent identities',()=>{
 assert.deepEqual(visibleGalleryItems(media,'bedrooms',null).map(x=>x.src),['bed.jpg']);
 assert.deepEqual(visibleGalleryItems(media,'guests',null).map(x=>x.src),['guest.jpg']);
 assert.deepEqual(visibleGalleryItems(media,'videos',null),[]);
 assert.equal(media.length,9);
});
