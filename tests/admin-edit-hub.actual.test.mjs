import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createSourceLoader} from './helpers/source-module-loader.mjs';
import {fullAdminAccess,adminRouteAllowed} from '../app/admin/access-policy.ts';
const {editingToolsForAccess,editingTools}=createSourceLoader({'next/link':()=>null})('app/admin/edit/page.tsx');
test('editing hub links resolve to real existing editors and distinguish supplier truth',()=>{
 const all=editingToolsForAccess(fullAdminAccess);assert.equal(all.length,editingTools.length);
 for(const tool of all){assert.ok(fs.existsSync('app'+tool.href.split('?')[0]+'/page.tsx'),tool.href);if(tool.source)assert.equal(tool.canEdit,false);}
 assert.ok(all.find(tool=>tool.id==='catalogs').source);assert.ok(all.find(tool=>tool.id==='weights').canEdit);
});
test('existing module permissions remain enforced in the actual editing hub',()=>{
 const access={fullAccess:false,manageUsers:false,permissions:{content:'view'}};const visible=editingToolsForAccess(access);
 assert.ok(visible.length>0);assert.ok(visible.every(tool=>tool.href.startsWith('/admin/content-studio')&&!tool.canEdit));assert.equal(adminRouteAllowed(access,'/admin/users'),false);assert.equal(editingToolsForAccess(access,'משקלים').length,0);
});
