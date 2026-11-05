import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../app/components/search-box.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('search-box.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let effect;
function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect'&&node.arguments[0].getText(ast).includes('leaveMobileEditor'))effect=node.arguments[0];ts.forEachChild(node,visit);}visit(ast);
const code=ts.transpileModule(`const effect=${effect.getText(ast)};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
test('actual responsive handler closes the editor without cancelling a saved, unsubmitted party draft',()=>{
 let handler,closed=0,cancelled=0,guests=10;
 const run=new Function('ctx',`with(ctx){${code};return effect;}`)({closeMobileSearch:()=>closed++,cancelMobileSearch:()=>{cancelled++;guests=20;},window:{matchMedia:()=>({addEventListener:(_name,fn)=>handler=fn,removeEventListener:()=>{}})}});
 const cleanup=run();handler({matches:false});assert.equal(closed,0);handler({matches:true});assert.equal(closed,1);assert.equal(cancelled,0);assert.equal(guests,10);cleanup();
});
