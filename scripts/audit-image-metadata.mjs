import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import ts from 'typescript';

const root = resolve(process.argv.find(arg => arg.startsWith('--root='))?.slice(7) || 'app');
const fix = process.argv.includes('--fix-titles');
const inventory = [];
async function scan(dir) {
  for (const entry of await readdir(dir, {withFileTypes:true})) {
    const path = resolve(dir,entry.name);
    if (entry.isDirectory()) { await scan(path); continue; }
    if (!path.endsWith('.tsx')) continue;
    const source = await readFile(path,'utf8');
    const tree = ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    const edits=[];
    function visit(node) {
      if ((ts.isJsxSelfClosingElement(node)||ts.isJsxOpeningElement(node)) && ['img','Image'].includes(node.tagName.getText(tree))) {
        const attrs = node.attributes.properties.filter(ts.isJsxAttribute);
        const alt=attrs.find(a=>a.name.getText(tree)==='alt');
        const title=attrs.find(a=>a.name.getText(tree)==='title');
        const decorative = alt?.initializer && ts.isStringLiteral(alt.initializer) && alt.initializer.text==='';
        inventory.push({file:relative(process.cwd(),path).replaceAll('\\','/'),line:tree.getLineAndCharacterOfPosition(node.getStart(tree)).line+1,alt:alt?.initializer?.getText(tree)||null,title:title?.initializer?.getText(tree)||null,decorative});
        if (fix && !title && alt?.initializer) edits.push({at:alt.end,text:` title=${alt.initializer.getText(tree)}${decorative?' data-image-role="decorative"':''}`});
      }
      ts.forEachChild(node,visit);
    }
    visit(tree);
    if (edits.length) {
      let result=source;
      for (const edit of edits.sort((a,b)=>b.at-a.at)) result=result.slice(0,edit.at)+edit.text+result.slice(edit.at);
      // This is a mechanical metadata-only rewrite, never a formatter or redesign.
      await writeFile(path,result,'utf8');
    }
  }
}
await scan(root);
const missing=inventory.filter(row=>!row.alt||!row.title);
console.log(JSON.stringify({images:inventory.length,files:new Set(inventory.map(row=>row.file)).size,missing,decorative:inventory.filter(row=>row.decorative),mode:fix?'mechanical_title_fix':'audit'},null,2));
if(!fix && missing.length)process.exitCode=1;
