import { readEffectiveWorldCss } from "./helpers/world-css.mjs";
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {currencyLabelParts} from '../app/lib/currency-label.ts';
test('supplier currency labels preserve copy but isolate shekel before the amount',()=>{
 for(const text of ['החל מ־₪750','החל מ־750 ₪','From ₪750','750 ש״ח']){
 const parts=currencyLabelParts(text);assert.equal(parts.filter(p=>p.amount).length,1);assert.equal(parts.find(p=>p.amount).text,'₪\u00a0750');
 }
 assert.deepEqual(currencyLabelParts('למחיר פנו למקום'),[{text:'למחיר פנו למקום'}]);
 const source=readFileSync(new URL('../app/components/discovery-card.tsx',import.meta.url),'utf8');assert.match(source,/<CurrencyText text=\{price\} \/>/);
});
test('gallery chevrons cannot mirror twice in RTL desktop or mobile',()=>{
 const css=readEffectiveWorldCss();
 assert.match(css,/\.story-gallery__tap-icon \{ direction:ltr; unicode-bidi:isolate;/);
 assert.doesNotMatch(css,/\[dir="rtl"\] \.story-gallery__tap-icon\s*\{[^}]*scaleX/);
});

test("active vacation price chips isolate the same currency parts",()=>{const source=readFileSync(new URL("../app/search/page.tsx",import.meta.url),"utf8");assert.match(source,/currencyLabelParts\(filter\.label\)/);assert.match(source,/<bdi dir="ltr" key=\{index\}>\{part\.text\}<\/bdi>/);});
