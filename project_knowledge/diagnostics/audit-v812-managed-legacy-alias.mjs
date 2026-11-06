import assert from 'node:assert/strict';
// A managed redirect is production data. Future releases must preserve both
// the DB binding and the existing managed-override-before-legacy precedence.
const origin='https://vii.spaplus.co';
const source='/%d7%90%d7%94%d7%91%d7%94_%d7%91%d7%a9%d7%a0%d7%99%d7%99%d7%9d';
const target='/discover/place/hourly-1891';
const rows=[];
for(const path of [source,source.toUpperCase()]){
 const response=await fetch(origin+path,{redirect:'manual',headers:{Accept:'text/html'},signal:AbortSignal.timeout(15000)});
 await response.body?.cancel();
 assert.equal(response.status,301,'Active source must not revert to bundled410');
 const location=new URL(response.headers.get('location'),origin);
 assert.equal(location.origin,origin);assert.equal(location.pathname,target);assert.equal(location.search,'');
 rows.push({path,status:response.status,location:location.href});
}
const destination=await fetch(origin+target,{redirect:'manual',headers:{Accept:'text/html'},signal:AbortSignal.timeout(15000)});
assert.equal(destination.status,200,'Destination must be final, active and free of redirect chains');
const html=await destination.text(),h1=/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1].replace(/<[^>]*>/g,'').trim();
assert.equal(h1,'אהבה בשניים');
console.log(JSON.stringify({status:'passed',observedAt:new Date().toISOString(),rows,target:{path:target,status:destination.status,h1,build:destination.headers.get('x-vii-app-build')}}));
