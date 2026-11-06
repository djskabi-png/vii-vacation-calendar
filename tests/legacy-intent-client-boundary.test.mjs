import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {buildLegacyVacationIntentIndex} from '../app/lib/legacy-search-intent-source.ts';
import {canonicalLegacyVacationSearchPath,legacyCanonicalIntentCount} from '../app/lib/legacy-search-intent.ts';
import {vacationIntentIndexBytes,supplierLegacyIndexBytes} from '../build/generate-vacation-intent-index.mjs';
import {supplierLegacySlug,unavailableLegacyPlace,unavailableLegacySearchHref} from '../app/data/supplier-legacy-links.ts';
import * as originalLegacyLinks from '../app/data/supplier-legacy-links-source.ts';
import verified from '../app/data/verified-catalog.json' with {type:'json'};
import retired from '../app/data/retired-place-routes.json' with {type:'json'};
const require=createRequire(import.meta.url);
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite/package.json')]}));

test('every source-derived canonical intent survives the compact browser projection exactly',()=>{
 const source=buildLegacyVacationIntentIndex();assert.ok(source.size>100);assert.equal(legacyCanonicalIntentCount(),source.size);
 for(const [key,path]of source)assert.equal(canonicalLegacyVacationSearchPath(JSON.parse(key)),path,key);
 assert.equal(readFileSync('app/data/legacy-vacation-intents.generated.json','utf8').replace(/\r\n/g,'\n'),vacationIntentIndexBytes());
 assert.equal(canonicalLegacyVacationSearchPath({location:'synthetic nonexistent place',features:['synthetic']}),null);
});
test('every verified and retired identity retains exact aliases and unavailable-route behavior',()=>{
 for(const world of ['vacations','events']){
  const ids=[...new Set([...(world==='vacations'?verified.vacation:verified.events).map(x=>x.id),...retired.map(x=>x.slug),undefined,'toString','constructor','__proto__','synthetic-unknown'])];
  for(const id of ids){assert.equal(supplierLegacySlug(id,world),originalLegacyLinks.supplierLegacySlug(id,world));assert.deepEqual(unavailableLegacyPlace(id,world),originalLegacyLinks.unavailableLegacyPlace(id,world));assert.equal(unavailableLegacySearchHref(id,world),originalLegacyLinks.unavailableLegacySearchHref(id,world));}
 }
 assert.equal(readFileSync('app/data/supplier-legacy-links.generated.json','utf8').replace(/\r\n/g,'\n'),supplierLegacyIndexBytes());
});
test('actual bundled search client cannot include raw supplier catalogs or server location readers',async()=>{
 const result=await build({entryPoints:['app/search/page.tsx'],bundle:true,write:false,metafile:true,format:'esm',platform:'browser',packages:'external',loader:{'.css':'empty'},minify:true,charset:'utf8'});
 const forbidden=['legacy-search-page-publications.json','sergey-public-catalog.json','verified-catalog.json','public-catalog-read.ts','world-location-pages.ts','supplier-legacy-links-source.ts'];
 for(const input of Object.keys(result.metafile.inputs))assert.ok(!forbidden.some(x=>input.includes(x)),input);
});
test('actual bundled search URL logic excludes full publication prose and retains every canonical lookup',async()=>{
 const result=await build({entryPoints:['app/lib/vacation-search-url.ts'],bundle:true,write:false,metafile:true,format:'esm',platform:'browser',packages:'external',minify:true,charset:'utf8'});
 const inputs=Object.keys(result.metafile.inputs);
 assert.ok(inputs.some(x=>x.includes('legacy-vacation-intents.generated.json')));
 assert.ok(!inputs.some(x=>x.includes('legacy-search-page-publications.json')));
 assert.ok(!inputs.some(x=>x.includes('legacy-search-intent-source.ts')));
 assert.ok(!inputs.some(x=>x.includes('public-catalog-read.ts')||x.includes('sergey-public-catalog.json')));
 assert.ok(result.outputFiles[0].contents.length<250000,'canonical URL lookup must remain a bounded browser module');
});
