import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {supplierContactNumber} from '../app/lib/supplier-contact.ts';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
function harness(language='he') {
 let value=false; const events=[];
 const jsx=(type,props)=>({type,props});
 const dependencies={
  'react':{useState:()=>[value,next=>value=next]},
  'react/jsx-runtime':{jsx,jsxs:jsx},
  '../i18n/locale-provider':{useSiteLanguage:()=>({language})},
  '../lib/analytics':{trackPhoneReveal:event=>events.push(event)},
  '../lib/supplier-contact':{supplierContactNumber},
  './whatsapp-lead-button':{WhatsAppLeadButton:function WhatsAppLeadButton(){}},
 };
 const exports={};
 const source=ts.transpileModule(read('app/components/card-contact-actions.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('require','exports',source)(id=>{assert.ok(dependencies[id],id);return dependencies[id]},exports);
 return {render:exports.CardContactActions,events};
}
const base={world:'hourly',placeId:'hourly-test',placeName:'Test place',serviceName:'Short stay'};
const children=node=>[node?.props?.children].flat().filter(Boolean);
test('contact eligibility never infers WhatsApp from phone or invalid data',()=>{
 const h=harness();
 assert.equal(h.render(base),null);
 assert.equal(h.render({...base,phone:'-------',whatsapp:'not-a-number'}),null);
 const phoneOnly=children(h.render({...base,phone:'050-111-1111'}));
 assert.equal(phoneOnly.length,1); assert.equal(phoneOnly[0].type,'button');
 const whatsappOnly=children(h.render({...base,whatsapp:'050-222-2222'}));
 assert.equal(whatsappOnly.length,1);assert.equal(whatsappOnly[0].props.businessPhone,'050-222-2222');
});
test('phone reveal becomes a callable isolated number and retains world analytics',()=>{
 for(const world of ['hourly','events']){
  const h=harness();const props={...base,world,phone:'050-111-1111',whatsapp:'050-222-2222'};
  children(h.render(props))[0].props.onClick();
  const call=children(h.render(props))[0];
  assert.equal(call.type,'a');assert.equal(call.props.href,'tel:0501111111');
  assert.equal(children(call)[1].props.dir,'ltr');
  assert.deepEqual(h.events,[{placeId:props.placeId,placeName:props.placeName,world,placement:world==='events'?'event_card':'discovery_card'}]);
 }
});
test('localized actions keep explicit venue/date/party context for existing lead flow',()=>{
 for(const language of ['he','en','fr','ru']){
  const h=harness(language);const props={...base,world:'events',phone:'050-111-1111',whatsapp:'050-222-2222',initialDate:'2026-10-23',initialGuests:20};
  const [phone,wa]=children(h.render(props));
  assert.ok(children(phone).some(node=>node.type==='span'));
  for(const field of ['world','placeId','placeName','serviceName','initialDate','initialGuests'])assert.equal(wa.props[field],props[field]);
  assert.ok(wa.props.buttonLabel);if(language!=='he')assert.doesNotMatch(wa.props.buttonLabel,/[\u0590-\u05ff]/);
 }
});
test('hourly footer and event results use shared bottom rows outside navigation links',()=>{
 const hourly=read('app/components/discovery-card.tsx');
 assert.match(hourly,/<CardContactActions key=\{item.id\} world="hourly"/);
 assert.match(hourly,/phone=\{item.phone\} whatsapp=\{item.whatsapp\}/);
 assert.ok(hourly.indexOf('preview-card-price-row')<hourly.indexOf('<CardContactActions'));
 const preview=read('app/components/place-preview-card.tsx');
 assert.ok(preview.indexOf('</Link>')<preview.indexOf('<CardContactActions key='));
 assert.match(read('app/components/event-card-contact-actions.tsx'),/<CardContactActions \{\.\.\.props\} world="events"/);
 const css=read('app/preview-card-consistency.css');
 assert.match(css,/\.preview-card-contact-row \{[^}]*repeat\(2, minmax\(0, 1fr\)\)/);
 assert.match(css,/footer.discovery-card__hourly-footer \{[^}]*margin-top: auto/);
 assert.match(css,/\.place-preview-card__contact \{ margin-top: auto/);
});
test('every event venue preview caller passes its own explicit contact, categories remain links',()=>{
 for(const file of ['app/events/page.tsx','app/components/home-showcase.tsx','app/events/place/client-page.tsx','app/components/event-last-minute.tsx']){
  const source=read(file);const matches=[...source.matchAll(/<PlacePreviewCard[^>]*>/g)];
  assert.ok(matches.length,file);for(const match of matches)assert.match(match[0],/contact=\{/);
 }
 assert.match(read('app/components/event-last-minute.tsx'),/initialDate: offer.from \|\| undefined, initialGuests: guests/);
 const route=read('app/api/vii/live-search/route.ts');
 assert.match(route,/place.contact.phone \? \{ phone: place.contact.phone \}/);
 assert.match(route,/place.contact.whatsapp \? \{ whatsapp: place.contact.whatsapp \}/);
 assert.doesNotMatch(route,/whatsapp: place.contact.phone/);
});
