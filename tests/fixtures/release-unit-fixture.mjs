import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {fingerprintUnit} from '../../tools/release-unit-inputs.mjs';
import {auditUnitCandidate} from '../../tools/release-unit-candidate.mjs';

export function fixture({ configure } = {}){
 const root=resolve('.qa-output','unit-manifest-'+randomUUID());mkdirSync(root,{recursive:true});
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const write=(path,value)=>{mkdirSync(dirname(resolve(root,path)),{recursive:true});writeFileSync(resolve(root,path),typeof value==='string'?value:JSON.stringify(value));};
 const json=path=>JSON.parse(readFileSync(resolve(root,path),'utf8'));
 git(['init','-q']);git(['config','user.name','Synthetic QA']);git(['config','user.email','qa@example.test']);
 write('project_knowledge/note.txt','seed');git(['add','.']);git(['commit','-qm','synthetic seed']);const baseline=git(['rev-parse','HEAD']);
 const contract={schemaVersion:1,accountId:'synthetic-account',units:{'quality-controller':{worker:'synthetic-controller',bindings:[{name:'QUALITY_DB',type:'d1',id:'synthetic-quality-db'}]}}};
 const graph={schemaVersion:2,graphId:'synthetic-graph',baselineSource:baseline,buildUnits:{'managed-site':{source:'.openai/hosting.json'},'quality-controller':{source:'services/vii-quality-control/wrangler.toml',provisioningRequired:true}},entries:[{id:'fixture',ownerBox:'fixture',match:['project_knowledge/','shared/','app/','worker/','services/','.openai/','.gitignore','package.json','pnpm-lock.yaml']}],nodes:{fixture:{dependsOn:[],requiredChecks:[],requiredLocalTests:[],buildUnits:['managed-site','quality-controller']}}};
 const files={'.gitignore':'.qa-output/\n','package.json':'{"type":"module"}','pnpm-lock.yaml':'lockfileVersion: 9','.openai/hosting.json':'{"project_id":"synthetic"}','worker/index.ts':'export default {}','shared/value.ts':'export const value=1;','app/lib/quality-platform.ts':'export const qualityRegistry=[];','services/vii-quality-control/wrangler.toml':'main="src/index.ts"','services/vii-quality-control/src/index.ts':'import "../../../shared/value.ts";export default {};','project_knowledge/release_controls/vii-release-impact-graph.json':graph,'project_knowledge/release_controls/vii-private-quality-resources.json':contract,'project_knowledge/note.txt':'original'};
 Object.entries(files).forEach(([path,value])=>write(path,value));
 const commit=()=>{git(['add','.']);git(['commit','-qm','synthetic fixture']);return git(['rev-parse','HEAD']);};
 configure?.({ root, graph, contract, write, git });
 const base=commit(),tree=git(['rev-parse','HEAD^{tree}']),now=Date.now(),observedAt=new Date(now).toISOString();
 const unitArtifacts=[];
 for(const unit of graph.nodes.fixture.buildUnits){
  const path='.qa-output/'+unit+'.tar',bytes='synthetic immutable bytes for '+unit,digest=createHash('sha256').update(bytes).digest('hex');write(path,bytes);
  const buildReceiptPath='.qa-output/'+unit+'-build.json',auditReceiptPath='.qa-output/'+unit+'-audit.json';
  write(buildReceiptPath,{schemaVersion:1,engine:'build',status:'passed',exitCode:0,unit,source:base,tree,observedAt,inputFingerprint:fingerprintUnit({root,source:base,unit}).fingerprint,artifactSha256:digest});
  write(auditReceiptPath,{schemaVersion:1,engine:'artifact-audit',status:'passed',unit,source:base,tree,observedAt,artifactSha256:digest,artifactBytes:Buffer.byteLength(bytes),failedCount:0,executedCheckIds:unit==='managed-site'?['artifact.fixture-exclusion','artifact.import-integrity']:['artifact.unit-import-integrity','artifact.runtime-isolation','artifact.tested-payload-parity']});
  unitArtifacts.push({unit,artifact:{path,sha256:digest,bytes:Buffer.byteLength(bytes)},buildReceiptPath,auditReceiptPath,...(unit==='quality-controller'?{provisioningReceiptPath:'.qa-output/resources.json'}:{})});
 }
 write('.qa-output/resources.json',{schemaVersion:1,engine:'cloud-resource-readback',status:'passed',accountId:contract.accountId,worker:'synthetic-controller',versionId:'11111111-2222-3333-4444-555555555555',observedAt,access:{enabled:false,previews_enabled:false},bindings:contract.units['quality-controller'].bindings});
 write('project_knowledge/note.txt','descendant documentation');const source=commit();
 const manifest={schemaVersion:2,graphId:graph.graphId,impactBase:baseline,candidate:{source,tree:git(['rev-parse','HEAD^{tree}'])},unitArtifacts};
 return{root,base,source,graph,contract,git,write,json,commit,manifest,now,run:()=>auditUnitCandidate(manifest,{root,now}),cleanup(){assert.ok(root.startsWith(resolve('.qa-output')+sep));rmSync(root,{recursive:true,force:true});}};
}
