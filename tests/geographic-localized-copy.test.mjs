import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {localizedSpaSearchSource, spaSearchRegions, spaSearchAudiences, spaSearchTitle, spaSearchDescription} from '../app/data/spa-search-landings.ts';
import {spaLandings} from '../app/data/spa-landings.ts';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const visitor=JSON.parse(read('app/data/visitor-ui-translations.json'));
const dictionaries=Object.fromEntries(['en','fr','ru'].map(locale=>[locale,JSON.parse(read(`app/i18n/translations.${locale}.generated.json`))]));
const empty={en:{},fr:{},ru:{}};
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;

test('known metro semantic titles and descriptions localize every audience and feature',()=>{
  for(const region of spaSearchRegions.filter(r=>['haifa-carmel','tel-aviv-area'].includes(r.slug))) {
    for(const audience of [undefined,...spaSearchAudiences]) for(const feature of [undefined,...spaLandings]) {
      const state={region,audience,features:feature?[feature]:[]};
      for(const locale of ['en','fr','ru']) {
        for(const formatter of [spaSearchTitle,spaSearchDescription]) {
          const result=localizedSpaSearchSource(formatter(state),locale);
          assert.equal(result,formatter(state,locale));
          assert.doesNotMatch(result,/[\u0590-\u05ff]/);
        }
      }
    }
  }
  assert.equal(localizedSpaSearchSource('ספא בבית פרטי שאינו אזור מוכר','en'),undefined);
  assert.equal(localizedSpaSearchSource('ספא בתל אביב וגוש דן עם מאפיין מומצא','en'),undefined);
});

test('actual client dynamic counter and breadcrumb use reviewed geographic names',()=>{
  const source=read('app/i18n/locale-provider.tsx');
  const snippet=source.slice(source.indexOf('function translateDynamic('),source.indexOf('\nfunction translateValue('));
  const translate=new Function('visitorUiTranslations','finalUiTranslations','curatedTranslations','dictionary','translateValue',compile(snippet)+'\nreturn translateDynamic;')(visitor,empty,empty,locale=>dictionaries[locale],(v)=>v);
  for(const locale of ['en','fr','ru']) for(const label of ['חיפה והכרמל','תל אביב וגוש דן']) {
    const expected=visitor[label]?.[locale] || dictionaries[locale][label];
    assert.ok(translate('51 בתי ספא ב'+label,locale).includes(expected));
    assert.ok(translate('ספא ב'+label,locale).includes(expected));
    assert.doesNotMatch(translate('51 בתי ספא ב'+label,locale),/[\u0590-\u05ff]/);
  }
});

test('actual server metadata translates semantic spa headline before appending brand',()=>{
  const source=read('worker/index.ts');
  const snippet=source.slice(source.indexOf('function translateServerText('),source.indexOf('\nfunction localizeStructuredUrl('));
  const translate=new Function('visitorUiTranslations','serverTranslations','localizedSpaSearchSource',compile(snippet)+'\nreturn translateServerText;')(visitor,empty,localizedSpaSearchSource);
  for(const locale of ['en','fr','ru']) {
    const state={region:spaSearchRegions.find(r=>r.slug==='tel-aviv-area'),features:[spaLandings.find(f=>f.id==='couples')]};
    assert.equal(translate(spaSearchTitle(state)+' | וי פור ויקיישן',locale),spaSearchTitle(state,locale)+' | VII Vacation');
    assert.equal(translate(spaSearchDescription(state),locale),spaSearchDescription(state,locale));
  }
});

test('semantic brand handling preserves reviewed legacy full-title translations',()=>{
  const source=read('worker/index.ts');
  const snippet=source.slice(source.indexOf('function translateServerText('),source.indexOf('\nfunction localizeStructuredUrl('));
  const translate=new Function('visitorUiTranslations','serverTranslations','localizedSpaSearchSource',compile(snippet)+'\nreturn translateServerText;')(visitor,dictionaries,localizedSpaSearchSource);
  for(const locale of ['en','fr','ru']) {
    const title='הצטרפות לוי פור ויקיישן, ספא וטיפולים | וי פור ויקיישן';
    assert.equal(translate(title,locale),dictionaries[locale][title]);
    assert.equal(translate('כותרת לא מוכרת | וי פור ויקיישן',locale),'כותרת לא מוכרת | וי פור ויקיישן');
  }
});

test('actual vacation metadata owns its OG fields and reviewed metro descriptions in every locale',async()=>{
  const source=read('app/components/vacation-landing-route.tsx');
  const snippet=source.slice(source.indexOf('export async function vacationLandingMetadata('),source.indexOf('\nexport async function VacationLandingRoute(')).replace('export async','async');
  const regions={haifa:{slug:'haifa-carmel',label:'חיפה והכרמל'},dan:{slug:'tel-aviv-area',label:'תל אביב וגוש דן'}};
  const metadata=new Function('vacationRegionBySlug','publicCatalogSummaries','vacationRegionListings',compile(snippet)+'\nreturn vacationLandingMetadata;')(id=>regions[id],async()=>[{}],()=>[{}]);
  for(const id of ['haifa','dan']) {
    const result=await metadata(id);
    assert.equal(result.openGraph.title,result.title);
    assert.equal(result.openGraph.description,result.description);
    assert.equal(result.openGraph.url,result.alternates.canonical);
    for(const locale of ['en','fr','ru']) {
      assert.ok(visitor[result.title][locale]);
      assert.doesNotMatch(visitor[result.description][locale],/[\u0590-\u05ff]/);
    }
  }
});
