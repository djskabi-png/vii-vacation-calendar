import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {publicWorldNavigation} from '../app/data/world-navigation.ts';
const source=readFileSync('app/data/world-switcher-labels.ts','utf8');
const code=stripTypeScriptTypes(source.replace(/import \{ publicWorldNavigation \} from [^;]+;/,`const publicWorldNavigation=${JSON.stringify(publicWorldNavigation)};`));
const {headerWorldOptions,headerWorldLabel}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('seven requested topics have clear ordered names and canonical destinations; corporate stays reachable',()=>{
 const options=headerWorldOptions('he');
 assert.deepEqual(options.slice(0,7).map(o=>o.label),['נופש','ספא','אירועים','חדרים לפי שעה','אטרקציות','טיולים','ספקים']);
 assert.deepEqual(options.map(o=>o.href),['/','/spas','/events','/hourly','/attractions','/trails','/providers','/corporate']);
 assert.equal(new Set(options.map(o=>o.id)).size,options.length);
});
test('every active world has its own non-search name in all four languages',()=>{
 for(const locale of ['he','en','fr','ru'])for(const option of headerWorldOptions(locale).slice(0,7))assert.equal(headerWorldLabel(option.id,locale),option.label);
 assert.equal(headerWorldLabel('corporate','fr'),'Entreprises');
 assert.equal(headerWorldLabel('activities','he'),'אטרקציות');
 assert.equal(headerWorldLabel('unknown','he'),'נופש');
});
test('native disclosure, close/focus behavior and localized direct navigation remain intact',()=>{
 const component=readFileSync('app/components/world-switcher.tsx','utf8');
 assert.match(component,/<summary ref=\{triggerRef\}><span><strong>\{headerWorldLabel\(active, language\)\}/);
 assert.match(component,/headerWorldOptions\(language\)\.map/);
 for(const invariant of ['localizedPath(world.href, language)','closeOnOutsideClick','closeOnEscape','triggerRef.current?.focus()','onPointerDown={navigateFromSwitcherPointer}','onClick={navigateFromSwitcher}'])assert.ok(component.includes(invariant),invariant);
 assert.match(component,/aria-current=\{isActive \? "page" : undefined\}/);
});
