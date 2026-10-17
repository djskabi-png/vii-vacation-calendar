import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";
const source=await fs.readFile(new URL("../app/lib/public-availability-notice.ts",import.meta.url),"utf8");
const module={exports:{}};
new Function("exports",ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(module.exports);
const notice=module.exports.publicAvailabilityNotice;
for(const language of ["he","en","ru","fr"]){
  test(`availability copy in ${language}: success is silent, uncertainty stays explicit`,()=>{
    const state={requestedDate:"2026-11-01",checkingDate:false,status:"ready",dateCovered:true};
    assert.equal(notice(state,language),null);
    assert.equal(notice({...state,requestedDate:""},language),null);
    for(const next of [{...state,status:"loading"},{...state,status:"idle"},{...state,checkingDate:true}])assert.equal(notice(next,language).kind,"loading");
    for(const next of [{...state,status:"unavailable"},{...state,dateCovered:false}]){
      const result=notice(next,language);assert.equal(result.kind,"unconfirmed");assert.ok(result.text.length>20);assert.ok(result.text.length<160);
      assert.doesNotMatch(result.text,/API|Biz|ביז|payload|endpoint|סנכרון/i);
    }
  });
}
