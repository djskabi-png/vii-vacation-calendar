import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const family=[
 ['components/property-card.tsx',['propertyHref','quickBookingHref'],4],
 ['components/preview-card-gallery.tsx',['href'],1],
 ['components/discovery-card.tsx',['detailsHref'],1],
 ['components/spa-package-deals.tsx',['href'],1],
 ['components/map/leaflet-places-map.tsx',['localizedPath(selected.href, language)'],1],
 ['components/map-provider-boundary.tsx',['place.href'],1],
 ['components/search-box.tsx',['localizedPath(place.href, language)'],1],
 ['favorites/page.tsx',['item.href'],3],
];
for(const[file,hrefs,minimum]of family)test(`place links open a new tab across ${file}`,()=>{
 const text=readFileSync(new URL('../app/'+file,import.meta.url),'utf8');const root=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let count=0;
 function visit(node){if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
  const attrs=new Map(node.attributes.properties.filter(ts.isJsxAttribute).map(x=>[x.name.getText(root),x.initializer]));
  const href=attrs.get('href');const expression=href&&ts.isJsxExpression(href)?href.expression?.getText(root):null;
  if(node.tagName.getText(root)==='Link'&&hrefs.includes(expression)){
   count++;assert.equal(attrs.get('target')?.text,'_blank',`${file} line ${root.getLineAndCharacterOfPosition(node.pos).line+1}`);assert.match(attrs.get('rel')?.text||'',/\bnoopener\b/);
  }
 }ts.forEachChild(node,visit);}visit(root);assert.ok(count>=minimum,`${file}: inspected ${count} detail links`);
});
test('background photo warming begins after visible-image load for both full and compact previews',()=>{
 for(const file of ['components/property-card.tsx','components/preview-card-gallery.tsx'])assert.match(readFileSync(new URL('../app/'+file,import.meta.url),'utf8'),/onLoad=\{warmImages\}/);
});
