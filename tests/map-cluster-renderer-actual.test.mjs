import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {spreadMapCluster} from '../app/lib/map-marker-layout.ts';

function renderer(zoom) {
 const source=readFileSync(new URL('../app/components/listing-map.tsx',import.meta.url),'utf8');const ast=ts.createSourceFile('map.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let initializer;
 const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='renderMarkers')initializer=node.initializer.getText(ast);ts.forEachChild(node,visit)};visit(ast);assert.ok(initializer);
 const rendered=[],spreads=[],camera=[];const points=[{id:'a',name:'A',lat:32.08,lng:34.78,markerKind:'price',markerLabel:'₪700'},{id:'b',name:'B',lat:32.08005,lng:34.78005,markerKind:'price',markerLabel:'₪950'}];
 const point=(x,y)=>({x,y,distanceTo(p){return Math.hypot(x-p.x,y-p.y)}});
 const L={point,latLng:(lat,lng)=>({lat,lng,distanceTo(p){const a=Array.isArray(p)?p:[p.lat,p.lng];return Math.hypot(lat-a[0],lng-a[1])*111000}}),divIcon:v=>v,latLngBounds:()=>({pad(){return this}}),DomEvent:{stopPropagation(){}},marker:(coordinate,options)=>{const handlers={},element={setAttribute(){},addEventListener(){},classList:{add(){}}};const marker={coordinate,options,handlers,addTo(){rendered.push(marker);return this},getElement:()=>element,on(event,handler){handlers[event]=handler;return this},setZIndexOffset(){}};return marker}};
 const map={getZoom:()=>zoom,latLngToContainerPoint:([lat,lng])=>point(lat*100000,lng*100000),getBoundsZoom:()=>zoom+2,fitBounds:()=>camera.push('fit'),setView:()=>camera.push('view'),panInside:()=>camera.push('pan')};
 const deps={L,map,container:{setAttribute(){}},markerLayer:{clearLayers(){rendered.length=0}},markerRegistry:new Map(),placesRef:{current:points},single:false,language:'he',mapControlCopy:{cluster:'open'},selectedIdRef:{current:''},hoveredPlaceId:{current:null},expandedPlaceIds:new Set(),spreadMapCluster,spiderfyCluster:entries=>spreads.push(entries.map(p=>p.id)),safeMarkerLabel:v=>v,markerIcon:()=>'',tone:'vacation',clusterActivationEvent:undefined,setSelectedId(){},suppressProgrammaticViewportPrompt(){},selectPlace(){},bindPlaceMarkerInteraction(){},enableMarkerKeyboardActivation(){}};
 const code=ts.transpileModule('return '+initializer,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;const render=new Function(...Object.keys(deps),code)(...Object.values(deps));render();return{rendered,spreads,camera,points};
}
test('actual shared renderer does not move distinct places into a ring at city zoom; cluster click zooms to real coordinates',()=>{
 const h=renderer(12);assert.equal(h.rendered.length,1);assert.equal(h.spreads.length,0);assert.ok(h.points.some(p=>p.lat===h.rendered[0].coordinate.lat&&p.lng===h.rendered[0].coordinate.lng));h.rendered[0].handlers.click({});assert.equal(h.spreads.length,0);assert.deepEqual(h.camera,['fit']);
});
test('actual shared renderer retains an actionable overlap at maximum zoom rather than leaving an inaccessible cluster',()=>{
 const h=renderer(19);assert.equal(h.rendered.length,1);h.rendered[0].handlers.click({});assert.deepEqual(h.spreads,[['a','b']]);assert.deepEqual(h.camera,['pan']);
});
