import test from 'node:test';
import assert from 'node:assert/strict';
import {runBrowserJob} from '../src/engine.ts';
import definition from '../engine-definition.json' with {type:'json'};

const sourceVersion='a'.repeat(40),buildId='12345678-1234-1234-1234-123456789abc';
const env={PUBLIC_ORIGIN:'https://vii.spaplus.co',EXPECTED_SOURCE_VERSION:sourceVersion,EXPECTED_BUILD_ID:buildId};
const job={jobId:'job-12345678',sourceVersion,buildId,engineVersion:definition.sha256,scenario:'world-shell',world:'vacations',device:'desktop'};
function browserFixture(options={}) {
  const state={pageClosed:0,contextClosed:0,browserClosed:0,contextsCreated:0,map:false,image:0,launches:0,requests:[],events:[],puts:[]};let intercept;
  const request=async(method='GET',url=env.PUBLIC_ORIGIN+'/search',resourceType='document',body=null,headers={})=>{
    let disposition;await intercept({request:()=>({method:()=>method,url:()=>url,resourceType:()=>resourceType,postData:()=>body,headers:()=>headers}),abort:async()=>{disposition='aborted'},continue:async()=>{disposition='continued'}});
    state.requests.push({method,url,disposition});return disposition;
  };
  const locator=selector=>({
    first(){return this;},locator:child=>locator(child),getByRole:(_role,value)=>locator(value.name),
    async waitFor({state:expected}){if(options.missingMain && selector==='main')throw Error('missing');if(options.missingWorldMarker && ['main.world-page--providers','main.attractions-page','main.trails-page','main.home-page'].includes(selector))throw Error('missing world surface');if(options.missingMap && selector.includes('leaflet-container'))throw Error('missing');if(expected==='detached'&&state.map)throw Error('map still mounted');},
    async click(){if(options.stallAction)return new Promise(()=>{});if(selector.includes('map-button')){if(options.missingButton)throw Error('missing');state.map=true;}if(selector==='חזרה לרשימה'&&!options.closeBroken)state.map=false;if(selector==='התמונה הבאה'&&!options.frozenGallery)state.image++;},
    async getAttribute(name){if(name==='data-map-rendered-markers')return options.emptyMarkers?'0':'12';if(name==='src')return 'image-'+state.image;return null;},
    async evaluate(){return Boolean(options.overflow);},
    async textContent(){if(options.heading!==undefined)return options.heading;const path=new URL(state.url).pathname;return path.startsWith('/events')?'מקומות לאירועים':path.startsWith('/spas')?'בתי ספא בישראל':path.startsWith('/hourly')?'חדרים לפי שעה':path.startsWith('/attractions')?'אטרקציות בישראל':path.startsWith('/providers')?'ספקים לאירוח ולאירועים':path.startsWith('/trails')?'מסלולי טיול בישראל למטייל העצמאי':path==='/'?'כל מה שעושים בחופש, במקום אחד':'נופש ברחבי הארץ';},
  });
  const page={setDefaultTimeout(){},setDefaultNavigationTimeout(){},locator,getByRole:(_role,value)=>locator(value.name),
    async goto(url){state.events.push('goto');state.url=url;assert.ok(intercept,'interception precedes navigation');await request('GET',url);if(options.extraRequest)await request(...options.extraRequest);if(options.burstRequests)for(let i=0;i<options.burstRequests;i++)await request('GET',url,'fetch');if(options.navigationFailure)throw Error('secret raw upstream text');return{status:()=>200,url:()=>url,headerValue:async(name)=>options.generationHeaders?options.generationHeaders[name]??null:options.wrongBuild?'wrong':buildId};},
    async waitForFunction(){if(options.frozenGallery)throw Error('image unchanged');},
    async screenshot(){return new Uint8Array(options.screenshotBytes || 12);},async close(){state.pageClosed++;},
  };
  const context={async route(_pattern,handler){intercept=handler;state.events.push('route');},async newPage(){state.events.push('new-page');return page;},on(){},async close(){state.contextClosed++;}};
  const browser={async newContext(){state.contextsCreated++;return context;},async close(){state.browserClosed++;}};
  const factory={async launch(){state.launches++;if(options.launchDelay)await new Promise(resolve=>setTimeout(resolve,options.launchDelay));return browser;}};
  return {state,factory,request,browser};
}
function assertClosed(state){assert.equal(state.pageClosed,1);assert.equal(state.contextClosed,1);assert.equal(state.browserClosed,1);}

test('each world uses its own actual route and verifies the observed build',async()=>{
  for(const [world,path] of Object.entries({vacations:'/search',events:'/events/search',hourly:'/hourly',spa:'/spas',activities:'/attractions',providers:'/providers',trails:'/trails',global:'/'})){
    const f=browserFixture();const result=await runBrowserJob({...job,world},env,f.factory);
    assert.equal(result.status,'passed');assert.equal(new URL(f.state.url).pathname,path);assertClosed(f.state);
    assert.deepEqual(f.state.events.slice(0,3),['route','new-page','goto']);
  }
});

test('a valid build and visible main cannot disguise an error screen as a healthy world',async()=>{
 for(const heading of ['', 'העמוד לא נטען במלואו', 'בתי ספא בישראל']){
  const f=browserFixture({heading});const result=await runBrowserJob(job,env,f.factory);
  assert.equal(result.status,'failed');assert.equal(result.reason,'world_heading_mismatch');assertClosed(f.state);
 }
});
test('additional worlds require their own surface while accepting editable nonempty headings',async()=>{
 for(const world of ['providers','activities','trails','global']){
  const edited=browserFixture({heading:'בוחרים חוויה בדרך שלכם'});assert.equal((await runBrowserJob({...job,world},env,edited.factory)).status,'passed');assertClosed(edited.state);
  const missing=browserFixture({missingWorldMarker:true});assert.equal((await runBrowserJob({...job,world},env,missing.factory)).status,'failed');assertClosed(missing.state);
  const error=browserFixture({heading:'העמוד לא נטען במלואו'});assert.equal((await runBrowserJob({...job,world},env,error.factory)).reason,'world_heading_mismatch');
 }
});
test('map requires actionable controls, markers and an observed return to the list',async()=>{
  const good=browserFixture();assert.equal((await runBrowserJob({...job,scenario:'map-open-close'},env,good.factory)).status,'passed');assertClosed(good.state);
  for(const options of [{missingButton:true},{missingMap:true},{emptyMarkers:true},{closeBroken:true}]){
    const f=browserFixture(options);assert.notEqual((await runBrowserJob({...job,scenario:'map-open-close'},env,f.factory)).status,'passed');assertClosed(f.state);
  }
});
test('gallery requires a changed image and unimplemented world contracts cannot pass',async()=>{
  const f=browserFixture();assert.equal((await runBrowserJob({...job,scenario:'gallery-next'},env,f.factory)).status,'passed');assert.equal(f.state.image,1);
  const frozen=browserFixture({frozenGallery:true});assert.equal((await runBrowserJob({...job,scenario:'gallery-next'},env,frozen.factory)).status,'failed');assertClosed(frozen.state);
  const unsupported=browserFixture();assert.equal((await runBrowserJob({...job,world:'spa',scenario:'gallery-next'},env,unsupported.factory)).status,'blocked');assert.equal(unsupported.state.launches,0);
});
test('uncached app identity is accepted while a conflicting cached identity stays blocked',async()=>{
  const uncached=browserFixture({generationHeaders:{'x-vii-app-build':buildId}});
  assert.equal((await runBrowserJob(job,env,uncached.factory)).status,'passed');
  const conflict=browserFixture({generationHeaders:{'x-vii-app-build':buildId,'x-vii-cache-build':'wrong'}});
  assert.equal((await runBrowserJob(job,env,conflict.factory)).reason,'observed_build_mismatch');
});

test('budget enforcement preserves the actual count even when an aborted request breaks a later step',async()=>{
 const fixture=browserFixture({burstRequests:180,missingMain:true});
 const result=await runBrowserJob(job,env,fixture.factory);
 assert.equal(result.requestCount,181);assert.equal(result.reason,'request_budget_exceeded');assert.equal(result.status,'failed');
 assert.equal(fixture.state.requests.at(-1).disposition,'aborted');assert.equal(fixture.state.requests.filter(x=>x.disposition==='continued').length,180);assertClosed(fixture.state);
});

test('wrong observed build, overflow and attempted writes cannot produce green evidence',async()=>{
  for(const [options,scenario,reason] of [[{wrongBuild:true},'world-shell','observed_build_mismatch'],[{overflow:true},'responsive-shell','horizontal_overflow'],[{extraRequest:['POST',env.PUBLIC_ORIGIN+'/api/lead']},'world-shell','write_request_attempted']]){
    const f=browserFixture(options);const result=await runBrowserJob({...job,scenario},env,f.factory);assert.notEqual(result.status,'passed');assert.equal(result.reason,reason);assertClosed(f.state);
    if(options.extraRequest){assert.equal(f.state.requests.at(-1).disposition,'aborted');assert.equal(result.failureStep,'world-heading');assert.deepEqual(result.attemptedWrites,[{method:'POST',origin:env.PUBLIC_ORIGIN,path:'/api/lead'}]);assert.ok(!JSON.stringify(result).includes('?'));}
  }
});

test('automatic read-only discovery POST is admitted without granting business writes',async()=>{
 const body=JSON.stringify({world:'events',from:'2026-11-06',till:'2026-11-06',guests:20,includePlaces:true,discoveryVersion:2});
 const headers={'content-type':'application/json'};
 const f=browserFixture({extraRequest:['POST',env.PUBLIC_ORIGIN+'/api/vii/live-search','fetch',body,headers]});
 const result=await runBrowserJob({...job,world:'global'},env,f.factory);assert.equal(result.status,'passed');assert.equal(f.state.requests.at(-1).disposition,'continued');assertClosed(f.state);
 for(const path of ['/api/booking','/api/lead','/api/payments','/api/admin/quality']){
  const denied=browserFixture({extraRequest:['POST',env.PUBLIC_ORIGIN+path,'fetch',body,headers]});
  const outcome=await runBrowserJob(job,env,denied.factory);assert.equal(outcome.status,'failed');assert.equal(outcome.reason,'write_request_attempted');assert.equal(denied.state.requests.at(-1).disposition,'aborted');assertClosed(denied.state);
 }
 const invalid=browserFixture({extraRequest:['POST',env.PUBLIC_ORIGIN+'/api/vii/live-search','fetch',JSON.stringify({action:'book',phone:'synthetic'}),headers]});
 assert.equal((await runBrowserJob(job,env,invalid.factory)).reason,'write_request_attempted');
});
test('outbound/admin traffic is intercepted and the request budget is enforced',async()=>{
  for(const request of [['GET','https://evil.test/track','script'],['GET',env.PUBLIC_ORIGIN+'/api/admin/users']]){
    const f=browserFixture({extraRequest:request});await runBrowserJob(job,env,f.factory);assert.equal(f.state.requests.at(-1).disposition,'aborted');
  }
  const f=browserFixture({extraRequest:['GET',env.PUBLIC_ORIGIN+'/extra']});assert.equal((await runBrowserJob(job,{...env,MAX_REQUESTS:'1'},f.factory)).reason,'request_budget_exceeded');
});
test('pre-cancel does not launch, and a browser arriving after deadline is closed',async()=>{
  const controller=new AbortController();controller.abort();const cancelled=browserFixture();assert.equal((await runBrowserJob(job,env,cancelled.factory,controller.signal)).reason,'cancelled');assert.equal(cancelled.state.launches,0);
  const late=browserFixture({launchDelay:35});assert.equal((await runBrowserJob(job,{...env,MAX_RUN_MS:'10'},late.factory)).reason,'deadline_exceeded');
  await new Promise(resolve=>setTimeout(resolve,45));assert.equal(late.state.browserClosed,1);
});
test('stalled actions stop within the run deadline and release every browser resource',async()=>{
  const f=browserFixture({stallAction:true});const result=await runBrowserJob({...job,scenario:'map-open-close'},{...env,MAX_RUN_MS:'20'},f.factory);assert.equal(result.reason,'deadline_exceeded');assert.equal(result.failureStep,'map-open-click');assert.deepEqual(result.attemptedWrites,[]);assertClosed(f.state);
});
test('an exhausted deadline prevents starting the next browser operation',async()=>{
  const f=browserFixture(),original=Date.now,started=original();
  try {
    Date.now=()=>started;
    const factory={launch:async()=>{Date.now=()=>started+1_000;return f.browser;}};
    const result=await runBrowserJob(job,{...env,MAX_RUN_MS:'10'},factory);
    assert.equal(result.reason,'deadline_exceeded');assert.equal(f.state.contextsCreated,0);assert.equal(f.state.browserClosed,1);
  }finally{Date.now=original;}
});
test('failure evidence is bounded bytes, structured and never includes raw page text',async()=>{
  const puts=[];const evidence={put:async(key,bytes,metadata)=>puts.push({key,bytes,metadata})};
  const f=browserFixture({navigationFailure:true,screenshotBytes:300});const result=await runBrowserJob(job,{...env,MAX_EVIDENCE_BYTES:'256',EVIDENCE:evidence},f.factory);
  assert.equal(result.status,'failed');assert.equal(result.reason,'browser_step_failed');assert.equal(puts.length,0);assert.ok(!JSON.stringify(result).includes('secret raw'));
  const small=browserFixture({navigationFailure:true,screenshotBytes:12});await runBrowserJob(job,{...env,EVIDENCE:evidence},small.factory);assert.equal(puts.length,1);assert.equal(puts[0].metadata.httpMetadata.contentType,'image/jpeg');
});
