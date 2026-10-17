import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
test('hourly public projection normalizes imported currency without changing amounts or supplier source',()=>{
  const source=readFileSync(new URL('../app/data/world-data.ts',import.meta.url),'utf8');
  const projection=source.split('export const hourlyPlacesFromCatalog = ')[1].split('export const hourlyPlaces:')[0];
  const compiled=stripTypeScriptTypes(`const build = ${projection}`,{mode:'strip'});
  const build=new Function('supplierContactNumber',`${compiled};return build;`)(value=>value);
  const place={id:'hourly-test',name:'Test',location:'City',area:'Area',description:'שעה ב־120 ש״ח, שעתיים ב־200 ש"ח.',rooms:[],images:[]};
  assert.equal(build([place])[0].description,'שעה ב־120 ₪, שעתיים ב־200 ₪.');
  assert.equal(place.description,'שעה ב־120 ש״ח, שעתיים ב־200 ש"ח.');
  assert.ok(build([{...place,description:undefined}])[0].description.length>5);
});
