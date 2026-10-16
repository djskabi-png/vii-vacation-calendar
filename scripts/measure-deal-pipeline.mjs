import {performance} from 'node:perf_hooks';
const results=[];
for(const path of ['/api/vii/home-deals?period=tomorrow&locale=he','/api/vii/home-holidays?locale=he']) {
  for(let sample=0;sample<2;sample++) {
    const start=performance.now(); const response=await fetch('https://vii.spaplus.co'+path,{signal:AbortSignal.timeout(20000)});
    const ttfbMs=Math.round(performance.now()-start); const data=await response.json();
    results.push({path,sample,status:response.status,ttfbMs,totalMs:Math.round(performance.now()-start),cacheControl:response.headers.get('cache-control'),count:(data.deals||data.holidays||[]).length,error:data.error});
  }
}
console.log(JSON.stringify({at:new Date().toISOString(),source:'workstation; two bounded sequential samples per fresh endpoint',results},null,2));
