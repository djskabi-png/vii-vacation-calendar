import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import {attachVerifiedSupplierVideo,isSafeYoutubeEmbed,legacySupplierVideos} from '../app/lib/verified-supplier-videos.ts';
import {homeTourVideos} from '../app/lib/home-video-selection.ts';

test('verified legacy video belongs only to its active resolved supplier and preserves explicit current arrays',()=>{
 const place={slug:'vacation-2356',image:'/same-place.jpg'};
 const attached=attachVerifiedSupplierVideo(place);
 assert.equal(legacySupplierVideos[place.slug][0].sourceUrl,'https://www.vii.co.il/Shilo_Suites');
 assert.equal(attached.videos[0].embedUrl,'https://www.youtube-nocookie.com/embed/WNhfp-IKebA');
 assert.equal(attached.videos[0].poster,place.image);
 assert.deepEqual(attachVerifiedSupplierVideo({...place,videos:[]}).videos,[]);
 const current=[{title:'Current source',src:'/current.mp4',poster:'/same-place.jpg',note:''}];
 assert.equal(attachVerifiedSupplierVideo({...place,videos:current}).videos,current);
 assert.equal(attachVerifiedSupplierVideo({...place,slug:'vacation-523'}).videos,undefined);
 assert.deepEqual(homeTourVideos([{...attached.videos[0],verifiedRealVideo:true}]),[],'embeds never become MP4 home tours');
});

test('Ahuzat Yosef keeps its verified legacy supplier video while the API contract is incomplete',()=>{
 const place={slug:'vacation-279',image:'/api/vii/media/46676d05e5319b6.jpeg'};
 assert.equal(legacySupplierVideos[place.slug][0].sourceUrl,'https://www.vii.co.il/ahuzat_yosef');
 assert.equal(legacySupplierVideos[place.slug][0].youtubeId,'7FAVmV3P8oI');
 assert.equal(attachVerifiedSupplierVideo(place).videos[0].embedUrl,'https://www.youtube-nocookie.com/embed/7FAVmV3P8oI');
});

test('generated legacy inventory stays place-scoped and complete for the verified migration snapshot',()=>{
 const catalog=JSON.parse(readFileSync(new URL('../app/data/sergey-public-catalog.json',import.meta.url),'utf8'));
 const sourceBySlug=new Map(catalog.places.map((place)=>[place.slug,place.sourceUrl]));
 const entries=Object.entries(legacySupplierVideos);
 assert.ok(entries.length>=156,`expected at least 156 verified places, received ${entries.length}`);
 assert.ok(entries.flatMap(([,videos])=>videos).length>=164,'verified video inventory unexpectedly shrank');
 for(const [slug,videos] of entries){
  assert.equal(sourceBySlug.get(slug),videos[0].sourceUrl,`${slug} must keep its exact catalog source page`);
  assert.equal(new Set(videos.map((video)=>video.youtubeId)).size,videos.length,`${slug} must not duplicate video IDs`);
  for(const video of videos)assert.match(video.youtubeId,/^[A-Za-z0-9_-]{11}$/,`${slug} has an invalid YouTube ID`);
 }
});

test('build-time supplier catalog persists verified API videos instead of dropping them',()=>{
 const source=readFileSync(new URL('../scripts/build-sergey-public-catalog.mjs',import.meta.url),'utf8');
 assert.match(source,/import \{ supplierVideos \} from "\.\.\/app\/lib\/supplier-videos\.ts"/);
 assert.match(source,/const videos = supplierVideos\(raw\.videos \?\? raw\.video, images\[0\]\)/);
 assert.match(source,/\.\.\.\(videos\.length \? \{ videos \} : \{\}\)/);
});

test('embed validation accepts only an exact credential-free privacy-enhanced YouTube URL',()=>{
 assert.equal(isSafeYoutubeEmbed('https://www.youtube-nocookie.com/embed/WNhfp-IKebA'),true);
 for(const url of ['javascript:alert(1)','https://evil.test/embed/WNhfp-IKebA','https://www.youtube-nocookie.com.evil.test/embed/WNhfp-IKebA','https://user:secret@www.youtube-nocookie.com/embed/WNhfp-IKebA','https://www.youtube-nocookie.com:444/embed/WNhfp-IKebA','https://www.youtube-nocookie.com/embed/WNhfp-IKebA?extra=1','https://www.youtube-nocookie.com/embed/not-an-id'])assert.equal(isSafeYoutubeEmbed(url),false,url);
});

test('actual gallery creates a live iframe only after its play action and never treats embeds as MP4',()=>{
 const source=readFileSync(new URL('../app/components/gallery-experience.tsx',import.meta.url),'utf8');
 const ast=ts.createSourceFile('gallery.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let expression;
 const visit=n=>{if(ts.isCallExpression(n)&&n.expression.getText(ast)==='property.videos?.map')expression=n;ts.forEachChild(n,visit);};visit(ast);assert.ok(expression);
 const js=ts.transpileModule('const result='+expression.getText(ast)+';',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 let activeVideo=null;const property=attachVerifiedSupplierVideo({slug:'vacation-2356',image:'/same-place.jpg'});
 const render=()=>Function('require','exports','property','activeVideo','setActiveVideo','isSafeYoutubeEmbed','translate',js+';return result;')(()=>jsx,{},property,activeVideo,v=>activeVideo=v,isSafeYoutubeEmbed,x=>x);
 const nodes=(tree,out=[])=>{for(const node of Array.isArray(tree)?tree:[tree])if(node&&typeof node==='object'){out.push(node);nodes(node.props?.children,out);}return out;};
 let tree=nodes(render());assert.equal(tree.filter(n=>n.type==='iframe').length,0);assert.equal(tree.filter(n=>n.type==='video').length,0);
 tree.find(n=>n.type==='button').props.onClick();tree=nodes(render());
 const iframe=tree.find(n=>n.type==='iframe');assert.equal(iframe.props.src,'https://www.youtube-nocookie.com/embed/WNhfp-IKebA?autoplay=1');assert.equal(iframe.props.style.aspectRatio,'16 / 9');
 property.videos[0].embedUrl='https://evil.test/embed/WNhfp-IKebA';tree=nodes(render());assert.equal(tree.filter(n=>n.type==='iframe'||n.type==='video').length,0);
});
