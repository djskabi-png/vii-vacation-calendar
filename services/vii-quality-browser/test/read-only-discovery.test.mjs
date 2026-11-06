import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isReadOnlyDiscoveryRequest} from '../src/read-only-discovery.ts';
import {EVENT_DISCOVERY_VERSION} from '../../../app/lib/event-discovery-contract.ts';
const origin='https://vii.spaplus.co';
const base={world:'events',from:'2026-11-06',till:'2026-11-06',guests:20,includePlaces:true,discoveryVersion:EVENT_DISCOVERY_VERSION};
const request=(body=base,options={})=>({method:()=>options.method??'POST',url:()=>options.url??origin+'/api/vii/live-search',headers:()=>options.headers??{'Content-Type':'application/json; charset=utf-8'},postData:()=>options.raw??JSON.stringify(body)});
test('real public-hook discovery schema and bounded vacation party remain read-only requests',()=>{
 assert.equal(isReadOnlyDiscoveryRequest(request(),origin),true);
 assert.equal(isReadOnlyDiscoveryRequest(request({world:'vacations',from:'2026-11-06',till:'2026-11-08',guests:6,rooms:[{adults:2,children:1,infants:0},{adults:3}],discoverySearch:true,candidates:[{from:'2026-11-06',till:'2026-11-08'}]}),origin),true);
 const hook=readFileSync(new URL('../../../app/components/use-vii-live-search.ts',import.meta.url),'utf8');assert.match(hook,/discoveryVersion: EVENT_DISCOVERY_VERSION/);assert.match(hook,/discoveryJson\("\/api\/vii\/live-search"/);
});
test('exact method, origin, path, body type and byte bounds cannot become a generic POST allowance',()=>{
 for(const options of [{method:'PUT'},{method:'DELETE'},{url:'https://other.invalid/api/vii/live-search'},{url:origin+'/api/booking'},{url:origin+'/api/vii/live-search/booking'},{url:origin+'/api/vii/live-search?write=1'},{url:'https://actor:credential@vii.spaplus.co/api/vii/live-search'},{headers:{'content-type':'text/plain'}},{raw:'{'},{raw:'[]'},{raw:' '.repeat(8193)}])assert.equal(isReadOnlyDiscoveryRequest(request(base,options),origin),false,JSON.stringify(options).slice(0,100));
});
test('unknown fields, contact data, unbounded party/range and malformed nested input fail closed',()=>{
 for(const body of [{...base,action:'book'},{...base,phone:'synthetic'},{...base,world:'spa'},{...base,from:'2026-02-30'},{...base,till:'2026-11-05'},{...base,till:'2027-11-06'},{...base,guests:1001},{...base,guests:'20'},{...base,includePlaces:'true'},{...base,rooms:[{adults:2,phone:'synthetic'}]},{...base,rooms:Array.from({length:11},()=>({adults:2}))},{...base,candidates:[{from:'bad',till:'bad'}]}])assert.equal(isReadOnlyDiscoveryRequest(request(body),origin),false);
});
test('candidate windows cannot extend provider work beyond the admitted outer date range',()=>{
 for(const candidates of [[{from:'1900-01-01',till:'9999-12-31'}],[{from:'2026-11-05',till:'2026-11-07'}],[{from:'2026-11-06',till:'2027-11-06'}]])assert.equal(isReadOnlyDiscoveryRequest(request({...base,till:'2026-11-08',candidates}),origin),false);
});
