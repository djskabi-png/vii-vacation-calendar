import test from 'node:test';
import assert from 'node:assert/strict';
import {localizedSpaPackageTitle,spaDealPeople} from '../app/i18n/localized-spa-package.ts';
const facts={title:'חבילה זוגית הכוללת עיסוי ראש יפני למשך 45 דקות, ארוחת בוקר ושימוש במתקני הספא',durationMinutes:45,people:2};
test('new supplier titles use only stated facts without Hebrew leakage in3locales',()=>{for(const lang of ['en','fr','ru']){const title=localizedSpaPackageTitle(facts,lang,x=>x);assert.doesNotMatch(title,/[\u0590-\u05ff]/);assert.match(title,/45/);assert.ok(title.length>30);}assert.equal(localizedSpaPackageTitle(facts,'he',x=>x),facts.title);});
test('full reviewed translation preserved and partial broken output rejected',()=>{assert.equal(localizedSpaPackageTitle(facts,'en',()=> 'Reviewed exact title'),'Reviewed exact title');assert.doesNotMatch(localizedSpaPackageTitle(facts,'fr',()=> 'Spa חבילה'),/[\u0590-\u05ff]/);});
test('unknown treatment is not invented as massage and unknown count not invented',()=>{assert.equal(localizedSpaPackageTitle({title:'חבילת פינוק',durationMinutes:null,people:null},'en',x=>x),'Spa package');});
test('guest labels native singular and Russian plural',()=>{assert.equal(spaDealPeople(1,'he'),'1 אורח');assert.equal(spaDealPeople(1,'en'),'1 guest');assert.equal(spaDealPeople(2,'ru'),'2 гостя');assert.equal(spaDealPeople(5,'ru'),'5 гостей');});
