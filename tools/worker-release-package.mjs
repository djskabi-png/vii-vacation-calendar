import {readFileSync,readdirSync,realpathSync,statSync,writeFileSync} from 'node:fs';
import {resolve,relative,posix} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {builtinModules} from 'node:module';
import ts from 'typescript';
import {fingerprintUnit} from './release-unit-inputs.mjs';

export const WORKER_PACKAGE_DEFINITION='worker-package-v1';
const sha=value=>createHash('sha256').update(value).digest('hex');
const units={'edge-delivery':'vii-edge-delivery','image-delivery':'vii-public-images','quality-controller':'vii-quality-control','quality-browser':'vii-quality-browser'};
const git=(root,args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
const safe=name=>typeof name==='string'&&name.length<=512&&!name.includes('\\')&&!name.includes('\0')&&!name.startsWith('/')&&!name.split('/').some(x=>!x||x==='.'||x==='..'||x.startsWith('.')||/^__.*qa|fixture/i.test(x))&&!/[<>:"|?*]/.test(name);
const mime=name=>name.endsWith('.js')?'application/javascript+module':name.endsWith('.wasm')?'application/wasm':name.endsWith('.txt')?'text/plain':name.endsWith('.bin')?'application/octet-stream':null;
function compiledModules(directory){
 const root=realpathSync(directory),files=[];let total=0,visited=0;
 function walk(path){for(const entry of readdirSync(path,{withFileTypes:true})){
  if(++visited>512)throw Error('worker_package_entry_limit');
  if(entry.isSymbolicLink())throw Error('worker_package_linked_input');
  const absolute=resolve(path,entry.name),name=relative(root,absolute).replaceAll('\\','/');
  if(entry.isDirectory()){if(!safe(name))throw Error('worker_package_directory_invalid');walk(absolute);continue;}
  if(!entry.isFile())throw Error('worker_package_special_input');
  // Wrangler's commentary and debugging maps are not executable modules.
  if(entry.name==='README.md'||entry.name.endsWith('.map'))continue;
  if(!safe(name)||!mime(name))throw Error('worker_package_module_invalid');
  const size=statSync(absolute).size;total+=size;
  if(size>16*1024*1024||total>24*1024*1024||files.length>=256)throw Error('worker_package_total_size_invalid');
  const bytes=readFileSync(absolute);files.push({name,mime:mime(name),sha256:sha(bytes),bytes:bytes.length,body:bytes.toString('base64')});
 }}walk(root);return files.sort((a,b)=>a.name.localeCompare(b.name));
}
function inspect(payload){
 if(payload?.schemaVersion!==1||!units[payload.unit]||payload.entrypoint!=='index.js'||typeof payload.nodeCompat!=='boolean'||!Array.isArray(payload.modules)||!payload.modules.length||payload.modules.length>256)throw Error('worker_package_invalid');
 if(!/^[a-f0-9]{40}$/.test(payload.source??'')||!/^[a-f0-9]{40}$/.test(payload.tree??'')||!/^[a-f0-9]{64}$/.test(payload.inputFingerprint??''))throw Error('worker_package_identity_invalid');
 const modules=new Map();let total=0,references=0;
 for(const entry of payload.modules){
  if(!safe(entry.name)||mime(entry.name)!==entry.mime||modules.has(entry.name)||!Number.isSafeInteger(entry.bytes)||entry.bytes<0||entry.bytes>16*1024*1024||typeof entry.body!=='string'||entry.body.length>24*1024*1024)throw Error('worker_package_module_invalid');
  const bytes=Buffer.from(entry.body,'base64');
  if(bytes.toString('base64')!==entry.body||bytes.length!==entry.bytes||sha(bytes)!==entry.sha256)throw Error('worker_package_module_digest_mismatch');
  total+=bytes.length;if(total>24*1024*1024)throw Error('worker_package_total_size_invalid');modules.set(entry.name,{...entry,decoded:bytes});
 }
 if(!modules.has(payload.entrypoint))throw Error('worker_package_entrypoint_missing');
 const node=new Set(builtinModules.flatMap(x=>[x,x.replace(/^node:/,''),'node:'+x.replace(/^node:/,'')]));
 for(const entry of modules.values()){
  if(entry.mime!=='application/javascript+module')continue;
  const ast=ts.createSourceFile(entry.name,entry.decoded.toString('utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  if(ast.parseDiagnostics.length)throw Error('worker_package_javascript_invalid');
  if(entry.name===payload.entrypoint&&!ast.statements.some(n=>ts.isExportAssignment(n)||n.modifiers?.some(m=>m.kind===ts.SyntaxKind.DefaultKeyword)||ts.isExportDeclaration(n)&&n.exportClause&&ts.isNamedExports(n.exportClause)&&n.exportClause.elements.some(e=>e.name.text==='default')))throw Error('worker_package_handler_missing');
  const imports=[];
  const visit=n=>{
   if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier){if(!ts.isStringLiteral(n.moduleSpecifier))throw Error('worker_package_opaque_import');imports.push(n.moduleSpecifier.text);}
   if(ts.isCallExpression(n)&&n.expression.kind===ts.SyntaxKind.ImportKeyword){if(n.arguments.length!==1||!ts.isStringLiteral(n.arguments[0]))throw Error('worker_package_opaque_import');imports.push(n.arguments[0].text);}
   ts.forEachChild(n,visit);
  };visit(ast);
  for(const name of imports){references++;
   if(node.has(name)){if(!payload.nodeCompat)throw Error('worker_package_node_compat_required');continue;}
   if(['cloudflare:workers','cloudflare:sockets'].includes(name))continue;
   if(!name.startsWith('./')&&!name.startsWith('../'))throw Error('worker_package_external_import');
   const target=posix.normalize(posix.join(posix.dirname(entry.name),name));
   if(!safe(target)||!modules.has(target))throw Error('worker_package_import_missing');
  }
 }
 return {modules:modules.size,totalBytes:total,imports:references};
}

/** Preserve exact dry-run module bytes; no deploy, configuration or secrets.
 * Runtime bindings/configuration require a separate provider readback. */
export function captureWorkerPackage({unit,directory,outputPath,root=process.cwd()}){
 root=resolve(root);if(!units[unit])throw Error('unknown_build_unit');
 const source=git(root,['rev-parse','HEAD']),tree=git(root,['rev-parse','HEAD^{tree}']);
 if(git(root,['status','--porcelain=v1','--untracked-files=all']))throw Error('candidate_worktree_not_frozen');
 const config=git(root,['show',`${source}:services/${units[unit]}/wrangler.toml`]);
 const payload={schemaVersion:1,unit,source,tree,inputFingerprint:fingerprintUnit({root,source,unit}).fingerprint,entrypoint:'index.js',nodeCompat:/compatibility_flags\s*=\s*\[[^\]]*"nodejs_compat"/.test(config),modules:compiledModules(directory)};
 inspect(payload);const bytes=Buffer.from(JSON.stringify(payload));
 if(bytes.length>40*1024*1024)throw Error('worker_package_size_invalid');
 writeFileSync(resolve(outputPath),bytes,{flag:'wx'});
 return {unit,source,tree,artifactSha256:sha(bytes),artifactBytes:bytes.length,inputFingerprint:payload.inputFingerprint};
}

export function auditWorkerPackage({artifactPath,compiledDirectory,root=process.cwd(),source,unit}){
 if(statSync(artifactPath).size>40*1024*1024)throw Error('worker_package_size_invalid');
 const bytes=readFileSync(artifactPath);
 const payload=JSON.parse(bytes.toString('utf8')),details=inspect(payload);
 if(payload.unit!==unit||payload.source!==source||git(root,['rev-parse',`${source}^{tree}`])!==payload.tree||fingerprintUnit({root,source,unit}).fingerprint!==payload.inputFingerprint)throw Error('worker_package_source_mismatch');
 const config=git(root,['show',`${source}:services/${units[unit]}/wrangler.toml`]);
 if(payload.nodeCompat!==/compatibility_flags\s*=\s*\[[^\]]*"nodejs_compat"/.test(config))throw Error('worker_package_runtime_mismatch');
 if(JSON.stringify(payload.modules)!==JSON.stringify(compiledModules(compiledDirectory)))throw Error('worker_package_tested_payload_mismatch');
 return {schemaVersion:1,engine:'artifact-audit',definitionVersion:WORKER_PACKAGE_DEFINITION,status:'passed',unit,source,tree:payload.tree,observedAt:new Date().toISOString(),artifactSha256:sha(bytes),artifactBytes:bytes.length,failedCount:0,...details,executedCheckIds:['artifact.unit-import-integrity','artifact.runtime-isolation','artifact.fixture-exclusion','artifact.tested-payload-parity']};
}
