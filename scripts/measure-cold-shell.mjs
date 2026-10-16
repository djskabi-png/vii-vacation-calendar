import {performance} from 'node:perf_hooks';
const results=[];
for(const path of ['/', '/spas', '/hourly']) {
  const url=new URL(path,'https://vii.spaplus.co'); url.searchParams.set('release',`cold-shell-${Date.now()}`);
  const started=performance.now();
  const response=await fetch(url,{headers:{Accept:'text/html',Cookie:'__cf_bm=public-probe'},signal:AbortSignal.timeout(20000)});
  const ttfbMs=Math.round(performance.now()-started);
  const reader=response.body.getReader(); const decoder=new TextDecoder(); let body='',firstChunkMs,heroMs;
  while(true) {const {done,value}=await reader.read(); if(done)break; firstChunkMs??=Math.round(performance.now()-started); body+=decoder.decode(value,{stream:true});
    if(heroMs===undefined&&body.includes(path==='/'?'כל החופשה, במקום אחד':path==='/spas'?'בתי ספא בישראל':'חדרים לפי שעה'))heroMs=Math.round(performance.now()-started);
  }
  results.push({path,ttfbMs,firstChunkMs,heroMs,totalMs:Math.round(performance.now()-started),bytes:Buffer.byteLength(body),status:response.status,cache:response.headers.get('x-vii-page-cache'),build:response.headers.get('x-vii-cache-build'),streamBoundary:body.includes('$RC(')||body.includes('id="S:')});
}
console.log(JSON.stringify({at:new Date().toISOString(),source:'workstation, unique cold key per route, same infrastructure cookie',results},null,2));
