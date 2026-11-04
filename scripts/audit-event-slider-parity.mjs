import {eventDealPresets} from '../app/lib/event-deal-dates.ts';

const origin=process.env.BASE_URL || 'https://vii.spaplus.co';
const legacy=process.env.VII_LEGACY_ORIGIN || 'https://www.vii.co.il';
const report={checkedAt:new Date().toISOString(),origin,legacy,guests:20,verdict:'passed',presets:[]};
for(const preset of eventDealPresets()){
 const till=new Date(`${preset.date}T12:00:00Z`);till.setUTCDate(till.getUTCDate()+1);
 try{
  const oldResponse=await fetch(`${legacy}/events/ajax_popularDeals.php?mob=0`,{method:'POST',body:new URLSearchParams({tab:preset.id,fromDate:preset.date,tillDate:till.toISOString().slice(0,10)}),signal:AbortSignal.timeout(20_000)});
  if(!oldResponse.ok)throw new Error(`legacy_http_${oldResponse.status}`);
  const html=await oldResponse.text();
  const legacyIds=[...new Set([...html.matchAll(/data-siteid="(\d+)"/g)].map(match=>Number(match[1])))];
  const response=await fetch(`${origin}/api/vii/live-search`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({world:'events',from:preset.date,till:preset.date,guests:report.guests}),signal:AbortSignal.timeout(25_000)});
  if(!response.ok)throw new Error(`current_http_${response.status}`);
  const body=await response.json();
  if(!Array.isArray(body.results))throw new Error('invalid_results');
  const byId=new Map(body.results.map(offer=>[offer.siteID,offer]));
  const unresolved=legacyIds.flatMap(siteID=>byId.get(siteID)?.available===true?[]:[{siteID,state:byId.get(siteID)?.available??null,reason:byId.get(siteID)?.reason??'missing'}]);
  report.presets.push({preset:preset.id,date:preset.date,legacyCount:legacyIds.length,confirmedCount:body.results.filter(offer=>offer.available===true).length,unresolved});
  if(unresolved.length)report.verdict='not_verified';
 }catch(error){report.verdict='not_verified';report.presets.push({preset:preset.id,date:preset.date,error:error instanceof Error?error.message:'unavailable'});}
}
console.log(JSON.stringify(report,null,2));
if(report.verdict!=='passed')process.exitCode=1;
