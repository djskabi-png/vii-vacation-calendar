// Read-only nationwide maintenance. Stages a candidate for review, never writes public source data.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseSpaPlusFacilities} from './lib/spaplus-facility-parser.mjs';
const dir=path.resolve(process.argv[2] || '.qa-output/spaplus-facility-audit'); fs.mkdirSync(dir,{recursive:true});
const catalog=JSON.parse(fs.readFileSync('app/data/spaplus-public-catalog.json','utf8'));
const previous=JSON.parse(fs.readFileSync('app/data/spaplus-official-facility-evidence.json','utf8'));
const operationFile=path.join(dir,'official-facility-audit.json'); if(fs.existsSync(operationFile)&&JSON.parse(fs.readFileSync(operationFile,'utf8')).state==='running')throw Error('previous_audit_not_terminal');
const operation={operation:'official-spa-facility-audit-841',attempt:1,previousResult:null,changedVariable:'Audit all accepted SPA supplier IDs, validate page hidden siteid before extracting only its own facility section',startedAt:new Date().toISOString(),deadline:new Date(Date.now()+180000).toISOString(),state:'running',rows:[]};
const save=()=>fs.writeFileSync(path.join(dir,'official-facility-audit.json'),JSON.stringify(operation,null,2));save();
const queue=[...catalog.sites],entries={...previous.entries};
async function worker(){while(queue.length&&Date.now()<Date.parse(operation.deadline)){
 const site=queue.shift(),row={supplierId:site.id,sourceUrl:site.bookingUrl};
 try{
  const input=new URL(site.bookingUrl);if(!['spaplus.co.il','www.spaplus.co.il'].includes(input.hostname)||input.protocol!=='https:')throw Error('unapproved_source');
  const response=await fetch(input,{signal:AbortSignal.timeout(Math.max(1,Math.min(20000,Date.parse(operation.deadline)-Date.now())))});
  const html=await response.text();row.status=response.status;row.resolvedUrl=response.url;
  if(!response.ok||!['spaplus.co.il','www.spaplus.co.il'].includes(new URL(response.url).hostname))throw Error('source_http_or_host');
  const facts=parseSpaPlusFacilities(html,site.id);
  const entry={sourceUrl:site.bookingUrl,resolvedUrl:response.url,checkedAt:new Date().toISOString(),htmlSha256:createHash('sha256').update(html).digest('hex'),...facts};
  // Optional paid access is independently sourced; retain its original evidence.
  if(previous.entries[site.id]?.optionalFeatures)entry.optionalFeatures=previous.entries[site.id].optionalFeatures.map(feature=>({...feature,checkedAt:previous.entries[site.id].checkedAt,sourceUrl:previous.entries[site.id].sourceUrl}));
  entries[site.id]=entry;row.result='verified';row.facilityCount=entry.labels.length;
 }catch(error){row.result='not_verified';row.reason=error.message;}
 operation.rows.push(row);save();
}}
await Promise.all(Array.from({length:3},worker));
operation.notAttempted=queue.map(s=>s.id);operation.state=queue.length?'deadline_reached':'completed';operation.finishedAt=new Date().toISOString();save();
const candidate={schemaVersion:3,source:'official-spaplus-place-pages',checkedAt:operation.finishedAt,scope:'accepted-public-spa-catalog-nationwide',entries};
fs.writeFileSync(path.join(dir,'facility-evidence-candidate.json'),JSON.stringify(candidate,null,2)+'\n');
console.log(JSON.stringify({state:operation.state,verified:operation.rows.filter(r=>r.result==='verified').length,notVerified:operation.rows.filter(r=>r.result!=='verified'),notAttempted:queue.length,totalEvidence:Object.keys(entries).length}));
