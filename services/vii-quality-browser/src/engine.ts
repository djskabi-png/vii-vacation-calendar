import type { Browser, BrowserContext, Page } from '@cloudflare/playwright';
import engineDefinition from '../engine-definition.json' with {type:'json'};
import { browserWorldPaths, browserWorldHeadingMatches, browserWorldSurfaceSelectors, type PublicBrowserWorld } from './public-world-contract.ts';
import { isReadOnlyDiscoveryRequest } from './read-only-discovery.ts';

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
  if(job.scenario==='gallery-next' && job.world!=='vacations')return {jobId:job.jobId,status:'blocked' as const,reason:'world_gallery_contract_not_implemented'};
  const started=Date.now(),deadline=started+number(env.MAX_RUN_MS,45_000,10,60_000);
  const maxRequests=number(env.MAX_REQUESTS,180,1,300),maxEvidence=number(env.MAX_EVIDENCE_BYTES,1_000_000,256,2_000_000);
  const step=<T>(operation:()=>Promise<T>)=>{
    const remaining=deadline-Date.now();
    if(signal?.aborted)throw new CheckFailure('cancelled');
    if(remaining<=0)throw new CheckFailure('deadline_exceeded');
    return bounded(operation(),Math.min(8_000,remaining),signal);
  };
  let browser:Browser|undefined,context:BrowserContext|undefined,page:Page|undefined,finished=false,requestCount=0,blockedWrites=0,steps=0;
  let status:'passed'|'failed'|'blocked'='blocked',reason:string|undefined,evidenceKey:string|undefined;
  let currentStep='launch';
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
      const request=route.request();requestCount++;
      let url:URL;try{url=new URL(request.url());}catch{return route.abort();}
      if(request.method()!=='GET' && !isReadOnlyDiscoveryRequest(request,origin)){
        blockedWrites++;
        if(attemptedWrites.length<8){try{const attempted=new URL(request.url());attemptedWrites.push({method:/^[A-Z]{3,7}$/.test(request.method())?request.method():'OTHER',origin:safeWriteOrigin(attempted.origin),path:safeWritePath(attempted.pathname)});}catch{attemptedWrites.push({method:'OTHER',origin:'<external>',path:'<redacted>'});}}
        return route.abort();
      }
      const publicAsset=['image','font','stylesheet'].includes(request.resourceType()) && assetHosts.has(url.hostname);
      if(requestCount>maxRequests || url.protocol!=='https:' || (url.origin!==origin && !publicAsset) || url.username || url.password || url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/admin'))return route.abort();
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
      const gallery=page.locator('.property-gallery').first();await step(() => (gallery.waitFor({state:'visible'})));
      const active=gallery.locator('img.is-active, .property-gallery__image.is-active img').first();
      const before=await step(() => (active.getAttribute('src')));
      if(!before)throw new CheckFailure('gallery_source_missing');
      await step(() => (gallery.getByRole('button',{name:'התמונה הבאה',exact:true}).click()));steps++;
      await step(() => (page!.waitForFunction(previous=>{
        const image=document.querySelector('.property-gallery img.is-active, .property-gallery .property-gallery__image.is-active img');
        return Boolean(image?.getAttribute('src') && image.getAttribute('src')!==previous);
      },before)));steps++;
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
  return {jobId:job.jobId,sourceVersion:job.sourceVersion,buildId:job.buildId,engineVersion:engineDefinition.sha256,world:job.world,device:job.device,scenario:job.scenario,status,reason,steps,requestCount,durationMs:Date.now()-started,evidenceKey,...(status!=='passed'?{failureStep:currentStep,attemptedWrites}: {})};
}
