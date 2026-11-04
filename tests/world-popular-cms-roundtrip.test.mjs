import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import test from 'node:test';
import {ensureContentItem,normalizeEditorial,parseContentChange,readContentItems,saveContentItem} from '../app/lib/content-studio.ts';
import {readHomepagePresentation} from '../app/lib/homepage-presentation.ts';
import {popularSearchesForWorld} from '../app/lib/world-popular-search-defaults.ts';
async function database(){const sqlite=new DatabaseSync(':memory:');const sql=await readFile(new URL('../drizzle/0008_content_studio.sql',import.meta.url),'utf8');for(const part of sql.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))sqlite.exec(part);return{sqlite,prepare(sql){let values=[];return{bind(...next){values=next;return this},async run(){return{meta:{changes:sqlite.prepare(sql).run(...values).changes}}},async first(){return sqlite.prepare(sql).get(...values)||null},async all(){return{results:sqlite.prepare(sql).all(...values)}}}}}}
test('actual CMS saves complete world lists beyond1200, publishes only requested versions and preserves hide/order/empty after fresh read',async()=>{
 const db=await database();try{
 let item=await ensureContentItem(db,{type:'homepage',key:'vacation-sliders',world:'global',locale:'he',sourceLabel:'test',title:'עמוד הבית',summary:'ניהול חיפושים'});
 const rows=popularSearchesForWorld('spa');const list=[rows[3],{...rows[0],visible:false},...rows.slice(1,3),...rows.slice(4)];
 const attrs={homePopularSearchesSpa:JSON.stringify(list),homePopularSearchesSpaVersion:'2',homePopularSearchesHourly:JSON.stringify(popularSearchesForWorld('hourly'))};assert.ok(attrs.homePopularSearchesSpa.length>1200);
 const content={...item.draft,attributes:attrs};assert.equal(normalizeEditorial(content).attributes.homePopularSearchesSpa,attrs.homePopularSearchesSpa);
 await saveContentItem(db,parseContentChange({id:item.id,expectedVersion:item.version,status:'draft',action:'save',content}),'local-checker');
 assert.equal((await readHomepagePresentation(db,'he','spa')).popular[0].action,'nearby','draft cannot replace public list');
 [item]=await readContentItems(db,'homepage','he');await saveContentItem(db,parseContentChange({id:item.id,expectedVersion:item.version,status:'published',action:'publish',content}),'local-checker');
 assert.deepEqual((await readHomepagePresentation(db,'he','spa')).popular.map(r=>r.id),list.filter(r=>r.visible).map(r=>r.id));
 assert.equal((await readHomepagePresentation(db,'he','hourly')).popular.length,popularSearchesForWorld('hourly').length);
 [item]=await readContentItems(db,'homepage','he');await saveContentItem(db,parseContentChange({id:item.id,expectedVersion:item.version,status:'published',action:'publish',content:{...content,attributes:{...attrs,homePopularSearchesSpa:'[]'}}}),'local-checker');
 assert.equal((await readHomepagePresentation(db,'he','spa')).popular.length,0);
 assert.equal(normalizeEditorial({...content,attributes:{homePopularSearchesSpa:'[{broken'}}),null);
 }finally{db.sqlite.close()}
});
