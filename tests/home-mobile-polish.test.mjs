import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {homeEventPhotography,homeReviewExcerpt} from '../app/lib/home-preview-content.ts';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('homepage poster uses same-place accepted photo, leaves unrelated covers alone',()=>{
 const poster='https://www.vii.co.il/gallery/586acca721dc46e.jpg';
 const p={image:poster,images:[poster,'https://www.vii.co.il/gallery/6969df3999df262.jpeg'],slug:'event-2259'};
 const result=homeEventPhotography(p);
 assert.equal(result.image,p.images[1]);assert.deepEqual(result.images,[p.images[1]]);assert.equal(p.image,poster);
 const plain={image:'/photo.jpg',images:['/photo.jpg']};assert.equal(homeEventPhotography(plain),plain);
 assert.equal(homeEventPhotography({image:poster}).image,poster);
});
test('review preview removes only observed import metadata before Hebrew, not guest prose',()=>{
 assert.equal(homeReviewExcerpt('8 hours ago New מקום יוצא מן הכלל.'),'מקום יוצא מן הכלל.');
 assert.equal(homeReviewExcerpt('New place with a beautiful garden.'),'New place with a beautiful garden.');
 assert.equal(homeReviewExcerpt('8 hours ago New experience for us'),'8 hours ago New experience for us');
 assert.ok(homeReviewExcerpt('חופשה '.repeat(40)).length<=122);
});
test('mobile-only rails preserve all world, magazine and trail items with shared boundary controls',()=>{
 const home=read('app/components/home-showcase.tsx'),page=read('app/page.tsx'),rail=read('app/components/home-mobile-rail.tsx'),css=read('app/home-mobile.css');
 for(const id of ['home-worlds-rail','home-trails-rail'])assert.ok(home.includes(id));
 assert.match(page,/HomeMobileRail id="home-magazine-rail"/);assert.match(rail,/HomeSliderControls/);assert.match(rail,/shufflePlaces = false/);assert.match(rail,/shufflePlaces \? orderPlaceRailChildren\(children,.*\) : children/);assert.match(rail,/\{rendered\}/);
 assert.match(css,/\.home-mobile-rail-controls \{ display:none; \}/);assert.match(css,/@media \(max-width:760px\)/);
 assert.match(css,/\.home-page \.home-mobile-rail > \* \{[^}]*flex:0 0 100%/);
 assert.match(css,/\.home-page :is\(\.spa-deal-card,\.event-deals__card\) \{ flex-basis:100%;/);
 assert.match(css,/\.home-page :is\(\.home-event-feature,\.home-event-list__card\) \{[^}]*max-inline-size:100%/);
 assert.match(css,/\.home-page :is\(\.home-mobile-rail,\.home-events-world__layout\) \{ scroll-padding-inline:0; \}/);
});
test('missing image occupies existing media region instead of adding another225px row',()=>{
 const css=read('app/globals.css');assert.match(css,/\.discovery-card__missing-image \{ position: absolute; inset: 0;[^}]*min-height: 0;/);
 assert.doesNotMatch(css,/\.discovery-card__missing-image \{[^}]*min-height: 225px/);
});
test('homepage trust prose does not explain supplier mechanics and trail gate keeps truthful nonvisual media context',()=>{
 const page=read('app/page.tsx'),home=read('app/components/home-showcase.tsx');
 assert.doesNotMatch(page,/שהתקבלו מהספק|נתוני הספק/);assert.match(home,/worldTopicMedia\.trails/);assert.match(home,/const imageAlt = topicCopy\?\.alt/);assert.doesNotMatch(home,/home-world-gate__image-label/);
 assert.match(home,/homeEventPhotography/);assert.match(home,/homeReviewExcerpt/);
});
test('imported discovery-card currency spelling is normalized without changing the amount',()=>{
 assert.ok(read('app/components/discovery-card.tsx').includes('.replace(/ש["״]ח/g, "₪")'));
 assert.equal('החל מ250 ש"ח'.replace(/ש["״]ח/g,'₪'),'החל מ250 ₪');
});
