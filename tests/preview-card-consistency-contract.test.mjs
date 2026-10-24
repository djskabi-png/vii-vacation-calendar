import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const card=read('app/components/event-result-card.tsx');
const css=read('app/preview-card-consistency.css');
const views=read('app/results-view.css');
test('event preview has explicit compact title and no redundant teaser prose',()=>{
 assert.match(card,/<h3 className="event-result-card__title">/);
 assert.doesNotMatch(card,/<h2>|place\.description|place\.features\.slice/);
 assert.match(card,/title=\{name\}>\{name\}<\/Link>/);
 assert.match(card,/FavoriteButton[^>]+name=\{name\}[^>]+location=\{`\$\{location\}, \$\{area\}`\}/);
 assert.match(card,/אורחים ביחידה הגדולה/);
 assert.match(card,/supplierStatus.*event-live-status/s);
});
test('shared preview typography cannot inherit section heading scales',()=>{
 for(const selector of ['.event-result-card__title','.stay-card__title h3','.discovery-card__body h3','.trail-card__body h3'])assert.ok(css.includes(selector));
 assert.match(css,/--preview-title-size: 1\.125rem/);
 assert.match(css,/-webkit-line-clamp: 2/);
 assert.match(read('app/layout.tsx'),/preview-card-consistency\.css/);
});
test('cards stretch but mixed heading and toolbar rows are not forced to card heights',()=>{
 assert.match(views,/\.event-list\.results-view--grid \{[^}]*align-items: stretch/);
 assert.match(views,/\.result-cards\.results-view--grid \{[^}]*align-items: stretch/);
 assert.doesNotMatch(css+views,/grid-auto-rows:\s*1fr/);
 assert.match(css,/event-card__actions \{ margin-top: auto/);
 assert.doesNotMatch(css,/stay-card__date-status[^}]*overflow:\s*hidden/s);
});
test('event interactions and selected detail context remain intact',()=>{
 for(const value of ['<PreviewCardGallery','<FavoriteButton','<EventCardContactActions','data-map-place-id','onPointerEnter','onFocusCapture','href={href}'])assert.ok(card.includes(value));
 assert.match(read('app/events/search/page.tsx'),/eventOfferHref\(place, new URLSearchParams/);
});
