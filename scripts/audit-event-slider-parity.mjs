import {eventDealPresets} from '../app/lib/event-deal-dates.ts';
import {EVENT_DISCOVERY_VERSION,eventDealPagePath} from '../app/lib/event-discovery-contract.ts';

const origin=process.env.BASE_URL || 'https://vii.spaplus.co';
const legacy=process.env.VII_LEGACY_ORIGIN || 'https://www.vii.co.il';
const report={checkedAt:new Date().toISOString(),origin,legacy,guests:20,verdict:'passed',presets:[]};
async function api(selection){
 const response=await fetch(`${origin}/api/vii/live-search`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(selection),signal:AbortSignal.timeout(30_000)});
 if(!response.ok)throw new Error(`current_http_${response.status}`);
 const body=await response.json();if(!Array.isArray(body.results))throw new Error('invalid_results');return body;
}
for(const preset of eventDealPresets()){
 const till=new Date(`${preset.date}T12:00:00Z`);till.setUTCDate(till.getUTCDate()+1);
 try{
  const selection={world:'events',from:preset.date,till:preset.date,guests:report.guests};
  const [oldResponse,source,discovery]=await Promise.all([
   fetch(`${legacy}/events/ajax_popularDeals.php?mob=0`,{method:'POST',body:new URLSearchParams({tab:preset.id,fromDate:preset.date,tillDate:till.toISOString().slice(0,10)}),signal:AbortSignal.timeout(20_000)}),
   api(selection),api({...selection,includePlaces:true,discoveryVersion:EVENT_DISCOVERY_VERSION})
  ]);
  if(!oldResponse.ok)throw new Error(`legacy_http_${oldResponse.status}`);
  const html=await oldResponse.text();
  const legacyIds=[...new Set([...html.matchAll(/data-siteid="(\d+)"/g)].map(match=>Number(match[1])))];
  const byId=new Map(source.results.map(offer=>[offer.siteID,offer]));
  const discoveryIds=new Set(discovery.results.map(offer=>offer.siteID));
  const unresolved=legacyIds.flatMap(siteID=>byId.get(siteID)?.available===true&&discoveryIds.has(siteID)?[]:[{siteID,state:byId.get(siteID)?.available??null,reason:byId.get(siteID)?.reason??'missing',inDiscovery:discoveryIds.has(siteID)}]);
  const failures=[];
  if(discovery.discoveryVersion!==EVENT_DISCOVERY_VERSION||discovery.scope?.date!==preset.date||discovery.scope?.guests!==report.guests)failures.push('wrong_snapshot_scope');
  if(discoveryIds.size!==discovery.results.length)failures.push('duplicate_venue');
  if(discovery.results.length!==discovery.places?.length||discovery.results.length!==discovery.matchedCount)failures.push('card_count_mismatch');
  if(discovery.results.some(offer=>offer.available!==true||offer.from!==preset.date||!['morning','evening'].includes(offer.slot)||offer.total===null&&offer.onlineBooking===true))failures.push('invalid_offer_state');
  const missingSourceIds=source.results.filter(offer=>offer.available===true&&!discoveryIds.has(offer.siteID)).map(offer=>offer.siteID);
  const declaredExclusions=new Set(discovery.selectionDiagnostics?.missingPublicCardIds||[]);
  if(missingSourceIds.some(id=>!declaredExclusions.has(id)))failures.push('confirmed_source_venue_dropped');
  report.presets.push({preset:preset.id,path:eventDealPagePath(preset.id),date:preset.date,legacyCount:legacyIds.length,confirmedCount:source.results.filter(offer=>offer.available===true).length,discoveryCount:discovery.results.length,unpricedCount:discovery.results.filter(offer=>offer.total===null).length,cache:discovery.cache,unresolved,missingSourceIds,declaredExclusions:[...declaredExclusions],failures});
  if(unresolved.length||failures.length)report.verdict='not_verified';
 }catch(error){report.verdict='not_verified';report.presets.push({preset:preset.id,date:preset.date,error:error instanceof Error?error.message:'unavailable'});}
}
console.log(JSON.stringify(report,null,2));
if(report.verdict!=='passed')process.exitCode=1;
