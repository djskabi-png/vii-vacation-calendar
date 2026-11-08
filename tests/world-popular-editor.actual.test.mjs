import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceLoader} from './helpers/source-module-loader.mjs';
const load=createSourceLoader();
const {WorldPopularEditor,editablePopularItems}=load('app/admin/content-studio/world-popular-editor.tsx');
const {popularSearchesForWorld}=load('app/lib/world-popular-search-defaults.ts');
function nodes(node,out=[]){if(!node||typeof node!=='object')return out;out.push(node);for(const child of [node.props?.children].flat(Infinity))nodes(child,out);return out;}
function fixture(disabled=false){let attrs={homePopularSearchesSpa:JSON.stringify(popularSearchesForWorld('spa')),homePopularSearchesHourly:JSON.stringify(popularSearchesForWorld('hourly')),guard:'preserved'};return{get attrs(){return attrs;},render:()=>WorldPopularEditor({world:'spa',attributes:attrs,onChange:next=>{attrs=next;},onWorldChange(){},disabled})};}
const labelInput=(tree,label)=>nodes(tree).find(n=>n.type==='label'&&n.props.children?.[0]?.props?.children===label)?.props.children[1];
test('actual spa editor preserves transient blank input and writes only the selected world',()=>{
  const h=fixture(),beforeHourly=h.attrs.homePopularSearchesHourly;
  labelInput(h.render(),'כותרת').props.onChange({target:{value:''}});
  assert.equal(editablePopularItems(h.attrs,'spa').length,popularSearchesForWorld('spa').length);
  assert.equal(labelInput(h.render(),'כותרת').props.value,'');
  labelInput(h.render(),'כותרת').props.onChange({target:{value:'ספא לפי בחירה'}});
  assert.equal(JSON.parse(h.attrs.homePopularSearchesSpa)[0].label,'ספא לפי בחירה');
  assert.equal(h.attrs.homePopularSearchesSpaVersion,'2');assert.equal(h.attrs.homePopularSearchesHourly,beforeHourly);assert.equal(h.attrs.guard,'preserved');
});
test('actual editor reorders, hides and removes rows, with nearby identity intact',()=>{
  const h=fixture(),original=JSON.parse(h.attrs.homePopularSearchesSpa);
  nodes(h.render()).find(n=>n.type==='button'&&n.props.children==='הורדה').props.onClick();
  assert.equal(JSON.parse(h.attrs.homePopularSearchesSpa)[1].id,original[0].id);
  nodes(h.render()).find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:false}});
  assert.equal(JSON.parse(h.attrs.homePopularSearchesSpa)[0].visible,false);
  nodes(h.render()).find(n=>n.type==='button'&&n.props.children==='הסרה').props.onClick();
  assert.equal(JSON.parse(h.attrs.homePopularSearchesSpa).length,original.length-1);
  assert.equal(JSON.parse(h.attrs.homePopularSearchesSpa)[0].action,'nearby');
});
test('read-only editor cannot mutate content through its event handlers',()=>{
  const h=fixture(true),before=JSON.stringify(h.attrs);
  labelInput(h.render(),'כותרת').props.onChange({target:{value:'אסור'}});
  assert.equal(JSON.stringify(h.attrs),before);assert.equal(h.render().props.disabled,true);
});
