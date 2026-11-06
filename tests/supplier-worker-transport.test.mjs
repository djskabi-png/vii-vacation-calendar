import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite/package.json')]}));
const {Miniflare,Log,LogLevel}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}));

test('real supplier adapters construct supported Worker requests and reject redirects without forwarding credentials',{timeout:20000},async()=>{
 const contents=`import {createMaxCompoundsClient} from './app/lib/max-compounds-api.ts';import {createSergeyViiClient} from './app/lib/sergey-vii-api.ts';import {fetchCapabilityProbe} from './app/lib/online-booking-capability.ts';import {fetchStartingPriceCatalog} from './app/lib/supplier-starting-price.ts';
 export default {async fetch(request){const redirect=new URL(request.url).searchParams.has('redirect');const calls=[];const place={siteID:116,siteName:'Synthetic fixture',active:true,has_availability:true,location:{cityID:7},galleries:[{pictures:['/gallery/fixture.jpeg']}],startPriceWinter:1000};const fetcher=async(url,init)=>{const constructed=new Request(url,init);calls.push({url:constructed.url,redirect:constructed.redirect});if(redirect)return Response.json({ok:true,data:{siteID:116}},{status:302,headers:{Location:'https://untrusted.invalid'}});if(url.includes('/partner/'))return Response.json({ok:true,data:{siteID:116}});if(url.endsWith('/locations'))return Response.json({cities:[{id:7,title:'Fixture',area:3}],areas:[{id:3,title:'Fixture area'}]});if(url.endsWith('/search'))return Response.json({sites:[{siteID:116,onlineBooking:true}]});return Response.json({places:[place]});};const outcomes={};for(const [name,run] of [['compounds',()=>createMaxCompoundsClient({apiKey:'synthetic',fetchImpl:fetcher}).site(116)],['supplier',()=>createSergeyViiClient({apiKey:'synthetic',fetchImpl:fetcher}).list('vacations')],['capability',()=>fetchCapabilityProbe('synthetic',{},Date.now(),fetcher)],['startingPrice',()=>fetchStartingPriceCatalog('vacations','synthetic',fetcher)]]){try{outcomes[name]={ok:true,value:await run()};}catch(error){outcomes[name]={ok:false,code:error.code||error.message};}}return Response.json({outcomes,calls});}};`;
 const bundle=await build({stdin:{contents,resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'esm',platform:'browser',target:'es2022',write:false,external:['cloudflare:workers']});
 const mf=new Miniflare({log:new Log(LogLevel.WARN),modules:[{type:'ESModule',path:'supplier-worker-transport-fixture.mjs',contents:bundle.outputFiles[0].text}],compatibilityDate:'2026-05-22',compatibilityFlags:['nodejs_compat']});
 try{
  const result=await (await mf.dispatchFetch('https://fixture.invalid/')).json();
  assert.deepEqual(Object.fromEntries(Object.entries(result.outcomes).map(([k,v])=>[k,v.ok])),{compounds:true,supplier:true,capability:true,startingPrice:true});
  assert.equal(result.outcomes.compounds.value.siteID,116);assert.equal(result.outcomes.supplier.value.length,1);assert.ok(result.outcomes.capability.value['vacation-116']);assert.equal(result.outcomes.startingPrice.value['vacation-116'].startPriceWinter,1000);assert.ok(result.calls.length>=6);assert.ok(result.calls.every(call=>call.redirect==='manual'));
  const rejected=await (await mf.dispatchFetch('https://fixture.invalid/?redirect=1')).json();assert.ok(Object.values(rejected.outcomes).every(row=>row.ok===false));assert.ok(rejected.calls.every(call=>new URL(call.url).hostname==='bizonline.co.il'));assert.equal(rejected.calls.length,5);
 }finally{await mf.dispose();}
});
