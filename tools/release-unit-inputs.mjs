import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createReadStream} from 'node:fs';
import {realpath,stat} from 'node:fs/promises';
import {resolve,relative,isAbsolute,posix} from 'node:path';
import ts from 'typescript';
import {builtinModules} from 'node:module';

const SHA=/^[a-f0-9]{40}$/,DIGEST=/^[a-f0-9]{64}$/;
const UNITS=Object.freeze({
 'managed-site':null,
 'quality-controller':'services/vii-quality-control/',
 'quality-browser':'services/vii-quality-browser/',
 'edge-delivery':'services/vii-edge-delivery/',
 'image-delivery':'services/vii-public-images/',
});
const git=(root,args,options={})=>execFileSync('git',args,{cwd:root,stdio:['ignore','pipe','pipe'],windowsHide:true,maxBuffer:32*1024*1024,...options});
const text=(root,args)=>git(root,args,{encoding:'utf8'}).trim();
const transient=path=>/(?:^|\/)(?:test|tests|docs|node_modules)\//.test(path)||path.endsWith('.map');
// Retain the Site input policy; migrations are artifact inputs as well.
function managedInput(path){return !transient(path)&&!path.startsWith('scripts/fixtures/')&&(
 ['app/','worker/','build/','infrastructure/','scripts/','public/','types/','shared/','drizzle/'].some(prefix=>path.startsWith(prefix))||
 /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|vite\.config\.[^/]+|wrangler\.[^/]+|tsconfig[^/]*\.json|postcss\.config\.[^/]+|next\.config\.[^/]+|drizzle\.config\.[^/]+|instrumentation(?:-client)?\.[^/]+|proxy\.[^/]+|\.openai\/hosting\.json)$/.test(path));}
function inventory(root,source){
 if(!SHA.test(source??'')||text(root,['cat-file','-t',source])!=='commit')throw new Error('source_identity_invalid');
 const entries=new Map();
 for(const record of git(root,['ls-tree','-r','-z',source]).toString('utf8').split('\0').filter(Boolean)){
  const match=/^(\d{6}) (blob|commit) ([a-f0-9]{40})\t(.+)$/.exec(record);if(!match)throw new Error('source_tree_invalid');
  entries.set(match[4],{path:match[4],mode:match[1],type:match[2],blob:match[3]});
 }
 return entries;
}
function sourceReferences(body,path){
 const ast=ts.createSourceFile(path,body,ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),references=[];
 const constants=new Map();
 const constantsVisit=node=>{if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.initializer&&(ts.isStringLiteral(node.initializer)||ts.isNoSubstitutionTemplateLiteral(node.initializer))){const values=constants.get(node.name.text)??new Set();values.add(node.initializer.text);constants.set(node.name.text,values);}ts.forEachChild(node,constantsVisit);};constantsVisit(ast);
 const visit=node=>{
  if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))references.push(node.moduleSpecifier.text);
  if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(node.expression)&&node.expression.text==='require')){
   const arg=node.arguments[0];
   if(arg&&(ts.isStringLiteral(arg)||ts.isNoSubstitutionTemplateLiteral(arg)))references.push(arg.text);
   else if(arg&&ts.isIdentifier(arg)&&constants.get(arg.text)?.size===1)references.push([...constants.get(arg.text)][0]);
   else throw new Error('opaque_build_dependency:'+path);
  }
  ts.forEachChild(node,visit);
 };visit(ast);return references;
}
export function collectUnitInputs({root=process.cwd(),source,unit}){
 if(!Object.hasOwn(UNITS,unit))throw new Error('unknown_build_unit');
 const files=inventory(root,source),selected=new Set(),pending=[],blobCache=new Map(),packages=new Set();
 const include=path=>{if(selected.has(path))return;const item=files.get(path);if(!item||item.type!=='blob'||item.mode==='120000')throw new Error('build_dependency_missing_or_linked:'+path);selected.add(path);pending.push(path);if(path==='package.json'||path.endsWith('/package.json')){const pkg=JSON.parse(body(path));for(const field of ['dependencies','devDependencies','peerDependencies','optionalDependencies'])Object.keys(pkg[field]??{}).forEach(name=>packages.add(name));}};
 const body=path=>{if(!blobCache.has(path))blobCache.set(path,text(root,['cat-file','blob',files.get(path).blob]));return blobCache.get(path);};
 if(unit==='managed-site'){
  for(const path of files.keys())if(managedInput(path))include(path);
  for(const path of ['package.json','.openai/hosting.json','worker/index.ts'])if(!selected.has(path))throw new Error('build_unit_inputs_missing:'+path);
 }else{
  const prefix=UNITS[unit];
  for(const path of files.keys())if(path.startsWith(prefix)&&!transient(path)&&!path.endsWith('/SKILL.md')&&!path.endsWith('/README.md'))include(path);
  for(const path of [prefix+'wrangler.toml',prefix+'src/index.ts','package.json','pnpm-lock.yaml'])include(path);
  for(const path of files.keys())if(/^tsconfig[^/]*\.json$/.test(path))include(path);
  const config=body(prefix+'wrangler.toml');
  const custom=/command\s*=\s*"node ([a-zA-Z0-9_./-]+)"/.exec(config);if(custom)include(custom[1]);
  const aliases=[],configs=new Set();
  const readConfig=path=>{
   if(configs.has(path))return;configs.add(path);
   const parsed=ts.parseConfigFileTextToJson(path,body(path));if(parsed.error)throw new Error('invalid_build_tsconfig:'+path);
   const value=parsed.config;
   if(value.compilerOptions?.baseUrl!==undefined)throw new Error('unsupported_baseurl_build_config:'+path);
   Object.keys(value.compilerOptions?.paths??{}).forEach(alias=>aliases.push(alias));
   for(const parent of value.extends===undefined?[]:Array.isArray(value.extends)?value.extends:[value.extends]){
    if(typeof parent!=='string'||!parent.startsWith('.'))throw new Error('unsupported_build_tsconfig_extends:'+path);
    const target=posix.normalize(posix.join(posix.dirname(path),parent)),found=[target,target+'.json'].find(item=>files.has(item));if(!found)throw new Error('build_dependency_missing:'+target);include(found);readConfig(found);
   }
   for(const reference of value.references??[]){if(typeof reference.path!=='string')throw new Error('invalid_build_tsconfig_reference');const target=posix.normalize(posix.join(posix.dirname(path),reference.path)),found=[target,posix.join(target,'tsconfig.json')].find(item=>files.has(item));if(!found)throw new Error('build_dependency_missing:'+target);include(found);readConfig(found);}
  };
  for(const path of [...selected])if(/(?:^|\/)tsconfig[^/]*\.json$/.test(path))readConfig(path);
  while(pending.length){
   const path=pending.shift();
   if(path.endsWith('/engine-definition.json')){
    const definition=JSON.parse(body(path));if(!Array.isArray(definition.files)||definition.files.some(value=>typeof value!=='string'||value.includes('..')||value.startsWith('/')))throw new Error('build_definition_invalid');definition.files.forEach(include);
   }
   if(!/\.(?:[cm]?js|tsx?)$/.test(path))continue;
   for(const specifier of sourceReferences(body(path),path)){
    if(!specifier.startsWith('.')){
     if(aliases.some(alias=>{const [before,after]=alias.split('*');return after===undefined?specifier===alias:specifier.startsWith(before)&&specifier.endsWith(after);}))throw new Error('unresolved_build_alias:'+path);
     const name=specifier.startsWith('@')?specifier.split('/').slice(0,2).join('/'):specifier.split('/')[0];
     if(!specifier.startsWith('node:')&&!specifier.startsWith('cloudflare:')&&!builtinModules.includes(specifier)&&!packages.has(name))throw new Error('undeclared_build_dependency:'+specifier);
     continue;
    }
    const target=posix.normalize(posix.join(posix.dirname(path),specifier));
    if(target.startsWith('../')||target.startsWith('/'))throw new Error('build_dependency_outside_source');
    const options=[target,...['.ts','.tsx','.d.ts','.js','.mjs','.json','/index.ts','/index.tsx','/index.d.ts','/index.js'].map(suffix=>target+suffix)];
    const found=options.find(value=>files.has(value));if(!found)throw new Error('build_dependency_missing:'+target);include(found);
   }
  }
 }
 return [...selected].sort().map(path=>({path,blob:files.get(path).blob}));
}
export function fingerprintUnit(options){
 const inputs=collectUnitInputs(options),digest=createHash('sha256').update('vii-unit-input-policy-v1\0'+options.unit+'\0');
 for(const input of inputs)digest.update(input.path+'\0'+input.blob+'\0');
 return{schemaVersion:1,unit:options.unit,source:options.source,fingerprint:digest.digest('hex'),inputs};
}
export async function validateReusableArtifact({root=process.cwd(),receipt,unit,source,artifactPath,now=Date.now()}){
 if(!Object.hasOwn(UNITS,unit))throw new Error('unknown_build_unit');
 if(text(root,['status','--porcelain=v1','--untracked-files=all']))throw new Error('working_tree_dirty');
 if(text(root,['rev-parse','HEAD'])!==source)throw new Error('candidate_worktree_not_frozen');
 const age=now-Date.parse(receipt?.observedAt);
 if(receipt?.schemaVersion!==1||receipt.status!=='passed'||receipt.engine!=='build'||receipt.exitCode!==0||receipt.unit!==unit||!SHA.test(receipt.source??'')||!SHA.test(receipt.tree??'')||!DIGEST.test(receipt.artifactSha256??'')||!DIGEST.test(receipt.inputFingerprint??'')||!Number.isFinite(age)||age<0||age>24*60*60*1000)throw new Error('artifact_receipt_invalid');
 if(text(root,['rev-parse',receipt.source+'^{tree}'])!==receipt.tree)throw new Error('artifact_source_tree_mismatch');
 try{git(root,['merge-base','--is-ancestor',receipt.source,source]);}catch{throw new Error('artifact_source_not_ancestor');}
 const original=fingerprintUnit({root,source:receipt.source,unit}),current=fingerprintUnit({root,source,unit});
 if(original.fingerprint!==receipt.inputFingerprint||current.fingerprint!==original.fingerprint)throw new Error('artifact_input_fingerprint_mismatch');
 const absoluteRoot=await realpath(root),artifact=await realpath(resolve(root,artifactPath)),rel=relative(absoluteRoot,artifact);
 if(!rel||rel.startsWith('..')||isAbsolute(rel)||!(await stat(artifact)).isFile())throw new Error('artifact_outside_workspace');
 const digest=createHash('sha256');for await(const bytes of createReadStream(artifact))digest.update(bytes);
 if(digest.digest('hex')!==receipt.artifactSha256)throw new Error('artifact_digest_mismatch');
 return{status:'reusable',unit,candidateSource:source,artifactSource:receipt.source,inputFingerprint:current.fingerprint,artifactSha256:receipt.artifactSha256};
}
