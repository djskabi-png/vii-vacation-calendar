import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSpaPlusFacilities} from '../scripts/lib/spaplus-facility-parser.mjs';
const page=(id,body)=>`<input type="hidden" name="siteid" value="${id}">מאפייני המקום${body}תיאור המקום<div data-cid="111"><span>מידע של עסק אחר</span>`;
test('official parser handles long facility SVGs without dropping the following label',()=>{
 const source=page(8,`<div data-cid="2001,179"><svg>${'x'.repeat(15000)}</svg><span>ג&#39;קוזי</span></div><div data-cid="2003,180"><span>חדר כושר</span></div>`);
 assert.deepEqual(parseSpaPlusFacilities(source,8),{verifiedSupplierId:8,providerFacilityIds:[2001,179,2003,180],labels:["ג'קוזי",'חדר כושר']});
});
test('redirected supplier identity and partial extraction cannot overwrite accepted source facts',()=>{
 assert.throws(()=>parseSpaPlusFacilities(page(9,'<div data-cid="1"><span>בריכה</span>'),8),/supplier_identity_mismatch/);
 assert.throws(()=>parseSpaPlusFacilities(page(8,'<div data-cid="1"><svg>no label</svg>'),8),/incomplete_facility_extraction/);
 assert.throws(()=>parseSpaPlusFacilities('<input name="siteid" value="8">בריכה בגוף העמוד',8),/facility_section_missing/);
});
