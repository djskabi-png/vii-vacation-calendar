import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {homeDealDates} from '../app/lib/vii-home-deals.ts';
const source=readFileSync(new URL('../app/components/home-live-deals.tsx',import.meta.url),'utf8');
const business=readFileSync(new URL('../app/business/client-page.tsx',import.meta.url),'utf8');
const parse=text=>ts.createSourceFile('component.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function initializer(text,name){const tree=parse(text);let out;const visit=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(tree)===name)out=n.initializer.getText(tree);ts.forEachChild(n,visit);};visit(tree);assert.ok(out,name);return out;}
test('retained fixed-period navigation immediately overrides the previous selected tab',()=>{
 const fn=new Function('fixedPeriod','chosenPeriod',`return ${initializer(source,'period')}`);
 assert.equal(fn('friday','thursday'),'friday');assert.equal(fn(undefined,'thursday'),'thursday');
});
test('changing dates, party, region, language or period hides previous-scope offers synchronously',()=>{
 const fn=new Function('scopedData','selectionKey',`return ${initializer(source,'data')}`);
 const value={deals:[{siteID:618}]};
 assert.equal(fn({key:'old',value},'new'),null);assert.equal(fn({key:'same',value},'same'),value);
 const key=initializer(source,'selectionKey');
 const make=new Function('language','clock','mode','holidayId','regionLabel','period','guests',`return ${key}`);
 const base=['he',{key:'2026-11-04:before14'},'near',null,'צפון','tomorrow',2];
 const previous=make(...base);
 for(const [index,next] of [[0,'en'],[1,{key:'2026-11-04:after14'}],[4,'מרכז'],[5,'friday'],[6,6]]){const inputs=[...base];inputs[index]=next;assert.notEqual(make(...inputs),previous);}
});
test('last-minute dates change at14 Israel time and response acceptance enforces those exact dates',()=>{
 assert.equal(homeDealDates('tomorrow',new Date('2026-11-04T11:59:59Z')).from,'2026-11-04');
 assert.equal(homeDealDates('tomorrow',new Date('2026-11-04T12:00:00Z')).from,'2026-11-05');
 assert.match(source,/result\.dates\?\.from !== expected\.from/);
 assert.match(source,/result\.deals\.some\(deal => deal\.from !== expected\.from \|\| deal\.till !== expected\.till\)/);
 assert.match(source,/if \(controller\.signal\.aborted\) return;/);
});
test('unknown supplier capability permits checking dates but does not authorize an online booking',()=>{
 const mode=new Function('supplierSiteID','property','hasVerifiedSupplierQuote','supplierQuoteUnsettled','usesLiveLegacyAvailability',`return ${initializer(business,'vacationAvailabilityMode')}`);
 assert.equal(mode('618',{},false,false,false),'live');
 assert.equal(mode('618',{onlineAvailability:false},false,false,false),'inquiry');
 assert.equal(mode(undefined,{},false,false,false),'inquiry');
 assert.equal(mode('618',{onlineAvailability:false},true,false,false),'live');
 const booking=new Function('activeWorld','vacationAvailabilityMode','hasSelectedDates','effectiveVacationAvailability','hasSelectedPrice','supplierSiteID','supplierQuote','verifiedSupplierRoomID',`return ${initializer(business,'vacationOnlineReady')}`);
 const call=(status,onlineBooking,ids,room,dates=true)=>booking('vacation','live',dates,{availability:status},true,'618',{onlineBooking,roomIDs:ids},room);
 assert.equal(call('available',true,[1339],1339),true);
 for(const result of [call('unavailable',true,[1339],1339),call('available',false,[1339],1339),call('available',true,[],null),call('available',true,[1339,1340],1339),call('available',true,[1339],1339,false)])assert.equal(Boolean(result),false);
});
