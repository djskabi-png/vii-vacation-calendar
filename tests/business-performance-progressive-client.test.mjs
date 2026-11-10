import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {businessReportScopes,canonicalBusinessReportScope} from '../app/lib/business-report-scopes.ts';
import {businessPerformanceView,reportPage} from '../app/lib/business-performance-view.ts';

const inventory=Array.from({length:921},(_,i)=>({placeId:`vacation-${i+1}`,placeName:`Business ${String(i+1).padStart(4,'0')}`,world:'vacations',impressions:2,pageViews:1,phoneReveals:0,phoneClicks:1,whatsappLeads:0,whatsappHandoffs:0,bookingRequests:0,viiBookings:0,reviews:0,uniqueBrowsers:1}));
function compile(){
  let source=readFileSync(new URL('../app/admin/business-performance/page.tsx',import.meta.url),'utf8');
  const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),edits=[];
  function walk(n){if(ts.isVariableDeclaration(n)&&ts.isArrayBindingPattern(n.name)&&ts.isCallExpression(n.initializer)&&n.initializer.expression.getText(ast)==='useState')edits.push({start:n.initializer.getStart(ast),end:n.initializer.end,value:`useState(${JSON.stringify(n.name.elements[0].getText(ast))},${n.initializer.arguments.map(a=>a.getText(ast)).join(',')})`});ts.forEachChild(n,walk)}walk(ast);
  for(const e of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,e.start)+e.value+source.slice(e.end);
  return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
}
const compiled=compile();
const equal=(a,b)=>a?.length===b?.length&&a.every((v,i)=>Object.is(v,b[i]));
function harness(overrides={},fetcher){
  const state={...overrides},refs=[],callbacks=[],memos=[],effects=[],pending=[],timers=new Map(),requests=[];let ri=0,ci=0,mi=0,ei=0,clock=0,csv;
  const react={
    useState:(name,initial)=>{if(!(name in state))state[name]=typeof initial==='function'?initial():initial;return [state[name],next=>{state[name]=typeof next==='function'?next(state[name]):next}]},
    useRef:initial=>refs[ri++]??(refs[ri-1]={current:initial}),
    useCallback:(fn,deps)=>{const i=ci++;if(!callbacks[i]||!equal(callbacks[i].deps,deps))callbacks[i]={deps,fn};return callbacks[i].fn},
    useMemo:(fn,deps)=>{const i=mi++;if(!memos[i]||!equal(memos[i].deps,deps))memos[i]={deps,value:fn()};return memos[i].value},
    useEffect:(fn,deps)=>{const i=ei++;if(!effects[i]||!equal(effects[i].deps,deps)){effects[i]?.cleanup?.();effects[i]={deps};pending.push(()=>effects[i].cleanup=fn())}},
  };
  const jsx=(type,props)=>({type,props:props||{}});
  const dependencies={react,'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},'lucide-react':new Proxy({},{get:(_,name)=>`icon-${name}`}),
    '../../lib/business-report-scopes':{businessReportScopes,canonicalBusinessReportScope},'../../lib/business-performance-view':{businessPerformanceView,reportPage},'../../components/modern-date-input':{ModernDateInput:({onChange,...props})=>jsx('input',{...props,onChange})},'../../components/currency-text':{CurrencyText:({value})=>jsx('span',{children:String(value)})},'../../components/currency-text.tsx':{CurrencyText:({value})=>jsx('span',{children:String(value)})},'./business-performance.module.css':{default:new Proxy({},{get:(_,name)=>String(name)})}};
  const window={location:{hash:`#${overrides.activeView||'overview'}`},localStorage:{getItem:()=>null,setItem:()=>{}},addEventListener:()=>{},removeEventListener:()=>{},setTimeout:fn=>{timers.set(++clock,fn);return clock},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>fn()};
  const fetch=async(url,init)=>{requests.push({url,signal:init?.signal});return fetcher?fetcher(url,init):Response.json({rows:inventory,runHistory:[],bizSnapshots:{}})};
  const document={getElementById:()=>null,createElement:()=>({click:()=>{}})};
  class Blob {constructor(parts){csv=parts.join('')}}
  const URL={createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{}};
  const exports={};new Function('require','exports','window','fetch','document','Blob','URL',compiled)(id=>{assert.ok(dependencies[id],id);return dependencies[id]},exports,window,fetch,document,Blob,URL);
  return {state,requests,render:()=>{ri=ci=mi=ei=0;return exports.default()},flush:async()=>{for(const f of pending.splice(0))f();for(const [id,f]of [...timers]){timers.delete(id);f()}await new Promise(r=>setTimeout(r,0))},csv:()=>csv};
}
function nodes(tree,predicate){if(!tree||typeof tree!=='object')return [];return [tree,...[tree.props?.children].flat(Infinity).flatMap(child=>nodes(child,predicate))].filter(predicate)}
const text=n=>[n?.props?.children].flat(Infinity).map(x=>typeof x==='object'?text(x):x??'').join('');

test('actual overview neither mounts921rows nor requests snapshots, history or conversions',async()=>{
  const h=harness();h.render();await h.flush();const tree=h.render();
  assert.equal(h.requests.length,1);assert.match(h.requests[0].url,/mode=overview/);
  assert.equal(nodes(tree,n=>n.type==='tbody').length,0);
  assert.ok(nodes(tree,()=>true).length<1000);
  assert.ok(text(tree).includes('1,842'),'global impression total includes921businesses');
});
test('actual business view pages50 globally sorted rows while CSV exports all921',()=>{
  const h=harness({rows:inventory,loading:false,activeView:'businesses',businessPage:2,sort:'placeName',sortDirection:'asc'}),tree=h.render();
  const body=nodes(tree,n=>n.type==='tbody')[0];assert.equal(nodes(body,n=>n.type==='tr').length,50);
  assert.ok(text(body).includes('Business 0051'));assert.ok(!text(body).includes('Business 0001'));
  nodes(tree,n=>n.type==='button'&&text(n).includes('ייצוא CSV'))[0].props.onClick();
  assert.equal(h.csv().split('\n').length,922);assert.ok(h.csv().includes('Business 0921'));
});
test('search reaches a business beyond the first page and paging cannot change global counts',()=>{
  const h=harness({rows:inventory,loading:false,activeView:'businesses',businessPage:19,query:'Business 0921'}),tree=h.render();
  const body=nodes(tree,n=>n.type==='tbody')[0];assert.equal(nodes(body,n=>n.type==='tr').length,1);assert.ok(text(body).includes('Business 0921'));
  assert.equal(reportPage(inventory,19).items.length,21);assert.equal(reportPage(inventory,19).total,921);
});
test('deferred sections request only when explicitly selected, and contacts render at most50',async()=>{
  const h=harness();h.render();await h.flush();h.render();await h.flush();assert.equal(h.requests.length,1);
  h.state.activeView='history';h.render();await h.flush();assert.equal(h.requests.filter(r=>r.url.includes('mode=run-history')).length,1);
  assert.equal(h.requests.filter(r=>r.url.includes('mode=conversions')).length,0);
  const bucket={contacts:150,identified:150,converted:0,rate:0,customers:0,orders:0,revenue:0,medianDelay:null};
  const contacts=Array.from({length:150},(_,i)=>({id:i+1,source:'form',time:'2026-11-04',phone:null,details:{},order:null,delay:null,moreOrders:[]}));
  const c=harness({rows:inventory,loading:false,activeView:'contacts',selectedPlaceId:'vacation-1',conversions:{siteID:1,from:'2026-11-04',till:'2026-11-04',created:'2026-11-04',count:150,contacts,summary:{all:bucket,whatsapp:bucket,maskyoo:bucket,form:bucket}},conversionLoading:false});
  const tree=c.render();const ledger=nodes(tree,n=>n.props?.className==='contactLedger')[0];assert.equal(nodes(ledger,n=>n.type==='tbody')[0].props.children.length,50);
});
test('a late prior-period response cannot overwrite the new report',async()=>{
  const resolvers=[];const h=harness({},()=>new Promise(resolve=>resolvers.push(resolve)));
  h.render();await h.flush();h.state.from='2026-11-01';h.render();await h.flush();
  assert.equal(h.requests[0].signal.aborted,true);
  resolvers[1](Response.json({rows:[{...inventory[0],placeName:'Current'}]}));await new Promise(r=>setTimeout(r,0));
  resolvers[0](Response.json({rows:[{...inventory[0],placeName:'Stale'}]}));await new Promise(r=>setTimeout(r,0));
  assert.equal(h.state.rows[0].placeName,'Current');
});
