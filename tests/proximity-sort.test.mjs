import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
function load(file, imports={}) {
 const source=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const module={exports:{}};new Function('require','module','exports',code)(name=>imports[name]||{},module,module.exports);return module.exports;
}
const proximity=load('app/lib/proximity-sort.ts');
const sort=load('app/lib/discovery-result-sort.ts',{'./proximity-sort':proximity,'./proximity-sort.ts':proximity,'./discovery-slider-order':{discoverySeedCompare:(a,b)=>String(a).localeCompare(String(b))},'./discovery-slider-order.ts':{discoverySeedCompare:(a,b)=>String(a).localeCompare(String(b))}});
test('nearest sorts the complete inventory globally, with missing and invalid coordinates last',()=>{
 const origin={lat:32.0853,lng:34.7818};
 const items=Array.from({length:150},(_,i)=>({id:String(i),lat:origin.lat+i*.01,lng:origin.lng})).reverse();
 items.splice(1,0,{id:'unknown'},{id:'invalid',lat:100,lng:0},{id:'null',lat:null,lng:null});
 const result=sort.orderDiscoveryResults(items,'nearest','seed',{id:x=>x.id,name:x=>x.id,distance:x=>proximity.proximityDistance(origin,x)});
 assert.equal(result.length,153);assert.equal(result[0].id,'0');assert.equal(result[149].id,'149');assert.deepEqual(result.slice(-3).map(x=>x.id),['unknown','invalid','null']);
 assert.equal(new Set(result.map(x=>x.id)).size,153);
 const distances=result.slice(0,150).map(x=>proximity.proximityDistance(origin,x));assert.ok(distances.every((d,i)=>!i||d>=distances[i-1]));
});
test('no browser origin preserves prior order, zero distance is known, and antipodal points stay finite',()=>{
 const data=[{id:'b'},{id:'a'}];assert.deepEqual(proximity.orderByProximity(data,()=>undefined),data);
 assert.equal(proximity.proximityDistance({lat:0,lng:0},{lat:0,lng:0}),0);
 assert.ok(Number.isFinite(proximity.proximityDistance({lat:0,lng:0},{lat:0,lng:180})));
 assert.equal(proximity.proximityDistance(null,{lat:32,lng:35}),undefined);
 assert.equal(proximity.proximityDistance({lat:32,lng:35},{lat:'32',lng:35}),undefined);
});
test('all seven result families wire browser origin into the shared order before progressive display',()=>{
 for(const file of ['app/search/page.tsx','app/events/search/page.tsx','app/components/hourly-results.tsx','app/components/world-map-results.tsx','app/components/provider-results.tsx','app/attractions/attractions-explorer.tsx','app/trails/trails-explorer.tsx']){
  const source=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');assert.match(source,/useNearbySort\(\)/,file);assert.match(source,/NearbySortStatus/,file);assert.match(source,/nearby(?:\.distance|Distance)/,file);
 }
 const options=sort.discoverySortOptions([],{id:x=>x.id,name:x=>x.id},'he');assert.equal(options.find(x=>x.value==='nearest').label,'קרוב אליי');
});
test('actual browser origin helper deduplicates requests, caches in this session and does not transmit coordinates',async()=>{
 const previous={window:globalThis.window,navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator'),sessionStorage:globalThis.sessionStorage};
 let success,requests=0;const storage=new Map();
 globalThis.window={setTimeout,clearTimeout};Object.defineProperty(globalThis,'navigator',{configurable:true,value:{geolocation:{getCurrentPosition(fn){requests++;success=fn}}}});globalThis.sessionStorage={getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)};
 try{
  const helper=load('app/components/use-nearby-sort.tsx');
  // The helper imports validators but does not perform a network request.
  const live=load('app/components/use-nearby-sort.tsx',{'../lib/proximity-sort':proximity});
  const first=live.requestNearbyOrigin(),second=live.requestNearbyOrigin();assert.equal(first,second);assert.equal(requests,1);
  success({coords:{latitude:32.1,longitude:34.8}});assert.deepEqual(await first,{lat:32.1,lng:34.8});assert.deepEqual(await live.requestNearbyOrigin(),{lat:32.1,lng:34.8});assert.equal(requests,1);
  const source=fs.readFileSync(new URL('../app/components/use-nearby-sort.tsx',import.meta.url),'utf8');assert.doesNotMatch(source,/fetch\(|localStorage|track/);assert.match(source,/sessionStorage/);
 }finally{globalThis.window=previous.window;if(previous.navigator)Object.defineProperty(globalThis,'navigator',previous.navigator);else delete globalThis.navigator;globalThis.sessionStorage=previous.sessionStorage;}
});
test('actual location request rejects denied access and permits a later explicit retry',async()=>{
 const previous={window:globalThis.window,navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator'),sessionStorage:globalThis.sessionStorage};let requests=0;
 globalThis.window={setTimeout,clearTimeout};globalThis.sessionStorage={getItem:()=>null,setItem:()=>{}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{geolocation:{getCurrentPosition(ok,fail){requests++;if(requests===1)fail({code:1});else ok({coords:{latitude:31.8,longitude:35.2}})}}}});
 try{const live=load('app/components/use-nearby-sort.tsx',{'../lib/proximity-sort':proximity});await assert.rejects(live.requestNearbyOrigin());assert.deepEqual(await live.requestNearbyOrigin(),{lat:31.8,lng:35.2});assert.equal(requests,2);}finally{globalThis.window=previous.window;if(previous.navigator)Object.defineProperty(globalThis,'navigator',previous.navigator);globalThis.sessionStorage=previous.sessionStorage;}
});
