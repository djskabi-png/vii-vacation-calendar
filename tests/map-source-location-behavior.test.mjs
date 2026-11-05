import { readMapImplementation } from "./helpers/map-implementation-source.mjs";
import assert from 'node:assert/strict';
import test from 'node:test';
import {mapSpiderOffset, spreadMapCluster, validMapCoordinate} from '../app/lib/map-marker-layout.ts';
import {readFileSync} from 'node:fs';

test('ordinary street zoom keeps distinct business locations; only coincident or maximum-zoom points spread',()=>{
 const points=[{lat:32.08,lng:34.78},{lat:32.081,lng:34.781}];
 for(const zoom of [8,12,14,16,18])assert.equal(spreadMapCluster(points,zoom),false,`distinct at ${zoom}`);
 assert.equal(spreadMapCluster(points,19),true);
 assert.equal(spreadMapCluster([points[0],{...points[0]}],12),true);
 assert.equal(spreadMapCluster([points[0]],19),false);
});
test('invalid coordinate values never become map markers and coincident offsets remain bounded and distinct',()=>{
 for(const pair of [[NaN,35],[32,Infinity],[91,35],[32,181],[0,0],[null,35]])assert.equal(validMapCoordinate(...pair),false);
 assert.equal(validMapCoordinate(31.768319,35.21371),true);
 const offsets=Array.from({length:30},(_,i)=>mapSpiderOffset(i,30));assert.equal(new Set(offsets.map(p=>`${p.x}:${p.y}`)).size,30);assert.ok(offsets.every(p=>Math.hypot(p.x,p.y)<170));
});
test('shared renderer connects spread pins to each original coordinate and never automatically spreads all clusters at city zoom',()=>{
 const source=readMapImplementation();
 assert.match(source,/L\.polyline\(\[\[entry\.lat, entry\.lng\], spiderPosition\]/);
 assert.doesNotMatch(source,/zoom >= 12 \|\| explicitlyExpanded|currentZoom \+ 3, 12/);
 assert.match(source,/explicitlyExpanded && spreadMapCluster/);
});
test('compact map viewport and scroll-lock use the same tablet and landscape breakpoint',()=>{
 const source=readFileSync(new URL('../app/components/map-view-state.ts',import.meta.url),'utf8'),css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
 assert.doesNotMatch(source,/max-width: 820px|min-width: 821px/);
 assert.match(source,/max-width: 1100px/);assert.match(source,/min-width: 1101px/);
 assert.match(css,/@media \(max-width: 1100px\) \{\s*\.airbnb-map-split__map \.map-results-experience/);
});

test('desktop split fits its available width and event filters remain reachable without a third squeezed column',()=>{
 const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
 assert.match(css,/\.airbnb-map-split \{[^}]*grid-template-columns: minmax\(0, \.92fr\) minmax\(0, 1\.08fr\)/);
 assert.match(css,/\.event-results-layout:has\(\.event-list--map-open\) \{ display: block;/);
 assert.match(css,/\.event-list--map-open \.event-filter-toggle \{ display: inline-flex;/);
 assert.match(css,/\.event-list--map-open > \.event-map-split \{ grid-column: 1 \/ -1;/);
 assert.match(css,/\.event-results-layout:has\(\.event-list--map-open\) > \.filter-panel.open \{ position: fixed;/);
});
