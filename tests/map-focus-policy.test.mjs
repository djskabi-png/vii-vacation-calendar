import test from 'node:test';
import assert from 'node:assert/strict';
import {keepMapFocusInViewport} from '../app/lib/map-focus-policy.ts';

test('map control and pointer refocus preserve keyboard focus without moving the document',()=>{
  let y=1473,focused=false;const calls=[];
  const element={focus(options){focused=true;calls.push(options);if(!options?.preventScroll)y=1727;}};
  const original=element.focus,restore=keepMapFocusInViewport(element);
  element.focus();element.focus({preventScroll:false});
  assert.equal(focused,true);assert.equal(y,1473);assert.ok(calls.every(options=>options.preventScroll===true));
  restore();assert.equal(element.focus,original);element.focus();assert.equal(y,1727);
});
test('map cleanup cannot overwrite a later focus owner',()=>{
  const element={focus(){}};const restore=keepMapFocusInViewport(element);const next=()=>{};
  element.focus=next;restore();assert.equal(element.focus,next);
});
