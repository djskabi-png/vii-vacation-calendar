import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {validMapCoordinate} from '../app/lib/map-marker-layout.ts';

function wrappers(){
 const jsx=(type,props,key)=>({type,props,key});const deps={'react':{useMemo:fn=>fn()},'react/jsx-runtime':{jsx,jsxs:jsx},'../i18n/locale-provider':{useSiteLanguage:()=>({language:'he',translate:v=>v})},'../i18n/localized-business-content':{localizedBusinessText:v=>v,latinBusinessAlias:()=>''},'../lib/map-marker-layout':{validMapCoordinate},'../lib/map-price':{validMapPrice:()=>false,verifiedPriceFromLabel:()=>null},'../lib/event-place-href':{eventPlaceHref:p=>'/events/place/'+p.slug}};
 const code=ts.transpileModule(readFileSync(new URL('../app/components/listing-map.tsx',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;const exports={};new Function('require','exports',code)(name=>deps[name]||{},exports);return exports;
}
const listing=id=>({slug:id,name:id,location:'צפון',area:'צפון',lat:32.8,lng:35.5,image:'/source.jpg',type:'וילה',guests:4});
test('actual listing wrapper retains Leaflet identity through catalog growth and ordering; a deliberate geography change refocuses',()=>{
 const {ListingMap}=wrappers(),a=listing('a'),b=listing('b');
 const first=ListingMap({listings:[a],initialListings:[a],focusKey:'north'}),grown=ListingMap({listings:[a,b],initialListings:[a,b],focusKey:'north'}),reordered=ListingMap({listings:[b,a],initialListings:[b,a],focusKey:'north'}),changed=ListingMap({listings:[b],initialListings:[b],focusKey:'south'});
 assert.equal(first.key,grown.key);assert.equal(first.key,reordered.key);assert.notEqual(first.key,changed.key);assert.equal(grown.props.places.length,2);
});
test('actual discovery wrapper preserves a live map on refreshed results and single-place navigation focuses the new place',()=>{
 const {DiscoveryMap,ListingMap}=wrappers(),a={id:'spa-a',name:'A',location:'צפון',area:'צפון',image:'/a.jpg',features:[],description:'',lat:32.8,lng:35.5};const b={...a,id:'spa-b'};
 assert.equal(DiscoveryMap({items:[a],initialItems:[a],tone:'spa',focusKey:'north'}).key,DiscoveryMap({items:[a,b],initialItems:[a,b],tone:'spa',focusKey:'north'}).key);
 assert.notEqual(ListingMap({listings:[listing('a')],single:true}).key,ListingMap({listings:[listing('b')],single:true}).key);
});
