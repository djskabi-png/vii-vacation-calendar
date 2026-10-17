// LOCAL QA ONLY. Render the actual built UI and execute the actual candidate
// availability handlers with read-only public VII data adapters. No secrets,
// synthetic venues/offers, booking, lead, review or catalog writes. This is not
// the hosted D1/provider runtime and cannot prove publication or provider auth.
import http from 'node:http';
import fs from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {resolve,extname,sep} from 'node:path';
import {Readable} from 'node:stream';
import worker from '../dist/server/index.js';
import {regionalAvailabilityRegion,regionalPublishedIds} from '../app/lib/regional-availability.ts';
import {matchesSearchLocation} from '../app/data/search-taxonomy.ts';
import {spaPlusArea} from '../app/data/spa-regions.ts';
import {selectSpaPackageDeals} from '../app/lib/spa-package-deals.ts';
import {eventDealDate} from '../app/lib/event-deal-dates.ts';
import {homeDealPeriods} from '../app/lib/vii-home-deals.ts';
import {validDate} from '../app/lib/vii-live-search.ts';
const origin='https://vii.spaplus.co';
const manifestPath=process.argv[2];
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
manifest.ownedProcesses.push({pid:process.pid,parentPid:process.ppid,purpose:'Built regional availability UI + candidate handlers, real public read adapters only',command:'node scripts/preview-regional-availability.mjs',startedAt:new Date().toISOString(),status:'running',port:4365});
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2));
const root=resolve('dist/client');
const mime={'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json'};
const assets={async fetch(request){const path=resolve(root,'.'+decodeURIComponent(new URL(request.url).pathname));if(!path.startsWith(root+sep))return new Response('Not found',{status:404});try{return new Response(await fs.readFile(path),{headers:{'Content-Type':mime[extname(path)]||'application/octet-stream'}});}catch{return new Response('Not found',{status:404});}}};
const sources={};
for(const [path,method] of [['vii/home-deals','GET'],['vii/live-search','POST'],['spa/deals','GET']]) {
  const source=await fs.readFile(`app/api/${path}/route.ts`,'utf8');
  sources[`/api/${path}`]={method,compiled:stripTypeScriptTypes(source.replace(/^import .*;\r?$/gm,''),{mode:'strip'}).replace(`export async function ${method}`,`async function ${method}`)};
}
async function json(path,init){const response=await fetch(origin+path,{...init,cache:'no-store',signal:AbortSignal.timeout(25000)});if(!response.ok)throw new Error('public_read_unavailable');return response.json();}
async function candidateAPI(request){
 const url=new URL(request.url);const source=sources[url.pathname];
 const reads=new Map();
 const catalog=world=>{if(!reads.has(world))reads.set(world,json(`/api/catalog?world=${world}`).then(body=>body.entries.map(entry=>({...entry.summary,supplierId:entry.supplierId}))));return reads.get(world);};
 let homeResult;
 const home=()=>homeResult??=(json(`/api/vii/home-deals?${new URLSearchParams({period:url.searchParams.get('period')||'tomorrow',locale:url.searchParams.get('locale')||'he'})}`));
 const dependencies={
  regionalAvailabilityRegion,regionalPublishedIds,matchesSearchLocation,spaPlusArea,selectSpaPackageDeals,eventDealDate,homeDealPeriods,validDate,
  isContentLocale:value=>['he','en','ru','fr'].includes(value),
  supplierToken:async()=>'local-public-read-adapter-not-a-provider-token',
  publicCatalogSummaries:catalog,
  publishedSupplierIds:async world=>new Set((await catalog(world)).map(place=>place.supplierId)),
  publicCatalogSelectedSummaries:async(world,ids)=>(await catalog(world)).filter(place=>ids.includes(place.supplierId)).slice(0,8),
  readHomeDisplaySettings:async()=>(await home()).display,
  getHomeDeals:async options=>{const body=await home();return{...body,deals:body.deals.filter(deal=>options.publicSiteIds.has(deal.siteID)&&deal.priceGuests===options.guests)};},
  liveSupplierSearch:async options=>{const body=await json('/api/vii/live-search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({world:options.world,from:options.from,till:options.till,guests:options.guests,...(options.slot?{slot:options.slot}:{})})});return{...body,results:body.results.filter(offer=>options.publishedIds.has(offer.siteID))};},
  readSpaAvailability:async()=>(await json('/api/spa/availability')).availability,
 };
 const handler=new Function(...Object.keys(dependencies),`${source.compiled};return ${source.method};`)(...Object.values(dependencies));
 return handler(request);
}
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,origin);let response;
 const localAPI=sources[url.pathname];
 if(req.method!=='GET'&&req.method!=='HEAD'&&!(req.method==='POST'&&url.pathname==='/api/vii/live-search')){res.writeHead(405);res.end();return;}
 if(localAPI){let body='';for await(const chunk of req){body+=chunk;if(body.length>32768){res.writeHead(413);res.end();return;}}response=await candidateAPI(new Request(url,{method:req.method,headers:req.headers,...(body?{body}:{})}));}
 else if(url.pathname.startsWith('/api/')||url.pathname==='/_vinext/image')response=await fetch(origin+url.pathname+url.search,{signal:AbortSignal.timeout(25000)});
 else {response=await assets.fetch(new Request(url));if(response.status===404)response=await worker.fetch(new Request(url,{headers:req.headers}),{ASSETS:assets},{waitUntil(p){p.catch(()=>{});},passThroughOnException(){}});}
 const headers=Object.fromEntries(response.headers);for(const key of ['content-encoding','content-length','transfer-encoding'])delete headers[key];
 res.writeHead(response.status,{...headers,'X-VII-Local-QA':'candidate handlers;read-only public data adapters;not production'});if(response.body)Readable.fromWeb(response.body).pipe(res);else res.end();
 }catch{res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"local_public_read_unavailable"}');}
});
server.listen(4365,'127.0.0.1',()=>console.log(`OWNED_PID=${process.pid} http://127.0.0.1:4365`));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
