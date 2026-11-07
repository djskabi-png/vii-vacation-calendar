import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {eventDealPresets,eventDealDate} from '../app/lib/event-deal-dates.ts';
import {normalizeDealDate} from '../app/lib/deal-clock.ts';
import {eventDealPagePath,uniqueEventVenueItems} from '../app/lib/event-discovery-contract.ts';
import {eventSlotCopy} from '../app/i18n/event-slot-copy.ts';

// Exercise the actual client component with retained React state, as happens
// when RSC navigation changes fixedPreset without remounting the client tree.
function retainedClient(now) {
  const cells=['2026-11-05',true,'thursday',50,'50',undefined,'both',0];
  let index=0, selection;
  const dependencies={
    'react/jsx-runtime':{jsx:()=>null,jsxs:()=>null},
    react:{useEffect:()=>{},useState:initial=>{const i=index++;return [i<cells.length?cells[i]:initial,()=>{}]}},
    '../i18n/locale-provider':{useSiteLanguage:()=>({language:'he',translate:x=>x})},
    '../i18n/event-slot-copy':{eventSlotCopy},
    '../lib/event-deal-dates':{eventDealPresets,eventDealDate},
    '../lib/deal-clock':{normalizeDealDate},
    './use-deal-clock':{useDealClock:()=>({now})},
    './use-document-seed':{useDocumentSeed:()=> 'test'},
    './use-section-activation':{useSectionActivation:()=>true},
    './use-managed-geography':{useManagedGeography:()=>({})},
    '../lib/regional-availability':{regionalAvailabilityRegion:()=>null},
    '../lib/use-starting-prices':{useStartingPrices:()=>({})},
    '../lib/discovery-slider-order':{orderDiscoveryRail:()=>[]},
    '../lib/event-discovery-contract.ts':{eventDealPagePath,uniqueEventVenueItems},
    './use-vii-live-search':{useViiLiveSearch:(...args)=>{selection=args;return {status:'ready',results:{},resultOrder:[],places:[]}}},
  };
  const exports={};
  const source=ts.transpileModule(readFileSync(new URL('../app/components/event-last-minute.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function('require','exports',source)(id=>dependencies[id]||{},exports);
  return preset=>{index=0;exports.EventLastMinute({places:[],fixedPreset:preset,layout:'grid'});return selection};
}

test('client forward/back navigation changes the queried date despite retained Thursday state',()=>{
  const render=retainedClient(new Date('2026-11-04T13:00:00+02:00'));
  for(const [preset,date] of [['thursday','2026-11-05'],['friday','2026-11-06'],['lastminute','2026-11-04'],['friday','2026-11-06'],['thursday','2026-11-05']]){
    const selection=render(preset);
    assert.equal(selection[1],date,preset);
    assert.equal(selection[2],date,preset);
    assert.equal(selection[3],50,'retain the chosen party without retaining another page date');
  }
});

test('last-minute route follows the14:00 clock even with retained Thursday selection',()=>{
  assert.equal(retainedClient(new Date('2026-11-04T13:59:59+02:00'))('lastminute')[1],'2026-11-04');
  assert.equal(retainedClient(new Date('2026-11-04T14:00:00+02:00'))('lastminute')[1],'2026-11-05');
});
