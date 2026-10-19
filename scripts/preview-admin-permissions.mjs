// Loopback-only synthetic interaction fixture. Not a Google login or hosted deployment.
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { adminUsersHandler } from '../app/lib/admin-users-handler.ts';
import { authorizedAdminSession } from '../app/lib/admin-session.ts';
import { ensureAdminGrantSchema } from '../app/lib/admin-grants.ts';
import { createSignedValue, SESSION_COOKIE } from '../app/lib/google-auth.ts';
const require=createRequire(import.meta.url),dependency=createRequire(require.resolve('wrangler'));
const {Miniflare}=dependency('miniflare');
const {build}=createRequire(require.resolve('vite'))('esbuild');
process.env.VII_ADMIN_EMAILS='owner@example.test';delete process.env.VII_ADMIN_EMAILS_EXTRA;
process.env.VII_ACCESS_MANAGER_EMAILS='owner@example.test';process.env.VII_AUTH_SECRET='local-only-synthetic-permissions-secret-at-least-32';
const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("synthetic-only")}}',compatibilityDate:'2026-05-15',d1Databases:{DB:'local-admin-ui-synthetic'}});
const db=await mf.getD1Database('DB');await ensureAdminGrantSchema(db);
const cookie=await createSignedValue({sub:'synthetic-owner',email:'owner@example.test',name:'Synthetic Owner',provider:'google',exp:Math.floor(Date.now()/1000)+3600});
const handlers=adminUsersHandler({authorize:r=>authorizedAdminSession(r,undefined,async()=>db),database:async()=>db});
const entry=`import React from 'react'; import {createRoot} from 'react-dom/client';
import Page from '/app/admin/users/page.tsx'; import Nav from '/app/admin/admin-nav.tsx'; import Commands from '/app/admin/admin-command-bar.tsx';
import Provider from '/app/admin/admin-access-context.tsx'; import styles from '/app/admin/admin.module.css';
const access={fullAccess:true,manageUsers:true,permissions:{}};
createRoot(document.getElementById('root')).render(<div className={styles.shell}><Nav access={access}/><div className={styles.workspace}><Commands access={access}/><Provider access={access}><Page/></Provider></div></div>);`;
const critical=readFileSync('app/layout.tsx','utf8').match(/const adminFontCriticalCss = `([\s\S]*?)`;/)[1];
const bundled=await build({stdin:{contents:entry.replaceAll("'/app/","'./app/"),resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'qa',jsx:'automatic',format:'esm',plugins:[{name:'synthetic-navigation',setup(b){b.onResolve({filter:/^next\/(navigation|link)$/},a=>({path:a.path,namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},a=>({contents:a.path==='next/navigation'?`export const usePathname=()=>'/admin/users';`:`import React from 'react'; export default function Link({children,prefetch,...props}){return React.createElement('a',props,children)}`,resolveDir:process.cwd(),loader:'js'}));}}]});
const js=bundled.outputFiles.find(f=>f.path.endsWith('.js')).contents;
const css=bundled.outputFiles.find(f=>f.path.endsWith('.css')).contents;
const server=createServer(async(req,res)=>{
  if(req.url==='/qa.js'||req.url==='/qa.css'){res.writeHead(200,{'Content-Type':req.url.endsWith('.js')?'application/javascript':'text/css'});res.end(req.url.endsWith('.js')?js:css);return;}
  if(req.url?.startsWith('/fonts/heebo/')){try{res.writeHead(200,{'Content-Type':'font/woff2'});res.end(readFileSync(resolve('public',req.url.slice(1))));}catch{res.writeHead(404);res.end();}return;}
  if(req.url?.split('?')[0]==='/api/admin/users'){
    try{
      const parts=[];for await(const chunk of req)parts.push(chunk);
      const request=new Request('http://127.0.0.1:4416/api/admin/users',{method:req.method,headers:{...req.headers,cookie:`${SESSION_COOKIE}=${encodeURIComponent(cookie)}`},...(req.method==='POST'?{body:Buffer.concat(parts)}:{})});
      const response=await (req.method==='POST'?handlers.POST(request):handlers.GET(request));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
    }catch{res.writeHead(503);res.end('{"error":"synthetic_fixture_failure"}');}return;
  }
  if(req.url==='/'||req.url?.startsWith('/admin/users')){
    res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');
    res.end(`<!doctype html><html lang="he" dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/qa.css"><style>${critical}body{margin:0}*{box-sizing:border-box}</style></head><body data-vii-surface="admin"><aside style="padding:8px;text-align:center;background:#fff6e5">בדיקת ממשק מקומית בנתוני דמה בלבד</aside><div id="root"></div><script type="module" src="/qa.js"></script></body></html>`);return;
  }res.writeHead(404);res.end();
});
await new Promise(r=>server.listen(4416,'127.0.0.1',r));console.log(JSON.stringify({pid:process.pid,url:'http://127.0.0.1:4416/admin/users',scope:'actual components plus real local D1, synthetic owner only'}));
async function stop(){server.close();await mf.dispose();process.exit(0)}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
