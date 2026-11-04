import assert from 'node:assert/strict';import test from 'node:test';import {readFileSync}from'node:fs';import ts from'typescript';import {popularSearchesForWorld}from'../app/lib/world-popular-search-defaults.ts';import {activityRegions}from'../app/lib/activity-discovery-taxonomy.ts';
function sourceArray(path,name){const source=readFileSync(new URL(path,import.meta.url),'utf8'),tree=ts.createSourceFile('source.ts',source,ts.ScriptTarget.Latest,true);let initializer;const visit=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(tree)===name)initializer=n.initializer.getText(tree);ts.forEachChild(n,visit)};visit(tree);assert.ok(initializer);return new Function(ts.transpileModule('return '+initializer,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)()}
test('region shortcuts use exact accepted facets instead of silently ignored or empty regions',()=>{
 for(const [world,key,accepted]of[['providers','region',sourceArray('../app/data/world-data.ts','nationwideServiceAreas')],['trails','area',sourceArray('../app/data/trail-data.ts','mainTrailAreas')],['attractions','area',activityRegions]])for(const item of popularSearchesForWorld(world)){const region=new URL(item.href,'https://vii.invalid').searchParams.get(key);if(region)assert.ok(accepted.includes(region),`${world}: ${region}`)}
 assert.equal(popularSearchesForWorld('corporate').find(row=>row.label==='ספא לקבוצות').href,'/spas/search/groups');
});

test('hourly region pages exist in the approved inventory; unapproved south uses explicit filtering',async()=>{
 const {worldLocationSlug}=await import('../app/lib/location-slug.ts');const {searchLocationOptions}=await import('../app/data/search-taxonomy.ts');const approved=JSON.parse(readFileSync(new URL('../app/data/approved-world-locations.json',import.meta.url),'utf8'));const slugs=new Set([...approved.hourly,...searchLocationOptions('hourly')].map(worldLocationSlug));
 for(const row of popularSearchesForWorld('hourly')){const url=new URL(row.href,'https://vii.invalid');if(url.pathname.startsWith('/hourly/search/'))assert.ok(slugs.has(url.pathname.split('/').pop()),row.href);}
 const south=popularSearchesForWorld('hourly').find(row=>row.label.includes('בדרום'));assert.equal(new URL(south.href,'https://vii.invalid').searchParams.get('location'),'דרום ונגב');
});
