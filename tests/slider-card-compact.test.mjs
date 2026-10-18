import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css=readFileSync(new URL('../app/slider-card-compact.css',import.meta.url),'utf8');
test('compact cards are scoped to horizontal rails, not all search/detail cards',()=>{
 assert.match(css,/\[data-horizontal-rail\][\s\S]*height: auto/);
 assert.match(css,/\.home-slider__item, \.home-live-deals__item\) > article \{ flex: 1/);
 assert.doesNotMatch(css,/max-height:\s*\d+px|height:\s*\d+px.*overflow:\s*hidden/);
});
test('rail quote price and guest basis share a wrapping line without hiding data',()=>{
 assert.match(css,/stay-card__price--selected \{ max-width: 100%/);
 assert.match(css,/stay-card__price--selected em \{ flex-basis: auto/);
 assert.match(css,/stay-card__price--selected em::before/);
 assert.doesNotMatch(css,/stay-card__(?:price|date-status|availability)[^{]*\{[^}]*display:\s*none/);
});
test('compact rail cards preserve 44px contact actions and image gallery controls',()=>{
 assert.match(css,/stay-card__contact, \.stay-card__details-link\) \{ min-height: 44px/);
 assert.doesNotMatch(css,/gallery-(?:arrow|dots|count)[^{]*\{[^}]*display:\s*none/);
 assert.match(css,/discovery-card__visual--contain/);
});
