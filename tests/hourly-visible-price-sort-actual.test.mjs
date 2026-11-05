import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const sortSource = fs.readFileSync(new URL('../app/lib/discovery-result-sort.ts', import.meta.url), 'utf8');
const sortCode = ts.transpileModule(sortSource, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const sortModule = {exports:{}};
new Function('require','module','exports',sortCode)(() => ({}),sortModule,sortModule.exports);
const {orderDiscoveryResults} = sortModule.exports;
const source = fs.readFileSync(new URL('../app/components/hourly-results.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('hourly-results.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let initializer;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'sortModel') initializer = node.initializer.arguments[0];
  ts.forEachChild(node, visit);
}
visit(ast);
const code = ts.transpileModule(`const make = ${initializer.getText(ast)};`, {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
test('actual hourly sort follows the one-hour price displayed by cards, independently of the two-hour filter', () => {
  const rates = {a:{'שעה':200,'שעתיים':220}, b:{'שעה':150,'שעתיים':300}, unknown:{'שעתיים':100}};
  const verifiedHourlyPrice = (id, duration) => rates[id][duration];
  const model = new Function('ctx',`with(ctx){${code};return make();}`)({nearby:{distance:()=>undefined}, verifiedHourlyPrice, twoHourPrice:item=>verifiedHourlyPrice(item.id,'שעתיים') ?? Infinity});
  const items = Object.keys(rates).map(id=>({id,name:id}));
  assert.deepEqual(orderDiscoveryResults(items,'price-asc','fixture',model).map(x=>x.id), ['b','a','unknown']);
  assert.deepEqual(orderDiscoveryResults(items,'price-desc','fixture',model).map(x=>x.id), ['a','b','unknown']);
});
