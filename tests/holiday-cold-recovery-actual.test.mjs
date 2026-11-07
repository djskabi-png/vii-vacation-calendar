import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import {DISCOVERY_RECOVERY_BUDGET_MS,discoveryRecoveryDelay} from '../app/lib/discovery-recovery-policy.ts';

const source=fs.readFileSync(new URL('../app/components/home-live-deals.tsx',import.meta.url),'utf8').replaceAll('\r\n','\n');
const original=execFileSync('git',['show','2376a70cd84d95c65b9c2533a163243e713f6fa9:app/components/home-live-deals.tsx'],{encoding:'utf8'}).replaceAll('\r\n','\n');

// Execute the production effect itself with virtual time and response latency.
// The provider is owned by the server; GETs only observe its pending snapshot.
async function simulate(text,readyAt=20_000,{networkError=false,active=true}={}){
 const guard=text.indexOf('if (mode === "holidays" && (holidayState');
 const start=text.lastIndexOf('  useEffect(() => {',guard);
 const end=text.indexOf('\n  }, [',guard);
 assert.ok(start>0&&end>start);
 const body=text.slice(start+'  useEffect(() => {'.length,end);
 const js=ts.transpileModule(`function effect(){${body}\n}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 let now=0,nextId=0,status='loading',data=null,cleanup=()=>{};const timers=new Map(),calls=[],states=[];
 const setTimeout=(fn,delay)=>{const id=++nextId;timers.set(id,{at:now+delay,fn});return id};
 const clearTimeout=id=>timers.delete(id);
 const clock={key:'2026-11-07:today',now:new Date('2026-11-07T00:00:00Z')};
 const DateFake=class extends Date{static now(){return now}};
 const deps={active,clock,mode:'holidays',holidayState:'ready',holidayId:114,holidays:[{id:114}],selectionKey:'he:day:holiday:114',language:'he',period:'tomorrow',fixedPeriod:undefined,regionLabel:undefined,guests:2,
  recoveryStartedAt:{current:new Map()},automaticRetries:{current:new Map()},lastGoodData:{current:new Map()},
  selectionRecoveryBudgetMs:text===original?10_000:DISCOVERY_RECOVERY_BUDGET_MS,automaticRecoveryDelays:[1250,2500],discoveryRecoveryDelay,
  Date:DateFake,setTimeout,clearTimeout,AbortController,URLSearchParams,HOME_OFFER_MAX_AGE_MS:3_600_000,
  homeOfferCheckedAt:value=>value?.cache?0:null,isFreshHomeOffer:value=>!!value?.cache,validHomeOfferResponse:()=>true,
  setData:value=>{data=value},setState:value=>{status=value;states.push({at:now,status})},
  discoveryJson:(_url,_scope,init)=>new Promise((resolve,reject)=>{calls.push({at:now,signal:init.signal});setTimeout(()=>networkError?reject(Error('network')):resolve(now<readyAt?{holiday:{id:114},deals:[],availabilityStatus:'refreshing'}:{holiday:{id:114},dates:{from:'2026-11-08',till:'2026-11-09'},deals:[],availabilityStatus:'verified',cache:{checkedAt:new Date(0).toISOString()}}),2000)}),
  setDealRetry:()=>{cleanup();cleanup=effect()||(()=>{})}
 };
 const effect=new Function(...Object.keys(deps),js+';return effect;')(...Object.values(deps));
 cleanup=effect()||(()=>{});
 for(let turns=0;turns<30&&status==='loading';turns++){
  for(let tick=0;tick<8;tick++)await Promise.resolve();
  const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];
  if(!next||next[1].at>40_000)break;
  now=next[1].at;timers.delete(next[0]);next[1].fn();
 }
 for(let tick=0;tick<8;tick++)await Promise.resolve();
 cleanup();return{status,data,calls,states,now};
}

test('the actual v812 effect fails before a valid 20s cold snapshot; the repaired effect observes it automatically',async()=>{
 const before=await simulate(original);assert.equal(before.status,'error');assert.ok(before.now<20_000);
 const after=await simulate(source);assert.equal(after.status,'ready');assert.equal(after.data.availabilityStatus,'verified');assert.ok(after.now>=20_000&&after.now<=DISCOVERY_RECOVERY_BUDGET_MS);assert.ok(after.calls.length<=6);
});
test('an endlessly pending provider terminates with no invented offers and no unbounded GET loop',async()=>{
 const result=await simulate(source,Infinity);assert.equal(result.status,'error');assert.equal(result.data,null);assert.ok(result.now<=DISCOVERY_RECOVERY_BUDGET_MS);assert.ok(result.calls.length<=6);assert.ok(result.calls.every(call=>call.signal.aborted));
});
test('a network failure does not become another semantic polling cycle',async()=>{
 const result=await simulate(source,0,{networkError:true});assert.equal(result.status,'error');assert.equal(result.calls.length,1);
});

test('a cached holiday response never reads full-world galleries or calls the supplier',async()=>{
 const text=fs.readFileSync(new URL('../app/api/vii/home-holiday-deals/route.ts',import.meta.url),'utf8');
 const js=ts.transpileModule(text.replace(/^import .*;\r?$/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const dates={from:'2026-11-08',till:'2026-11-09',nights:1};const holiday={id:114,...dates};
 const deps={requestStageTiming:()=>({measure:async(_n,fn)=>fn(),header:()=>''}),holidayParts:['all'],validDate:()=>true,runtimeCatalogDatabase:async()=>({}),publicDiscoveryCatalogIndex:async()=>({places:[{supplierId:12,name:'Real'}],publishedIds:new Set([12])}),supplierToken:async()=>'',getDiscoveryHolidays:async()=>[holiday],firstDealDate:()=>dates.from,
  cachedDiscovery:async()=>({value:{holiday,dates,deals:[{siteID:12,priceGuests:2,from:dates.from}]},cache:{status:'fresh',checkedAt:new Date().toISOString()}}),
  publicCatalogSummaries:()=>{throw Error('Full catalog must remain lazy')},getHomeHolidayDeals:()=>{throw Error('Supplier must remain lazy')},runtimeDatabase:async()=>null,prioritizeOnlineFirst:value=>value,isHomeDealOnlineEligible:()=>true,compareVacationPriority:()=>0,eligibleDealDate:()=>true,
  setTimeout:()=>0,getRequestExecutionContext:()=>null};
 const exports={};new Function(...Object.keys(deps),'exports',js)(...Object.values(deps),exports);
 const response=await exports.GET(new Request('https://example.test/?id=114'));assert.equal(response.status,200);const body=await response.json();assert.equal(body.availabilityStatus,'verified');assert.deepEqual(body.deals.map(x=>x.siteID),[12]);assert.ok(response.headers.has('Server-Timing'));
});
