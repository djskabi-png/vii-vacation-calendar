import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../app/components/special-search-summary.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('summary.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='SpecialSearchSummary');
const compiled=ts.transpileModule(fn.getText(ast).replace('export ',''),{compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,jsxFactory:'h'}}).outputText;
const h=(tag,props,...children)=>({tag,props,children});
const summary=(query,initialArea)=>new Function('ctx',`with(ctx){${compiled};return SpecialSearchSummary({description:'fixture',initialArea});}`)({h,TranslatedText:'translated',useSearchParams:()=>new URLSearchParams(query),initialArea});
test('actual compact world summary follows area query and semantic page defaults',()=>{
 assert.equal(summary('area=North').children[0].children[0].props.text,'North');
 assert.equal(summary('location=Jerusalem','North').children[0].children[0].props.text,'Jerusalem');
 assert.equal(summary('','North').children[0].children[0].props.text,'North');
 assert.equal(summary('').children[0].children[0].props.text,'כל הארץ');
});
