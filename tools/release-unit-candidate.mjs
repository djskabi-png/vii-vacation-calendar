import {readFileSync,realpathSync,statSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildImpact} from '../scripts/release-impact-graph.mjs';
import {validateReusableArtifact} from './release-unit-inputs.mjs';

const GRAPH='project_knowledge/release_controls/vii-release-impact-graph.json';
const CONTRACT='project_knowledge/release_controls/vii-private-quality-resources.json';
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const git=(root,args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:16*1024*1024}).trim();
const blob=(root,source,path)=>JSON.parse(git(root,['show',source+':'+path]));
function read(root,path){
 if(typeof path!=='string'||!path)throw Error('evidence_path_missing');
 const absolute=realpathSync(resolve(root,path)),rel=relative(realpathSync(root),absolute);
 if(!rel||rel.startsWith('..')||isAbsolute(rel)||!statSync(absolute).isFile())throw Error('evidence_outside_workspace');
 return JSON.parse(readFileSync(absolute,'utf8').replace(/^\uFEFF/,''));
}
function fresh(value,now,maxAge){const age=now-Date.parse(value);return Number.isFinite(age)&&age>=0&&age<=maxAge;}
function validateProvisioning(proof,contract,unit,now){
 const expected=contract?.units?.[unit];
 if(contract?.schemaVersion!==1||!expected||proof?.schemaVersion!==1||proof.engine!=='cloud-resource-readback'||proof.status!=='passed'||proof.accountId!==contract.accountId||proof.worker!==expected.worker||!UUID.test(proof.versionId??'')||!fresh(proof.observedAt,now,3600000))throw Error('provisioning_identity_invalid');
 if(proof.access?.enabled!==false||proof.access?.previews_enabled!==false)throw Error('provisioning_not_private');
 if(!Array.isArray(proof.bindings)||new Set(proof.bindings.map(x=>x.name)).size!==proof.bindings.length)throw Error('provisioning_bindings_invalid');
 for(const binding of expected.bindings){
  const observed=proof.bindings.find(x=>x.name===binding.name);
  if(!observed||Object.entries(binding).some(([key,value])=>observed[key]!==value))throw Error('provisioning_binding_mismatch:'+binding.name);
 }
 // Credentials and notification providers are outside this private preflight.
 if(proof.bindings.some(x=>x.type==='secret_text'||x.type==='send_email'))throw Error('provisioning_unexpected_provider');
}

/** Unit/artifact/provisioning preflight only. The global release gate still
 * requires runtime families, rollback and exact public acceptance separately.
 * No caller-supplied clean state, ancestry callback or input globs are trusted.
 */
export async function auditUnitCandidate(manifest,{root=process.cwd(),now=Date.now()}={}){
 root=resolve(root);const failures=[],units=[];let impact,source,tree,contract;
 const fail=message=>failures.push(message);
 try{
  if(manifest?.schemaVersion!==2)throw Error('schema2_required');
  source=git(root,['rev-parse','HEAD']);tree=git(root,['rev-parse','HEAD^{tree}']);
  if(git(root,['status','--porcelain=v1','--untracked-files=all']))throw Error('candidate_worktree_not_frozen');
  if(manifest.candidate?.source!==source||manifest.candidate?.tree!==tree)throw Error('candidate_identity_mismatch');
  const graph=blob(root,source,GRAPH);
  if(manifest.graphId!==graph.graphId)throw Error('impact_graph_mismatch');
  if(!/^[a-f0-9]{40}$/.test(manifest.impactBase??'')||manifest.impactBase!==graph.baselineSource)throw Error('impact_base_invalid');
  git(root,['merge-base','--is-ancestor',manifest.impactBase,source]);
  const files=git(root,['diff','--name-only',manifest.impactBase,source,'--']).split(/\r?\n/).filter(Boolean);
  impact=buildImpact(graph,files,{root});
  if(impact.status!=='mapped')throw Error('impact_unmapped');
  const required=[...new Set(impact.buildUnits)].sort(),entries=manifest.unitArtifacts;
  if(!Array.isArray(entries))throw Error('unit_artifacts_missing');
  const names=entries.map(x=>x?.unit);
  if(new Set(names).size!==names.length||JSON.stringify([...names].sort())!==JSON.stringify(required))throw Error('unit_coverage_mismatch');
  if(required.some(id=>graph.buildUnits[id]?.provisioningRequired))contract=blob(root,source,CONTRACT);
  for(const entry of entries){
   const unit=entry.unit;
   try{
    const receipt=read(root,entry.buildReceiptPath);
    const proof=await validateReusableArtifact({root,source,unit,receipt,artifactPath:entry.artifact?.path,now});
    if(entry.artifact?.sha256!==proof.artifactSha256||!Number.isSafeInteger(entry.artifact?.bytes)||statSync(resolve(root,entry.artifact.path)).size!==entry.artifact.bytes)throw Error('artifact_identity_mismatch');
    const audit=read(root,entry.auditReceiptPath);
    const checks=unit==='managed-site'?['artifact.fixture-exclusion','artifact.import-integrity']:['artifact.unit-import-integrity','artifact.private-bindings'];
    if(audit.schemaVersion!==1||audit.status!=='passed'||audit.engine!=='artifact-audit'||audit.unit!==unit||audit.source!==receipt.source||audit.tree!==receipt.tree||audit.artifactSha256!==proof.artifactSha256||audit.artifactBytes!==entry.artifact.bytes||!fresh(audit.observedAt,now,86400000)||checks.some(id=>!audit.executedCheckIds?.includes(id))||audit.failedCount!==0)throw Error('artifact_audit_invalid');
    if(graph.buildUnits[unit]?.provisioningRequired)validateProvisioning(read(root,entry.provisioningReceiptPath),contract,unit,now);
    units.push({...proof,artifactBytes:entry.artifact.bytes,reused:receipt.source!==source});
   }catch(error){fail(unit+':'+error.message);}
  }
 }catch(error){fail(error.message);}
 return{verificationScope:'unit-artifact-provisioning-preflight',status:failures.length?'blocked':'passed',publicationApproved:false,publicReleaseVerified:false,source,tree,requiredUnits:impact?.buildUnits??[],units,failures};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 let report;try{report=await auditUnitCandidate(JSON.parse(readFileSync(resolve(process.argv[2]),'utf8').replace(/^\uFEFF/,'')));}
 catch{report={status:'blocked',publicationApproved:false,publicReleaseVerified:false,failures:['manifest_unavailable_or_invalid']};}
 console.log(JSON.stringify(report,null,2));if(report.status!=='passed')process.exitCode=1;
}
