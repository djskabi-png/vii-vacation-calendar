import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';

const source = fs.readFileSync(new URL("../app/components/guest-review-studio.tsx", import.meta.url), "utf8");

const ast=ts.createSourceFile('review.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let aside, contentCheck;
const visit=node=>{
 if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='hasPublishedReviewContent')contentCheck=node.initializer;
 if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(ast)==='aside'&&node.openingElement.attributes.getText(ast).includes('review-experience__score'))aside=node;
 ts.forEachChild(node,visit);
};visit(ast);assert.ok(aside&&contentCheck);
const js=ts.transpileModule(`const hasPublishedReviewContent=${contentCheck.getText(ast)}; const result=${aside.getText(ast)};`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const copy={outOfTen:n=>String(n),published:n=>`${n} published`,archiveCount:n=>`${n} archive`,illustrativeScore:'illustrative',sourceScore:'source',newLabel:'new',voice:'voice',noApproved:'none'};
const text=x=>typeof x==='string'||typeof x==='number'?String(x):Array.isArray(x)?x.map(text).join(''):x?.props?text(x.props.children):'';
const render=(supplierReviews,publishedReviews,reviewCount=14,publishedRating=10,illustrative=false)=>text(Function('require','exports','supplierReviews','publishedReviews','reviewCount','publishedRating','illustrative','copy',js+';return result;')(()=>jsx,{},supplierReviews,publishedReviews,reviewCount,publishedRating,illustrative,copy));

test('actual review score labels a source count as archive when no written content can be displayed',()=>{
 const result=render([],[]);assert.match(result,/14 archive/);assert.doesNotMatch(result,/published/);
 assert.match(render([],[],0),/source/);
 assert.match(render([],[],0,null),/new.*none/);
});

test('actual review score retains published wording for either available source and marks illustrative state separately',()=>{
 assert.match(render([{text:'Supplier review'}],[]),/14 published/);
 assert.match(render([],[{summary:'Verified archive review'}]),/14 published/);
 assert.match(render([],[],14,10,true),/illustrative/);
});
