import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source=await readFile(new URL("../app/i18n/locale-provider.tsx",import.meta.url),"utf8");
const snippet=source.match(/  const translateTextNode = \(textNode: Text\) => \{[\s\S]*?\n  \};/)?.[0];
assert.ok(snippet,"test must execute the actual DOM translation boundary");
function renderer(){
  const original=new WeakMap(),rendered=new WeakMap();
  return language=>new Function("hebrewPattern","originalText","lastTranslatedText","translateValue","language",ts.transpileModule(snippet+"\nreturn translateTextNode;",{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)(/[\u0590-\u05ff]/,original,rendered,(text,locale)=>locale==="he"?text:`${locale}:${text.match(/^\d+/)?.[0]} spas${text.includes("ירושלים")?" · ירושלים":""}`,language);
}
const node=text=>({data:text,parentElement:{tagName:"H2",closest:()=>null}});
test("React async result updates replace the cached source in every locale",()=>{
  for(const locale of ["en","fr","ru"]){const render=renderer()(locale),text=node("0 בתי ספא בישראל");render(text);assert.equal(text.data,`${locale}:0 spas`);text.data="17 בתי ספא בישראל";render(text);assert.equal(text.data,`${locale}:17 spas`);text.data="3 בתי ספא בישראל";render(text);assert.equal(text.data,`${locale}:3 spas`);}
});
test("partly untranslated names do not replace the real source or loop",()=>{
  const render=renderer(),text=node("17 בתי ספא בירושלים");render("en")(text);for(let i=0;i<3;i++)render("en")(text);assert.equal(text.data,"en:17 spas · ירושלים");render("fr")(text);assert.equal(text.data,"fr:17 spas · ירושלים");render("he")(text);assert.equal(text.data,"17 בתי ספא בירושלים");
});
test("explicit native-locale text remains outside the DOM translator",()=>{
  const text=node("17 בתי ספא בישראל");text.parentElement.closest=()=>({});renderer()("en")(text);assert.equal(text.data,"17 בתי ספא בישראל");
});
