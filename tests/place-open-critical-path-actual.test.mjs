import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {placeRecommendationPayload} from '../app/lib/place-recommendation-payload.ts';
import {nearbyRecommendations} from '../app/lib/nearby-recommendations.ts';
import {attachVerifiedSupplierVideo} from '../app/lib/verified-supplier-videos.ts';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function exportedFunctions(path,names){const source=read(path),ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);return ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name?.text)).map(n=>n.getText(ast).replace(/^export default /,'').replace(/^export /,'')).join('\n')}
function catalogReader({entry,state,bundle}){const source=exportedFunctions('app/lib/public-catalog-read.ts',['publicCatalogDetail','loadPublicCatalogDetail','hasCompleteAcceptedDetail']);const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;return new Function('publicCatalogDatabase','readSupplierCatalogEntry','readSupplierCatalogState','acceptedSergeyDetail','mergeBundledDetail','projectSergeyPublicCatalogValue','readOnceInServerRequest',js+';return {publicCatalogDetail,hasCompleteAcceptedDetail};')(async()=>({database:{}}),async()=>entry,async()=>state,bundle,(accepted,fallback)=>({...fallback,...accepted}),v=>v,async (_key,load)=>await load())}
test('actual detail reader never loads the multi-business bundle for complete verified runtime detail or accepted removal',async()=>{
 let bundleReads=0;const now=Date.now();const detail={rooms:[],images:[],_viiCatalog:{checkedAt:new Date(now-2000).toISOString(),attemptedAt:new Date(now-1000).toISOString()}};
 const f=catalogReader({entry:{detail},state:{activeRunId:'run'},bundle:()=>{bundleReads++;return new Promise(()=>{})}});
 assert.equal(await f.publicCatalogDetail('vacations',1),detail);assert.equal(bundleReads,0);
 const removed=catalogReader({entry:null,state:{activeRunId:'run'},bundle:()=>{throw Error('removed place bundle forbidden')}});assert.equal(await removed.publicCatalogDetail('events',1),null);
});
test('actual detail reader keeps incomplete/unknown/failed verification on bundled merge path',async()=>{
 let calls=0;const fallback={rooms:['bundled-room']};for(const detail of [{name:'old'}, {_viiCatalog:{checkedAt:'invalid',attemptedAt:'invalid'}},{_viiCatalog:{checkedAt:'2999-01-01',attemptedAt:'2999-01-02'}}]){
 const f=catalogReader({entry:{detail},state:{activeRunId:'run'},bundle:async()=>{calls++;return fallback}});assert.deepEqual((await f.publicCatalogDetail('vacations',1)).rooms,['bundled-room']);}
 assert.equal(calls,3);
});
test('actual place recommendation payload preserves all search facets and exactly the existing recommendation identities',()=>{
 for(const world of ['spa','hourly','providers','activities']){
 const items=Array.from({length:160},(_,i)=>({id:world+'-'+i,world,name:'Place'+i,area:'צפון',location:'City'+i,lat:32+i*.0001,lng:35,image:'/verified-'+i+'.jpg',images:Array.from({length:30},(_,n)=>'/verified-'+i+'-'+n+'.jpg'),description:'description '.repeat(100),features:['בריכה'],serviceAreas:['צפון']}));
 const item=items[0];const old=nearbyRecommendations(items,item,{key:x=>x.id,exclude:item.id}).items;const next=placeRecommendationPayload(item,items);
 assert.deepEqual(next.relatedItems.map(x=>x.id),old.map(x=>x.id));assert.equal(next.searchInventory.length,161);assert.deepEqual(next.searchInventory.map(x=>x.location),[item,...items].map(x=>x.location));
 assert.ok(JSON.stringify(next).length<JSON.stringify(items).length*.15);
 }
});
test('actual business Page returns its primary content without starting below-fold CMS reads, and deferred content still completes',async()=>{
 const source=exportedFunctions('app/business/page.tsx',['Page','normalizedParams','queryValue','BusinessComplementaryContent']);const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText;
 const jsx=(type,props)=>({type,props});const jsxRuntime={jsx,jsxs:jsx,Fragment:'Fragment'};const property={slug:'vacation-1',name:'Verified place',area:'צפון',location:'עיר',images:['/real.jpg'],capacityScope:'unit',contact:{},type:'וילה'};let cmsReads=0;let release;const slow=new Promise(resolve=>release=resolve);
 const env={Suspense:'Suspense',BusinessPage:'BusinessPage',BusinessComplementarySections:'BusinessComplementarySections',supplierLegacySlug:()=>null,unavailableLegacySearchHref:()=>null,resolveProperty:async()=>property,loadProperties:async()=>[property],publicCatalogDetail:async()=>({rooms:[]}),supplierPlaceDetail:()=>null,spaPlacesFromSites:()=>[],discoveryItems:[],trails:[],managedTrails:()=>{cmsReads++;return slow},bundledPublicCatalogSummaries:async()=>[],managedDiscoveryItems:()=>{cmsReads++;return slow},nearbyRecommendations:()=>({items:[]}),nearbyTrails:()=>[],getListingOfferings:()=>[{world:'vacation'}],currentPeriodOffer:()=>undefined,propertyFaq:[],vacationBreadcrumbTrailForProperty:()=>[],notFound:()=>{throw Error('notFound')},ViewedItemBootstrap:'Viewed',StructuredData:'Schema',lodgingSchema:()=>({}),breadcrumbSchema:()=>({}),faqSchema:()=>({})};
 Object.assign(env,{attachVerifiedSupplierVideo});
 const exports={};const f=new Function('require','exports',...Object.keys(env),js+';return {Page,BusinessComplementaryContent};')(()=>jsxRuntime,exports,...Object.values(env));
 const tree=await f.Page({searchParams:Promise.resolve({id:'vacation-1'})});assert.equal(cmsReads,0);assert.ok(JSON.stringify(tree).includes('Verified place'));
 const deferred=f.BusinessComplementaryContent({property});assert.equal(cmsReads,2);release([]);assert.equal((await deferred).type,'BusinessComplementarySections');
});

test('actual canonical and query event pages return before full related inventory and keep the deferred slot',async()=>{
 for(const [path,childName,props]of [['app/events/place/[id]/page.tsx','EventRelatedSlotAsync',{params:Promise.resolve({id:'event-2'}),searchParams:Promise.resolve({})}],['app/events/place/page.tsx','EventRelatedContent',{searchParams:Promise.resolve({id:'event-2'})}]]){
 const source=exportedFunctions(path,['Page',childName]);const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText;
 const jsx=(type,props)=>({type,props});const place={slug:'event-2',name:'Event place',location:'City',area:'North',type:'לופט',guests:20};let reads=0;let release;const pending=new Promise(resolve=>release=resolve);
 const env={Suspense:'Suspense',resolvePlace:async()=>place,publicCatalogDetail:async()=>({images:['/real.jpg']}),validDate:()=>false,redirect:()=>{throw Error('unexpected_redirect')},serverPublicCopy:async()=>({language:'he',translate:x=>x}),localizedEventPlace:x=>x,eventPlaceHref:p=>'/events/place/'+p.slug,eventBreadcrumbsForLocation:()=>[],eventVenueSchema:()=>({}),breadcrumbSchema:()=>({}),ViewedItemBootstrap:'Viewed',StructuredData:'Schema',EventPlacePage:'EventPlacePage',providerProfiles:[],loadPlaces:()=>{reads++;return pending},EventRelatedSlot:'EventRelatedSlot'};
 const f=new Function('require','exports',...Object.keys(env),js+';return {Page,child:'+childName+'};')(()=>({jsx,jsxs:jsx,Fragment:'Fragment'}),{},...Object.values(env));
 const result=await f.Page(props);assert.equal(reads,0,path);assert.ok(JSON.stringify(result).includes('Event place'));
 const deferred=f.child({place});assert.equal(reads,1);release([place]);assert.equal((await deferred).type,'EventRelatedSlot');
 }
});
