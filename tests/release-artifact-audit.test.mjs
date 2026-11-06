import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {auditReleaseArtifact} from '../scripts/audit-release-artifact.mjs';

async function fixture(){
 const root=await mkdtemp(resolve('.qa-output/artifact-fixture-'));
 for(const path of ['.openai','dist/.openai','dist/server/ssr','dist/client/assets'])await mkdir(join(root,path),{recursive:true});
 const hosting={project_id:'synthetic-site',d1:'DB',r2:'UPLOADS'};
 await writeFile(join(root,'.openai/hosting.json'),JSON.stringify(hosting));
 await writeFile(join(root,'dist/.openai/hosting.json'),JSON.stringify(hosting));
 await writeFile(join(root,'dist/server/index.js'),'import "./chunk.js";export default {};');
 await writeFile(join(root,'dist/server/chunk.js'),'export const preservedSecret="random-test-only";');
 await writeFile(join(root,'dist/client/assets/entry.js'),'console.log("fixture")');
 const manifest='export default '+JSON.stringify({bootstrapScriptContent:'import("/assets/entry.js")'});
 for(const dir of ['server','server/ssr'])await writeFile(join(root,'dist',dir,'__vite_rsc_assets_manifest.js'),manifest);
 const archive=join(root,'candidate.tar.gz');
 const pack=()=>execFileSync(process.platform==='win32'?'tar.exe':'tar',['-czf',archive,'-C',root,'dist'],{windowsHide:true});
 return{root,archive,pack,async cleanup(){assert.ok(root.startsWith(resolve('.qa-output')+requireSeparator()));await rm(root,{recursive:true,force:true});}};
}
function requireSeparator(){return process.platform==='win32'?'\\':'/';}

test('audits the actual archive with identical compiled bytes and resolved imports',async()=>{
 const f=await fixture();try{f.pack();const secretBefore=await readFile(join(f.root,'dist/server/chunk.js'),'utf8');const result=await auditReleaseArtifact({archivePath:f.archive,projectRoot:f.root});assert.equal(result.status,'passed');assert.ok(result.executedCheckIds.includes('artifact.fixture-exclusion'));assert.equal(result.compiledFilesCompared,5);assert.match(result.artifactSha256,/^[a-f0-9]{64}$/);assert.equal(await readFile(join(f.root,'dist/server/chunk.js'),'utf8'),secretBefore);assert.ok((await stat(f.archive)).size>0);}finally{await f.cleanup();}
});

test('a packaged QA wrapper fails before archive extraction',async()=>{
 const f=await fixture();try{await writeFile(join(f.root,'dist/server/__vii_qa_fixture.mjs'),'export default {}');f.pack();await assert.rejects(auditReleaseArtifact({archivePath:f.archive,projectRoot:f.root}),/fixture_or_private_workspace/);}finally{await f.cleanup();}
});

test('changed tested payload and missing compiled imports both block publication evidence',async()=>{
 const f=await fixture();try{f.pack();await writeFile(join(f.root,'dist/server/chunk.js'),'different output');await assert.rejects(auditReleaseArtifact({archivePath:f.archive,projectRoot:f.root}),/payload_changed/);await writeFile(join(f.root,'dist/server/index.js'),'import "./missing.js";export default {};');f.pack();await assert.rejects(auditReleaseArtifact({archivePath:f.archive,projectRoot:f.root}),/Missing compiled server imports/);}finally{await f.cleanup();}
});

test('correct project ID cannot hide changed database or capability declarations',async()=>{
 const f=await fixture();try{await writeFile(join(f.root,'dist/.openai/hosting.json'),JSON.stringify({project_id:'synthetic-site',d1:'OTHER_DB',r2:'UPLOADS'}));f.pack();await assert.rejects(auditReleaseArtifact({archivePath:f.archive,projectRoot:f.root}),/hosting_configuration_changed/);}finally{await f.cleanup();}
});

test('removing a payload file from an archive cannot pass partial byte comparison',async()=>{
 const f=await fixture();try{await writeFile(join(f.root,'dist/client/preserved-photo.jpg'),'photo');f.pack();await writeFile(join(f.root,'dist/client/extra-required-photo.jpg'),'another photo');await assert.rejects(auditReleaseArtifact({archivePath:f.archive,projectRoot:f.root}),/file_inventory_changed/);}finally{await f.cleanup();}
});
