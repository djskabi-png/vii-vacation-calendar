import {readFile,readdir,mkdir,writeFile,realpath,stat} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateReusableArtifact} from './release-unit-inputs.mjs';
import {auditReleaseArtifact} from '../scripts/audit-release-artifact.mjs';
import {releaseBuildIdentity} from '../scripts/release-build-identity.mjs';
import {encodeRetainedAsset,retainedAssetKey} from '../services/vii-edge-delivery/src/retained-assets.ts';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
/** Prepare from a complete audited immutable Site artifact, never a sampled
 * page crawl. No R2 writes, public route changes or release approval occur. */
export async function prepareRetainedAssets({root=process.cwd(),artifactPath,buildReceiptPath,outputDirectory,buildId,now=Date.now()}={}){
 root=await realpath(root);
 if(!outputDirectory)throw Error('retention_output_required');
 const output=resolve(root,outputDirectory),rel=relative(root,output);
 if(!rel.startsWith('.qa-output'+(process.platform==='win32'?'\\':'/'))||isAbsolute(rel))throw Error('retention_output_not_owned');
 const parent=await realpath(dirname(output));if(relative(root,parent).startsWith('..')||isAbsolute(relative(root,parent)))throw Error('retention_output_parent_outside_workspace');
 try{await stat(output);throw Error('retention_output_exists');}catch(error){if(error.code!=='ENOENT')throw error;}
 const receipt=JSON.parse((await readFile(resolve(root,buildReceiptPath),'utf8')).replace(/^\uFEFF/,''));
 const source=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 const reuse=await validateReusableArtifact({root,source,unit:'managed-site',receipt,artifactPath,now});
 if(buildId!==releaseBuildIdentity({cwd:root}))throw Error('retention_build_namespace_mismatch');
 const audit=await auditReleaseArtifact({archivePath:resolve(root,artifactPath),projectRoot:root});
 if(audit.status!=='passed'||audit.artifactSha256!==reuse.artifactSha256)throw Error('retention_archive_audit_mismatch');
 const assets=join(root,'dist/client/assets'),files=await readdir(assets,{withFileTypes:true});
 if(!files.length||files.length>500||files.some(x=>!x.isFile()))throw Error('retention_asset_inventory_invalid');
 const prepared=[];let totalBytes=0;
 // Validate every entry before creating the owned output directory.
 for(const file of files.sort((a,b)=>a.name.localeCompare(b.name))){
  const path='/assets/'+file.name,key=await retainedAssetKey(path),body=new Uint8Array(await readFile(join(assets,file.name)));
  totalBytes+=body.length;if(totalBytes>32*1024*1024)throw Error('retention_inventory_budget_exceeded');
  let encoded;try{encoded=await encodeRetainedAsset({path,source:receipt.source,buildId,createdAt:now,retainUntil:now+7*86400000},body,now);}
  catch(error){throw Error(error.message+':'+path);}
  prepared.push({path,key,bytes:body.length,sha256:sha(body),envelopeBytes:encoded.length,envelopeSha256:sha(encoded),encoded});
 }
 await mkdir(output,{recursive:false});
 for(const entry of prepared)await writeFile(join(output,entry.key.split('/')[1]+'.bin'),entry.encoded,{flag:'wx'});
 const manifest={schemaVersion:1,stage:'prepared-local',source:receipt.source,sourceTree:receipt.tree,preparedAt:new Date(now).toISOString(),retainUntil:new Date(now+7*86400000).toISOString(),buildId,artifactSha256:reuse.artifactSha256,artifactBytes:audit.artifactBytes,files:prepared.map(({encoded,...entry})=>entry),fileCount:prepared.length,totalBytes,uploaded:false,publicationApproved:false,scope:'complete hashed assets of the audited supplied Site archive; not proof this archive is currently public'};
 await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});
 return{...manifest,files:undefined,outputDirectory:output};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 try{console.log(JSON.stringify(await prepareRetainedAssets(JSON.parse(await readFile(process.argv[2],'utf8'))),null,2));}
 catch(error){console.error(JSON.stringify({status:'blocked',reason:error.message,uploaded:false,publicationApproved:false}));process.exitCode=1;}
}
