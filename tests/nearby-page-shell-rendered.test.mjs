import test from 'node:test';
import assert from 'node:assert/strict';
const workerPromise=import(new URL('../dist/server/index.js',import.meta.url).href);
const pages=[['vacations','נופש קרוב אליי'],['spas','ספא קרוב אליי'],['events','מקומות לאירועים קרובים אליי'],['hourly','חדרים לפי שעה קרובים אליי'],['attractions','אטרקציות קרובות אליי'],['trails','מסלולי טיול קרובים אליי'],['providers','ספקים קרובים אליי']];
test('every semantic nearby page renders the complete site shell, unique heading and permanent canonical',async()=>{
 const {default:worker}=await workerPromise;
 for(const [world,title] of pages){
  const path='/'+world+'/near-me';
  const response=await worker.fetch(new Request('https://vii.spaplus.co'+path,{headers:{accept:'text/html'}}),{ASSETS:{fetch:async()=>new Response('Not found',{status:404})}},{waitUntil(p){p.catch(()=>{})},passThroughOnException(){}});
  assert.equal(response.status,200,path);
  const raw=await response.text(),html=raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
  assert.match(html,/<header\b/,path+' must render its header before hydration');
  assert.match(html,/<footer\b/,path+' must render its footer');
  assert.equal([...html.matchAll(/<h1\b/g)].length,1,path+' must have one H1');
  const h1=html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g,'');
  assert.equal(h1,title,path);
  assert.ok(html.includes('rel="canonical"')&&html.includes(path),path+' must retain semantic canonical');
  assert.ok(html.includes('דילוג לתוכן'),path+' must retain skip navigation');
 }
});
