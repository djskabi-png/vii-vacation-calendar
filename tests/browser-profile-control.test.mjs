import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {browserProfiles} from '../services/vii-quality-control/src/browser-profiles.ts';

function fixture(){
 const state=[],runs=[];let cursor=0,canEdit=true;
 const react={useState(initial){const index=cursor++;if(!(index in state))state[index]=initial;return[state[index],value=>{state[index]=value;}];}};
 const jsx=(type,props)=>({type,props});
 const code=ts.transpileModule(readFileSync(new URL('../app/admin/quality/browser-profile-control.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const exports={};new Function('require','exports',code)(name=>name==='react'?react:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:{useAdminCanEdit:()=>canEdit,__esModule:true,default:{}},exports);
 const nodes=value=>!value?[]:Array.isArray(value)?value.flatMap(nodes):typeof value==='object'?[value,...nodes(value.props?.children)]:[];
 return{runs,setCanEdit(value){canEdit=value;},render(options={}){cursor=0;const tree=nodes(exports.default({options:{enabled:true,profiles:browserProfiles},disabled:false,initialProfileId:'vacations-mobile-map-open-close',onRun:id=>runs.push(id),...options}));return{selects:tree.filter(x=>x.type==='select'),button:tree.find(x=>x.type==='button')};}};
}
test('changing from a map profile to a shell-only world keeps an executable supported scenario',()=>{
 const f=fixture();let ui=f.render();assert.equal(ui.selects[2].props.value,'map-open-close');
 const labels=Object.fromEntries(ui.selects[0].props.children.map(option=>[option.props.value,option.props.children]));assert.equal(labels.providers,'ספקים');assert.equal(labels.activities,'אטרקציות');assert.equal(labels.trails,'מסלולי טיול');assert.equal(labels.global,'דף הבית');
 ui.selects[0].props.onChange({target:{value:'providers'}});ui=f.render();assert.equal(ui.selects[2].props.value,'responsive-shell');assert.equal(ui.selects[2].props.disabled,false);assert.equal(ui.button.props.disabled,false);ui.button.props.onClick();
 ui.selects[1].props.onChange({target:{value:'desktop'}});ui=f.render();assert.equal(ui.selects[2].props.value,'world-shell');ui.button.props.onClick();
 assert.deepEqual(f.runs,['providers-mobile-responsive-shell','providers-desktop-world-shell']);
});
test('viewer permissions and unactivated runner cannot be bypassed through the selected fallback',()=>{
 const f=fixture();f.setCanEdit(false);let ui=f.render();assert.equal(ui.button.props.disabled,true);ui.button.props.onClick();assert.equal(f.runs.length,0);
 f.setCanEdit(true);ui=f.render({options:{enabled:false,profiles:browserProfiles}});assert.equal(ui.button.props.disabled,true);ui.button.props.onClick();assert.equal(f.runs.length,0);
 ui=f.render({options:{enabled:true,profiles:[]}});assert.equal(ui.button.props.disabled,true);assert.equal(ui.selects[2].props.disabled,true);
});
