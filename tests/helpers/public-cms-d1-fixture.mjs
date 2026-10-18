import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {cmsFixture} from './public-cms-sqlite-fixture.mjs';
const req=createRequire(import.meta.url),dependency=createRequire(req.resolve('wrangler'));
const {Miniflare}=dependency('miniflare');
export async function withCmsD1(populate,run){
 const source=cmsFixture();
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("synthetic-only")}}',compatibilityDate:'2026-05-15',d1Databases:{DB:'synthetic-cms-regression'}});
 try{
  populate?.(source);
  const db=await mf.getD1Database('DB');
  for(const table of source.sqlite.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL").all()){
   assert.match(table.name,/^[a-z_]+$/);await db.prepare(table.sql).run();
   for(const row of source.sqlite.prepare(`SELECT * FROM "${table.name}"`).all()){
    const cols=Object.keys(row);
    await db.prepare(`INSERT INTO "${table.name}" (${cols.map(c=>'"'+c+'"').join(',')}) VALUES(${cols.map(()=>'?').join(',')})`).bind(...cols.map(c=>row[c])).run();
   }
  }
  await run(db);
 }finally{source.sqlite.close();await mf.dispose();}
}
