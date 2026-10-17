import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareCleanBuild, verifyRscAssets } from "../scripts/verify-rsc-assets.mjs";

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), "vii-asset-integrity-"));
  try {
    await mkdir(join(root,"dist/server/ssr"),{recursive:true});
    await mkdir(join(root,"dist/client/assets"),{recursive:true});
    await writeFile(join(root,"package.json"),"{}");
    const manifest={bootstrapScriptContent:'import("/assets/entry.js")',clientReferenceDeps:{x:{js:["/assets/entry.js"],css:["/assets/style.css"]}}};
    await writeFile(join(root,"dist/client/assets/entry.js"),"export {};");
    await writeFile(join(root,"dist/client/assets/style.css"),"body{}");
    for(const path of ["dist/server/__vite_rsc_assets_manifest.js","dist/server/ssr/__vite_rsc_assets_manifest.js"]) await writeFile(join(root,path),"export default "+JSON.stringify(manifest));
    await run(root,manifest);
  } finally { await rm(root,{recursive:true,force:true}); }
}

test("packaging requires matching manifests and existing bootstrap/CSS",()=>fixture(async root=>{
  const result=await verifyRscAssets(root); assert.equal(result.references,2); assert.equal(result.manifestsAgree,true);
}));
test("stale SSR manifest fails even if old bootstrap is retained",()=>fixture(async(root,manifest)=>{
  manifest.bootstrapScriptContent='import("/assets/old.js")';
  await writeFile(join(root,"dist/client/assets/old.js"),"export {};");
  await writeFile(join(root,"dist/server/ssr/__vite_rsc_assets_manifest.js"),"export default "+JSON.stringify(manifest));
  await assert.rejects(verifyRscAssets(root),/manifests disagree/);
}));
test("missing client module blocks packaging",()=>fixture(async root=>{
  await rm(join(root,"dist/client/assets/entry.js")); await assert.rejects(verifyRscAssets(root),/missing client asset/);
}));
test("partial build without SSR stage blocks packaging",()=>fixture(async root=>{
  await rm(join(root,"dist/server/ssr/__vite_rsc_assets_manifest.js")); await assert.rejects(verifyRscAssets(root),/ENOENT/);
}));
test("clean build removes only its derived output",()=>fixture(async root=>{
  await writeFile(join(root,"keep.txt"),"keep"); await prepareCleanBuild(root);
  assert.equal(await readFile(join(root,"keep.txt"),"utf8"),"keep");
  await assert.rejects(readFile(join(root,"dist/client/assets/entry.js")),/ENOENT/);
}));
