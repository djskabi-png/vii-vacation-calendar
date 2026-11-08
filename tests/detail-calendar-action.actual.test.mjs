import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as model from '../app/lib/modern-date-model.ts';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const jsx=(type,props)=>({type,props});
function load(path,dependencies){const exports={};const code=ts.transpileModule(read(path),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;Function('require','exports',code)(name=>{if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};if(name in dependencies)return dependencies[name];throw Error('Unexpected dependency '+name);},exports);return exports;}
function nodes(tree){return !tree||typeof tree!=='object'?[]:[tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)];}

test('actual sticky dock renders an explicit action button and retains ordinary booking links',()=>{
 const {DetailStickyDock}=load('app/components/detail-sticky-dock.tsx',{'next/link':{default:Symbol('Link')},'./direct-phone-link':{DirectPhoneLink:Symbol('Phone')}});
 let opened=0;
 const tree=DetailStickyDock({name:'Venue',sections:[],onlineHref:'#booking-summary',onOnlineAction:()=>opened++,onlineLabel:'Dates'});
 const button=nodes(tree).find(e=>e.type==='button');assert.equal(button.props.type,'button');button.props.onClick();assert.equal(opened,1);
 assert.ok(!nodes(tree).some(e=>e.type==='a'&&e.props.href==='#booking-summary'));
 const ordinary=DetailStickyDock({name:'Venue',sections:[],onlineHref:'#booking-summary'});
 assert.ok(nodes(ordinary).some(e=>e.type==='a'&&e.props.href==='#booking-summary'));
});

function dateHarness(extra={}){
 let props={openRequest:0,value:'2026-11-12',...extra},slots=[],cursor=0,effects=[],dirty=false,tree;
 const field={focusCount:0,focus(){this.focusCount++;},setCustomValidity(){},form:{addEventListener(){},removeEventListener(){}}};
 const react={useId:()=> 'date-fixture',useMemo:fn=>fn(),useRef(value){const i=cursor++;return slots[i]??={current:value};},useState(value){const i=cursor++;slots[i]??={value};return[slots[i].value,next=>{const value=typeof next==='function'?next(slots[i].value):next;if(!Object.is(value,slots[i].value)){slots[i].value=value;dirty=true;}}];},useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>!Object.is(v,old.deps[j])))effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});}};
 const {ModernDateInput}=load('app/components/modern-date-input.tsx',{'react':react,'../i18n/locale-provider':{useSiteLanguage:()=>({language:'he'})},'../lib/modern-date-model':model,'./modern-date-input.css':{}});
 const originalDocument=globalThis.document;globalThis.document={addEventListener(){},removeEventListener(){}};
 function render(){let passes=0;do{assert.ok(++passes<8,'effects settle without a render loop');dirty=false;cursor=0;effects=[];tree=ModernDateInput(props);for(const e of nodes(tree))if(e.type==='input'&&e.props.ref)e.props.ref.current=field;for(const effect of effects)effect();}while(dirty);return tree;}
 return{render,field,request(value){props={...props,openRequest:value};return render();},dispose(){globalThis.document=originalDocument;}};
}

test('actual date input opens from CTA, closes, reopens from the next CTA and does not leak trigger to DOM',()=>{
 const h=dateHarness();try{
 assert.equal(nodes(h.render()).some(e=>e.props?.role==='dialog'),false);
 let tree=h.request(1);assert.ok(nodes(tree).some(e=>e.props?.role==='dialog'));assert.equal(h.field.focusCount,1);
 const input=nodes(tree).find(e=>e.type==='input');assert.equal(input.props.openRequest,undefined);assert.equal(input.props.value,'2026-11-12');
 const close=nodes(tree).find(e=>e.type==='button'&&e.props.children==='סגירה');assert.ok(close);close.props.onClick();assert.equal(nodes(h.render()).some(e=>e.props?.role==='dialog'),false);
 tree=h.request(2);assert.ok(nodes(tree).some(e=>e.props?.role==='dialog'));
 }finally{h.dispose();}
});

test('disabled and read-only date controls cannot be forced open by a CTA',()=>{
 for(const extra of [{disabled:true},{readOnly:true}]){const h=dateHarness(extra);try{assert.equal(nodes(h.request(1)).some(e=>e.props?.role==='dialog'),false);assert.equal(h.field.focusCount,0);}finally{h.dispose();}}
});

test('actual vacation callback opens calendar and event CTA is wired to the date input request',()=>{
 const text=read('app/business/client-page.tsx'),ast=ts.createSourceFile('business.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let expression;
 function visit(n){if(ts.isJsxAttribute(n)&&n.name.getText(ast)==='onOnlineAction')expression=n.initializer.expression.getText(ast);ts.forEachChild(n,visit);}visit(ast);assert.ok(expression);
 let open=false;Function('activeWorld','setCalendarOpen','return '+expression)('vacation',value=>open=value)();assert.equal(open,true);assert.equal(Function('activeWorld','setCalendarOpen','return '+expression)('events',()=>{}),undefined);
 const events=read('app/events/place/client-page.tsx');assert.match(events,/onOnlineAction=\{openEventCalendar\}/);assert.match(events,/<ModernDateInput openRequest=\{dateOpenRequest\}/);assert.match(events,/onClick=\{openEventCalendar\}>\{translate\("בדיקת אירוע"\)\}/);
});
