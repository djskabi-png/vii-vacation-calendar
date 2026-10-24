import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const css=read('app/globals.css'),home=read('app/home-mobile.css'),source=read('app/components/home-showcase.tsx');
test('review cards protect common header, quote, author/date and CTA rows',()=>{
 assert.match(css,/\.home-rating-card \{[^}]*display: grid;[^}]*grid-template-rows: 112px minmax\(4\.8em,1fr\) auto auto/);
 assert.doesNotMatch(css,/\.home-tour-card > div,\.home-rating-card > div/);
 assert.match(css,/\.home-rating-card__top \{[^}]*grid-template-columns: 112px minmax\(0,1fr\);[^}]*padding: 0/);
 assert.doesNotMatch(css,/\.home-rating-card__top \{[^}]*grid-template-columns: 84px/);
 assert.match(css,/\.home-rating-card__top h3 \{[^}]*min-block-size: 2\.7em;[^}]*-webkit-line-clamp: 2/);
 assert.match(css,/\.home-rating-card__byline > time \{ flex: 0 0 auto; white-space: nowrap/);
 assert.match(source,/<time dateTime=\{reviewDate\} dir="ltr">\{new Intl\.DateTimeFormat/);
 assert.match(source,/title=\{name\}>\{name\}<\/Link>/);
 assert.match(source,/language === "he" \? homeReviewExcerpt\(reviewText\) : copy\.review/);
 assert.match(source,/homeReviewExcerpt\(reviewText\)/);
});
test('trust and adjacent spa section share the parent background and one bounded section gap',()=>{
 assert.match(home,/\.home-page \.home-trust-discovery \{ background:transparent/);
 assert.match(home,/home-trust-discovery:has\(\+ \.spa-package-deals\) \{ padding-block-end:24px/);
 assert.match(home,/home-trust-discovery \+ \.spa-package-deals \{ padding-block-start:32px/);
 assert.match(home,/home-trust-discovery:has\(\+ \.spa-package-deals\) \{ padding-block-end:16px/);
 assert.match(home,/home-trust-discovery \+ \.spa-package-deals \{ padding-block-start:16px/);
});
test('article opening keeps balanced columns and readable long-title scale without clipping',()=>{
 assert.match(css,/\.magazine-article__hero \{[^}]*grid-template-columns: 1fr 1\.15fr;[^}]*gap: clamp\(24px,4vw,64px\)/);
 assert.match(css,/\.magazine-article__headline h1 \{[^}]*font-size: clamp\(2\.15rem,3\.7vw,3\.35rem\);[^}]*line-height: 1\.15/);
 assert.match(css,/\.magazine-article__headline h1 \{ font-size: 2rem; line-height: 1\.2/);
 assert.doesNotMatch(css,/\.magazine-article__headline h1[^}]*-webkit-line-clamp/);
});
