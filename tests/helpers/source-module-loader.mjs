import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';

// Execute complete owning source and real TS/JSON dependencies without a
// watcher, browser or production data connection.
export function createSourceLoader(overrides={}) {
  const cache=new Map();
  function load(input) {
    let filename=path.resolve(input);
    if(!fs.existsSync(filename))filename=['.ts','.tsx','.mjs','.json'].map(ext=>filename+ext).find(candidate=>fs.existsSync(candidate));
    if(!filename)throw Error('Source dependency missing: '+input);
    if(filename.endsWith('.json'))return JSON.parse(fs.readFileSync(filename,'utf8'));
    if(filename.endsWith('.css'))return {};
    if(cache.has(filename))return cache.get(filename).exports;
    const module={exports:{}};cache.set(filename,module);
    const native=createRequire(filename);
    const require=name=>Object.hasOwn(overrides,name)?overrides[name]:name.startsWith('.')?load(path.resolve(path.dirname(filename),name)):native(name);
    const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
    new Function('require','module','exports','__filename','__dirname',code)(require,module,module.exports,filename,path.dirname(filename));
    return module.exports;
  }
  return load;
}
