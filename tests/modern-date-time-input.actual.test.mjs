import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../app/components/modern-date-time-input.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const DateControl=Symbol('date');
function harness(initial='',controlled=true,extra={}){
 const slots=[],listeners=new Map(),emitted=[];let cursor=0,effects=[],dirty=false,tree,value=initial;
 const field={value:initial,form:{addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:(k,f)=>{if(listeners.get(k)===f)listeners.delete(k);}}};
 const react={
  useState(v){const i=cursor++;slots[i]??={value:v};return[slots[i].value,next=>{next=typeof next==='function'?next(slots[i].value):next;if(!Object.is(next,slots[i].value)){slots[i].value=next;dirty=true;}}];},
  useRef(v){const i=cursor++;return slots[i]??={current:v};},
  useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((p,j)=>!Object.is(p,old.deps[j])))effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});}
 };
 const jsx=(type,props)=>({type,props});const exports={};
 new Function('require','exports',code)(n=>n==='react'?react:n==='react/jsx-runtime'?{jsx,jsxs:jsx}:n.includes('locale-provider')?{useSiteLanguage:()=>({language:'he'})}:{ModernDateInput:DateControl},exports);
 function render(){let passes=0;do{assert.ok(++passes<10,'effects settle');dirty=false;cursor=0;effects=[];
 tree=exports.ModernDateTimeInput({...extra,name:'scheduled',value:controlled?value:undefined,defaultValue:controlled?undefined:initial,onChange:e=>{emitted.push(e.target.value);if(controlled)value=e.target.value;}});
 const hidden=tree.props.children[0];hidden.props.ref.current=field;field.value=hidden.props.value;for(const f of effects)f();
 }while(dirty);return tree.props.children;}
 render();return{fields:()=>render(),emitted,field,date(v){render()[1].props.onChange({target:{value:v}});render();},time(v){render()[2].props.onChange({target:{value:v}});render();},external(v){value=v;render();},reset(){listeners.get('reset')?.();render();}};
}
for(const controlled of [true,false]){
 test(`clearing time preserves date (${controlled?'controlled':'uncontrolled'})`,()=>{const h=harness('2026-11-07T10:30',controlled);h.time('');assert.equal(h.fields()[1].props.value,'2026-11-07');assert.equal(h.field.value,'');h.time('11:45');assert.equal(h.field.value,'2026-11-07T11:45');assert.deepEqual(h.emitted,['','2026-11-07T11:45']);});
 test(`date-first selection never invents a time (${controlled?'controlled':'uncontrolled'})`,()=>{const h=harness('',controlled);h.date('2026-11-09');assert.equal(h.fields()[1].props.value,'2026-11-09');assert.equal(h.field.value,'');h.time('17:20');assert.equal(h.field.value,'2026-11-09T17:20');});
}
test('external timestamp and form reset remain authoritative',()=>{const h=harness('2026-11-07T10:30');h.time('');h.external('2026-12-02T15:40');assert.equal(h.fields()[1].props.value,'2026-12-02');assert.equal(h.fields()[2].props.value,'15:40');h.external('');assert.equal(h.fields()[1].props.value,'');const u=harness('2026-11-07T10:30',false);u.date('2026-12-01');u.reset();assert.equal(u.field.value,'2026-11-07T10:30');});
test('required, disabled, name and date/time boundaries are preserved',()=>{const h=harness('2026-11-07T10:30',true,{required:true,disabled:true,min:'2026-11-07T09:15',max:'2026-11-07T18:20',step:60});const[a,b,c]=h.fields();assert.equal(a.props.name,'scheduled');assert.equal(a.props.disabled,true);assert.equal(b.props.required,true);assert.equal(b.props.min,'2026-11-07');assert.equal(c.props.required,true);assert.equal(c.props.min,'09:15');assert.equal(c.props.max,'18:20');assert.equal(c.props.step,60);});
