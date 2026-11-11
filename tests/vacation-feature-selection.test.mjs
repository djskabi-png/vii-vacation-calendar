import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import ts from 'typescript';
import { vacationFeatureSelection } from '../app/lib/vacation-feature-selection.ts';

test('quick and legacy feature URLs normalize to one accessibility selection without losing other facts',()=>{
 for(const query of ['accessible=1&features=wifi','features=accessible,wifi','accessible=1&features=accessible,wifi,accessible']) {
  assert.deepEqual(vacationFeatureSelection(new URLSearchParams(query)),{accessibleOnly:true,extras:['wifi']});
 }
 assert.deepEqual(vacationFeatureSelection(new URLSearchParams('features=luxury')),{accessibleOnly:false,extras:['luxury']});
 assert.deepEqual(vacationFeatureSelection(new URLSearchParams('pets=1')),{accessibleOnly:false,extras:['pets']});
 assert.deepEqual(vacationFeatureSelection(new URLSearchParams('pets=2&features=wifi,pets')),{accessibleOnly:false,extras:['wifi','pets']});
 assert.deepEqual(vacationFeatureSelection(new URLSearchParams('pets=0&features=wifi')),{accessibleOnly:false,extras:['wifi']});
});

const source=readFileSync(new URL('../app/search/page.tsx',import.meta.url),'utf8');
const tree=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let declaration;const visit=node=>{if(ts.isFunctionDeclaration(node)&&node.name?.text==='changeBinaryFilter')declaration=node.getText(tree);ts.forEachChild(node,visit);};visit(tree);
const factory=new Function('filtersOpen','draftFilters','setDraftFilters','setPool','setSpa','setWhole','setAccessibleOnly','updateSearchContext','selectedExtras',stripTypeScriptTypes(declaration)+';return changeBinaryFilter;');

test('actual mobile accessibility handler stages the change and cancel leaves applied URL untouched',()=>{
 let draft;const navigation=[];const initial={accessibleOnly:true,selectedExtras:['wifi']};
 const handler=factory(true,initial,v=>{draft=v;},()=>{},()=>{},()=>{},()=>{},v=>navigation.push(v),['wifi']);
 handler('accessible',false);
 assert.deepEqual(draft,{...initial,accessibleOnly:false});assert.deepEqual(navigation,[]);
 assert.equal(initial.accessibleOnly,true);
});

test('actual applied handler removes both URL forms and preserves unrelated filters',()=>{
 let value;let updates;
 const handler=factory(false,null,()=>{},()=>{},()=>{},()=>{},v=>{value=v;},v=>{updates=v;},['wifi']);
 handler('accessible',false);
 assert.equal(value,false);assert.deepEqual(updates,{accessible:null,features:'wifi'});
});

test('pet-party URLs are removable from the shared filter surface and reset clears their source field',()=>{
 assert.match(source,/id === "pets" && !nextExtras\.includes\("pets"\) \? \{ pets: null \}/);
 assert.match(source,/guests: null, bedrooms: null, pets: null/);
 assert.match(source,/pets: draftFilters\.selectedExtras\.includes\("pets"\) \? initialParams\.get\("pets"\) : null/);
});
