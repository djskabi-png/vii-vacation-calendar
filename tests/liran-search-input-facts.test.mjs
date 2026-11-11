import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import {vacationPriceRangeMaximum} from '../app/lib/vacation-price-sort.ts';
import {readFile} from 'node:fs/promises';
import {matchesVacationAccommodationType} from '../app/lib/vacation-search-filter-index.ts';
const source=await readFile(new URL('../app/search/page.tsx',import.meta.url),'utf8');
const tree=ts.createSourceFile('search.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function findNode(predicate){let out;const visit=n=>{if(!out&&predicate(n))out=n;ts.forEachChild(n,visit);};visit(tree);assert.ok(out);return out;}
const compile=text=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
test('price URL range survives before starting-price hydration rather than resetting to defaults',()=>{
 const setters=[];const visit=n=>{if(ts.isCallExpression(n)&&['setMinPrice','setMaxPrice'].includes(n.expression.getText(tree))&&n.arguments[0]?.getText(tree).includes('requestedMinPrice'))setters.push(n.getText(tree));ts.forEachChild(n,visit);};visit(tree);assert.equal(setters.length,2);
 for(const available of [false,true]){
  let min,max;new Function('priceFilterAvailable','requestedMinPrice','requestedMaxPrice','VACATION_PRICE_MIN','VACATION_PRICE_MAX','setMinPrice','setMaxPrice',setters.join(';'))(available,1200,2000,0,5000,v=>min=v,v=>max=v);
  assert.deepEqual([min,max],[1200,2000]);
 }
});
test('price input controls remain editable while catalog prices have not arrived',()=>{
 const field=findNode(n=>ts.isJsxOpeningElement(n)&&n.tagName.getText(tree)==='fieldset'&&n.getText(tree).includes('vacation-price-filter'));
 assert.equal(field.attributes.properties.some(a=>a.name?.getText(tree)==='disabled'),false);
});
test('dated price eligibility waits for the dated quote rather than catalog advertising price',()=>{
 const map=findNode(n=>ts.isVariableDeclaration(n)&&n.name.getText(tree)==='mapCandidates');
 let expression;const walk=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(tree)==='matchesPrice')expression=n.initializer.getText(tree);ts.forEachChild(n,walk);};walk(map);assert.ok(expression);
 const run=new Function('priceFilterAvailable','priceFilterActive','catalogPrice','minPrice','maxPrice','selectedStay','periodSearch',`return ${expression}`);
 assert.equal(run(true,true,undefined,1000,2000,{from:'2026-11-05'},null),true);
 assert.equal(run(false,true,undefined,1000,2000,null,null),false);
 assert.equal(run(true,true,1500,1000,2000,null,null),true);
 assert.equal(run(true,true,3000,1000,2000,null,null),false);
});
test('missing accommodation classification cannot match every selected type',()=>{
 for(const types of [[],[''],['  ']])assert.equal(matchesVacationAccommodationType({type:'',types},'וילות'),false);
 const declaration=findNode(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='matchesAnyAccommodationType');
 const fn=new Function('legacyAccommodationTypes',compile(declaration.getText(tree))+';return matchesAnyAccommodationType;')([{label:'וילות',matches:['וילה','וילות']}]);
 assert.equal(fn([''],['וילות']),false);
 assert.equal(fn(['סוויטה','וילה'],['וילות']),true);
});

test('range maximum includes displayed seasonal/loaded prices above5000',()=>{
 assert.equal(vacationPriceRangeMaximum([{slug:'high',price:15000},{slug:'season',startPriceWinter:10000}],{}),15000);
 assert.equal(vacationPriceRangeMaximum([{slug:'fresh'}],{fresh:{startPriceWinter:18000}}),18000);
 assert.equal(vacationPriceRangeMaximum([{slug:'unknown'}],{}),5000);
});
