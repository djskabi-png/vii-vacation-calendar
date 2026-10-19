import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('popular searches has one centered heading and preserves all managed quick links',()=>{
 const source=read('app/components/home-discovery-sections.tsx');
 assert.doesNotMatch(source,/קיצורי דרך|home-popular-rail/);
 assert.match(source,/<Search aria-hidden="true" \/><h2 id="home-popular-searches-title">חיפושים פופולריים/);
 assert.match(source,/presentation\.popular\.map/);
 assert.match(source,/href=\{item\.href\}/);
 assert.match(source,/home-city-rail/);assert.match(source,/home-type-rail/);
 assert.match(read('app/globals.css'),/\.home-visual-searches__head\s*\{[^}]*justify-content:\s*center/);
});
test('world openings retain H1, intro, search, breadcrumbs and truthful imagery without slogan stacking',()=>{
 const hero=read('app/components/discovery-world-hero.tsx');
 assert.doesNotMatch(hero,/className="discovery-world-hero__eyebrow"/);
 for(const text of ['<h1>{presentation.title}</h1>','{presentation.description}','<BreadcrumbTrail','<WorldTopicImage','{children}'])assert.ok(hero.includes(text),text);
 assert.doesNotMatch(read('app/components/world-landing.tsx'),/>הפסקה טובה מתחילה כאן</);
 assert.doesNotMatch(read('app/events/page.tsx'),/className="events-hero__eyebrow"/);
 assert.match(read('app/events/page.tsx'),/<SearchBox mode="events"/);
});
test('search-depth keeps useful SEO, FAQs, reviews, semantic related links and image disclosures',()=>{
 const source=read('app/components/search-after-results.tsx');
 assert.doesNotMatch(source,/<span className="eyebrow">\{(?:content|discovery)\.eyebrow\}<\/span>|<p>\{discovery\.intro\}<\/p>/);
 for(const text of ['faqSchema(content.faqs)','content.paragraphs.map','content.faqs.map','reviews.map','discovery.title','regionLinks','cityLinks','typeLinks','smartLinks','trailLinks','providerLinks','Illustrative image'])assert.ok(source.includes(text),text);
});
test('declutter does not remove article facts, gallery disclosures or trail safety',()=>{
 const article=read('app/guides/article/client-page.tsx');
 for(const text of ['article.category','article.dateLabel','article.readTime','EditorialIllustrationLabel','article.checklist.map','toggleChecklist'])assert.ok(article.includes(text),text);
 const trail=read('app/trails/[slug]/page.tsx');
 for(const text of ['trail.safety.map','trail.sourceName','המידע אינו אישור שהמסלול פתוח כרגע','trail.dayPlan.map'])assert.ok(trail.includes(text),text);
 const home=read('app/components/home-showcase.tsx');assert.match(home,/\{video.note\}/);
 const detail=read('app/business/client-page.tsx');assert.match(detail,/חדרי שינה אינם יחידות אירוח/);
});
