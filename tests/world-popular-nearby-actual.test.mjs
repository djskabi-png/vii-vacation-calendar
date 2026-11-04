import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {parseHomepagePresentation} from '../app/lib/homepage-presentation.ts';
import {localizedPath} from '../app/i18n/locale-routing.ts';
import {popularSearchesForWorld} from '../app/lib/world-popular-search-defaults.ts';
function harness(){const cells=[];let index=0,resolve,reject,requests=0;const destinations=[];const jsx=(type,props)=>({type,props});
 const react={useRef:v=>{const i=index++;return cells[i]??(cells[i]={current:v})},useState:v=>{const i=index++;if(!(i in cells))cells[i]=typeof v==='function'?v():v;return[cells[i],v=>cells[i]=typeof v==='function'?v(cells[i]):v]},useEffect:()=>{}};
 const deps={'react':react,'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':{default:'a'},'lucide-react':{Search:'search',MapPin:'pin'},'../i18n/locale-provider':{useSiteLanguage:()=>({language:'he',translate:v=>v})},'../i18n/locale-routing':{localizedPath},'next/navigation':{useRouter:()=>({push:value=>destinations.push(value)})},'./use-nearby-sort':{requestNearbyOrigin:()=>{requests++;return new Promise((a,b)=>{resolve=a;reject=b})}},'../lib/homepage-presentation':{parseHomepagePresentation}};
 const code=ts.transpileModule(readFileSync(new URL('../app/components/home-discovery-sections.tsx',import.meta.url),'utf8')+'\nexport {PopularSearchLink};',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const exports={};new Function('require','exports','window',code)(id=>deps[id]||{},exports,{location:{origin:'https://vii.invalid'}});
 return{render:item=>{index=0;return exports.PopularSearchLink({item})},resolve:()=>resolve({lat:32.2,lng:34.8}),reject:()=>reject(new Error('denied')),destinations,get requests(){return requests}};
}
const click=()=>({button:0,preventDefault(){this.prevented=true}});
const settle=async()=>{for(let i=0;i<4;i++)await Promise.resolve()};
test('actual nearby links prevent double requests, await position then preserve intent and nearest without sharing coordinates',async()=>{
 for(const world of ['vacation','spa','events','hourly','providers','trails','attractions','corporate']){
 const h=harness();const item=popularSearchesForWorld(world)[0];const event=click();const tree=h.render(item);const action=tree.props.children[0].props.onClick;action(event);action(click());assert.equal(h.requests,1);assert.equal(h.destinations.length,0);assert.equal(event.prevented,true);
 h.resolve();await settle();assert.equal(h.destinations.length,1);const href=h.destinations[0];assert.equal(new URL(href,'https://vii.invalid').searchParams.get('sort'),'nearest');assert.doesNotMatch(href,/lat|lng|32\.2|34\.8/);if(world==='corporate')assert.equal(new URL(href,'https://vii.invalid').searchParams.get('eventType'),'אירועי חברה');
 }
});
test('denied position never navigates and the visible item supports a clean retry',async()=>{
 const h=harness(),item=popularSearchesForWorld('spa')[0];h.render(item).props.children[0].props.onClick(click());h.reject();await settle();assert.equal(h.destinations.length,0);const next=h.render(item);assert.equal(next.props.children[1].props.role,'status');next.props.children[0].props.onClick(click());assert.equal(h.requests,2);h.resolve();await settle();assert.equal(h.destinations.length,1);
});
