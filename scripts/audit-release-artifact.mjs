import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdtemp,readFile,readdir,realpath,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,relative,isAbsolute,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {verifyRscAssets} from './verify-rsc-assets.mjs';
import {auditWorkerStartup,verifyServerLiteralImports} from './verify-worker-startup-budget.mjs';

async function digest(path){const hash=createHash('sha256');for await(const bytes of createReadStream(path))hash.update(bytes);return hash.digest('hex');}
function safeEntry(path){
 if(!path||path.includes('\\')||path.includes('\0')||path.includes('//')||/[<>:"|?*]/.test(path)||path.startsWith('/')||path.split('/').some(part=>part==='..'||part==='.'||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))||!path.startsWith('dist/'))throw new Error('artifact_entry_not_allowed');
 if(/(?:^|\/)(?:\.qa-output|__vii_qa_fixture[^/]*|__qa_fixture[^/]*|node_modules|\.git)(?:\/|$)/i.test(path))throw new Error('artifact_fixture_or_private_workspace_file');
}

/** Audit the actual immutable archive, not merely the directory before packing.
 * No build/rewrite occurs here; private framework-generated secrets stay intact. */
export async function auditReleaseArtifact({archivePath,projectRoot=process.cwd(),expectedProjectId}={}){
 const root=await realpath(projectRoot),archive=await realpath(archivePath);
 const info=await stat(archive);if(!info.isFile()||info.size>250*1024*1024)throw new Error('artifact_size_invalid');
 const tar=process.platform==='win32'?'tar.exe':'tar';
 const command=args=>execFileSync(tar,args,{encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024,timeout:30000});
 const entries=command(['-tzf',archive]).split(/\r?\n/).filter(Boolean);
 if(!entries.length||entries.length>20000||new Set(entries.map(path=>path.replace(/\/$/,'').toLowerCase())).size!==entries.length)throw new Error('artifact_entries_invalid');
 entries.forEach(safeEntry);
 // Reject symlinks, hardlinks and special files before extraction. Both BSD
 // tar (Windows) and GNU tar show their type as the first verbose character.
 const details=command(['-tvzf',archive]).split(/\r?\n/).filter(Boolean);
 if(details.length!==entries.length||details.some(line=>!/^[-d]/.test(line)))throw new Error('artifact_links_or_special_files');
 const sizes=details.map(line=>{const fields=line.split(/\s+/);const date=fields.findIndex(value=>/^\d{4}-\d{2}-\d{2}$/.test(value));return Number(date>=0?fields[date-1]:fields[4]);});
 if(sizes.some(size=>!Number.isSafeInteger(size)||size<0||size>32*1024*1024)||sizes.reduce((sum,size)=>sum+size,0)>512*1024*1024)throw new Error('artifact_uncompressed_size_invalid');
 const parent=await realpath(tmpdir()),stage=await mkdtemp(join(parent,'vii-artifact-audit-'));
 if(!relative(parent,stage)||relative(parent,stage).startsWith('..')||isAbsolute(relative(parent,stage)))throw new Error('artifact_stage_not_owned');
 try{
  command(['-xzf',archive,'-C',stage]);
  const hosting=JSON.parse(await readFile(join(stage,'dist/.openai/hosting.json'),'utf8'));
  const expected=expectedProjectId??JSON.parse(await readFile(join(root,'.openai/hosting.json'),'utf8')).project_id;
  if(!expected||hosting.project_id!==expected)throw new Error('artifact_site_identity_mismatch');
  const sourceHosting=JSON.parse(await readFile(join(root,'.openai/hosting.json'),'utf8'));
  let builtHosting={};try{builtHosting=JSON.parse(await readFile(join(root,'dist/.openai/hosting.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const expectedHosting={...sourceHosting};if(builtHosting.artifact_metadata!=null)expectedHosting.artifact_metadata=builtHosting.artifact_metadata;
  if(!isDeepStrictEqual(hosting,expectedHosting))throw new Error('artifact_hosting_configuration_changed');
  const files=[];
  async function walk(folder){for(const item of await readdir(folder,{withFileTypes:true})){const path=join(folder,item.name);if(item.isDirectory())await walk(path);else if(item.isFile())files.push(relative(stage,path).replaceAll('\\','/'));else throw new Error('artifact_extracted_type_invalid');}}
  await walk(join(stage,'dist'));
  let compared=0;
  const payloadFiles=new Set(files.filter(file=>file!=='dist/.openai/hosting.json'&&!file.startsWith('dist/.openai/drizzle/')));
  const expectedPayload=[];
  async function walkExpected(folder){for(const item of await readdir(folder,{withFileTypes:true})){const path=join(folder,item.name);if(item.isDirectory())await walkExpected(path);else if(item.isFile()){const file=relative(root,path).replaceAll('\\','/');if(file!=='dist/.openai/hosting.json'&&!file.startsWith('dist/.openai/drizzle/'))expectedPayload.push(file);}else throw new Error('tested_output_type_invalid');}}
  await walkExpected(join(root,'dist'));
  if(expectedPayload.length!==payloadFiles.size||expectedPayload.some(file=>!payloadFiles.has(file)))throw new Error('artifact_compiled_file_inventory_changed');
  const expectedMigrations=[];
  async function migrations(folder){for(const item of await readdir(folder,{withFileTypes:true})){const path=join(folder,item.name);if(item.isDirectory())await migrations(path);else if(item.isFile())expectedMigrations.push('dist/.openai/'+relative(root,path).replaceAll('\\','/'));else throw new Error('migration_source_type_invalid');}}
  try{await migrations(join(root,'drizzle'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const packagedMigrations=files.filter(file=>file.startsWith('dist/.openai/drizzle/'));
  if(expectedMigrations.length!==packagedMigrations.length||expectedMigrations.some(file=>!packagedMigrations.includes(file)))throw new Error('artifact_migration_inventory_changed');
  for(const file of files){
   // The supported Sites packager stages source hosting/migration declarations.
   // Every compiled payload file must be byte-identical to the tested output.
   if(file==='dist/.openai/hosting.json')continue;
   if(file.startsWith('dist/.openai/drizzle/')){if(await digest(join(stage,file))!==await digest(join(root,file.slice('dist/.openai/'.length))))throw new Error('artifact_migration_changed');continue;}
   if(await digest(join(stage,file))!==await digest(join(root,file)))throw new Error('artifact_compiled_payload_changed');
   compared++;
  }
  const manifests=await verifyRscAssets(stage);
  const imports=await verifyServerLiteralImports(join(stage,'dist/server'));
  const startup=await auditWorkerStartup(join(stage,'dist/server/index.js'));
  return{status:'passed',engine:'artifact-audit',artifactSha256:await digest(archive),artifactBytes:info.size,compiledFilesCompared:compared,files:files.length,executedCheckIds:['artifact.fixture-exclusion','artifact.import-integrity','artifact.tested-payload-parity'],manifests:{agree:manifests.manifestsAgree,references:manifests.references},imports,startup:{bytes:startup.bytes,modules:startup.modules,maxBytes:startup.maxBytes}};
 }finally{await rm(stage,{recursive:true,force:true});}
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 try{console.log(JSON.stringify(await auditReleaseArtifact({archivePath:process.argv[2],projectRoot:process.argv[3]??process.cwd()}),null,2));}
 catch(error){console.error(JSON.stringify({status:'blocked',engine:'artifact-audit',reason:error instanceof Error?error.message:'artifact_audit_failed'}));process.exitCode=1;}
}
