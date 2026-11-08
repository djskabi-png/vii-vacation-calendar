import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {validMapCoordinate} from '../app/lib/map-marker-layout.ts';
import {listingMapPrecision,discoveryMapPrecision} from '../app/lib/map/coordinate-precision.ts';

function wrappers(){
 const jsx=(type,props,key)=>({type,props,key});const deps={'react':{useMemo:fn=>fn()},'react/jsx-runtime':{jsx,jsxs:jsx},'../i18n/locale-provider':{useSiteLanguage:()=>({language:'he',translate:v=>v})},'../i18n/localized-business-content':{localizedBusinessText:v=>v,latinBusinessAlias:()=>''},'../lib/map-marker-layout':{validMapCoordinate},'../lib/map-marker-layout.ts':{validMapCoordinate},'../map-marker-layout.ts':{validMapCoordinate},'../lib/map-price':{validMapPrice:()=>false,verifiedPriceFromLabel:()=>null,formatMapPrice:()=>'',priceModeFromLabel:()=>"from"},'../lib/map-price.ts':{validMapPrice:()=>false,verifiedPriceFromLabel:()=>null,formatMapPrice:()=>'',priceModeFromLabel:()=>"from"},'../map-price.ts':{validMapPrice:()=>false,verifiedPriceFromLabel:()=>null,formatMapPrice:()=>'',priceModeFromLabel:()=>"from"},'../lib/event-place-href':{eventPlaceHref:p=>'/events/place/'+p.slug},'../lib/event-place-href.ts':{eventPlaceHref:p=>'/events/place/'+p.slug},'../event-place-href.ts':{eventPlaceHref:p=>'/events/place/'+p.slug},'../../i18n/localized-business-content.ts':{localizedBusinessText:v=>v,latinBusinessAlias:()=>''},'../../i18n/localized-business-content':{localizedBusinessText:v=>v,latinBusinessAlias:()=>''}};
 deps['./coordinate-precision.ts']={listingMapPrecision,discoveryMapPrecision};
 deps['./map/map-provider-host']={MapProviderHost:function MapProviderHost(){},preloadDefaultMapProvider:async()=>null};
 const adapterCode=ts.transpileModule(readFileSync(new URL('../app/lib/map/map-place.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;const adapterExports={};new Function('require','exports',adapterCode)(name=>deps[name]||{},adapterExports);deps['../lib/map/map-place']=adapterExports;
 const code=ts.transpileModule(readFileSync(new URL('../app/components/listing-map.tsx',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;const exports={};new Function('require','exports',code)(name=>deps[name]||{},exports);return exports;
}
const listing=id=>({slug:id,name:id,location:'צפון',area:'צפון',lat:32.8,lng:35.5,image:'/source.jpg',type:'וילה',guests:4});
test('actual listing wrapper retains provider host identity through catalog growth and ordering; a deliberate geography change refocuses',()=>{
 const {ListingMap}=wrappers(),a=listing('a'),b=listing('b');
 const first=ListingMap({listings:[a],initialListings:[a],focusKey:'north'}),grown=ListingMap({listings:[a,b],initialListings:[a,b],focusKey:'north'}),reordered=ListingMap({listings:[b,a],initialListings:[b,a],focusKey:'north'}),changed=ListingMap({listings:[b],initialListings:[b],focusKey:'south'});
 assert.equal(first.key,grown.key);assert.equal(first.key,reordered.key);assert.notEqual(first.key,changed.key);assert.equal(grown.props.places.length,2);
 assert.equal(first.type.name,'MapProviderHost');assert.equal(first.type,grown.type);assert.equal(grown.type,reordered.type);
});
test('actual discovery wrapper preserves a live map on refreshed results and single-place navigation focuses the new place',()=>{
 const {DiscoveryMap,ListingMap}=wrappers(),a={id:'spa-a',name:'A',location:'צפון',area:'צפון',image:'/a.jpg',features:[],description:'',lat:32.8,lng:35.5};const b={...a,id:'spa-b'};
 assert.equal(DiscoveryMap({items:[a],initialItems:[a],tone:'spa',focusKey:'north'}).key,DiscoveryMap({items:[a,b],initialItems:[a,b],tone:'spa',focusKey:'north'}).key);
 assert.notEqual(ListingMap({listings:[listing('a')],single:true}).key,ListingMap({listings:[listing('b')],single:true}).key);
});

test('actual provider initialization wakes after an empty result stream without restarting for positive catalog growth',async()=>{
 const source=readFileSync(new URL('../app/components/map/leaflet-places-map.tsx',import.meta.url),'utf8');
 const ast=ts.createSourceFile('map.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let effect,deps;
 const visit=n=>{if(ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect'&&n.arguments[0]?.getText(ast).includes('const map = L.map(container')){effect=n.arguments[0];deps=n.arguments[1];}ts.forEachChild(n,visit);};visit(ast);
 assert.ok(effect&&deps);
 const compile=n=>ts.transpileModule('const result='+n.getText(ast)+';',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';return result;';
 const evaluate=(node,ctx)=>Function('ctx','with(ctx){'+compile(node)+'}')(ctx);
 let starts=0;const errors=[];const noop=()=>{};
 const ctx={providerError:null,enabled:true,hasPlaces:false,interactive:true,selectPlace:noop,single:false,tone:'events',language:'he',cardCopy:{openCluster:'cluster'},mapControlCopy:{cluster:'cluster',zoomIn:'in',zoomOut:'out'},providerRetry:0,mapElement:{current:{}},markerInstances:{current:new Map()},suppressViewportPrompt:{current:false},setViewportDirty:noop,setPendingVisibleIds:noop,setMapReady:noop,keepMapFocusInViewport:()=>noop,setProviderError:e=>errors.push(e),preloadLeaflet:()=>Promise.resolve({map(){starts++;throw Error('fixture-constructor-stop');}})};
 ctx.mapInstance={current:null};
 let lastDeps;function render(hasPlaces){ctx.hasPlaces=hasPlaces;const next=evaluate(deps,ctx);if(!lastDeps||next.some((value,index)=>!Object.is(value,lastDeps[index]))){lastDeps=next;evaluate(effect,ctx)();}}
 render(false);await Promise.resolve();assert.equal(starts,0);
 render(true);await Promise.resolve();await Promise.resolve();assert.equal(starts,1,'data arriving after opening must initialize the provider');
 render(true);await Promise.resolve();assert.equal(starts,1,'positive result growth must reconcile markers without recreating the map');
 assert.equal(errors[0]?.message,'fixture-constructor-stop');
});
