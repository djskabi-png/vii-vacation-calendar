import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=name=>readFileSync(new URL(`../app/components/${name}.tsx`,import.meta.url),'utf8');
test('all-results links carry locale in the React href, not only mutated DOM attributes',()=>{
 const stay=read('home-live-deals'),events=read('event-last-minute'),spa=read('spa-package-deals');
 for(const source of [stay,events,spa])assert.match(source,/import \{ localizedPath \} from "\.\.\/i18n\/locale-routing"/);
 assert.match(stay,/<Link href=\{localizedPath\(searchHref, language\)\}/);
 assert.match(events,/<Link href=\{localizedPath\(`\$\{searchPath\}\?\$\{params\}`, language\)\}/);
 assert.match(spa,/<Link href=\{localizedPath\(allHref,language\)\}/);
});
