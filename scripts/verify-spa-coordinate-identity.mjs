import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

export function officialSpaIdentity(html) {
 return html.match(/name=["']siteid["'][^>]*value=["'](\d+)["']/i)?.[1]
  || html.match(/value=["'](\d+)["'][^>]*name=["']siteid["']/i)?.[1] || null;
}
export function officialSpaCoordinate(html) {
 const decoded=html.replace(/&amp;/g,'&');
 const pin=decoded.match(/[?&]q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/)
  || decoded.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
 if(!pin)return null;
 const lat=Number(pin[1]),lng=Number(pin[2]);
 return lat>=29&&lat<=34&&lng>=34&&lng<=36?{lat,lng}:null;
}
async function main(){
 const args=process.argv.slice(2), outputIndex=args.indexOf('--output');
 if(outputIndex<0||!args[outputIndex+1])throw new Error('Use --output <review.json>; canonical evidence is never overwritten automatically.');
 const inputIndex=args.indexOf('--input');
 const source=JSON.parse(fs.readFileSync(inputIndex<0?'app/data/spa-coordinate-evidence.json':args[inputIndex+1],'utf8'));
 const rows=[...source.verified,...source.missing],out=[];let cursor=0;const deadline=Date.now()+180000;
 await Promise.all(Array.from({length:4},async()=>{while(cursor<rows.length){const r=rows[cursor++];
  if(!r.sourceUrl||Date.now()>deadline){out.push({...r,lat:null,lng:null,reason:'source-or-deadline-unavailable'});continue;}
  try{if(new URL(r.sourceUrl).origin!=='https://www.spaplus.co.il')throw new Error('unapproved-source');
   const response=await fetch(r.sourceUrl,{signal:AbortSignal.timeout(9000)});
   if(!response.ok||new URL(response.url).origin!=='https://www.spaplus.co.il')throw new Error('official-page-unavailable');
   const html=await response.text(),siteId=officialSpaIdentity(html),point=officialSpaCoordinate(html),match=siteId===String(r.id);
   out.push({...r,lat:match&&point?point.lat:null,lng:match&&point?point.lng:null,identity:{siteId,siteIdMatch:match},checkedAt:new Date().toISOString(),reason:!match?'identity-mismatch':!point?'coordinate-unavailable':undefined});
  }catch(error){out.push({...r,lat:null,lng:null,reason:error.name});}
 }}));
 const verified=out.filter(r=>r.identity?.siteIdMatch&&r.lat&&r.lng),missing=out.filter(r=>!verified.includes(r));
 fs.writeFileSync(args[outputIndex+1],JSON.stringify({schemaVersion:2,generatedAt:new Date().toISOString(),totalCatalogSites:rows.length,verifiedCount:verified.length,missingCount:missing.length,verified,missing},null,2)+'\n');
 console.log(JSON.stringify({total:rows.length,verified:verified.length,missing:missing.length}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
