import type { Browser, BrowserContext, Page } from '@cloudflare/playwright';
import engineDefinition from '../engine-definition.json' with {type:'json'};
import { browserWorldPaths, browserWorldHeadingMatches, browserWorldSurfaceSelectors, type PublicBrowserWorld } from './public-world-contract.ts';
import { isReadOnlyDiscoveryRequest } from './read-only-discovery.ts';
import { readNavigationMetrics, type NavigationMetrics } from './navigation-metrics.ts';

export type World = PublicBrowserWorld;
export type BrowserJob = { jobId: string; sourceVersion: string; buildId: string; engineVersion:string;world: World; device: 'desktop' | 'mobile'; scenario: 'world-shell' | 'map-open-close' | 'gallery-next' | 'responsive-shell' };
export type BrowserEnvironment = {
  PUBLIC_ORIGIN: string; EXPECTED_SOURCE_VERSION: string; EXPECTED_BUILD_ID: string;
  MAX_RUN_MS?: string; MAX_REQUESTS?: string; MAX_EVIDENCE_BYTES?: string;
  EVIDENCE?: { put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType: string }; customMetadata?: Record<string,string> }): Promise<unknown> };
};
export type BrowserFactory = { launch(): Promise<Browser> };
const worldPaths = browserWorldPaths;
const origins = new Set(['https://vii.spaplus.co','https://www.vii.co.il','https://vii-vacation-calendar.adir-naor-7510.chatgpt.site']);
const assetHosts = new Set(['tile.openstreetmap.org','a.tile.openstreetmap.org','b.tile.openstreetmap.org','c.tile.openstreetmap.org','a.basemaps.cartocdn.com','b.basemaps.cartocdn.com','c.basemaps.cartocdn.com','fonts.googleapis.com','fonts.gstatic.com']);
const cdnHost='vii-public-images.djskabi.workers.dev';
const imageWidths=new Set([384,640,750,828,960,1280,1600]),imageQualities=new Set([75,82,85,88]);
const trafficTypes=['document','script','stylesheet','image','font','fetch','other'] as const;
type TrafficType=typeof trafficTypes[number];
const emptyTraffic=()=>({resourceCounts:Object.fromEntries(trafficTypes.map(type=>[type,0])) as Record<TrafficType,number>,deniedCounts:{external:0,budget:0,write:0,admin:0,invalid:0,platform:0},writeKinds:[] as string[]});
function cdnImageUrl(url:URL){
  if(url.origin!==`https://${cdnHost}`||url.username||url.password||url.hash||url.pathname!=='/'||url.searchParams.getAll('url').length!==1||url.searchParams.getAll('w').length!==1||url.searchParams.getAll('q').length!==1||[...url.searchParams.keys()].some(key=>!['url','w','q'].includes(key)))return false;
  const source=url.searchParams.get('url')||'',width=Number(url.searchParams.get('w')),quality=Number(url.searchParams.get('q'));
  return /^\/api\/vii\/media\/[a-f0-9]{8,128}\.(?:jpe?g|png|webp|avif)$/i.test(source)&&imageWidths.has(width)&&String(width)===url.searchParams.get('w')&&imageQualities.has(quality)&&String(quality)===url.searchParams.get('q');
}
function resourceType(value:string):TrafficType{return value==='xhr'?'fetch':trafficTypes.includes(value as TrafficType)?value as TrafficType:'other';}
function actionHeader(headers:Record<string,string>){return Object.keys(headers).some(key=>['next-action','x-server-action'].includes(key.toLowerCase()));}
function passivePlatformTelemetry(method:string,url:URL,origin:string,headers:Record<string,string>){
  return origin==='https://vii.spaplus.co'&&url.origin===origin&&!url.username&&!url.password&&!actionHeader(headers)&&method==='POST'&&url.pathname.startsWith('/cdn-cgi/challenge-platform/');
}
function writeKind(url:URL,method:string,headers:Record<string,string>,origin:string){
  if(passivePlatformTelemetry(method,url,origin,headers))return 'cloudflare_challenge';
  if(actionHeader(headers)&&url.origin==='https://vii.spaplus.co')return 'server_action';
  if(url.origin==='https://vii.spaplus.co'&&url.pathname==='/api/experience/metrics')return 'experience_metrics';
  if(url.origin==='https://vii.spaplus.co'&&url.pathname==='/api/vii/live-search')return 'live_search';
  if(url.origin==='https://vii.spaplus.co'&&url.pathname==='/api/analytics/search')return 'analytics_search';
  if(url.origin==='https://vii.spaplus.co'&&url.pathname==='/api/analytics/business')return 'analytics_business';
  return 'other';
}
export function validJob(value: unknown): value is BrowserJob {
  if(!value || typeof value!=='object' || Array.isArray(value))return false;
  const job=value as Record<string,unknown>;
  return typeof job.jobId==='string' && /^[A-Za-z0-9_-]{8,120}$/.test(job.jobId)
    && typeof job.sourceVersion==='string' && /^[a-f0-9]{40}$/.test(job.sourceVersion)
    && typeof job.buildId==='string' && /^[a-f0-9-]{8,64}$/.test(job.buildId)
    && typeof job.engineVersion==='string' && /^[a-f0-9]{64}$/.test(job.engineVersion)
    && typeof job.world==='string' && Object.hasOwn(worldPaths,job.world)
    && (job.device==='desktop' || job.device==='mobile')
    && ['world-shell','map-open-close','gallery-next','responsive-shell'].includes(String(job.scenario));
}
const number = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed=Number(value); return Number.isFinite(parsed) && parsed>=min && parsed<=max ? Math.floor(parsed) : fallback;
};
class CheckFailure extends Error {}
async function bounded<T>(operation: Promise<T>, milliseconds: number, signal?: AbortSignal): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (()=>void) | undefined;
  try {
    if(signal?.aborted)throw new CheckFailure('cancelled');
    return await Promise.race([operation,new Promise<never>((_,reject)=>{
      timer=setTimeout(()=>reject(new CheckFailure('deadline_exceeded')),Math.max(1,milliseconds));
      abort=()=>reject(new CheckFailure('cancelled'));signal?.addEventListener('abort',abort,{once:true});
    })]);
  } finally { if(timer)clearTimeout(timer);if(abort)signal?.removeEventListener('abort',abort); }
}
async function close(resource: {close():Promise<unknown>} | undefined) { if(resource)await bounded(resource.close().catch(()=>undefined),1_000).catch(()=>undefined); }

export async function runBrowserJob(job: BrowserJob, env: BrowserEnvironment, factory: BrowserFactory, signal?: AbortSignal) {
  if(!validJob(job))throw new CheckFailure('invalid_job');
  if(job.engineVersion!==engineDefinition.sha256)throw new CheckFailure('engine_definition_mismatch');
  const origin=new URL(env.PUBLIC_ORIGIN).origin;
  if(!origins.has(origin) || env.PUBLIC_ORIGIN!==origin)throw new CheckFailure('target_not_allowlisted');
  if(job.sourceVersion!==env.EXPECTED_SOURCE_VERSION || job.buildId!==env.EXPECTED_BUILD_ID)throw new CheckFailure('source_definition_mismatch');
  if(job.scenario==='gallery-next' && job.world!=='vacations')return {jobId:job.jobId,status:'blocked' as const,reason:'world_gallery_contract_not_implemented',traffic:emptyTraffic()};
  const started=Date.now(),deadline=started+number(env.MAX_RUN_MS,45_000,10,60_000);
  const maxRequests=number(env.MAX_REQUESTS,180,1,300),maxEvidence=number(env.MAX_EVIDENCE_BYTES,1_000_000,256,2_000_000);
  const step=<T>(operation:()=>Promise<T>)=>{
    const remaining=deadline-Date.now();
    if(signal?.aborted)throw new CheckFailure('cancelled');
    if(remaining<=0)throw new CheckFailure('deadline_exceeded');
    return bounded(operation(),Math.min(8_000,remaining),signal);
  };
  let browser:Browser|undefined,context:BrowserContext|undefined,page:Page|undefined,finished=false,requestCount=0,blockedWrites=0,steps=0;
  const traffic=emptyTraffic();
  let status:'passed'|'failed'|'blocked'='blocked',reason:string|undefined,evidenceKey:string|undefined;
  let currentStep='launch';
  let navigationMetrics:NavigationMetrics|undefined;
  const attemptedWrites:Array<{method:string;origin:string;path:string}> = [];
  const safeWritePath=(path:string)=>path==='/api/vii/live-search'||path==='/api/experience/metrics'||path==='/api/lead'||path==='/api/booking'||path==='/api/payments'||path==='/api/admin/quality'?path:'<redacted>';
  const safeWriteOrigin=(value:string)=>origins.has(value)?value:'<external>';
  const path=job.scenario==='gallery-next'?'/business?id=vacation-116':worldPaths[job.world];
  try {
    if(signal?.aborted)throw new CheckFailure('cancelled');
    currentStep='launch';
    browser=await step(() => (factory.launch().then(async value=>{ if(finished)await close(value);return value; })));
    if(!browser)throw new CheckFailure('browser_launch_unavailable');
    context=await step(() => (browser!.newContext({viewport:job.device==='mobile'?{width:390,height:844}:{width:1440,height:900},serviceWorkers:'block',acceptDownloads:false})));
    // Interception precedes page creation and applies to popup/subframe requests.
    await step(() => (context!.route('**/*',async route=>{
      const request=route.request();requestCount++;traffic.resourceCounts[resourceType(request.resourceType())]++;
      let url:URL;try{url=new URL(request.url());}catch{traffic.deniedCounts.invalid++;return route.abort();}
      const headers=request.headers();
      if(request.method()!=='GET' && !isReadOnlyDiscoveryRequest(request,origin)){
        const platform=passivePlatformTelemetry(request.method(),url,origin,headers);
        if(platform)traffic.deniedCounts.platform++;else{blockedWrites++;traffic.deniedCounts.write++;}
        const kind=writeKind(url,request.method(),headers,origin);if(!traffic.writeKinds.includes(kind)&&traffic.writeKinds.length<7)traffic.writeKinds.push(kind);
        if(attemptedWrites.length<8){try{const attempted=new URL(request.url());attemptedWrites.push({method:/^[A-Z]{3,7}$/.test(request.method())?request.method():'OTHER',origin:safeWriteOrigin(attempted.origin),path:safeWritePath(attempted.pathname)});}catch{attemptedWrites.push({method:'OTHER',origin:'<external>',path:'<redacted>'});}}
        // Platform telemetry is still aborted. This never completes a challenge
        // or grants a write; actual interstitials fail the ordinary page checks.
        return route.abort();
      }
      if(finished||signal?.aborted||Date.now()>=deadline){traffic.deniedCounts.invalid++;return route.abort();}
      const type=request.resourceType(),publicAsset=['image','font','stylesheet'].includes(type) && assetHosts.has(url.hostname),publicCdn=type==='image'&&cdnImageUrl(url);
      const sameOriginPath=url.origin===origin;
      if(requestCount>maxRequests){traffic.deniedCounts.budget++;return route.abort();}
      if(url.protocol!=='https:'||url.username||url.password){traffic.deniedCounts.invalid++;return route.abort();}
      if(sameOriginPath&&(url.pathname.startsWith('/admin')||url.pathname.startsWith('/api/admin'))){traffic.deniedCounts.admin++;return route.abort();}
      if(url.origin!==origin && !publicAsset && !publicCdn){traffic.deniedCounts.external++;return route.abort();}
      if(url.hostname===cdnHost&&!publicCdn){traffic.deniedCounts.invalid++;return route.abort();}
      return route.continue();
    })));
    page=await step(() => (context!.newPage()));
    context.on('page',unexpected=>{if(unexpected!==page)void close(unexpected);});
    page.setDefaultTimeout(5_000);page.setDefaultNavigationTimeout(10_000);
    currentStep='navigate';
    const response=await step(() => (page!.goto(origin+path,{waitUntil:'domcontentloaded',timeout:10_000})));steps++;
    if(!response || response.status()!==200 || new URL(response.url()).origin!==origin || new URL(response.url()).pathname!==new URL(origin+path).pathname)throw new CheckFailure('unexpected_document_response');
    const appBuild=await step(()=>response.headerValue('x-vii-app-build'));
    const cacheBuild=await step(()=>response.headerValue('x-vii-cache-build'));
    if((appBuild??cacheBuild)!==job.buildId || appBuild&&appBuild!==job.buildId || cacheBuild&&cacheBuild!==job.buildId)throw new CheckFailure('observed_build_mismatch');
    await step(() => (page!.locator('main').waitFor({state:'visible'})));steps++;
    navigationMetrics=await step(()=>readNavigationMetrics(page!));
    if(job.scenario!=='gallery-next') {
      const surface=browserWorldSurfaceSelectors[job.world];
      currentStep='world-surface';
      if(surface){await step(()=>page!.locator(surface).waitFor({state:'visible'}));steps++;}
      currentStep='world-heading';
      const heading=page.locator('main h1').first();
      await step(()=>heading.waitFor({state:'visible'}));
      const text=await step(()=>heading.textContent());
      if(!text||!browserWorldHeadingMatches(job.world,text))throw new CheckFailure('world_heading_mismatch');steps++;
    }
    if(job.scenario==='map-open-close') {
      currentStep='map-open-click';
      await step(() => (page!.locator('button.map-button[data-map-interactive="true"][aria-pressed="false"]').first().click()));steps++;
      currentStep='map-ready';
      const canvas=page.locator('.listing-map-shell[data-map-ready="true"] > .listing-map.leaflet-container');
      await step(() => (canvas.waitFor({state:'visible'})));
      if(!(Number(await step(() => (canvas.getAttribute('data-map-rendered-markers'))))>0))throw new CheckFailure('map_markers_missing');steps++;
      currentStep='map-close-click';
      await step(() => (page!.getByRole('button',{name:'חזרה לרשימה',exact:true}).click()));
      currentStep='map-detach';
      await step(() => (page!.locator('.listing-map').waitFor({state:'detached'})));steps++;
    }
    if(job.scenario==='gallery-next') {
      currentStep='gallery-open';
      const trigger=page.locator('[data-gallery-trigger]:visible').first();await step(() => (trigger.waitFor({state:'visible'})));await step(() => (trigger.click()));steps++;
      const gallery=page.locator('.story-gallery[role="dialog"]').first();await step(() => (gallery.waitFor({state:'visible'})));
      const active=gallery.locator('.story-gallery__image').first();
      const before=await step(() => (active.getAttribute('src')));
      if(!before)throw new CheckFailure('gallery_source_missing');
      currentStep='gallery-next-click';await step(() => (gallery.getByRole('button',{name:'התמונה הבאה',exact:true}).click()));steps++;
      currentStep='gallery-image-change';await step(() => (page!.waitForFunction(previous=>{
        const image=document.querySelector('.story-gallery[role="dialog"] .story-gallery__image') as HTMLImageElement | null;
        return Boolean(image?.complete && image.naturalWidth>0 && image.getAttribute('src') && image.getAttribute('src')!==previous);
      },before)));steps++;
      currentStep='gallery-close-click';await step(() => (gallery.getByRole('button',{name:'סגירת הגלריה',exact:true}).click()));
      currentStep='gallery-detach';await step(() => (gallery.waitFor({state:'detached'})));steps++;
    }
    if(job.scenario==='responsive-shell') {
      currentStep='responsive-overflow';
      const overflow=await step(() => (page!.locator('html').evaluate(node=>node.scrollWidth>node.clientWidth+1)));
      if(overflow)throw new CheckFailure('horizontal_overflow');steps++;
    }
    if(requestCount>maxRequests)throw new CheckFailure('request_budget_exceeded');
    if(blockedWrites)throw new CheckFailure('write_request_attempted');
    status='passed';
  } catch(error) {
    reason=requestCount>maxRequests?'request_budget_exceeded':error instanceof CheckFailure?error.message:'browser_step_failed';
    status=reason==='cancelled' || reason==='deadline_exceeded' || reason==='observed_build_mismatch'?'blocked':'failed';
    if(page && env.EVIDENCE && !signal?.aborted) {
      try {
        const screenshot=await bounded(page.screenshot({type:'jpeg',quality:55,fullPage:false,timeout:1_000,mask:[page.locator('input,textarea,[data-private],a[href^="tel:"],a[href*="wa.me"]')]}),1_500);
        if(screenshot.byteLength<=maxEvidence) {
          evidenceKey=`qqqaaa/failures/${job.sourceVersion}/${job.jobId}/${job.device}-${job.scenario}.jpg`;
          await bounded(env.EVIDENCE.put(evidenceKey,screenshot,{httpMetadata:{contentType:'image/jpeg'},customMetadata:{expiresAt:new Date(started+30*24*60*60*1000).toISOString()}}),1_500);
        }
      } catch { evidenceKey=undefined; }
    }
  } finally { finished=true;await Promise.all([close(page),close(context),close(browser)]); }
  // Network callbacks may finish while the context is closing. Classify the
  // final counters, rather than returning a passing result with late denials.
  if(requestCount>maxRequests){if(status==='passed')currentStep='cleanup';status='failed';reason='request_budget_exceeded';}
  else if(status==='passed'&&blockedWrites){currentStep='cleanup';status='failed';reason='write_request_attempted';}
  return {jobId:job.jobId,sourceVersion:job.sourceVersion,buildId:job.buildId,engineVersion:engineDefinition.sha256,world:job.world,device:job.device,scenario:job.scenario,status,reason,steps,requestCount,durationMs:Date.now()-started,evidenceKey,traffic:{resourceCounts:{...traffic.resourceCounts},deniedCounts:{...traffic.deniedCounts},writeKinds:[...traffic.writeKinds]},...(navigationMetrics?{navigationMetrics}:{}),...(status!=='passed'?{failureStep:currentStep,attemptedWrites}: {})};
}
