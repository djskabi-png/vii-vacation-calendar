import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

export async function auditWorkerStartup(entry, maxBytes=1024*1024) {
  const visited=new Set(), modules=[];
  async function visit(filename) {
    filename=resolve(filename);
    if(visited.has(filename))return;
    visited.add(filename);
    const source=await readFile(filename,'utf8');
    modules.push({path:filename,bytes:Buffer.byteLength(source)});
    const ast=ts.createSourceFile(filename,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
    for(const node of ast.statements) {
      if(!(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)))continue;
      const specifier=node.moduleSpecifier;
      if(!specifier||!ts.isStringLiteral(specifier)||!specifier.text.startsWith('.'))continue;
      await visit(resolve(dirname(filename),specifier.text));
    }
  }
  await stat(entry);
  await visit(entry);
  const bytes=modules.reduce((total,item)=>total+item.bytes,0);
  const result={entry:resolve(entry),bytes,maxBytes,modules:modules.length,largest:modules.sort((a,b)=>b.bytes-a.bytes).slice(0,8)};
  if(bytes>maxBytes)throw new Error(`Worker static startup graph ${bytes}bytes exceeds ${maxBytes}byte budget; defer application/catalog/locale modules behind the request boundary`);
  return result;
}
export async function verifyServerLiteralImports(directory) {
  const missing=[];let modules=0;
  async function walk(folder) {
    for(const item of await readdir(folder,{withFileTypes:true})) {
      const filename=resolve(folder,item.name);
      if(item.isDirectory()){await walk(filename);continue;}
      if(!/\.(?:m?js)$/.test(item.name))continue;
      modules++;
      const ast=ts.createSourceFile(filename,await readFile(filename,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
      const references=[];
      const visit=node=>{
        if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))references.push(node.moduleSpecifier.text);
        if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))references.push(node.arguments[0].text);
        ts.forEachChild(node,visit);
      };
      visit(ast);
      for(const specifier of references.filter(value=>value.startsWith('.'))) {
        const target=resolve(dirname(filename),specifier.replace(/[?#].*$/,''));
        try {if(!(await stat(target)).isFile())missing.push({filename,specifier});}
        catch {missing.push({filename,specifier});}
      }
    }
  }
  await walk(directory);
  if(missing.length)throw new Error(`Missing compiled server imports: ${JSON.stringify(missing.slice(0,12))}`);
  return {serverModules:modules,literalImports:'all resolved'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await auditWorkerStartup(resolve('dist/server/index.js')),null,2));
  console.log(JSON.stringify(await verifyServerLiteralImports(resolve('dist/server'))));
}
