import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {eventWhatsAppDestination,eventInquiryWhatsAppUrl,startEventWhatsAppInquiry} from '../app/lib/event-whatsapp-inquiry.ts';
import {eventPlaceHref} from '../app/lib/event-place-href.ts';

const input={submissionId:'fixture-id',placeId:'event-1331',placeName:'מקום לבדיקה',whatsapp:'0501234567',date:'2026-11-12',guests:'20',slot:'ערב',eventType:'יום הולדת',name:'מבקר לבדיקה',phone:'0507654321',sourcePage:'https://vii.spaplus.co/events/place/event-1331?from=2026-11-12',privacyAccepted:true};
const displayedDate='12.11.2026';
test('event inquiry uses the exact supplier WhatsApp and every chosen detail',()=>{
  const url=new URL(eventInquiryWhatsAppUrl(input));
  assert.equal(url.host,'wa.me');assert.equal(url.pathname,'/972501234567');
  const text=url.searchParams.get('text');
  for(const value of [input.placeName,displayedDate,input.guests,input.slot,input.eventType,input.name,input.phone,'/events/place/event-1331'])assert.ok(text.includes(value));
  assert.doesNotMatch(text,/mailto:|אימייל/);
});
test('invalid supplier contact or missing consent never opens or saves a request',()=>{
  for(const patch of [{whatsapp:undefined},{whatsapp:'invalid'},{privacyAccepted:false},{honey:'bot'},{date:'invalid'},{date:'2026-02-30'},{guests:'0'},{sourcePage:''},{sourcePage:'bad url'},{sourcePage:'file:///private'},{placePath:'https://unrelated.test/place'}]){
    assert.equal(eventInquiryWhatsAppUrl({...input,...patch}),null);
    assert.equal(startEventWhatsAppInquiry({...input,...patch},{open:()=>assert.fail('opened'),assign:()=>assert.fail('navigated'),fetch:()=>assert.fail('saved')}),false);
  }
});
test('WhatsApp opens synchronously before optional persistence and CRM failure cannot block it',async()=>{
  for(const persist of [()=>Promise.reject(Error('offline')),()=>{throw Error('sync failure');}]){
    const order=[],popup={opener:{}};
    assert.equal(startEventWhatsAppInquiry(input,{open:(url,target)=>{order.push('open');assert.equal(target,'_blank');return popup;},assign:()=>assert.fail('duplicate'),fetch:(url,options)=>{order.push('persist');const payload=JSON.parse(options.body);assert.equal(payload.purpose,'whatsapp_enquiry');assert.equal(payload.placeId,input.placeId);assert.equal(payload.submissionId,input.submissionId);assert.equal(payload.email,undefined);assert.equal(options.keepalive,true);return persist();}}),true);
    assert.deepEqual(order,['open','persist']);assert.equal(popup.opener,null);
    await Promise.resolve();
  }
});
test('blocked popup navigates once; composite vacation/event venue links keep event mode',()=>{
  const calls=[];
  startEventWhatsAppInquiry({...input,placeId:'vacation-164'},{open:()=>null,assign:url=>calls.push(url),fetch:async()=>Response.json({success:true})});
  assert.equal(calls.length,1);
  assert.match(new URL(calls[0]).searchParams.get('text'),/business\?id=vacation-164&mode=events/);
});
function actualHandler(){
  const source=fs.readFileSync('app/events/place/client-page.tsx','utf8');
  const ast=ts.createSourceFile('events.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let handler;
  function find(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='submitInquiry')handler=n;ts.forEachChild(n,find);}find(ast);
  const code=ts.transpileModule(handler.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const calls=[],values={date:input.date,guests:input.guests,name:input.name,phone:input.phone,eventType:input.eventType,privacy:'on',company_site:''};
  const ctx={language:'he',submitState:'idle',submitLock:{current:false},submissionId:'',setSubmitState:value=>{ctx.submitState=value;},setSubmissionId:value=>{ctx.submissionId=value;},place:{slug:input.placeId,name:input.placeName},ownerWhatsapp:input.whatsapp,eventSlot:'evening',eventSlotCopy:{he:{evening:'ערב',both:'בוקר או ערב'}},eventPlaceHref,startEventWhatsAppInquiry,crypto,FormData:class{get(name){return values[name];}},window:{location:{href:input.sourcePage,assign:url=>calls.push(['assign',url])},open:url=>{calls.push(['open',url]);return {opener:{}};}},fetch:async(url,options)=>{calls.push(['persist',JSON.parse(options.body)]);return Response.json({success:true});}};
  return {ctx,calls,run:new Function('ctx',`with(ctx){${code};return submitInquiry;}`)(ctx)};
}
test('actual venue submit handler opens WhatsApp once and blocks duplicate submit gestures',()=>{
  const h=actualHandler();const event={preventDefault(){},currentTarget:{}};
  h.run(event);h.run(event);
  assert.equal(h.ctx.submitState,'success');
  assert.equal(h.calls.filter(([kind])=>kind==='open').length,1);
  assert.equal(h.calls.filter(([kind])=>kind==='persist').length,1);
  assert.ok(h.ctx.submissionId);
  assert.equal(h.calls.find(([kind])=>kind==='persist')[1].submissionId,h.ctx.submissionId);
});
test('event enquiry message labels follow the visitor locale',()=>{
 for(const language of ['en','ru','fr']){
  const url=eventInquiryWhatsAppUrl({...input,placeName:'Fixture venue',name:'Guest',slot:'Evening',eventType:'Birthday',language});
  const message=new URL(url).searchParams.get('text');assert.doesNotMatch(message,/[א-ת]/);assert.ok(message.includes(displayedDate));
 }
});

test('actual venue contact block offers the verified telephone when WhatsApp is absent',()=>{
 const source=fs.readFileSync('app/events/place/client-page.tsx','utf8'),ast=ts.createSourceFile('venue.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let aside;
 function visit(n){if(ts.isJsxElement(n)&&n.openingElement.tagName.getText(ast)==='aside'&&n.openingElement.attributes.getText(ast).includes('event-booking'))aside=n;ts.forEachChild(n,visit);}visit(ast);assert.ok(aside);
 const code=ts.transpileModule('const render=()=>('+aside.getText(ast)+');',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const run=ctx=>new Function('require','exports','ctx',`with(ctx){${code};return render();}`)(createRequire(import.meta.url),{},ctx);
 const flatten=node=>node==null?[]:Array.isArray(node)?node.flatMap(flatten):[node,...flatten(node.props?.children)];
 const ctx={CalendarIcon:()=>null,translate:s=>s,eventWhatsAppDestination,ownerWhatsapp:undefined,ownerPhone:'055-1234567',phoneHref:'tel:0551234567',submitState:'idle'};
 let nodes=flatten(run(ctx));assert.equal(nodes.filter(n=>n.type==='form').length,0);assert.equal(nodes.find(n=>n.type==='a').props.href,ctx.phoneHref);
 nodes=flatten(run({...ctx,ownerPhone:undefined,phoneHref:undefined}));assert.equal(nodes.filter(n=>n.type==='form'||n.type==='a').length,0);assert.ok(nodes.includes('פרטי הקשר של המקום אינם זמינים כרגע.'));
});
