import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';

const ref=process.env.VII_QA_WINDOW_SOURCE_REF;
if(ref&&!/^[a-f0-9]{40}$/.test(ref))throw Error('invalid_test_source_ref');
const source=ref?execFileSync('git',['show',ref+':app/search/page.tsx'],{encoding:'utf8'}):readFileSync(new URL('../app/search/page.tsx',import.meta.url),'utf8');
const tree=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const component=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='SearchExperience');
assert.ok(component,'actual SearchExperience missing');
const variables=new Map();let progressive;
const visit=n=>{if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name))variables.set(n.name.text,n.initializer);if(ts.isJsxOpeningElement(n)&&n.tagName.getText(tree)==='ProgressiveResults')progressive=n;ts.forEachChild(n,visit);};visit(component);
const initializer=name=>{assert.ok(variables.get(name),name+' missing');return variables.get(name).getText(tree);};
const initial=Function('return ('+initializer('initialResultWindow')+');')();
const visible=Function('resultWindow','resultWindowKey','initialResultWindow','mapOpen','displayedResults','const visibleResultCount='+initializer('visibleResultCount')+';return '+initializer('visibleResults')+';');
const attribute=progressive?.attributes.properties.find(x=>x.name?.getText(tree)==='onShowMore');
assert.ok(attribute?.initializer&&ts.isJsxExpression(attribute.initializer)&&attribute.initializer.expression,'actual continuation callback missing');
const continuation=Function('setResultWindow','resultWindowKey','displayedResults','initialResultWindow','return ('+attribute.initializer.expression.getText(tree)+');');
const all=Object.freeze(Array.from({length:103},(_,i)=>Object.freeze({slug:'id-'+i,price:i+1})));

function fixture(){let state={key:'same',count:initial};return{get state(){return state;},render({key='same',map=false,items=all}={}){return visible(state,key,initial,map,items);},more({key='same',items=all}={}){continuation(update=>{state=update(state);},key,items,initial)();}};}

test('actual initial mount is six while bounded continuation reaches every ordered identity',()=>{
 assert.equal(initial,6);
 const f=fixture();assert.deepEqual(f.render(),all.slice(0,6));
 for(let step=0;step<12&&f.render().length<all.length;step++){
  const before=f.render();f.more();const after=f.render();
  assert.ok(after.length>before.length,'continuation must advance');
  assert.ok(after.length<=before.length+9,'continuation must remain bounded');
  assert.deepEqual(after.slice(0,before.length),before,'existing order must remain stable');
 }
 assert.deepEqual(f.render(),all);assert.equal(new Set(f.render().map(x=>x.slug)).size,103);
 f.more();assert.deepEqual(f.render(),all,'terminal continuation cannot exceed inventory');
 assert.equal(all.length,103);
});

test('actual map projection uses the complete inventory and filter or sort changes reset the mount window',()=>{
 const f=fixture();for(let step=0;step<12;step++)f.more();
 assert.equal(f.state.count,103);assert.strictEqual(f.render({map:true}),all);
 assert.deepEqual(f.render({key:'new-filter'}),all.slice(0,initial));
 f.more({key:'new-filter'});assert.deepEqual(f.state,{key:'new-filter',count:initial+9});
 assert.deepEqual(f.render({key:'new-filter'}),all.slice(0,initial+9));
 const reversed=Object.freeze([...all].reverse());
 assert.deepEqual(f.render({key:'new-sort',items:reversed}),reversed.slice(0,initial));
 assert.strictEqual(f.render({key:'new-sort',items:reversed,map:true}),reversed);
});

test('actual window does not invent results when eligible inventory is short or empty',()=>{
 const f=fixture(),short=Object.freeze(all.slice(0,3)),empty=Object.freeze([]);
 assert.deepEqual(f.render({items:short}),short);assert.deepEqual(f.render({items:empty}),empty);
 assert.strictEqual(f.render({items:short,map:true}),short);assert.strictEqual(f.render({items:empty,map:true}),empty);
});
