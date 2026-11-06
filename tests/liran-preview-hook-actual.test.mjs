import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
test('actual preview hook advances immediately and ignores a late earlier image response',async()=>{
 const source=ts.transpileModule(readFileSync(new URL('../app/components/use-preview-gallery.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const cells=[];let cursor=0,first=true;const pending=[];
 const react={useRef:initial=>{const index=cursor++;return cells[index]??(cells[index]={current:initial})},useState:initial=>{const index=cursor++;if(!(index in cells))cells[index]=initial;return[cells[index],value=>cells[index]=typeof value==='function'?value(cells[index]):value]},useEffect:fn=>{if(first)fn()}};
 const exports={};new Function('require','exports',source)(id=>id==='react'?react:id.includes('preview-image-loader')?{findReadyPreviewImage:()=>new Promise(resolve=>pending.push(resolve)),previewImageLoader:{load:()=>Promise.resolve(true)}}:id.includes('responsive-media')?{isOptimizableCardMedia:()=>false}: {},exports);
 const render=(images=['a','b','c'])=>{cursor=0;const result=exports.usePreviewGallery(images);first=false;return result};
 let gallery=render();gallery.setImageIndex(1);gallery=render();assert.equal(gallery.imageIndex,1);assert.equal(gallery.pending,true);
 gallery.setImageIndex(2);gallery=render();assert.equal(gallery.imageIndex,2);
 pending[0](1);await Promise.resolve();assert.equal(render().imageIndex,2);
 pending[1](2);await Promise.resolve();assert.equal(render().pending,false);
 assert.equal(render(['new-a','new-b']).imageIndex,0);
});


test('actual preview hook warms the next two responsive photos and respects save-data',async()=>{
 const source=ts.transpileModule(readFileSync(new URL('../app/components/use-preview-gallery.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const cells=[];let cursor=0,first=true;const calls=[];const navigator={connection:{saveData:false}};
 const react={useRef:initial=>{const index=cursor++;return cells[index]??(cells[index]={current:initial})},useState:initial=>{const index=cursor++;if(!(index in cells))cells[index]=initial;return[cells[index],value=>cells[index]=typeof value==='function'?value(cells[index]):value]},useEffect:fn=>{if(first)fn()}};
 const exports={};new Function('require','exports','navigator',source)(id=>id==='react'?react:id.includes('preview-image-loader')?{findReadyPreviewImage:async(images,index,direction,load)=>await load(images[index])?index:null,previewImageLoader:{load:async(src,urgent,options)=>{calls.push({src,urgent,options});return true}}}:id.includes('responsive-media')?{defaultCardImageSizes:'420px',responsiveCardMedia:src=>({src:'responsive-'+src,srcSet:src+' 828w'}),isOptimizableCardMedia:()=>true}:{},exports,navigator);
 const render=()=>{cursor=0;const result=exports.usePreviewGallery(['a','b','c','d','e']);first=false;return result};
 let gallery=render();assert.equal(calls.length,0);
 gallery.warmImages();await Promise.resolve();assert.deepEqual(calls.map(x=>x.src),['responsive-b','responsive-c']);assert.ok(calls.every(x=>x.urgent===false&&x.options.sizes==='420px'));
 calls.length=0;gallery.setImageIndex(2);await Promise.resolve();await Promise.resolve();gallery=render();calls.length=0;
 gallery.warmImages();await Promise.resolve();assert.deepEqual(calls.map(x=>x.src),['responsive-d','responsive-e','responsive-b']);
 navigator.connection.saveData=true;calls.length=0;gallery.warmImages();assert.equal(calls.length,0);
});
