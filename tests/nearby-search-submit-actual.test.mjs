import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { semanticNearbyPath } from '../app/lib/homepage-search-href.ts';
const source=fs.readFileSync(new URL('../app/components/search-box.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('search-box.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function actualFunction(name,ctx){let found;function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text===name)found=node;ts.forEachChild(node,visit)}visit(ast);assert.ok(found,name);
 const code=ts.transpileModule(found.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return new Function('ctx',`with(ctx){${code};return ${name};}`)(ctx);
}
test('actual nearby choice preserves the browser point for ranking and does not narrow to a city',async()=>{
 let selection,status;const ctx={locating:false,setLocating:()=>{},setLocationStatus:value=>{status=value},requestNearbyOrigin:async()=>({lat:32.08,lng:34.78}),chooseLocation:(...args)=>{selection=args}};
 await actualFunction('chooseNearbyLocation',ctx)();assert.deepEqual(selection,['כל הארץ',true]);
 ctx.requestNearbyOrigin=async()=>{throw Error('denied')};selection=undefined;await actualFunction('chooseNearbyLocation',ctx)();assert.equal(selection,undefined);assert.match(status,/לא הצלחנו/);
});
for(const mode of ['vacation','events','spa','hourly'])test(`actual ${mode} submission uses the canonical nearby page without coordinates and retains date/party context`,()=>{
 let target,tracking;const emptyRange={from:'2026-11-26',till:'2026-11-28',to:'2026-11-28'};
 const ctx={isSearchingRef:{current:false},setIsSearching:()=>{},setSearchCommitted:()=>{},closeMobileSearch:()=>{},locationValueRef:{current:'כל הארץ'},canonicalSearchLocation:value=>value,
 maximumPrice:0,spaAudience:null,spaDateRef:{current:{date:'2026-11-26',withoutDate:false}},guests:5,eventDateRangeRef:{current:emptyRange},vacationPartyRef:{current:{adults:3,children:2,infants:0,pets:0,rooms:2}},vacationDateRangeRef:{current:emptyRange},vacationFlexibleSearchRef:{current:null},
 mode,isHourly:mode==='hourly',vacationType:mode==='vacation'?'וילות':undefined,cleanAccommodationPath:()=>'/villas',cleanVacationPath:()=>'/vacations',spaSearchHref:()=>'/spas/spa-with-pool',spaSearchStateFromValues:()=>({}),initialSpaFeatures:mode==='spa'?['pool','heated-pool']:[],eventSearchHref:()=>'/events/search',hourlySearchHref:()=>'/hourly',basePath:undefined,initialLocation:undefined,
 mergeSearchHref:(route,params)=>route+(params.size?'?'+params:''),searchParamsKey:'',language:'he',isWholeCountrySelection:value=>value==='כל הארץ',nearbySelectionRef:{current:true},
 window:{location:{origin:'https://vii.spaplus.co',pathname:'/old',search:''},setTimeout:()=>0},trackSearchSubmitted:value=>{tracking=value},localizedPath:path=>path,router:{push:value=>{target=value}}};
 ctx.semanticNearbyPath=semanticNearbyPath;
 actualFunction('search',ctx)();assert.ok(target);const url=new URL(target,'https://vii.spaplus.co');assert.equal(url.searchParams.has('sort'),false);assert.equal(url.searchParams.has('lat'),false);assert.equal(url.searchParams.has('lng'),false);assert.doesNotMatch(target,/32\.08|34\.78/);
 assert.equal(url.pathname,{vacation:'/vacations/near-me',events:'/events/near-me',spa:'/spas/near-me',hourly:'/hourly/near-me'}[mode]);
 if(mode==='vacation')assert.equal(url.searchParams.get('type'),'וילות');
 if(mode==='spa')assert.equal(url.searchParams.get('features'),'pool,heated-pool');
 assert.equal(tracking.location,'כל הארץ');if(mode==='vacation'){assert.equal(url.searchParams.get('from'),'2026-11-26');assert.equal(url.searchParams.get('children'),'2');assert.equal(url.searchParams.get('rooms'),'2')}
 if(mode==='spa')assert.equal(url.searchParams.get('date'),'2026-11-26');if(mode==='events')assert.equal(url.searchParams.get('guests'),'5');
});
test('actual location choice auto-submits only on desktop and preserves mobile stages',()=>{
 for(const desktop of [false,true]){let searched=false,step,nearest;const ctx={nearbySelectionRef:{current:false},setNearbySelection:value=>{nearest=value},canonicalSearchLocation:value=>value,locationValueRef:{current:''},setLocationValue:()=>{},recentDestinations:()=>[],recentLocations:[],destinations:[],setRecentLocations:()=>{},localStorage:{setItem:()=>{}},setLocationOpen:()=>{},setLocationQuery:()=>{},setLocationStatus:()=>{},isDesktopSearchViewport:()=>desktop,search:()=>{searched=true},isHourly:false,setMobileStep:value=>{step=value},setMobileExpanded:()=>{},setCalendarOpen:()=>{}};
 actualFunction('chooseLocation',ctx)('כל הארץ',true);assert.equal(searched,desktop);assert.equal(nearest,true);if(!desktop)assert.equal(step,'dates');
 }
});
