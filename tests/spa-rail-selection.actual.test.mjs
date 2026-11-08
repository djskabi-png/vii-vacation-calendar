import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {spaDealDays,spaRailSelectionHref} from '../app/lib/spa-deal-window.ts';
import {spaWeekdayPath,spaWeekdaySlugs} from '../app/lib/spa-weekday-pages.ts';
import {spaAllPackagesLabel} from '../app/i18n/spa-deal-link-copy.ts';
import {spaSearchHref,spaSearchStateFromValues} from '../app/data/spa-search-landings.ts';
const source=fs.readFileSync('app/components/spa-package-deals.tsx','utf8');
const ast=ts.createSourceFile('rail.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function expression(name,ctx){let found;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name)found=n.initializer;ts.forEachChild(n,visit);}visit(ast);assert.ok(found,name);const code=ts.transpileModule('const answer='+found.getText(ast)+';',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;return new Function('ctx',`with(ctx){${code};return answer;}`)(ctx);}
function selector(ctx){let fn;function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='select')fn=n;ts.forEachChild(n,visit);}visit(ast);const code=ts.transpileModule(fn.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;return new Function('ctx',`with(ctx){${code};return select;}`)(ctx);}
test('rapid date and audience taps stay on the localized regional rail and preserve router state',()=>{
 const historyState={router:'preserved'},calls=[];
 const ctx={layout:'rail',pathname:'/fr/spas/search/north',params:new URLSearchParams('sort=nearest&minPrice=200'),pendingDateRef:{current:'2026-11-09'},date:'2026-11-09',setAudience(){},setRailDate(){},sectionId:'spa-region',spaRailSelectionHref,window:{history:{state:historyState,replaceState:(...args)=>calls.push(args)}},router:{push:()=>assert.fail('navigation'),replace:()=>assert.fail('navigation')}};
 const select=selector(ctx);select('2026-11-11','single');select(undefined,'couple');
 assert.equal(calls.length,2);assert.equal(calls[1][0],historyState);
 const url=new URL(calls[1][2],'https://vii.spaplus.co');assert.equal(url.pathname,ctx.pathname);assert.equal(url.searchParams.get('spaDealDate'),'2026-11-11');assert.equal(url.searchParams.get('spaDealFor'),'couple');assert.equal(url.searchParams.get('minPrice'),'200');assert.equal(url.searchParams.get('sort'),'nearest');
});
test('actual rail fetch identity does not change with selected date or audience',()=>{
 const keys=[];for(const day of ['2026-11-09','2026-11-10'])for(const audience of ['single','couple','group']){
  const ctx={layout:'rail',fixedDate:undefined,fixedWeekday:undefined,fixedDateOffset:undefined,requestedDate:day,regionLabel:'צפון',clockKey:'2026-11-08:after-cutoff',audience};
  ctx.fullDateRequest=expression('fullDateRequest',ctx);ctx.requestDate=expression('requestDate',ctx);keys.push(expression('requestKey',ctx));
 }assert.equal(new Set(keys).size,1);
});
test('all-results destinations preserve audience and exact regional date',()=>{
 for(const audience of ['single','couple','group'])for(const scope of [null,{label:'צפון'}]){
  const ctx={scope,date:'2026-11-09',today:'2026-11-08',tomorrow:'2026-11-09',futureWeekday:'',linkDate:'2026-11-09',audience,spaSearchHref,spaSearchStateFromValues,spaWeekdayPath};
  ctx.allBase=expression('allBase',ctx);ctx.allQuery=expression('allQuery',ctx);const url=new URL(expression('allHref',ctx),'https://vii.spaplus.co');
  assert.equal(url.searchParams.get('spaDealFor'),audience);assert.equal(url.searchParams.get('date'),scope?'2026-11-09':null);assert.equal(url.pathname,scope?spaSearchHref(spaSearchStateFromValues('צפון',audience)):'/spas/tomorrow');
 }
});
test('all-link copy names the chosen future day in all locales',()=>{
 assert.match(spaAllPackagesLabel('2026-11-11','2026-11-08','2026-11-09','he','fallback'),/יום רביעי/);
 assert.match(spaAllPackagesLabel('2026-11-11','2026-11-08','2026-11-09','ru','fallback'),/среду/);
 for(const locale of ['en','fr'])assert.doesNotMatch(spaAllPackagesLabel('2026-11-11','2026-11-08','2026-11-09',locale,'fallback'),/[א-ת]/);
});
test('the supplier six-day horizon never grows an unsupported date at cutoff or midnight',()=>{
 assert.deepEqual(spaDealDays(new Date('2026-11-08T11:59:59Z')),['2026-11-08','2026-11-09','2026-11-10','2026-11-11','2026-11-12','2026-11-13']);
 assert.deepEqual(spaDealDays(new Date('2026-11-08T12:00:00Z')),['2026-11-09','2026-11-10','2026-11-11','2026-11-12','2026-11-13']);
 assert.equal(spaDealDays(new Date('2026-11-08T22:01:00Z')).length,6);assert.equal(spaWeekdaySlugs.length,7);
});
test('a media failure cannot remove an otherwise valid package from the rail',()=>{
 const offers=[{siteId:1,packageId:2},{siteId:3,packageId:4}];assert.equal(expression('visibleOffers',{offers}).length,2);
 assert.match(source,/spa-deal-card__image--unavailable/);
});
