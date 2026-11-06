import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectProviderCatalog} from '../app/lib/provider-catalog-inspection.ts';
import {catalogStatusMcp} from '../app/lib/catalog-status-mcp.ts';

test('source inspection retains exact active status and full identity inventory without exposing secrets or private fields',async()=>{
 const seen=[];const result=await inspectProviderCatalog('vacations',[2417,2740,2736],{secret:async()=> 'fixture-secret-never-output',fetchImpl:async(url,init)=>{seen.push({url:String(url),init});return Response.json({places:[{siteID:2417,active:false,name:'Inactive fixture',privateEmail:'private@example.test'},{siteID:2740,active:true,name:'New fixture',features:[{id:7,label:'pool',password:'must-not-return'}]}]});}});
 assert.deepEqual(result.ids,[2417,2740]);assert.deepEqual(result.activeIds,[2740]);assert.equal(result.requested[0].fields.active,false);assert.equal(result.requested[2].found,false);
 const serialized=JSON.stringify(result);assert.doesNotMatch(serialized,/fixture-secret|private@example|password|must-not-return/);assert.equal(seen[0].url,'https://bizonline.co.il/api/ai/vii/vacations');assert.equal(seen[0].init.headers.get('Authorization'),'Bearer fixture-secret-never-output');assert.equal(seen[0].init.redirect,'manual');
});
test('source inspector has no arbitrary URL, oversized selection or redirect continuation',async()=>{
 let calls=0;const dependencies={secret:async()=> 'fixture',fetchImpl:async()=>{calls++;return new Response(null,{status:302,headers:{Location:'https://untrusted.test/'}})}};
 await assert.rejects(inspectProviderCatalog('https://untrusted.test',[1],dependencies));assert.equal(calls,0);
 await assert.rejects(inspectProviderCatalog('spa',[1,2,3,4,5],dependencies));assert.equal(calls,0);
 await assert.rejects(inspectProviderCatalog('spa',[6],dependencies));assert.equal(calls,1);
});
test('MCP inspection authorizes existing administrator before provider reads and rejects extra arguments',async()=>{
 let inspections=0;const deps={adminEmails:async()=> 'owner@example.test',database:async()=>{throw Error('no DB read')},fallbackCounts:{vacations:0,events:0,rooms:0,spa:0},inspect:async(world,supplierIds)=>{inspections++;return {world,supplierIds,readOnly:true}}};
 const request=(identity,args={world:'spa',supplierIds:[6,385]})=>new Request('https://vii.spaplus.co/mcp',{method:'POST',headers:{'Content-Type':'application/json',...identity},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'vii_catalog_inspect',arguments:args}})});
 assert.equal((await catalogStatusMcp(request({}),deps)).status,401);assert.equal(inspections,0);
 const headers={'oai-authenticated-user-id':'fixture-owner','oai-authenticated-user-email':'owner@example.test'};
 const denied=await (await catalogStatusMcp(request(headers,{world:'spa',supplierIds:[6],url:'https://untrusted.test'}),deps)).json();assert.ok(denied.error);assert.equal(inspections,0);
 const result=await (await catalogStatusMcp(request(headers),deps)).json();assert.equal(result.result.structuredContent.readOnly,true);assert.equal(inspections,1);
});

test('hourly rooms inspect only the fixed official rooms inventory with exact active flags',async()=>{
 let seen;
 const result=await inspectProviderCatalog('rooms',[42],{secret:async()=> 'fixture',fetchImpl:async(url)=>{seen=String(url);return Response.json({places:[{siteID:42,active:true,name:'fixture room'}]});}});
 assert.equal(seen,'https://bizonline.co.il/api/ai/vii/rooms');assert.deepEqual(result.activeIds,[42]);assert.equal(result.requested[0].fields.active,true);
});
