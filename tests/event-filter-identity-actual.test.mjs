import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import catalog from '../app/data/sergey-public-catalog.json' with {type:'json'};
import {normalizeEventVenueType,matchesEventVenueType} from '../app/lib/event-search-taxonomy.ts';
import {matchesSearchLocation} from '../app/data/search-taxonomy.ts';
import {uniqueSearchLocations} from '../app/lib/geographic-names.ts';
const require=createRequire(import.meta.url);
const aliases=[['לופט','לופטים'],['וילה','וילות'],['מתחם אירוח','מתחמי אירוח'],['מתחם אירועים','מתחמי אירועים'],['מתחם קיץ','מתחמי קיץ'],['חדר קריוקי','חדרי קריוקי']];
// Execute the actual page predicate, not a second implementation of its comparison.
const page=readFileSync(new URL('../app/events/search/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('page.tsx',page,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let predicate;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='matchesHardFilters')predicate=n.initializer.getText(ast);ts.forEachChild(n,visit)}visit(ast);
function actualPredicate(type){const js=ts.transpileModule('const predicate='+predicate+';',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;return new Function('type','matchesEventVenueType','eventType','facility','guests','noNoiseLimit','accessibleOnly','eventMatchesFeatureSelection','matchesVacationSearchFilter',js+';return predicate;')(type,matchesEventVenueType,'הכל','הכל',0,false,false,()=>true,()=>true)}
test('actual event page accepts both provider singular and route plural without changing business facts',()=>{
 for(const [singular,plural]of aliases)for(const stored of [singular,plural])for(const selected of [singular,plural])assert.equal(actualPredicate(selected)({type:stored,eventTypes:[],features:[]}),true,stored+' / '+selected);
 assert.equal(actualPredicate('לופטים')({type:'וילה',eventTypes:[],features:[]}),false);
 assert.equal(normalizeEventVenueType('constructor'),'constructor');
 assert.equal(normalizeEventVenueType('__proto__'),'__proto__');
 assert.equal(actualPredicate('unknown')({type:'לופט',eventTypes:[],features:[]}),false);
});
test('north and south loft membership survives supplier singular/plural refresh',()=>{
 const events=catalog.places.filter(x=>x.world==='events');
 for(const region of ['צפון','דרום ונגב']){
 const lofts=events.filter(x=>matchesSearchLocation(x,region)&&(/לופט/.test(x.name)||normalizeEventVenueType(x.type)==='לופטים'));
 assert.ok(lofts.length>0,region);
 const query=new URLSearchParams({type:'לופט'});const selection=normalizeEventVenueType(query.get('type'));
 const selected=lofts.filter(x=>actualPredicate(selection)({...x,type:'לופט'}));
 assert.deepEqual(selected.map(x=>x.slug),lofts.map(x=>x.slug));
 assert.deepEqual(lofts.filter(x=>actualPredicate(selection)({...x,type:'לופטים'})).map(x=>x.slug),selected.map(x=>x.slug));
 }
 assert.deepEqual(uniqueSearchLocations(['דרום','דרום ונגב','צפון']),['דרום ונגב','צפון']);
});
function selectHarness(){
 let open=false;const source=ts.transpileModule(readFileSync(new URL('../app/components/modern-select.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 let cursor=0;const state=[];const react={useId:()=> 'test',useRef:()=>({current:null}),useEffect:()=>{},useState:initial=>{const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],v=>state[i]=typeof v==='function'?v(state[i]):v]}};
 const exports={};new Function('require','exports',source)(id=>id==='react'?react:require(id),exports);
 const render=props=>{cursor=0;return exports.ModernSelect(props)};return{render};
}
function nodes(tree){return !tree||typeof tree!=='object'?[]:[tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)]}
test('actual shared select retains a route identity through empty, populated and partial catalog batches, with selected menu and form value',()=>{
 const h=selectHarness();let chosen;const props={label:'אזור',name:'location',value:'דרום ונגב',retainSelectedOption:true,options:[{value:'הכל',label:'הכל'}],onChange:v=>chosen=v};
 for(const options of [props.options,[],[...props.options,{value:'דרום ונגב',label:'דרום ונגב'}],props.options]){
 let tree=h.render({...props,options});assert.ok(nodes(tree).some(n=>n.type==='strong'&&n.props.children==='דרום ונגב'));
 assert.equal(nodes(tree).find(n=>n.type==='input').props.value,'דרום ונגב');
 const trigger=nodes(tree).find(n=>n.props?.['aria-haspopup']==='listbox');if(!trigger.props['aria-expanded'])trigger.props.onClick();tree=h.render({...props,options});
 const selected=nodes(tree).filter(n=>n.props?.role==='option'&&n.props['aria-selected']);assert.equal(selected.length,1);assert.equal(selected[0].props.children[0].props.children,'דרום ונגב');
 }
 let tree=h.render(props);nodes(tree).find(n=>n.props?.role==='option'&&n.props.children[0].props.children==='הכל').props.onClick();assert.equal(chosen,'הכל');
 tree=h.render({...props,value:'הכל'});assert.ok(nodes(tree).some(n=>n.type==='strong'&&n.props.children==='הכל'));
});
test('retention is opt in: opaque unrelated select identities never become raw labels',()=>{
 const tree=selectHarness().render({label:'Sort',value:'opaque-id',options:[{value:'default',label:'Recommended'}]});assert.ok(nodes(tree).some(n=>n.type==='strong'&&n.props.children==='Recommended'));
});

test('retained human-readable identities use their translated label',()=>{
 const tree=selectHarness().render({label:'Region',value:'דרום ונגב',retainSelectedOption:true,retainedSelectionLabel:'South and Negev',options:[]});assert.ok(nodes(tree).some(n=>n.type==='strong'&&n.props.children==='South and Negev'));
});

test('every event region remains selectable when live geography and catalog are temporarily empty',()=>{
 let initializer;function scan(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='areas')initializer=n.initializer.getText(ast);ts.forEachChild(n,scan)}scan(ast);
 const js=ts.transpileModule('const areas='+initializer+';', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return import('../app/data/search-taxonomy.ts').then(({searchLocationOptions})=>{
 const values=new Function('useMemo','uniqueSearchLocations','searchLocationOptions','managedGeography','eventPlaces',js+';return areas;')(fn=>fn(),uniqueSearchLocations,searchLocationOptions,[],[]);
 assert.ok(values.includes('דרום ונגב'));assert.ok(values.includes('צפון'));assert.equal(values.filter(x=>x==='דרום ונגב').length,1);
 });
});

test('actual event change handler normalizes a selected alias before state and URL writes',()=>{
 let handler;function scan(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='changeFilter')handler=n.getText(ast);ts.forEachChild(n,scan)}scan(ast);
 const js=ts.transpileModule(handler,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const state=[],urls=[];const noop=()=>{};
 const change=new Function('normalizeEventVenueType','setArea','setType','setEventType','setFacility','setGuests','setNoNoiseLimit','setAccessibleOnly','setSort','setSlot','EVENT_SORT_VALUES','updateUrl',js+';return changeFilter;')(normalizeEventVenueType,noop,v=>state.push(v),noop,noop,noop,noop,noop,noop,noop,[],v=>urls.push(v));
 change('type','לופט');assert.equal(state.at(-1),'לופטים');assert.deepEqual(urls.at(-1),{type:'לופטים'});
 change('type','הכל');assert.equal(state.at(-1),'הכל');assert.deepEqual(urls.at(-1),{type:null});
});
