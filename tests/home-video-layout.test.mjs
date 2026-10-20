import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {eligibleHomeTourProperties,homeTourVideos} from '../app/lib/home-video-selection.ts';
const globals=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
const compact=readFileSync(new URL('../app/slider-card-compact.css',import.meta.url),'utf8');
const home=readFileSync(new URL('../app/home-mobile.css',import.meta.url),'utf8');
const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
test('direct video and review cards do not inherit wrapper flex or universal child height',()=>{
 assert.doesNotMatch(globals,/(?<!div)\.home-slider__item > \*\s*\{/);
 assert.match(compact,/> div:is\(\.home-slider__item, \.home-live-deals__item\) \{ display: flex/);
 assert.match(globals,/\.home-tour-card video \{[^}]*height: auto;[^}]*aspect-ratio: 16\/9;[^}]*object-fit: contain/);
});
test('adjacent trust section uses one bounded gap and no doubled header margin',()=>{
 assert.match(home,/home-vacation-discovery:has\(\+ \.home-trust-discovery\) \{ padding-block-end:24px/);
 assert.match(home,/home-vacation-discovery \+ \.home-trust-discovery \{ padding-block-start:32px/);
 assert.match(home,/home-trust-strip > \.home-vacation-strip__head \{ margin:0/);
 assert.match(home,/padding-block-end:16px/);assert.match(home,/padding-block-start:16px/);
});
test('inactive demos, unavailable listings and empty media are excluded before selection limits',()=>{
 const video={src:'/own-tour.mp4',poster:'/own-poster.jpg'};
 const values=[{slug:'demo',active:false,videos:[video]},{slug:'closed',active:false,videos:[video]},
 {slug:'active',active:true,videos:[video]},{slug:'legacy',videos:[video]},
 {slug:'no-video'},{slug:'empty',videos:[{src:'',poster:'/poster.jpg'}]},
 {slug:'no-poster',videos:[{src:'/tour.mp4',poster:' '}]},{slug:'active',videos:[video]}];
 const before=JSON.stringify(values);
 assert.deepEqual(eligibleHomeTourProperties(values).map(p=>p.slug),['active','legacy']);
 assert.equal(JSON.stringify(values),before);
 assert.equal(eligibleHomeTourProperties(values)[0].videos[0],video);
 assert.match(page,/rotateDaily\(eligibleHomeTourProperties\(/);
});
test('mixed video arrays retain valid pairs but never render empty or unsafe media',()=>{
 const good={src:'/own-tour.mp4',poster:'/own-poster.jpg',note:'Real source disclosure'};
 const mixed=[{src:'',poster:'/cover.jpg'},good,{src:'/tour.mp4',poster:' '},
  {src:'javascript:alert(1)',poster:'/cover.jpg'},{src:'/tour.mp4',poster:'//other.example/cover.jpg'}];
 const saved=JSON.stringify(mixed);
 assert.deepEqual(homeTourVideos(mixed),[good]);assert.equal(JSON.stringify(mixed),saved);
 assert.equal(eligibleHomeTourProperties([{slug:'mixed',videos:mixed}]).length,1);
 const source=readFileSync(new URL('../app/components/home-showcase.tsx',import.meta.url),'utf8');
 assert.match(source,/homeTourVideos\(property.videos\)\.map/);
});
