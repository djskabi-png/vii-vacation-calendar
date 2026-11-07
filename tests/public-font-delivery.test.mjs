import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('public first paint uses only bundled local Rubik faces, with pinned binary integrity and the original family/weights',()=>{
 const css=read('app/public-fonts.css'),global=read('app/globals.css'),layout=read('app/layout.tsx');const sources=JSON.parse(read('public/fonts/rubik/sources.json')).sources;
 assert.ok(global.startsWith('@import "./public-fonts.css";'));assert.doesNotMatch(css+global+layout,/https:\/\/(?:fonts\.googleapis|fonts\.gstatic)\.com/);
 assert.equal(sources.length,6);for(const f of sources){const bytes=readFileSync(new URL('../'+f.path,import.meta.url));assert.equal(bytes.subarray(0,4).toString(),'wOF2');assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256);assert.ok(css.includes('/'+f.path.replace(/^public\//,'')));}
 assert.match(css,/font-family: 'Rubik'/);assert.match(css,/font-weight: 400 800/);assert.match(css,/font-display: swap/);assert.match(read('public/fonts/rubik/OFL.txt'),/SIL OPEN FONT LICENSE/);
 assert.ok(layout.includes('/fonts/rubik/rubik-hebrew-v31.woff2'));assert.ok(layout.includes('/fonts/rubik/rubik-latin-v31.woff2'));assert.ok(layout.includes('/fonts/rubik/rubik-cyrillic-v31.woff2'));
});
