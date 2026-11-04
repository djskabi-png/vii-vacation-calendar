// Loopback-only fixture: actual content editor and actual in-memory CMS persistence.
// No production API, credentials, business data or outbound requests are used.
import http from 'node:http';
import fs from 'node:fs';
import {resolve,sep,extname} from 'node:path';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {ensureContentItem,readContentItems,readContentItem,readContentVersions,parseContentChange,saveContentItem} from '../app/lib/content-studio.ts';
import {readHomepagePresentation} from '../app/lib/homepage-presentation.ts';
const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('vite'))('esbuild');
const sqlite=new DatabaseSync(':memory:');for(const part of fs.readFileSync('drizzle/0008_content_studio.sql','utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))sqlite.exec(part);
const db={prepare(sql){let values=[];return{bind(...next){values=next;return this},async run(){return{meta:{changes:sqlite.prepare(sql).run(...values).changes}}},async first(){return sqlite.prepare(sql).get(...values)||null},async all(){return{results:sqlite.prepare(sql).all(...values)}}}}};
await ensureContentItem(db,{type:'homepage',key:'vacation-sliders',world:'global',locale:'he',sourceLabel:'Local isolated fixture',title:'ניהול החיפושים בכל העולמות',summary:'נתוני בדיקה מקומיים בלבד'});
const entry=`import React from 'react';import{createRoot}from'react-dom/client';import Page from'./app/admin/content-studio/page.tsx';import Provider from'./app/admin/admin-access-context.tsx';import styles from'./app/admin/admin.module.css';createRoot(document.getElementById('root')).render(<Provider access={{fullAccess:true,manageUsers:true,permissions:{}}}><div className={styles.workspace}><Page/></div></Provider>);`;
const bundle=await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'qa',jsx:'automatic',format:'esm',plugins:[{name:'local-navigation',setup(b){b.onResolve({filter:/^next\/(navigation|link)$/},a=>({path:a.path,namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},a=>({contents:a.path==='next/navigation'?`export const usePathname=()=>'/admin/content-studio';`:`import React from'react';export default function Link({children,prefetch,...props}){return React.createElement('a',props,children)}`,resolveDir:process.cwd(),loader:'js'}));}}]});
const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).contents,css=bundle.outputFiles.find(f=>f.path.endsWith('.css')).contents;
const critical=fs.readFileSync('app/layout.tsx','utf8').match(/const adminFontCriticalCss = `([\s\S]*?)`;/)[1];
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1:4192');
 if(url.pathname==='/qa.js'||url.pathname==='/qa.css'){res.writeHead(200,{'Content-Type':url.pathname.endsWith('.js')?'application/javascript':'text/css'});res.end(url.pathname.endsWith('.js')?js:css);return;}
 if(url.pathname==='/api/vii/home-holidays'){res.setHeader('Content-Type','application/json');res.end('{"holidays":[]}');return;}
 if(url.pathname==='/api/vii/homepage-presentation'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await readHomepagePresentation(db,'he',url.searchParams.get('world')||'vacation')));return;}
 if(url.pathname==='/api/admin/content-studio'){
  if(req.method==='POST'){const chunks=[];for await(const chunk of req)chunks.push(chunk);const change=parseContentChange(JSON.parse(Buffer.concat(chunks).toString()));if(!change){res.writeHead(400);res.end('{"error":"invalid_content"}');return;}await saveContentItem(db,change,'local-only-owner');res.setHeader('Content-Type','application/json');res.end('{"ok":true}');return;}
  const type=url.searchParams.get('type')||'spa';const items=await readContentItems(db,type,'he');const id=url.searchParams.get('id');const selected=id?await readContentItem(db,id):null;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({items:items.map(item=>({...item,publicPath:'/api/vii/homepage-presentation?world=spa'})),counts:{homepage:1},total:items.length,truncated:false,selected:selected?{...selected,publicPath:'/api/vii/homepage-presentation?world=spa',versions:await readContentVersions(db,id)}:null}));return;
 }
 if(req.method!=='GET'){res.writeHead(405);res.end();return;}
 if(url.pathname.startsWith('/fonts/')){const root=resolve('public'),file=resolve(root,'.'+url.pathname);if(!file.startsWith(root+sep))throw Error('path');res.setHeader('Content-Type','font/woff2');res.end(fs.readFileSync(file));return;}
 if(url.pathname==='/'||url.pathname==='/admin/content-studio'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="he" dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/qa.css"><style>${critical}body{margin:0;font-family:'VII Heebo',Heebo,Arial,sans-serif}*{box-sizing:border-box}</style></head><body data-vii-surface="admin"><aside style="padding:10px;background:#fff6e5;text-align:center">בדיקת ממשק מקומית בנתונים זמניים בלבד. ללא חיבור לייצור.</aside><div id="root"></div><script type="module" src="/qa.js"></script></body></html>`);return;}
 res.writeHead(404);res.end();
 }catch(error){res.writeHead(500);res.end(error.message)}});
server.listen(4192,'127.0.0.1',()=>console.log(`OWNED_PID=${process.pid} http://127.0.0.1:4192/admin/content-studio`));process.on('SIGINT',()=>server.close(()=>{sqlite.close();process.exit(0)}));
