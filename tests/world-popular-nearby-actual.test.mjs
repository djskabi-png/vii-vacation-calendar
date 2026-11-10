import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {parseHomepagePresentation} from '../app/lib/homepage-presentation.ts';
import {localizedPath} from '../app/i18n/locale-routing.ts';
import {popularSearchesForWorld} from '../app/lib/world-popular-search-defaults.ts';
function harness(){const cells=[];let index=0,resolve,reject,requests=0;const destinations=[];const jsx=(type,props)=>({type,props});
 const react={useRef:v=>{const i=index++;return cells[i]??(cells[i]={current:v})},useState:v=>{const i=index++;if(!(i in cells))cells[i]=typeof v==='function'?v():v;return[cells[i],v=>cells[i]=typeof v==='function'?v(cells[i]):v]},useEffect:()=>{}};
 const deps={'react':react,'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':{default:'a'},'lucide-react':{Search:'search',MapPin:'pin'},'../i18n/locale-provider':{useSiteLanguage:()=>({language:'he',translate:v=>v})},'../i18n/locale-routing':{localizedPath},'../lib/nearby-page-content':{nearbyPageContent:{vacation:{title:'נופש קרוב אליי'}},nearbyPageForPath:()=>null},'next/navigation':{useRouter:()=>({push:value=>destinations.push(value)})},'./use-nearby-sort':{requestNearbyOrigin:()=>{requests++;return new Promise((a,b)=>{resolve=a;reject=b})}},'../lib/homepage-presentation':{parseHomepagePresentation}};
 const code=ts.transpileModule(readFileSync(new URL('../app/components/home-discovery-sections.tsx',import.meta.url),'utf8')+'\nexport {PopularSearchLink};',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const exports={};new Function('require','exports','window',code)(id=>deps[id]||{},exports,{location:{origin:'https://vii.invalid'}});
 return{render:(item,props={})=>{index=0;return exports.PopularSearchLink({item,...props})},resolve:()=>resolve({lat:32.2,lng:34.8}),reject:()=>reject(new Error('denied')),destinations,get requests(){return requests}};
}
const click=()=>({button:0,preventDefault(){this.prevented=true}});
const settle=async()=>{for(let i=0;i<4;i++)await Promise.resolve()};
test('canonical near-me links navigate normally without requesting GPS',async()=>{
 for(const world of ['vacation','spa','events','hourly','trails','attractions','providers']){
 const h=harness();const item=popularSearchesForWorld(world).find(candidate=>candidate.href.split('?')[0].endsWith('/near-me'));assert.ok(item);const event=click();const tree=h.render({...item},{world});const action=tree.props.children[0].props.onClick;action(event);assert.equal(h.requests,0);assert.equal(h.destinations.length,0);assert.equal(event.prevented,undefined);
 assert.equal(item.href.split('?')[0].endsWith('/near-me'),true);assert.equal(tree.props.children[0].props.href,localizedPath(item.href,'he'));
 }
});
test('custom nearby links await GPS, preserve filters and support denial retry',async()=>{
 const h=harness(),items=['providers','corporate'].map(world=>popularSearchesForWorld(world).find(item=>item.action==='nearby')).filter(Boolean).map((item,index)=>index===0?{...item,href:'/providers?region=מרכז&sort=nearest'}:item);
 for(const item of items){const before=h.requests,beforeDest=h.destinations.length;const event=click();h.render(item).props.children[0].props.onClick(event);assert.equal(h.requests,before+1);assert.equal(event.prevented,true);h.reject();await settle();assert.equal(h.destinations.length,beforeDest);const next=h.render(item);assert.equal(next.props.children[1].props.role,'status');next.props.children[0].props.onClick(click());assert.equal(h.requests,before+2);h.resolve();await settle();assert.equal(h.destinations.length,beforeDest+1);const href=h.destinations.at(-1);assert.equal(new URL(href,'https://vii.invalid').searchParams.get('sort'),'nearest');assert.doesNotMatch(href,/lat|lng|32\.2|34\.8/);}
});
